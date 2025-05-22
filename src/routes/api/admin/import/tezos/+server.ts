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

			// If no valid artist was found or created, continue without artist association
			if (!artist) {
				console.log('[TEZOS_IMPORT] No valid artist found for NFT:', nft.tokenID);
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
			let finalMime = nft.mime || ''; // Initialize with Objkt MIME type
			let finalDimensions: { width: number; height: number } | null = null;

			// Helper to determine if a MIME type is generic (application/octet-stream or empty)
			const isMimeEffectivelyGeneric = (mime: string) =>
				!mime || mime === 'application/octet-stream';
			// Helper to determine if a MIME type is text-based (html/javascript)
			const isMimeTextBasedInteractive = (mime: string) =>
				mime.startsWith('text/') || mime.includes('javascript');

			// Priority 1: nft.extra (if it provides a more specific image mime)
			if (nft.extra && Array.isArray(nft.extra)) {
				for (const item of nft.extra) {
					if (
						item.mime_type?.startsWith('image/') &&
						item.dimensions?.value &&
						typeof item.dimensions.value === 'string'
					) {
						const parts = item.dimensions.value.split('x');
						if (parts.length === 2) {
							const width = parseInt(parts[0], 10);
							const height = parseInt(parts[1], 10);
							if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
								if (!finalDimensions) finalDimensions = { width, height };
								// If current finalMime is generic or text-based, and this is a specific image mime
								if (
									item.mime_type &&
									(isMimeEffectivelyGeneric(finalMime) || isMimeTextBasedInteractive(finalMime))
								) {
									finalMime = item.mime_type;
									console.log(`[TEZOS_IMPORT] MIME updated from nft.extra: ${finalMime}`);
								}
								if (
									finalDimensions &&
									finalDimensions.width === width &&
									finalDimensions.height === height
								)
									break;
							}
						}
					}
				}
			}

			// Priority 2: nft.dimensions.display.dimensions (if it provides a more specific image mime)
			if (nft.dimensions?.display?.dimensions) {
				const { width, height } = nft.dimensions.display.dimensions;
				const displayMime = nft.dimensions.display.mime;
				if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
					if (!finalDimensions) finalDimensions = { width, height };
					if (
						displayMime?.startsWith('image/') &&
						(isMimeEffectivelyGeneric(finalMime) || isMimeTextBasedInteractive(finalMime))
					) {
						finalMime = displayMime;
						console.log(`[TEZOS_IMPORT] MIME updated from nft.dimensions.display: ${finalMime}`);
					}
				}
			}

			// Priority 3: nft.dimensions.artifact.dimensions (if it provides a more specific image mime for an image artifact)
			if (nft.dimensions?.artifact?.dimensions) {
				const { width, height } = nft.dimensions.artifact.dimensions;
				const artifactMimeOnDimensions = nft.dimensions.artifact.mime; // Renamed to avoid conflict
				if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
					if (artifactMimeOnDimensions?.startsWith('image/')) {
						if (!finalDimensions) finalDimensions = { width, height };
						if (isMimeEffectivelyGeneric(finalMime) || isMimeTextBasedInteractive(finalMime)) {
							finalMime = artifactMimeOnDimensions;
							console.log(`[TEZOS_IMPORT] MIME updated from nft.dimensions.artifact: ${finalMime}`);
						}
					}
				}
			}

			try {
				// Process animation_url (often the primary artifact like HTML, video, or specific interactive types)
				if (normalizedMetadata.animation_url) {
					console.log(
						'[TEZOS_IMPORT] Processing animation_url with handleMediaUpload:',
						normalizedMetadata.animation_url
					);
					const animationResult = await handleMediaUpload(normalizedMetadata.animation_url, nft);
					if (animationResult?.url) {
						finalAnimationUrl = animationResult.url;
						console.log(`[TEZOS_IMPORT] Animation upload successful: ${finalAnimationUrl}`);
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
								console.log(
									`[TEZOS_IMPORT] MIME updated from animation (was generic): ${finalMime}`
								);
							} else if (newMimeIsPrimaryContent && currentMimeIsImage) {
								finalMime = newMime;
								console.log(
									`[TEZOS_IMPORT] MIME updated from animation (primary override image): ${finalMime}`
								);
							} else if (
								newMime !== finalMime &&
								finalMime === 'text/html' &&
								!newMimeIsPrimaryContent &&
								!newMime.startsWith('image/')
							) {
								// If current is text/html, and newMime is not primary content (e.g. not another text/html) and not an image, allow update.
								// This is a bit niche, usually covered by other conditions.
								finalMime = newMime;
								console.log(
									`[TEZOS_IMPORT] MIME updated from animation (text/html override): ${finalMime}`
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
								// General update if newMime is different, UNLESS current is specific (img/vid/model) and new is generic text/html
								finalMime = newMime;
								console.log(
									`[TEZOS_IMPORT] MIME updated from animation (general difference): ${finalMime}`
								);
							}
						}
						if (
							animationResult.dimensions &&
							animationResult.fileType?.startsWith('image/') &&
							!finalDimensions
						) {
							finalDimensions = animationResult.dimensions;
							console.log(
								'[TEZOS_IMPORT] Dimensions from processed animation_url (image):',
								finalDimensions
							);
						}
					} else {
						console.log(
							`[TEZOS_IMPORT] Animation upload failed for: ${normalizedMetadata.animation_url}`
						);
					}
				}

				// Process image_url as a fallback or for supplementary image
				if (normalizedMetadata.image_url) {
					console.log(
						'[TEZOS_IMPORT] Processing image_url with handleMediaUpload:',
						normalizedMetadata.image_url
					);
					const imageResult = await handleMediaUpload(normalizedMetadata.image_url, nft);
					if (imageResult?.url) {
						finalImageUrl = imageResult.url;
						console.log(`[TEZOS_IMPORT] Image upload successful: ${finalImageUrl}`);
						if (imageResult.fileType?.startsWith('image/')) {
							// Only update mime if current is effectively generic or was text/html (placeholder for image)
							// This avoids overriding a primary video/interactive mime with a thumbnail's image mime.
							if (isMimeEffectivelyGeneric(finalMime) || finalMime === 'text/html') {
								finalMime = imageResult.fileType;
								console.log(`[TEZOS_IMPORT] Updated mime type from image: ${finalMime}`);
							}
						}
						if (imageResult.dimensions && (!finalDimensions || finalMime.startsWith('image/'))) {
							finalDimensions = imageResult.dimensions;
							console.log('[TEZOS_IMPORT] Dimensions from processed image_url:', finalDimensions);
						}
					} else {
						console.log(`[TEZOS_IMPORT] Image upload failed for: ${normalizedMetadata.image_url}`);
					}
				}

				// If after all processing, mime is still octet-stream or HTML (and we have an animation_url that was processed),
				// and animation_url looks like a common interactive art platform, ensure it's text/html.
				if (
					(finalMime === 'application/octet-stream' || finalMime === 'text/html') &&
					finalAnimationUrl
				) {
					if (
						finalAnimationUrl.includes('fxhash.xyz') ||
						finalAnimationUrl.includes('generator.artblocks.io') ||
						finalAnimationUrl.endsWith('.html') ||
						finalAnimationUrl.endsWith('.htm')
					) {
						if (finalMime !== 'text/html') {
							finalMime = 'text/html';
							console.log(
								`[TEZOS_IMPORT] Guessed mime type as text/html based on animation_url structure: ${finalAnimationUrl}`
							);
						}
					}
				}
			} catch (error: unknown) {
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
					console.log(
						'[TEZOS_IMPORT] Using collection slug as contract address fallback:',
						collection.slug
					);
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
				artist?.id || null,
				collection.id
			);

			// Only create artist relationships if we have an artist
			if (artist) {
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
			}

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
