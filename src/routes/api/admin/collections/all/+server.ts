import { prismaRead } from '$lib/prisma';
import { cachedCollectionQueries, shouldSkipCache, getCacheHeaders } from '$lib/cache/db-cache.js';

export async function GET({ url }: { url: URL }): Promise<Response> {
	try {
		// Check if cache should be skipped
		const skipCache = shouldSkipCache(url);
		
		const startTime = Date.now();

		// Use cached query wrapper for the collections list
		const result = await cachedCollectionQueries.getPaginated(
			1, // page
			10000, // very large limit to get all collections
			undefined, // no search
			async () => {
				const collections = await prismaRead.collection.findMany({
					orderBy: {
						title: 'asc' // Sorts by title in ascending order
					}
				});

				return {
					collections: collections,
					total: collections.length,
					page: 1,
					totalPages: 1
				};
			},
			{ skipCache }
		);

		const queryTime = Date.now() - startTime;

		// Prepare cache headers
		const cacheHeaders = getCacheHeaders(result.fromCache, 300); // 5 minute cache

		return new Response(
			JSON.stringify({
				collections: result.data.collections
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					...cacheHeaders
				}
			}
		);
	} catch (error: any) {
		console.error('Error in GET request:', error.message);
		return new Response(JSON.stringify({ error: 'An error occurred' }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
}
