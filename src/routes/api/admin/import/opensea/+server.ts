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

			const normalizedMetadata = await normalizeOpenSeaMetadata(nft);

			if (normalizedMetadata.image_url && (await isImage(normalizedMetadata.image_url))) {
				const imageUploadResult = await handleMediaUpload(normalizedMetadata.image_url, nft);
				normalizedMetadata.image_url = imageUploadResult ? imageUploadResult.url.split('?')[0] : '';
				nft.dimensions =
					imageUploadResult && imageUploadResult.dimensions
						? imageUploadResult.dimensions
						: { width: undefined, height: undefined };
			} else {
				console.error('Image URI is undefined or empty.');
				return json({ error: 'Image URI is missing or invalid.' }, { status: 400 });
			}

			if (normalizedMetadata.animation_url && (await isVideo(normalizedMetadata.animation_url))) {
				const videoUploadResult = await handleMediaUpload(normalizedMetadata.animation_url, nft);
				if (videoUploadResult && videoUploadResult.url) {
					normalizedMetadata.animation_url = videoUploadResult.url;
				} else {
					console.error(
						`Video upload failed or returned no URL for: ${normalizedMetadata.animation_url}`
					);
					normalizedMetadata.animation_url = ''; // Clear or handle as needed
				}
			}

			nft.metadata = normalizedMetadata;
			nft.metadata.tokenID = nft.metadata.identifier;
			nft.tokenID = nft.metadata.identifier;

			//console.log(nft);

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
