import { prismaRead, prismaWrite } from '$lib/prisma';
import { Prisma } from '@prisma/client';
import { cachedArtworkQueries } from '$lib/cache/db-cache.js';

// Simple function to guess mime type from URL
function guessMimeTypeFromUrl(url: string): string | null {
	// Check extensions
	if (url.match(/\.(mp4|webm|mov)$/i)) return 'video/mp4';
	if (url.match(/\.(jpg|jpeg)$/i)) return 'image/jpeg';
	if (url.match(/\.(png)$/i)) return 'image/png';
	if (url.match(/\.(gif)$/i)) return 'image/gif';
	if (url.match(/\.(webp)$/i)) return 'image/webp';
	if (url.match(/\.(svg)$/i)) return 'image/svg+xml';
	if (url.match(/\.(pdf)$/i)) return 'application/pdf';
	if (url.match(/\.(html|htm)$/i)) return 'text/html';
	if (url.match(/\.(js)$/i)) return 'application/javascript';

	// Check for common patterns
	if (url.includes('cloudinary.com')) {
		if (url.includes('/video/')) return 'video/mp4';
		if (url.includes('/image/')) return 'image/jpeg';
	}

	// For common interactive art platforms
	if (url.includes('fxhash.xyz') || url.includes('generator.artblocks.io')) {
		return 'application/javascript';
	}

	return null;
}

