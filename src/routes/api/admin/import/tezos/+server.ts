import prisma from '$lib/prisma';
import { json } from '@sveltejs/kit';
import { normalizeTezosMetadata, handleMediaUpload } from '$lib/mediaHelpers';
import { fetchMetadata } from '$lib/objktHelpers';
import { processArtist, saveArtwork } from '$lib/adminOperations';
import { syncCollection } from '$lib/collectionSync';

// Define default dimensions
// const DEFAULT_DIMENSIONS = {
// 	width: 1000,
// 	height: 1000
// };

export const POST = async ({ request }) => {
	try {
		const { nfts } = await request.json();

		if (!Array.isArray(nfts) || nfts.length === 0) {
			return json({ error: 'No NFTs provided for import.' }, { status: 400 });
		}

		let successfulImports = 0;
		let skippedImports = 0;

		// Process NFTs sequentially instead of in parallel
		for (const nft of nfts) {
			let fetchedMetadata = null;

			if (nft.metadata_url) {
				fetchedMetadata = await fetchMetadata(nft.metadata_url);
				if (fetchedMetadata) {
					nft.metadata = fetchedMetadata;
				}
			}

			// Ensure nft.metadata exists before proceeding
			if (!nft.metadata) {
				nft.metadata = {};
			}

			// Process artist info
			const artistInfo = {
				username: nft.artist?.username || nft.artist?.name,
				address: nft.artist?.address || '',
				blockchain: 'tezos',
				bio: nft.artist?.bio,
				avatarUrl: nft.artist?.avatarUrl,
				website: nft.artist?.website,
				social_media_accounts: {
					twitter: nft.artist?.twitter || '',
					instagram: nft.artist?.instagram || ''
				}
			};

			const artist = await processArtist(artistInfo);

			// If no valid artist was found or created, skip this artwork
			if (!artist) {
				console.log('[TEZOS_IMPORT] No valid artist found for NFT:', nft.tokenID);
				skippedImports++;
				continue;
			}

			// Sync collection from Objkt.com
			const collection = await syncCollection(
				nft.collection?.contract || nft.contractAddr,
				'objkt'
			);

			let normalizedMetadata = await normalizeTezosMetadata(nft);

			// Log metadata attributes for debugging
			console.log(
				`[TEZOS_IMPORT] Token: ${nft.tokenID} - Normalized attributes:`,
				JSON.stringify(normalizedMetadata.attributes || [])
			);

			// Store final URLs and details here
			let finalImageUrl = '';
			let finalAnimationUrl = '';
			let finalMime = nft.mime || '';
			let finalDimensions: { width: number; height: number } | null = null;

			// Priority 1: nft.extra (if it's an image with parsed "WxH" string)
			if (nft.extra && Array.isArray(nft.extra)) {
				for (const item of nft.extra) {
					if (item.mime_type?.startsWith('image/') && item.dimensions?.value && typeof item.dimensions.value === 'string') {
						const parts = item.dimensions.value.split('x');
						if (parts.length === 2) {
							const width = parseInt(parts[0], 10);
							const height = parseInt(parts[1], 10);
							if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
								finalDimensions = { width, height };
								// If top-level mime was generic (e.g. text/html for generative art), prefer specific image mime from extra.
								if (finalMime === 'text/html' || finalMime === 'application/octet-stream' || !finalMime) {
									finalMime = item.mime_type;
								}
								console.log('[TEZOS_IMPORT] Dimensions from nft.extra:', finalDimensions, 'Mime:', finalMime);
								break; 
							}
						}
					}
				}
			}

			// Priority 2: nft.dimensions.display.dimensions (if not found in extra)
			if (!finalDimensions && nft.dimensions?.display?.dimensions) {
				const { width, height } = nft.dimensions.display.dimensions;
				const displayMime = nft.dimensions.display.mime;
				if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
					finalDimensions = { width, height };
					// If displayMime is an image type and current finalMime is generic or not set, update finalMime.
					if (displayMime?.startsWith('image/')) {
						if (finalMime === 'text/html' || finalMime === 'application/octet-stream' || !finalMime) {
							finalMime = displayMime;
						}
					}
					console.log('[TEZOS_IMPORT] Dimensions from nft.dimensions.display.dimensions:', finalDimensions, 'Mime:', finalMime);
				}
			}

			// Priority 3: nft.dimensions.artifact.dimensions (if not found above and artifact is an image)
			if (!finalDimensions && nft.dimensions?.artifact?.dimensions) {
				const { width, height } = nft.dimensions.artifact.dimensions;
				const artifactMime = nft.dimensions.artifact.mime;
				if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
					if (artifactMime?.startsWith('image/')) { // Only if artifact itself is an image
						finalDimensions = { width, height };
						// If artifactMime is an image type and current finalMime is generic or not set, update finalMime.
						if (finalMime === 'text/html' || finalMime === 'application/octet-stream' || !finalMime) {
							finalMime = artifactMime;
						}
						console.log('[TEZOS_IMPORT] Dimensions from nft.dimensions.artifact.dimensions (image):', finalDimensions, 'Mime:', finalMime);
					}
				}
			}
			
			try {
				// Process animation_url (often the primary artifact like HTML)
				if (normalizedMetadata.animation_url) {
					console.log('[TEZOS_IMPORT] Processing animation_url with handleMediaUpload:', normalizedMetadata.animation_url);
					const animationResult = await handleMediaUpload(normalizedMetadata.animation_url, nft);
					if (animationResult?.url) {
						finalAnimationUrl = animationResult.url;
						console.log(`[TEZOS_IMPORT] Animation upload successful: ${finalAnimationUrl}`);
						// Update finalMime from animationResult if it's more specific and useful
						if (animationResult.fileType && animationResult.fileType !== finalMime) {
							if (finalMime === 'application/octet-stream' || finalMime === '' || animationResult.fileType.startsWith('image/') || (finalMime === 'text/html' && animationResult.fileType !== 'text/html')) {
								finalMime = animationResult.fileType;
								console.log(`[TEZOS_IMPORT] Updated mime type from animation: ${finalMime}`);
							}
						}
						// If animation_url processing yields dimensions AND it's an image type,
						// and we don't have dimensions yet, use these.
						if (!finalDimensions && animationResult.dimensions && animationResult.fileType?.startsWith('image/')) {
							finalDimensions = animationResult.dimensions;
							console.log('[TEZOS_IMPORT] Dimensions from processed animation_url (image):', finalDimensions);
						}
					} else {
						console.log(`[TEZOS_IMPORT] Animation upload failed for: ${normalizedMetadata.animation_url}`);
					}
				}

				// Prioritize full-resolution images - try artifactUri first (original artifact)
				if (nft.artifactUri) {
					console.log('[TEZOS_IMPORT] Processing artifactUri (original asset) with handleMediaUpload:', nft.artifactUri);
					const artifactResult = await handleMediaUpload(nft.artifactUri, nft);
					if (artifactResult?.url) {
						finalImageUrl = artifactResult.url;
						console.log(`[TEZOS_IMPORT] Original artifact upload successful: ${finalImageUrl}`);
						
						// If result has dimensions and it's an image, use them
						if (artifactResult.dimensions && artifactResult.fileType?.startsWith('image/')) {
							finalDimensions = artifactResult.dimensions;
							console.log('[TEZOS_IMPORT] Dimensions from original artifact:', finalDimensions);
							
							// Update mime type
							finalMime = artifactResult.fileType;
							console.log(`[TEZOS_IMPORT] Updated mime type from artifact: ${finalMime}`);
						}
					} else {
						console.log(`[TEZOS_IMPORT] Original artifact upload failed for: ${nft.artifactUri}`);
					}
				}

				// If we don't have an image yet, try image_url from normalized metadata (often original too)
				if (!finalImageUrl && normalizedMetadata.image_url) {
					console.log('[TEZOS_IMPORT] Processing image_url with handleMediaUpload:', normalizedMetadata.image_url);
					const imageResult = await handleMediaUpload(normalizedMetadata.image_url, nft);
					if (imageResult?.url) {
						finalImageUrl = imageResult.url;
						console.log(`[TEZOS_IMPORT] Image upload successful: ${finalImageUrl}`);
						// If imageResult has dimensions and it's an image, these are high-confidence.
						if (imageResult.dimensions && imageResult.fileType?.startsWith('image/')) {
							const currentMimeIsGeneric = !finalMime || finalMime === 'text/html' || finalMime === 'application/octet-stream';
							// Prefer dimensions from image_url if:
							// 1. We don't have dimensions yet.
							// 2. Or, the current mime is generic, and these new dimensions are from a confirmed image.
							if (!finalDimensions || currentMimeIsGeneric) {
								finalDimensions = imageResult.dimensions;
								console.log('[TEZOS_IMPORT] Dimensions updated/set from processed image_url:', finalDimensions);
							}
							// Always update mime to the image's mime type if we are taking its dimensions or if current mime is generic.
							if (currentMimeIsGeneric || !finalMime.startsWith('image/')) {
								finalMime = imageResult.fileType || finalMime;
								console.log(`[TEZOS_IMPORT] Updated mime type from image: ${finalMime}`);
							}
						} else if (imageResult.fileType?.startsWith('image/')) {
							// Image was processed, it's an image type, but handleMediaUpload returned null dimensions.
							// Keep existing finalDimensions. Update mime if it was generic.
							if (!finalMime || finalMime === 'text/html' || finalMime === 'application/octet-stream') {
								finalMime = imageResult.fileType || finalMime;
								console.log(`[TEZOS_IMPORT] Updated mime type from image (no dimensions): ${finalMime}`);
							}
						}
					} else {
						console.log(`[TEZOS_IMPORT] Image upload failed for: ${normalizedMetadata.image_url}`);
					}
				}
				
				// As a last resort, try displayUri (often a lower-resolution display version)
				if (!finalImageUrl && nft.displayUri) {
					console.log('[TEZOS_IMPORT] No full-res image available, falling back to displayUri:', nft.displayUri);
					const displayUriResult = await handleMediaUpload(nft.displayUri, nft);
					if (displayUriResult?.url) {
						finalImageUrl = displayUriResult.url;
						console.log(`[TEZOS_IMPORT] DisplayUri upload successful: ${finalImageUrl}`);
						
						if (displayUriResult.fileType?.startsWith('image/')) {
							const currentMimeIsGeneric = !finalMime || finalMime === 'text/html' || finalMime === 'application/octet-stream';
							if (currentMimeIsGeneric) {
								finalMime = displayUriResult.fileType;
								console.log(`[TEZOS_IMPORT] Updated mime type from displayUri: ${finalMime}`);
							}
							
							if (!finalDimensions && displayUriResult.dimensions) {
								finalDimensions = displayUriResult.dimensions;
								console.log('[TEZOS_IMPORT] Dimensions updated from displayUri:', finalDimensions);
							}
						}
					} else {
						console.log(`[TEZOS_IMPORT] DisplayUri upload failed for: ${nft.displayUri}`);
					}
				}
			} catch (error) {
				console.error('[TEZOS_IMPORT] Error processing media with handleMediaUpload:', error);
			}

			// Update metadata with final URLs
			const finalMetadata = {
				...normalizedMetadata,
				image_url: finalImageUrl || normalizedMetadata.image_url,
				animation_url: finalAnimationUrl || normalizedMetadata.animation_url
			};

			// Ensure collection contract is set before saving
			if (!nft.collection || !nft.collection.contract) {
				console.error('[TEZOS_IMPORT] Missing contract address for NFT:', nft.tokenID);
				if (collection && collection.slug) {
					console.log('[TEZOS_IMPORT] Using collection slug as contract address fallback:', collection.slug);
					nft.collection = {
						...(nft.collection || {}),
						contract: collection.slug,
						blockchain: nft.collection?.blockchain || 'tezos'
					};
				} else {
					console.error('[TEZOS_IMPORT] Cannot import NFT without contract address');
					skippedImports++;
					continue;
				}
			}
			
			// Log the contract address being used
			console.log('[TEZOS_IMPORT] Using contract address:', nft.collection.contract);
			
			// Now save using the updated nft object
			const artwork = await saveArtwork(
				{
					...nft,
					metadata: finalMetadata,
					mime: finalMime,
					dimensions: finalDimensions
				},
				artist.id,
				collection.id
			);

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

			successfulImports++;
		}

		return json({
			success: true,
			message: `Import completed successfully. ${successfulImports} artworks imported.`,
			skipped: skippedImports
		});
	} catch (error) {
		console.error('Error processing request:', error);
		return json({ success: false, message: 'Server error occurred.' }, { status: 500 });
	}
};
