import prisma from '$lib/prisma.js';
import { json } from '@sveltejs/kit';
import { normalizeOpenSeaMetadata, handleMediaUpload } from '$lib/mediaHelpers';
import { fetchMetadata } from '$lib/openseaHelpers.js';
import { processArtist, processCollection, saveArtwork } from '$lib/adminOperations.js';
import { isVideo, isImage } from '$lib/utils';

export const POST = async ({ request }) => {
	try {
		const { nfts } = await request.json();

		if (!Array.isArray(nfts) || nfts.length === 0) {
			return json({ error: 'No NFTs provided for import.' }, { status: 400 });
		}

		const importPromises = nfts.map(async (nft, currentIndex) => {
			let fetchedMetadata = null;

			if (nft.metadata_url) {
				fetchedMetadata = await fetchMetadata(nft.metadata_url);
				if (fetchedMetadata) {
					nft.metadata = fetchedMetadata;
				}
			}

			const artist = await processArtist(nft.artist);
			const collection = await processCollection(nft.collection);

			let normalizedMetadata = await normalizeOpenSeaMetadata(nft);
			// Process media URLs and store final results
			let finalImageUrl = '';
			let finalAnimationUrl = '';
			let finalMime = normalizedMetadata.mime || ''; // Start with mime from normalization if available
			let finalDimensions = normalizedMetadata.dimensions || { width: undefined, height: undefined };

			try {
				// Process animation_url first (primary asset)
				if (normalizedMetadata.animation_url) {
					console.log(`[OS_IMPORT_PROCESS] NFT: ${nft.identifier} - Handling primary media (from animation_url): ${normalizedMetadata.animation_url}`);
					const primaryMediaResult = await handleMediaUpload(normalizedMetadata.animation_url, nft);
					if (primaryMediaResult?.url) {
						if (primaryMediaResult.fileType.startsWith('video/') || primaryMediaResult.fileType === 'text/html' || primaryMediaResult.fileType === 'application/pdf') {
							finalAnimationUrl = primaryMediaResult.url;
							finalMime = primaryMediaResult.fileType;
							if (primaryMediaResult.dimensions) finalDimensions = primaryMediaResult.dimensions;
						} else if (primaryMediaResult.fileType.startsWith('image/')) {
							// If animation_url pointed to an image, use it as the image_url
							finalImageUrl = primaryMediaResult.url;
							finalMime = primaryMediaResult.fileType;
							if (primaryMediaResult.dimensions) finalDimensions = primaryMediaResult.dimensions;
						} else {
							console.warn(`[OS_IMPORT_PROCESS] NFT: ${nft.identifier} - Unexpected fileType '${primaryMediaResult.fileType}' from animation_url upload.`);
						}
					} else {
						console.warn(`[OS_IMPORT_PROCESS] NFT: ${nft.identifier} - Primary media upload (from animation_url) failed.`);
					}
				}

				// Process image_url (only if different and no image resolved yet)
				if (normalizedMetadata.image_url && normalizedMetadata.image_url !== normalizedMetadata.animation_url && !finalImageUrl) {
					console.log(`[OS_IMPORT_PROCESS] NFT: ${nft.identifier} - Handling image upload (from image_url): ${normalizedMetadata.image_url}`);
					const imageUploadResult = await handleMediaUpload(normalizedMetadata.image_url, nft);
					if (imageUploadResult?.url) {
						if (imageUploadResult.fileType.startsWith('image/')) {
							finalImageUrl = imageUploadResult.url;
							if (!finalMime) finalMime = imageUploadResult.fileType;
							if (!finalDimensions.width && imageUploadResult.dimensions) {
								finalDimensions = imageUploadResult.dimensions;
							}
						} else {
							console.warn(`[OS_IMPORT_PROCESS] NFT: ${nft.identifier} - Expected image fileType but got '${imageUploadResult.fileType}' from image_url upload.`);
						}
					} else {
						console.warn(`[OS_IMPORT_PROCESS] NFT: ${nft.identifier} - Image upload (from image_url) failed.`);
					}
				}

				// Fallback checks
				if (!finalImageUrl && !finalAnimationUrl) {
					console.error(`[OS_IMPORT_PROCESS] NFT: ${nft.identifier} - Failed to resolve any valid media URL.`);
					// Consider skipping or using placeholder
					// For now, we'll let it proceed, but saveArtwork might fail or save empty URLs
				}

			} catch (error) {
				console.error(`[OS_IMPORT_PROCESS] NFT: ${nft.identifier} - Error processing media upload:`, error);
				// Continue processing other NFTs, this one might fail saving or have empty URLs
			}

			// Update nft object with processed data before saving
			nft.metadata = {
				...normalizedMetadata, // Keep other normalized fields
				image_url: finalImageUrl,
				animation_url: finalAnimationUrl
			};
			nft.mime = finalMime;
			nft.dimensions = finalDimensions;
			// Ensure tokenID/identifier consistency - normalizeOpenSeaMetadata should handle this
			// nft.metadata.tokenID = nft.metadata.identifier;
			// nft.tokenID = nft.metadata.identifier;

			console.log(`[OS_IMPORT_SAVE] NFT: ${nft.identifier} - Pre-save image_url: ${nft.metadata.image_url}, Pre-save animation_url: ${nft.metadata.animation_url}, Pre-save mime: ${nft.mime}`);

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
		});

		await Promise.all(importPromises);

		return json({ success: true, message: 'Import completed successfully.' });
	} catch (error) {
		console.error('Error processing request:', error);
		return json({ success: false, message: 'Server error occurred.' }, { status: 500 });
	}
};
