// src/routes/api/fetch-nft-data.js
import { json } from '@sveltejs/kit';
import { fetchCollection, fetchArtist } from '$lib/openseaHelpers';

export const POST = async ({ request }) => {
	try {
		const { collections } = await request.json();

		// Deduplicate contract addresses to minimize API calls
		const collectionSlugs = [...new Set(collections)];

		// Fetch collection and artist data for each unique address
		const dataPromises = collectionSlugs.map(async (collectionSlug) => {
			const collection = await fetchCollection(collectionSlug);
			let artist = {};
			if (collection && collection.owner) {
				artist = await fetchArtist(collection.owner);
			}

			return { collection, artist };
		});

		const data = await Promise.all(dataPromises);


		// Map back to the original array if needed or return as is
		return json({ success: true, data });
	} catch (error) {
		console.error('Error fetching NFT data:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
