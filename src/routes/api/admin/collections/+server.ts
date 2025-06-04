import { prismaRead } from '$lib/prisma';
import { getCoverImages } from '$lib/utils';
import { cachedCollectionQueries, shouldSkipCache, getCacheHeaders } from '$lib/cache/db-cache.js';

export async function GET({ url }: { url: URL }): Promise<Response> {
	try {
		const page = parseInt(url.searchParams.get('page') || '1');
		const sortColumn = url.searchParams.get('sort') || 'title';
		const sortOrder = url.searchParams.get('order') || 'asc';
		const search = url.searchParams.get('search') || '';
		
		// Check if cache should be skipped
		const skipCache = shouldSkipCache(url);
		
		const limit = 24;
		const offset = (page - 1) * limit;

		let orderBy: Record<string, string> = {};
		orderBy[sortColumn] = sortOrder;

		let whereClause: Record<string, any> = {};

		if (search) {
			whereClause = {
				title: { contains: search, mode: 'insensitive' }
			};
		}

		const startTime = Date.now();

		// Use cached query wrapper
		const result = await cachedCollectionQueries.getPaginated(
			page,
			limit,
			search,
			async () => {
				const totalCollections = await prismaRead.collection.count({ where: whereClause });
				const collections = await prismaRead.collection.findMany({
					where: whereClause,
					skip: offset,
					take: limit,
					orderBy: [orderBy],
					include: {
						Artwork: {
							take: 4,
							select: { imageUrl: true }
						},
						Artist: true
					}
				});

				const defaultImage = '/images/medici-image.png';
				const modifiedCollections = collections.map((collection) => ({
					...collection,
					coverImages: getCoverImages(
						collection.Artwork.map(artwork => ({
							imageUrl: artwork.imageUrl || undefined
						})), 
						defaultImage
					)
				}));

				return {
					collections: modifiedCollections,
					total: totalCollections,
					page,
					totalPages: Math.ceil(totalCollections / limit)
				};
			},
			{ skipCache }
		);

		const queryTime = Date.now() - startTime;

		// Log slow queries for debugging (only for cache misses)
		if (!result.fromCache && queryTime > 1000) {
			console.warn(`[API] Slow collections query took ${queryTime}ms - page: ${page}, search: "${search}"`);
		}

		// Prepare cache headers
		const cacheHeaders = getCacheHeaders(result.fromCache, 300); // 5 minute cache for collections

		return new Response(
			JSON.stringify({
				...result.data,
				queryTime,
				fromCache: result.fromCache,
				cacheKey: result.fromCache ? result.cacheKey : undefined
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