// GET: Fetch Artwork Details
export async function GET({ params }) {
	const { id } = params;
	const artwork = await prismaRead.artwork.findUnique({
		where: { id: parseInt(id, 10) },
		include: {
			Collection: true,
			Artist: true
		}
	});

	if (!artwork) {
		return new Response(JSON.stringify({ error: 'Artwork not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const transformedArtwork = {
		...artwork,
		tokenID: artwork.tokenId,
		contractAddr: artwork.contractAddress,
		artists: artwork.Artist || [],
		artist: artwork.Artist && artwork.Artist.length > 0 ? artwork.Artist[0] : null,
		collection: artwork.Collection
	};

	return new Response(JSON.stringify(transformedArtwork), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

// PUT: Update Artwork Details
export async function PUT({ params, request }) {
	const { id } = params;
	const artworkId = parseInt(id, 10);

	// Explicitly type the expected request body for clarity and safety
	interface ArtworkUpdateRequestData {
		title?: string;
		description?: string;
		enabled?: boolean;
		collectionId?: number | null;
		image_url?: string | null;
		animation_url?: string | null;
		thumbnail_url?: string | null;
		generator_url?: string | null;
		mime?: string | null; // Mime type of the image_url
		mediaMetadata?: Prisma.InputJsonValue | null; // Expect mediaMetadata as a JSON object
		metadataUrl?: string | null;
		externalUrl?: string | null;
		creatorAddress?: string | null; // Raw creator address string
		walletAddressId?: number | null; // ID of the WalletAddress record to link
		artistIds?: number[]; // Array of artist IDs to associate with the artwork
		tags?: string[]; // Assuming tags are an array of strings
		attributes?: Prisma.InputJsonValue | null;
		tokenID?: string;
		contractAddr?: string;
		blockchain?: string;
		tokenStandard?: string;
		mintDate?: string | Date | null;
		curatorNotes?: string;
		supply?: number;
		dimensions?: { width: number; height: number } | null;
		fullscreen?: boolean;
	}

	const requestData = (await request.json()) as ArtworkUpdateRequestData;

	try {
		const updateData: Prisma.ArtworkUpdateInput = {};

		// Map known, direct fields
		if (requestData.title !== undefined) updateData.title = requestData.title;
		if (requestData.description !== undefined) updateData.description = requestData.description;

		// Media URLs and main mime type
		if (requestData.image_url !== undefined) updateData.imageUrl = requestData.image_url;
		if (requestData.animation_url !== undefined)
			updateData.animationUrl = requestData.animation_url;
		if (requestData.thumbnail_url !== undefined)
			updateData.thumbnailUrl = requestData.thumbnail_url;
		if (requestData.generator_url !== undefined)
			updateData.generatorUrl = requestData.generator_url;
		if (requestData.mime !== undefined) updateData.mime = requestData.mime; // Mime of image_url

		// External URLs and identifiers
		if (requestData.metadataUrl !== undefined) updateData.metadataUrl = requestData.metadataUrl;
		if (requestData.tokenID !== undefined) updateData.tokenId = requestData.tokenID;
		if (requestData.contractAddr !== undefined)
			updateData.contractAddress = requestData.contractAddr;
		if (requestData.blockchain !== undefined) updateData.blockchain = requestData.blockchain;
		if (requestData.tokenStandard !== undefined)
			updateData.tokenStandard = requestData.tokenStandard;
		if (requestData.supply !== undefined) updateData.supply = requestData.supply;

		if (requestData.mintDate !== undefined) {
			updateData.mintDate = requestData.mintDate ? new Date(requestData.mintDate) : null;
		}

		// Attributes (assuming they are JSON or arrays compatible with schema)
		if (requestData.attributes !== undefined) {
			updateData.attributes =
				requestData.attributes === null ? Prisma.JsonNull : requestData.attributes;
		}

		// Dimensions
		if (requestData.dimensions !== undefined) {
			updateData.dimensions =
				requestData.dimensions === null ? Prisma.JsonNull : requestData.dimensions;
		}

		// Fullscreen
		if (requestData.fullscreen !== undefined) updateData.fullscreen = requestData.fullscreen;

		// Collection linking
		if (requestData.collectionId !== undefined) {
			updateData.Collection = requestData.collectionId
				? { connect: { id: requestData.collectionId } }
				: { disconnect: true };
		}

		// Artist linking - direct many-to-many relationship
		if (requestData.artistIds !== undefined) {
			if (requestData.artistIds.length > 0) {
				// Connect the artwork directly to the specified artists
				updateData.Artist = {
					set: requestData.artistIds.map(id => ({ id }))
				};
			} else {
				// Disconnect all artists if empty array
				updateData.Artist = { set: [] };
			}
		}

		// Automatically update lastSyncedAt (not in Artwork model)
		// updateData.lastSyncedAt = new Date();

		const updatedArtwork = await prismaWrite.artwork.update({
			where: { id: artworkId },
			data: updateData,
			include: {
				Collection: true,
				Artist: true
			}
		});

		// Invalidate artwork-related cache
		await cachedArtworkQueries.invalidate(artworkId, updatedArtwork.uid || undefined);

		// Pin any new IPFS URLs to Pinata
		try {
			const artworkForPinning = {
				title: updatedArtwork.title,
				imageUrl: updatedArtwork.imageUrl,
				thumbnailUrl: updatedArtwork.thumbnailUrl,
				animationUrl: updatedArtwork.animationUrl,
				generatorUrl: updatedArtwork.generatorUrl,
				metadataUrl: updatedArtwork.metadataUrl
			};
			
			const { extractCidsFromArtwork, pinCidToPinata } = await import('$lib/pinataHelpers');
			const cids = extractCidsFromArtwork(artworkForPinning);
			if (cids.length > 0) {
				console.log(`Pinning ${cids.length} IPFS URLs for updated artwork: ${updatedArtwork.title}`);
				
				for (const cid of cids) {
					try {
						const pinName = `${updatedArtwork.title} - ${cid}`;
						await pinCidToPinata(cid, pinName);
						console.log(`Successfully pinned CID: ${cid} for artwork: ${updatedArtwork.title}`);
					} catch (pinError) {
						console.error(`Failed to pin CID ${cid} for artwork ${updatedArtwork.title}:`, pinError);
						// Continue with other CIDs even if one fails
					}
				}
			}
		} catch (pinningError) {
			console.error(`Error during Pinata pinning for updated artwork ${updatedArtwork.title}:`, pinningError);
			// Don't fail the update if pinning fails
		}

		// Transform for consistent response with GET
		const transformedResponse = {
			...updatedArtwork,
			tokenID: updatedArtwork.tokenId,
			contractAddr: updatedArtwork.contractAddress,
			artists: updatedArtwork.Artist || [],
			artist: updatedArtwork.Artist && updatedArtwork.Artist.length > 0 ? updatedArtwork.Artist[0] : null,
			collection: updatedArtwork.Collection
		};

		// Update the artwork index to reflect changes in the normalized data
		try {
			const { indexArtwork } = await import('$lib/artworkIndexer');
			await indexArtwork(updatedArtwork.id);
			console.log(`[artworkUpdate] Updated index for artwork ${updatedArtwork.id}`);
		} catch (indexError) {
			console.error(`[artworkUpdate] Error updating index for artwork ${updatedArtwork.id}:`, indexError);
			// Don't fail the update if indexing fails
		}

		return new Response(JSON.stringify(transformedResponse), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error: any) {
		console.error(`Error updating artwork ${artworkId}:`, error);
		const errorMessage = error.message || 'Unknown error';
		// Check for Prisma-specific errors if needed (e.g., P2025 Record to update not found)
		if (error.code === 'P2025') {
			return new Response(
				JSON.stringify({ error: 'Artwork not found to update.', details: errorMessage }),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}
		return new Response(
			JSON.stringify({ error: 'Failed to update artwork.', details: errorMessage }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}

// DELETE: Delete Artwork
export async function DELETE({ params }) {
	const { id } = params;

	try {
		// First, get the artwork to unpin its files
		const artwork = await prismaRead.artwork.findUnique({
			where: { id: parseInt(id, 10) }
		});

		if (!artwork) {
			return new Response(
				JSON.stringify({ error: 'Artwork not found' }),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// Unpin files from Pinata before deleting
		try {
			const { unpinArtworkCids } = await import('$lib/pinataHelpers');
			await unpinArtworkCids({
				title: artwork.title,
				imageUrl: artwork.imageUrl,
				thumbnailUrl: artwork.thumbnailUrl,
				animationUrl: artwork.animationUrl,
				metadataUrl: artwork.metadataUrl
			});
			console.log(`Unpinned files for artwork: ${artwork.title}`);
		} catch (unpinError) {
			console.error('Error unpinning artwork files:', unpinError);
			// Continue with deletion even if unpinning fails
		}

		// Disconnect any associated ArtworkIndex records instead of deleting them
		// This preserves the indexing data while breaking the connection
		// and marks them as pending for potential re-import
		try {
			const updatedIndexRecords = await prismaWrite.artworkIndex.updateMany({
				where: { artworkId: parseInt(id, 10) },
				data: { 
					artworkId: null,
					importStatus: 'pending'
				}
			});
			if (updatedIndexRecords.count > 0) {
				console.log(`Disconnected ${updatedIndexRecords.count} ArtworkIndex record(s) from artwork: ${artwork.title} and marked as pending for re-import`);
			}
		} catch (indexUpdateError) {
			console.error('Error disconnecting ArtworkIndex records:', indexUpdateError);
			// Continue with artwork deletion even if index update fails
		}

		// Delete the artwork
		await prismaWrite.artwork.delete({
			where: { id: parseInt(id, 10) }
		});

		// Invalidate artwork-related cache
		await cachedArtworkQueries.invalidate(parseInt(id, 10), artwork.uid || undefined);

		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Error deleting artwork:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return new Response(
			JSON.stringify({ error: 'Error deleting artwork', details: errorMessage }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}

function isCloudinaryUrl(url: string): boolean {
	return url.includes('cloudinary.com');
}
