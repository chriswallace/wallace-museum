// src/routes/api/fetch-nft-data.js
import { json } from '@sveltejs/kit';
import { fetchCollection, fetchArtist } from '$lib/openseaHelpers';

export const POST = async ({ request }) => {
	try {
		const { collections } = await request.json();

		// Deduplicate contract addresses to minimize API calls
		const collectionSlugs = [...new Set(collections)];

		// Fetch collection and artist data for each unique address sequentially with delay
		/**
		 * @param {number} ms
		 */
		function delay(ms) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}

		const data = [];
		for (const collectionSlug of collectionSlugs) {
			try {
				const collection = await fetchCollection(collectionSlug);
				let artist = {};
				if (collection && collection.owner) {
					artist = await fetchArtist(collection.owner);
				}
				data.push({ collection, artist });
			} catch (err) {
				// 'err' is of type unknown; handled safely below
				let errorMsg = 'Unknown error';
				if (err instanceof Error) {
					errorMsg = err.message;
				} else if (typeof err === 'string') {
					errorMsg = err;
				}
				console.error('Error fetching collection or artist:', errorMsg);
				data.push({ collection: null, artist: null, error: errorMsg });
			}
			// Wait 300ms between requests (tune as needed)
			await delay(300);
		}

		// Map back to the original array if needed or return as is
		return json({ success: true, data });
	} catch (error) {
		console.error('Error fetching NFT data:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
