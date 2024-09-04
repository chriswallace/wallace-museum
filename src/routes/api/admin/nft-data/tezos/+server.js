// src/routes/api/fetch-nft-data.js
import { json } from '@sveltejs/kit';
import { fetchCollection, fetchArtist } from '$lib/objktHelpers';

export const POST = async ({ request }) => {
	try {
		const { collections } = await request.json();

		const collectionIds = [...new Set(collections)];

		const dataPromises = collectionIds.map(async (collection) => {
			const response = await fetchCollection(collection);

			// Access the first item in the fa array
			collection = response.data.fa.length > 0 ? response.data.fa[0] : null;
			let artist = {};
			if (collection && collection.owner) {
				artist = await fetchArtist(collection.owner);
			}

			return { collection, artist };
		});

		const data = await Promise.all(dataPromises);

		return json({ success: true, data });
	} catch (error) {
		console.error('Error fetching NFT data:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
