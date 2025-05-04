import prisma from '$lib/prisma';
import { json } from '@sveltejs/kit';
import { normalizeTezosMetadata, handleMediaUpload } from '$lib/mediaHelpers';
import { fetchMetadata } from '$lib/objktHelpers';
import { processArtist, processCollection, saveArtwork } from '$lib/adminOperations';

export const POST = async ({ request }) => {
	try {
		const { nfts } = await request.json();

		if (!Array.isArray(nfts) || nfts.length === 0) {
			return json({ error: 'No NFTs provided for import.' }, { status: 400 });
		}

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

			const artist = await processArtist(nft.artist);
			const collection = await processCollection(nft.collection);

			let normalizedMetadata = await normalizeTezosMetadata(nft);

			// Log metadata attributes for debugging
			console.log(`[TEZOS_IMPORT] Token: ${nft.tokenID} - Normalized attributes:`, 
				JSON.stringify(normalizedMetadata.attributes || []));

			// Store final URLs and details here
			let finalImageUrl = '';
			let finalAnimationUrl = '';
			let finalMime = nft.mime || ''; // Start with original mime
			let finalDimensions = nft.dimensions || { width: undefined, height: undefined };

			try {
				// Process Media (could be image, video, or html/interactive)
				// We might have image_url, animation_url, or both (e.g., from OpenSea normalization later)
				// Let's process animation_url first if it exists, as it often represents the primary asset

				if (normalizedMetadata.animation_url) {
					// Check if the artifactUri is an image or video before attempting to process it
					const isMediaFile = normalizedMetadata.mime?.startsWith('image/') || 
									   normalizedMetadata.mime?.startsWith('video/');
					
					if (!isMediaFile && normalizedMetadata.animation_url) {
						// If not an image or video, pass through directly to animation_url
						console.log(`[IMPORT_PROCESS] Token: ${nft.tokenID} - Non-image/video detected, passing through directly: ${normalizedMetadata.animation_url}`);
						finalAnimationUrl = normalizedMetadata.animation_url;
						finalMime = normalizedMetadata.mime || 'application/octet-stream';
					} else {
						// Process as normal for images and videos
						console.log(`[IMPORT_PROCESS] Token: ${nft.tokenID} - Handling primary media upload (from animation_url): ${normalizedMetadata.animation_url}`);
						const primaryMediaResult = await handleMediaUpload(normalizedMetadata.animation_url, nft);
						if (primaryMediaResult?.url) {
							if (primaryMediaResult.fileType.startsWith('video/') || primaryMediaResult.fileType === 'text/html' || primaryMediaResult.fileType === 'application/pdf') {
								finalAnimationUrl = primaryMediaResult.url;
								finalMime = primaryMediaResult.fileType; // Prioritize this mime type
								if (primaryMediaResult.dimensions) { // Update dimensions if provided
									finalDimensions = primaryMediaResult.dimensions;
								}
							} else if (primaryMediaResult.fileType.startsWith('image/')) {
								// If animation_url pointed to an image, use it as the main image_url
								finalImageUrl = primaryMediaResult.url;
								finalMime = primaryMediaResult.fileType; // Set mime type
								if (primaryMediaResult.dimensions) { // Update dimensions
									finalDimensions = primaryMediaResult.dimensions;
								}
							} else {
								console.warn(`[IMPORT_PROCESS] Token: ${nft.tokenID} - Unexpected fileType '${primaryMediaResult.fileType}' from animation_url upload.`);
							}
						} else {
							console.warn(`[IMPORT_PROCESS] Token: ${nft.tokenID} - Primary media upload (from animation_url) failed or returned no URL.`);
						}
					}
				}

				// Process Image URL (only if different from animation_url or if animation_url wasn't processed/didn't result in an image)
				if (normalizedMetadata.image_url && normalizedMetadata.image_url !== normalizedMetadata.animation_url && !finalImageUrl) {
					console.log(`[IMPORT_PROCESS] Token: ${nft.tokenID} - Handling image upload (from image_url): ${normalizedMetadata.image_url}`);
					const imageUploadResult = await handleMediaUpload(normalizedMetadata.image_url, nft);
					if (imageUploadResult?.url) {
						if (imageUploadResult.fileType.startsWith('image/')) {
							finalImageUrl = imageUploadResult.url;
							// Only update mime/dimensions if not already set by a primary asset
							if (!finalMime) finalMime = imageUploadResult.fileType;
							if (!finalDimensions.width && imageUploadResult.dimensions) {
								finalDimensions = imageUploadResult.dimensions;
							}
						} else {
							console.warn(`[IMPORT_PROCESS] Token: ${nft.tokenID} - Expected image fileType but got '${imageUploadResult.fileType}' from image_url upload.`);
						}
					} else {
						console.warn(`[IMPORT_PROCESS] Token: ${nft.tokenID} - Image upload (from image_url) failed or returned no URL.`);
					}
				} 
				
				// Fallback if no image_url was derived
				if (!finalImageUrl && finalAnimationUrl && finalMime.startsWith('video/')) {
					console.warn(`[IMPORT_PROCESS] Token: ${nft.tokenID} - Video detected in animation_url but no image_url found. Consider generating a thumbnail.`);
					// Potentially generate thumbnail here if needed
				}
				if (!finalImageUrl && !finalAnimationUrl) {
					console.error(`[IMPORT_PROCESS] Token: ${nft.tokenID} - Failed to resolve any valid media URL.`);
					// Decide how to handle - skip NFT, use placeholder, etc.
					// continue; // Example: skip this NFT
				}

			} catch (error) {
				console.error('Error processing media upload:', error);
				// Consider how to handle partial failures (e.g., image works, video fails)
				// Depending on requirements, might continue or return error
				// return json({ error: 'An error occurred during media processing.' }, { status: 500 });
			}

			// Update the original nft object directly before saving
			nft.metadata.image_url = finalImageUrl;
			nft.metadata.animation_url = finalAnimationUrl;
			nft.mime = finalMime;
			nft.dimensions = finalDimensions;
			
			// Ensure attributes are preserved from the normalized metadata
			if (normalizedMetadata.attributes && Array.isArray(normalizedMetadata.attributes)) {
				nft.metadata.attributes = normalizedMetadata.attributes;
			}

			// CRITICAL LOG: Values before saving
			console.log(`[IMPORT_SAVE] Token: ${nft.tokenID} - Preparing to save artwork.`);
			console.log(`[IMPORT_SAVE]   - Final Image URL: ${finalImageUrl}`);
			console.log(`[IMPORT_SAVE]   - Final Animation URL: ${finalAnimationUrl}`);
			console.log(`[IMPORT_SAVE]   - Final Mime: ${finalMime}`);
			console.log(`[IMPORT_SAVE]   - NFT Metadata Image URL: ${nft.metadata.image_url}`);
			console.log(`[IMPORT_SAVE]   - NFT Metadata Animation URL: ${nft.metadata.animation_url}`);
			console.log(`[IMPORT_SAVE]   - NFT Mime: ${nft.mime}`);
			console.log(`[IMPORT_SAVE]   - NFT Dimensions:`, JSON.stringify(nft.dimensions));
			console.log(`[IMPORT_SAVE] Token: ${nft.tokenID} - Pre-save image_url: ${nft.metadata.image_url}, Pre-save animation_url: ${nft.metadata.animation_url}, Pre-save mime: ${nft.mime}`);

			// Now save using the updated nft object
			const artwork = await saveArtwork(nft, artist.id, collection.id);

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

		// await Promise.all(importPromises); // Removed parallel processing

		return json({ success: true, message: 'Import completed successfully.' });
	} catch (error) {
		console.error('Error processing request:', error);
		return json({ success: false, message: 'Server error occurred.' }, { status: 500 });
	}
};
