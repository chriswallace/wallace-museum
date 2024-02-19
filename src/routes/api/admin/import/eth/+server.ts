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
				} else {
					console.error(`Failed to fetch metadata for NFT at index ${currentIndex}.`);
				}
			}

			const artist = await processArtist(nft.artist);
			const collection = await processCollection(nft.collection);

			const normalizedMetadata = await normalizeMetadata(nft);

			console.log(normalizedMetadata.attributes);

			if (normalizedMetadata.image) {
				if (!normalizedMetadata.image) {
					console.error("Image URI is undefined or empty.");
				} else {
					const imageUploadResult = await handleMediaUpload(normalizedMetadata.image, nft);
					normalizedMetadata.image = imageUploadResult ? imageUploadResult.url : '';
					nft.dimensions = imageUploadResult ? imageUploadResult.dimensions : '';
				}
			}

			if (normalizedMetadata.video) {
				if (!normalizedMetadata.video) {
					console.error("Video URI is undefined or empty.");
				} else {
					const videoUploadResult = await handleMediaUpload(normalizedMetadata.video, nft);
					normalizedMetadata.video = videoUploadResult ? videoUploadResult.url : '';
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