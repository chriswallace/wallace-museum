import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { syncCollection } from '$lib/collectionSync';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const collections = body.collections as string[];
		if (!Array.isArray(collections)) {
			throw new Error('Collections must be an array');
		}

		const collectionIds = [...new Set(collections)];

		const dataPromises = collectionIds.map(async (collectionId) => {
			// Use our new syncCollection function to get collection data
			const collection = await syncCollection(collectionId, 'opensea');
			return { collection };
		});

		const data = await Promise.all(dataPromises);

		return json({ success: true, data });
	} catch (error) {
		console.error('Error fetching NFT data:', error);
		return json(
			{ success: false, error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
