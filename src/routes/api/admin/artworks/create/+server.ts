import { prismaRead, prismaWrite } from '$lib/prisma';
import { uploadToPinata } from '$lib/pinataHelpers';
import { convertToIpfsUrl } from '$lib/pinataHelpers';
import slugify from 'slugify';
import { Prisma } from '@prisma/client';
import { cachedArtworkQueries } from '$lib/cache/db-cache.js';

// Simple function to guess mime type from URL
function guessMimeTypeFromUrl(url: string): string | null {
	if (!url) return null;
	const extension = url.split('.').pop()?.toLowerCase();
	if (!extension) return null;
	const commonTypes: Record<string, string> = {
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		gif: 'image/gif',
		webp: 'image/webp',
		svg: 'image/svg+xml',
		mp4: 'video/mp4',
		webm: 'video/webm',
		mov: 'video/quicktime',
		ogv: 'video/ogg',
		gltf: 'model/gltf+json',
		glb: 'model/gltf-binary',
		html: 'text/html',
		htm: 'text/html',
		pdf: 'application/pdf'
	};
	return commonTypes[extension] || null;
}

export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File | null;
		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		const curatorNotes = formData.get('curatorNotes') as string;

		// Media URLs from form
		const form_image_url = formData.get('image_url') as string | null;
		const form_animation_url = formData.get('animation_url') as string | null;
		const form_mime_type = formData.get('mime') as string | null;

		// Creator related form fields
		const creatorAddress = formData.get('creatorAddress') as string | null;
		const creatorBlockchain = (formData.get('creatorBlockchain') as string) || 'ethereum';
		const newArtistName = formData.get('newArtistName') as string | null;

		// Collection related form fields
		let collectionIdStr = formData.get('collectionId') as string | null;
		const newCollectionTitle = formData.get('newCollectionTitle') as string | null;

		let final_image_url: string | null = null;
		let image_mime_type: string | null = null;
		let image_dimensions: { width: number; height: number } | null = null;
		let final_animation_url: string | null = form_animation_url;
		let animation_mime_type: string | null = null;
		let fileSize: number | null = null;

		if (file && file instanceof File) {
			if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
				return new Response(JSON.stringify({ error: `Unsupported media type: ${file.type}` }), {
					status: 400
				});
			}
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			fileSize = buffer.length;

			const uploadResponse = await uploadToPinata(buffer, file.name, file.type);
			if (!uploadResponse) {
				return new Response(JSON.stringify({ error: 'Failed to upload to Pinata.' }), {
					status: 500
				});
			}
			final_image_url = uploadResponse.url;
			image_mime_type = uploadResponse.fileType;
			image_dimensions = uploadResponse.dimensions;

			if (
				(image_mime_type.startsWith('video/') || image_mime_type === 'image/gif') &&
				!final_animation_url
			) {
				final_animation_url = final_image_url;
				animation_mime_type = image_mime_type;
			}
		} else if (form_image_url) {
			final_image_url = form_image_url;
			image_mime_type = guessMimeTypeFromUrl(final_image_url);
		}

		if (final_animation_url && !animation_mime_type) {
			animation_mime_type = guessMimeTypeFromUrl(final_animation_url);
		}

		// Override mime type with form value if provided
		if (form_mime_type && form_mime_type.trim() !== '') {
			image_mime_type = form_mime_type;
		}

		let artistId: number | undefined;
		if (creatorAddress) {
			if (newArtistName) {
				// Create new artist with the provided name and wallet address
				const walletAddresses = [{
					address: creatorAddress,
					blockchain: creatorBlockchain,
					lastIndexed: new Date().toISOString()
				}];

				const newArtist = await prismaWrite.artist.create({ 
					data: { 
						name: newArtistName,
						walletAddresses: walletAddresses as any,
						updatedAt: new Date()
					} 
				});
				artistId = newArtist.id;
			} else {
				// Find or create artist using wallet address
				const artistName = `Artist_${creatorAddress.slice(-8)}`;
				
				// First, search all artists to find one with this wallet address
				let artist: any = null;
				const allArtists: any[] = await prismaRead.artist.findMany();

				// Check if any artist has this wallet address
				artist = allArtists.find(a => {
					if (!a.walletAddresses || !Array.isArray(a.walletAddresses)) return false;
					return (a.walletAddresses as any[]).some((w: any) => 
						w.address === creatorAddress
					);
				}) || null;

				if (!artist) {
					// Try to find by exact name match as fallback
					try {
						artist = await prismaRead.artist.findUnique({
							where: { name: artistName }
						});
					} catch (error) {
						// Ignore errors from name lookup
					}
				}

				if (!artist) {
					// Create new artist with wallet address
					const walletAddresses = [{
						address: creatorAddress,
						blockchain: creatorBlockchain,
						lastIndexed: new Date().toISOString()
					}];

					// Try to create with the base name first, handle conflicts
					let finalArtistName = artistName;
					let createAttempts = 0;
					const maxAttempts = 5;

					while (createAttempts < maxAttempts) {
						try {
							artist = await prismaWrite.artist.create({
								data: {
									name: finalArtistName,
									walletAddresses: walletAddresses as any,
									updatedAt: new Date()
								}
							});
							break; // Success, exit the loop
						} catch (error: any) {
							if (error?.code === 'P2002' && error?.meta?.target?.includes('name')) {
								// Name conflict, try with a unique suffix
								createAttempts++;
								const timestamp = Date.now().toString().slice(-6);
								finalArtistName = `${artistName}_${timestamp}`;
								console.log(`[ARTIST_CREATE] Name conflict for "${artistName}", trying "${finalArtistName}"`);
							} else {
								throw error; // Re-throw non-name-conflict errors
							}
						}
					}

					if (!artist) {
						throw new Error(`Failed to create artist after ${maxAttempts} attempts due to name conflicts`);
					}
				} else {
					// Update existing artist and merge wallet addresses if needed
					const existingWallets = Array.isArray(artist.walletAddresses) ? artist.walletAddresses as any[] : [];
					const addressExists = existingWallets.some((w: any) => 
						w.address === creatorAddress
					);
					
					if (!addressExists) {
						const updatedWallets = [...existingWallets, {
							address: creatorAddress,
							blockchain: creatorBlockchain,
							lastIndexed: new Date().toISOString()
						}];

						artist = await prismaWrite.artist.update({
							where: { id: artist.id },
							data: {
								updatedAt: new Date(),
								walletAddresses: updatedWallets as any
							}
						});
					}
				}

				artistId = artist.id;
			}
		}

		let collectionId: number | undefined;
		if (collectionIdStr) {
			collectionId = parseInt(collectionIdStr);
		} else if (newCollectionTitle) {
			const collectionSlug = slugify(newCollectionTitle, { lower: true, strict: true });
			const newCollection = await prismaWrite.collection.create({
				data: {
					title: newCollectionTitle,
					slug: collectionSlug,
					enabled: true
				}
			});
			collectionId = newCollection.id;
		}

		const mediaMetadata: any = {};
		if (image_dimensions) mediaMetadata.image_dimensions = image_dimensions;
		if (fileSize) mediaMetadata.file_size_bytes = fileSize;
		if (final_image_url) mediaMetadata.source_image_uri = final_image_url;

		if (final_animation_url) {
			mediaMetadata.source_animation_uri = final_animation_url;
			if (animation_mime_type) mediaMetadata.animation_mime_type = animation_mime_type;
			if (final_animation_url === final_image_url && image_dimensions) {
				mediaMetadata.animation_dimensions = image_dimensions;
			}
		}

		const newArtworkData: Prisma.ArtworkCreateInput = {
			title: title ? String(title) : 'Untitled',
			description: description ? String(description) : '',

			imageUrl: final_image_url ? convertToIpfsUrl(final_image_url) : final_image_url,
			animationUrl: final_animation_url ? convertToIpfsUrl(final_animation_url) : final_animation_url,
			mime: image_mime_type,

			tokenId: formData.get('tokenID') as string | null,
			contractAddress: formData.get('contractAddr') as string | null,
			blockchain: formData.get('blockchain') as string | null,
			mintDate: formData.get('mintDate') ? new Date(formData.get('mintDate') as string) : null
		};

		if (collectionId) {
			newArtworkData.Collection = { connect: { id: collectionId } };
		}

		const newArtwork = await prismaWrite.artwork.create({
			data: newArtworkData
		});

		// Invalidate artwork-related cache after creation
		await cachedArtworkQueries.invalidate();

		// Link artist to artwork if we have one
		if (artistId) {
			try {
				await prismaWrite.artwork.update({
					where: { id: newArtwork.id },
					data: {
						Artist: {
							connect: { id: artistId }
						}
					} as any
				});
			} catch (e) {
				console.error(`Error linking artwork ${newArtwork.id} to artist ${artistId}:`, e);
			}
		}

		// Pin artwork URLs to Pinata
		try {
			const artworkForPinning = {
				title: newArtwork.title,
				imageUrl: final_image_url,
				thumbnailUrl: null, // This endpoint doesn't seem to handle thumbnails
				animationUrl: final_animation_url,
				metadataUrl: null // This endpoint doesn't seem to handle metadata URLs
			};
			
			const { extractCidsFromArtwork, pinCidToPinata } = await import('$lib/pinataHelpers');
			const cids = extractCidsFromArtwork(artworkForPinning);
			if (cids.length > 0) {
				console.log(`Pinning ${cids.length} IPFS URLs for artwork: ${newArtwork.title}`);
				
				for (const cid of cids) {
					try {
						const pinName = `${newArtwork.title} - ${cid}`;
						await pinCidToPinata(cid, pinName);
						console.log(`Successfully pinned CID: ${cid} for artwork: ${newArtwork.title}`);
					} catch (pinError) {
						console.error(`Failed to pin CID ${cid} for artwork ${newArtwork.title}:`, pinError);
						// Continue with other CIDs even if one fails
					}
				}
			}
		} catch (pinningError) {
			console.error(`Error during Pinata pinning for artwork ${newArtwork.title}:`, pinningError);
			// Don't fail the creation if pinning fails
		}

		return new Response(JSON.stringify(newArtwork), {
			status: 201,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error: unknown) {
		console.error('Error in POST request for artwork creation:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (error instanceof Error && error.stack) {
			console.error(error.stack);
		}
		return new Response(
			JSON.stringify({ error: 'Error creating new artwork', details: errorMessage }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
