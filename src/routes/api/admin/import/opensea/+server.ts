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

			// If no valid artist was found or created, skip this artwork
			if (!artist) {
				console.warn('[OS_IMPORT] No valid artist found for NFT:', nft.identifier);
				return null;
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
			let finalMime = ''; // Start with no mime, let processing determine it.
			let finalDimensions = null; // We'll get dimensions from Cloudinary uploads
			
			try {
				// First check for generator URL
				if (nft.metadata?.generator_url) {
					finalGeneratorUrl = nft.metadata.generator_url;
					finalMime = 'text/html'; // Generator URLs are typically HTML
				}

				// Process animation_url if available and no generator URL
				if (nft.metadata?.animation_url && !finalGeneratorUrl) {
					console.log(`[OS_IMPORT] Processing animation_url: ${nft.metadata.animation_url}`);
					const animationResult = await handleMediaUpload(nft.metadata.animation_url, nft);
					if (animationResult?.url) {
						finalAnimationUrl = animationResult.url;
						console.log(`[OS_IMPORT] Animation upload successful: ${finalAnimationUrl}`);
						
						// Update mime type if we got one from the upload
						if (animationResult.fileType && (!finalMime || finalMime === 'application/octet-stream')) {
							finalMime = animationResult.fileType;
							console.log(`[OS_IMPORT] Updated mime type from animation: ${finalMime}`);
						}
						
						// Update dimensions from animation if available
						if (animationResult.dimensions) {
							finalDimensions = animationResult.dimensions;
							console.log(`[OS_IMPORT] Got dimensions from animation upload: ${finalDimensions.width}x${finalDimensions.height}`);
						}
					} else {
						console.log(`[OS_IMPORT] Animation upload failed for: ${nft.metadata.animation_url}`);
					}
				}

				// Prioritize full-resolution images from metadata or original URLs
				// First try image_url from metadata which is usually full resolution
				if (nft.metadata?.image_url || nft.image_url || nft.image_original_url) {
					// Use highest resolution image available
					const imageUrl = nft.metadata?.image_url || nft.image_url || nft.image_original_url;
					console.log(`[OS_IMPORT] Processing full-resolution image_url: ${imageUrl}`);
					const imageResult = await handleMediaUpload(imageUrl, nft);
					if (imageResult?.url) {
						finalImageUrl = imageResult.url;
						console.log(`[OS_IMPORT] Full-resolution image upload successful: ${finalImageUrl}`);
						
						// Update mime type if we got one from the upload, preferring image types
						if (imageResult.fileType?.startsWith('image/')) {
							if (!finalMime || finalMime === 'application/octet-stream' || finalMime === 'text/html') {
								finalMime = imageResult.fileType;
								console.log(`[OS_IMPORT] Updated mime type from image: ${finalMime}`);
							}
						} else if (imageResult.fileType && (!finalMime || finalMime === 'application/octet-stream')) {
							finalMime = imageResult.fileType;
							console.log(`[OS_IMPORT] Updated mime type from image: ${finalMime}`);
						}
						
						// Update dimensions from image upload if available
						if (imageResult.dimensions) {
							finalDimensions = imageResult.dimensions;
							console.log(`[OS_IMPORT] Got dimensions from full-resolution image: ${finalDimensions.width}x${finalDimensions.height}`);
						}
					} else {
						console.log(`[OS_IMPORT] Full-resolution image upload failed for: ${imageUrl}`);
					}
				}

				// Only fallback to display_image_url if we couldn't get a full-resolution image
				// display_image_url is often a lower resolution thumbnail from OpenSea
				if (!finalImageUrl && nft.display_image_url) {
					console.log(`[OS_IMPORT] No full-res image available, falling back to display_image_url: ${nft.display_image_url}`);
					const displayImageResult = await handleMediaUpload(nft.display_image_url, nft);
					if (displayImageResult?.url) {
						finalImageUrl = displayImageResult.url;
						console.log(`[OS_IMPORT] Display image upload successful: ${finalImageUrl}`);
						
						// Update mime type if we got one from the upload, preferring image types
						if (displayImageResult.fileType?.startsWith('image/')) {
							if (!finalMime || finalMime === 'application/octet-stream' || finalMime === 'text/html') {
								finalMime = displayImageResult.fileType;
								console.log(`[OS_IMPORT] Updated mime type from display image: ${finalMime}`);
							}
						} else if (displayImageResult.fileType && (!finalMime || finalMime === 'application/octet-stream')) {
							finalMime = displayImageResult.fileType;
							console.log(`[OS_IMPORT] Updated mime type from display image: ${finalMime}`);
						}
						
						// Update dimensions from image upload
						if (displayImageResult.dimensions) {
							finalDimensions = displayImageResult.dimensions;
							console.log(`[OS_IMPORT] Got dimensions from display image: ${finalDimensions.width}x${finalDimensions.height}`);
						}
					} else {
						console.log(`[OS_IMPORT] Display image upload failed for: ${nft.display_image_url}`);
					}
				}
				
				// Try to get dimensions from metadata if we still don't have them
				if (!finalDimensions) {
					if (nft.metadata?.image_details?.width && nft.metadata?.image_details?.height) {
						finalDimensions = {
							width: nft.metadata.image_details.width,
							height: nft.metadata.image_details.height
						};
						console.log(`[OS_IMPORT] Using dimensions from metadata.image_details: ${finalDimensions.width}x${finalDimensions.height}`);
					} else if (nft.metadata?.animation_details?.width && nft.metadata?.animation_details?.height) {
						finalDimensions = {
							width: nft.metadata.animation_details.width,
							height: nft.metadata.animation_details.height
						};
						console.log(`[OS_IMPORT] Using dimensions from metadata.animation_details: ${finalDimensions.width}x${finalDimensions.height}`);
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

			console.log("[Final Metadata Before Save]", finalMetadata);
			console.log("[Final Dimensions Before Save]", finalDimensions);

			// Ensure collection contract is set before saving
			if (!nft.collection || !nft.collection.contract) {
				console.error('[OS_IMPORT] Missing contract address for NFT:', nft.identifier || nft.tokenId || nft.tokenID);
				if (collection && collection.slug) {
					console.warn('[OS_IMPORT] Using collection slug as contract address fallback:', collection.slug);
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
				artist.id,
				collection.id
			);

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
