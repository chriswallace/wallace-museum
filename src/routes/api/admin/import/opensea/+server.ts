import prisma from '$lib/prisma.js';
import { json } from '@sveltejs/kit';
import { normalizeOpenSeaMetadata, handleMediaUpload } from '$lib/mediaHelpers';
import { fetchMetadata } from '$lib/openseaHelpers.js';
import { processArtist, processCollection, saveArtwork } from '$lib/adminOperations.js';
import { isVideo, isImage } from '$lib/utils';
import { syncCollection } from '$lib/collectionSync';

interface Dimensions {
	width: number;
	height: number;
}

// const DEFAULT_DIMENSIONS: Dimensions = {
// 	width: 1000,
// 	height: 1000
// };

export const POST = async ({ request }) => {
	try {
		const { nfts } = await request.json();

		if (!Array.isArray(nfts) || nfts.length === 0) {
			return json({ error: 'No NFTs provided for import.' }, { status: 400 });
		}

		const importPromises = nfts.map(async (nft) => {
			// Fetch metadata if available
			let fetchedMetadata = null;
			if (nft.metadata_url) {
				try {
					fetchedMetadata = await fetchMetadata(nft.metadata_url);
					if (fetchedMetadata) {
						nft.metadata = fetchedMetadata;
					}
				} catch (error) {
					console.warn(`[OS_IMPORT] Failed to fetch metadata for NFT ${nft.identifier}:`, error);
				}
			}

			const artistInfo = {
				username:
					nft.artist?.username ||
					nft.metadata?.artist ||
					nft.creator ||
					nft.metadata?.creator?.name ||
					nft.metadata?.creator,
				address:
					nft.artist?.address ||
					nft.creator ||
					nft.metadata?.creator?.address ||
					nft.creator_address,
				blockchain: nft.collection?.blockchain?.toLowerCase() || 'ethereum',
				bio: nft.metadata?.creator?.bio || nft.metadata?.creator?.description,
				avatarUrl: nft.metadata?.creator?.image || nft.metadata?.creator?.avatar,
				website: nft.metadata?.creator?.website || nft.metadata?.creator?.external_url,
				social_media_accounts: {
					twitter: nft.metadata?.creator?.twitter || '',
					instagram: nft.metadata?.creator?.instagram || ''
				}
			};

			// Process artist with complete info
			const artist = await processArtist(artistInfo);

			// If no valid artist was found or created, continue without artist association
			if (!artist) {
				console.warn('[OS_IMPORT] No valid artist found for NFT:', nft.identifier);
			}

			// Sync collection from OpenSea
			const collection = await syncCollection(
				nft.collection?.slug || nft.collection?.contract || nft.contractAddr,
				'opensea'
			);

			// Process media URLs
			let finalImageUrl = '';
			let finalAnimationUrl = '';
			let finalGeneratorUrl = '';
			// Try to get an initial MIME type from the NFT data itself (OpenSea might provide it)
			let finalMime = nft.mime || nft.mime_type || '';
			let finalDimensions = null; // We'll get dimensions from Cloudinary uploads

			// Helper to determine if a MIME type is generic (application/octet-stream or empty)
			const isMimeEffectivelyGeneric = (mime: string) =>
				!mime || mime === 'application/octet-stream';

			try {
				// First check for generator URL (these are typically primary interactive content)
				if (nft.metadata?.generator_url) {
					finalGeneratorUrl = nft.metadata.generator_url;
					// Only set to text/html if no specific mime was already provided by OpenSea or if it was generic
					if (isMimeEffectivelyGeneric(finalMime) || finalMime === 'text/html') {
						finalMime = 'text/html';
						console.log(
							`[OS_IMPORT] MIME set to text/html from generator_url: ${finalGeneratorUrl}`
						);
					}
				}

				// Process animation_url if available and no generator URL has taken precedence for the primary content
				if (nft.metadata?.animation_url && !finalGeneratorUrl) {
					console.log(`[OS_IMPORT] Processing animation_url: ${nft.metadata.animation_url}`);
					const animationResult = await handleMediaUpload(nft.metadata.animation_url, nft);
					if (animationResult?.url) {
						finalAnimationUrl = animationResult.url;
						console.log(`[OS_IMPORT] Animation upload successful: ${finalAnimationUrl}`);

						// Update mime type if we got one from the upload and it's more specific or current is generic
						if (animationResult.fileType) {
							const newMime = animationResult.fileType;
							const currentMimeIsGeneric = isMimeEffectivelyGeneric(finalMime);
							const newMimeIsPrimaryContent =
								newMime.startsWith('video/') ||
								newMime.startsWith('text/') ||
								newMime.includes('javascript') ||
								newMime === 'application/pdf' ||
								newMime.startsWith('model/');
							const currentMimeIsImage = finalMime.startsWith('image/');

							if (currentMimeIsGeneric) {
								finalMime = newMime;
								console.log(`[OS_IMPORT] MIME updated from animation (was generic): ${finalMime}`);
							} else if (newMimeIsPrimaryContent && currentMimeIsImage) {
								finalMime = newMime;
								console.log(
									`[OS_IMPORT] MIME updated from animation (primary override image): ${finalMime}`
								);
							} else if (
								newMime !== finalMime &&
								finalMime === 'text/html' &&
								!newMimeIsPrimaryContent &&
								!newMime.startsWith('image/')
							) {
								finalMime = newMime;
								console.log(
									`[OS_IMPORT] MIME updated from animation (text/html override): ${finalMime}`
								);
							} else if (
								newMime !== finalMime &&
								!(
									(finalMime.startsWith('image/') ||
										finalMime.startsWith('video/') ||
										finalMime.startsWith('model/')) &&
									newMime === 'text/html'
								)
							) {
								finalMime = newMime;
								console.log(
									`[OS_IMPORT] MIME updated from animation (general difference): ${finalMime}`
								);
							}
						}

						// Update dimensions from animation if available
						if (animationResult.dimensions) {
							finalDimensions = animationResult.dimensions;
							console.log(
								`[OS_IMPORT] Got dimensions from animation upload: ${finalDimensions.width}x${finalDimensions.height}`
							);
						}
					} else {
						console.log(`[OS_IMPORT] Animation upload failed for: ${nft.metadata.animation_url}`);
					}
				}

				// Process image_url (full resolution or original)
				// This should run whether animation_url was processed or not, as it might be the primary image or a poster.
				const primaryImageUrl = nft.metadata?.image_url || nft.image_url || nft.image_original_url;
				if (primaryImageUrl) {
					console.log(`[OS_IMPORT] Processing full-resolution image_url: ${primaryImageUrl}`);
					const imageResult = await handleMediaUpload(primaryImageUrl, nft);
					if (imageResult?.url) {
						finalImageUrl = imageResult.url;
						console.log(`[OS_IMPORT] Full-resolution image upload successful: ${finalImageUrl}`);

						// Update mime type from image upload if it's an image type AND current finalMime is generic or text/html
						// This avoids overriding a primary video/interactive mime with a poster image's mime.
						if (imageResult.fileType?.startsWith('image/')) {
							if (isMimeEffectivelyGeneric(finalMime) || finalMime === 'text/html') {
								finalMime = imageResult.fileType;
								console.log(`[OS_IMPORT] Updated mime type from full-res image: ${finalMime}`);
							}
						} else if (imageResult.fileType && isMimeEffectivelyGeneric(finalMime)) {
							// If not an image, but current mime is generic, update (e.g. SVG served as application/xml initially)
							finalMime = imageResult.fileType;
							console.log(
								`[OS_IMPORT] Updated mime type from full-res (non-image, generic was placeholder): ${finalMime}`
							);
						}

						// Update dimensions from image upload if available and it seems primary or no dimensions yet
						if (imageResult.dimensions && (!finalDimensions || finalMime.startsWith('image/'))) {
							finalDimensions = imageResult.dimensions;
							console.log(
								`[OS_IMPORT] Got dimensions from full-resolution image: ${finalDimensions.width}x${finalDimensions.height}`
							);
						}
					} else {
						console.log(`[OS_IMPORT] Full-resolution image upload failed for: ${primaryImageUrl}`);
					}
				}

				// Fallback to display_image_url (often a thumbnail) if no full-resolution image was successfully processed.
				if (!finalImageUrl && nft.display_image_url) {
					console.log(
						`[OS_IMPORT] No full-res image, falling back to display_image_url: ${nft.display_image_url}`
					);
					const displayImageResult = await handleMediaUpload(nft.display_image_url, nft);
					if (displayImageResult?.url) {
						finalImageUrl = displayImageResult.url;
						console.log(`[OS_IMPORT] Display image upload successful: ${finalImageUrl}`);

						// Update mime type from display image only if current is generic or text/html.
						if (displayImageResult.fileType?.startsWith('image/')) {
							if (isMimeEffectivelyGeneric(finalMime) || finalMime === 'text/html') {
								finalMime = displayImageResult.fileType;
								console.log(`[OS_IMPORT] Updated mime type from display image: ${finalMime}`);
							}
						} else if (displayImageResult.fileType && isMimeEffectivelyGeneric(finalMime)) {
							finalMime = displayImageResult.fileType;
							console.log(
								`[OS_IMPORT] Updated mime type from display (non-image, generic was placeholder): ${finalMime}`
							);
						}

						// Update dimensions from display image upload if no dimensions yet
						if (displayImageResult.dimensions && !finalDimensions) {
							finalDimensions = displayImageResult.dimensions;
							console.log(
								`[OS_IMPORT] Got dimensions from display image: ${finalDimensions.width}x${finalDimensions.height}`
							);
						}
					} else {
						console.log(`[OS_IMPORT] Display image upload failed for: ${nft.display_image_url}`);
					}
				}

				// If mime is still generic, but we have a generator or animation URL that hints at HTML/JS, set it.
				if (isMimeEffectivelyGeneric(finalMime) || finalMime === 'application/octet-stream') {
					const interactiveUrl = finalGeneratorUrl || finalAnimationUrl;
					if (
						interactiveUrl &&
						(interactiveUrl.includes('fxhash') ||
							interactiveUrl.includes('artblocks') ||
							interactiveUrl.endsWith('.html') ||
							interactiveUrl.endsWith('.htm'))
					) {
						if (finalMime !== 'text/html') {
							finalMime = 'text/html';
							console.log(
								'[OS_IMPORT] Guessed mime type as text/html based on generator/animation_url structure'
							);
						}
					}
				}

				// Try to get dimensions from metadata if we still don't have them
				if (!finalDimensions) {
					if (nft.metadata?.image_details?.width && nft.metadata?.image_details?.height) {
						finalDimensions = {
							width: nft.metadata.image_details.width,
							height: nft.metadata.image_details.height
						};
						console.log(
							`[OS_IMPORT] Using dimensions from metadata.image_details: ${finalDimensions.width}x${finalDimensions.height}`
						);
					} else if (
						nft.metadata?.animation_details?.width &&
						nft.metadata?.animation_details?.height
					) {
						finalDimensions = {
							width: nft.metadata.animation_details.width,
							height: nft.metadata.animation_details.height
						};
						console.log(
							`[OS_IMPORT] Using dimensions from metadata.animation_details: ${finalDimensions.width}x${finalDimensions.height}`
						);
					}
				}
			} catch (error) {
				console.error('[OS_IMPORT] Error processing media:', error);
			}

			// Update metadata with final URLs
			const finalMetadata = {
				...nft.metadata,
				image_url: finalImageUrl || nft.metadata?.image_url,
				animation_url: finalAnimationUrl || nft.metadata?.animation_url,
				generator_url: finalGeneratorUrl || nft.metadata?.generator_url
			};

			console.log('[Final Metadata Before Save]', finalMetadata);
			console.log('[Final Dimensions Before Save]', finalDimensions);

			// Ensure collection contract is set before saving
			if (!nft.collection || !nft.collection.contract) {
				console.error(
					'[OS_IMPORT] Missing contract address for NFT:',
					nft.identifier || nft.tokenId || nft.tokenID
				);
				if (collection && collection.slug) {
					console.warn(
						'[OS_IMPORT] Using collection slug as contract address fallback:',
						collection.slug
					);
					nft.collection = {
						...(nft.collection || {}),
						contract: collection.slug,
						blockchain: nft.collection?.blockchain || 'ethereum'
					};
				} else {
					console.error('[OS_IMPORT] Cannot import NFT without contract address');
					return null;
				}
			}

			// Log the contract address being used
			console.log('[OS_IMPORT] Using contract address:', nft.collection.contract);

			// Save artwork with validated data
			const artwork = await saveArtwork(
				{
					...nft,
					metadata: finalMetadata,
					mime: finalMime,
					dimensions: finalDimensions,
					tokenID: nft.identifier || nft.tokenId || nft.tokenID,
					generator_url: finalGeneratorUrl
				},
				artist?.id || null,
				collection.id
			);

			// Only create artist relationships if we have an artist
			if (artist) {
				// Create artist-collection relationship
				await prisma.artistCollections.upsert({
					where: {
						artistId_collectionId: {
							artistId: artist.id,
							collectionId: collection.id
						}
					},
					update: {},
					create: {
						artistId: artist.id,
						collectionId: collection.id
					}
				});

				// Create artist-artwork relationship
				await prisma.artistArtworks.upsert({
					where: {
						artistId_artworkId: {
							artistId: artist.id,
							artworkId: artwork.id
						}
					},
					update: {},
					create: {
						artistId: artist.id,
						artworkId: artwork.id
					}
				});
			}

			return artwork;
		});

		// Filter out null results (skipped artworks) and wait for all promises
		const results = await Promise.all(importPromises);
		const successfulImports = results.filter((result) => result !== null);

		return json({
			success: true,
			message: `Import completed successfully. ${successfulImports.length} artworks imported.`,
			skipped: results.length - successfulImports.length
		});
	} catch (error) {
		console.error('[OS_IMPORT] Error processing request:', error);
		return json({ success: false, message: 'Server error occurred.' }, { status: 500 });
	}
};
