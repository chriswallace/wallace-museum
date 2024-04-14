import prisma from '$lib/prisma.js';
import { json } from '@sveltejs/kit';
import { normalizeMetadata, handleMediaUpload } from '$lib/mediaHelpers';
import { fetchMetadata } from '$lib/openseaHelpers.js';
import { processArtist, processCollection, saveArtwork } from '$lib/adminOperations.js';

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

			const normalizedMetadata = await normalizeMetadata(nft);

			if (normalizedMetadata.image) {
				const imageUploadResult = await handleMediaUpload(normalizedMetadata.image, nft);
				normalizedMetadata.image = imageUploadResult ? imageUploadResult.url : '';
				// Ensure dimensions are defined before using them
				nft.dimensions = imageUploadResult && imageUploadResult.dimensions ? imageUploadResult.dimensions : { width: undefined, height: undefined };
			} else {
				console.error("Image URI is undefined or empty.");
				return;
			}

			// Adjusted video processing with checking for undefined dimensions
			if (normalizedMetadata.video) {
				const videoUploadResult = await handleMediaUpload(normalizedMetadata.video, nft);
				if (videoUploadResult && videoUploadResult.url) {
					normalizedMetadata.video = videoUploadResult.url;
				} else {
					console.error(`Video upload failed or returned no URL for: ${normalizedMetadata.video}`);
					normalizedMetadata.video = ''; // Clear or handle as needed
				}
			}

			nft.metadata = normalizedMetadata;

			const artwork = await saveArtwork(
				nft,
				artist.id,
				collection.id,
			);

			await prisma.artistCollections.upsert({
				where: {
					artistId_collectionId: {
						artistId: artist.id,
						collectionId: collection.id,
					}
				},
				update: {},
				create: {
					artistId: artist.id,
					collectionId: collection.id,
				}
			});

			await prisma.artistArtworks.upsert({
				where: {
					artistId_artworkId: {
						artistId: artist.id,
						artworkId: artwork.id,
					},
				},
				update: {},
				create: {
					artistId: artist.id,
					artworkId: artwork.id,
				},
			});

		});

		await Promise.all(importPromises);

		return json({ success: true, message: 'Import completed successfully.' });
	} catch (error) {
		console.error('Error processing request:', error);
		return json({ success: false, message: 'Server error occurred.' }, { status: 500 });
	}
};