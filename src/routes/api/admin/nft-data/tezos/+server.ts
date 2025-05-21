import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { Collection, Prisma } from '@prisma/client';
import { fetchArtist } from '$lib/objktHelpers';
import { syncCollection } from '$lib/collectionSync';

interface CollectionWithJson extends Collection {
	contractAddresses: Prisma.JsonValue;
}

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
			const collection = (await syncCollection(collectionId, 'objkt')) as CollectionWithJson;

			// Fetch artist data if we have a contract address
			let artist = null;
			const contractAddresses = collection.contractAddresses as { address: string }[] | null;
			if (contractAddresses?.[0]?.address) {
				artist = await fetchArtist(contractAddresses[0].address);
			}

			return { collection, artist };
		});

		const data = await Promise.all(dataPromises);

		return json({ success: true, data });
	} catch (error) {
		console.error('Error fetching NFT data:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
