import prisma from '$lib/prisma';
import { Prisma } from '@prisma/client';

// Define a type for the artwork object including relations we expect
type ArtworkWithRelations = Prisma.ArtworkGetPayload<{
	include: {
		collection: {
			select: {
				id: true;
				title: true;
			};
		};
		artists: {
			select: {
				id: true;
				name: true;
				avatarUrl: true;
			};
		};
	};
}>;

export async function GET({ url }) {
	const searchParams = url.searchParams;
	const page = parseInt(searchParams.get('page') || '1');
	const limit = parseInt(searchParams.get('limit') || '50');
	const search = searchParams.get('search') || '';
	const sortBy = searchParams.get('sortBy') || 'id';
	const sortOrder = searchParams.get('sortOrder') || 'desc';

	const offset = (page - 1) * limit;

	const where: Prisma.ArtworkWhereInput = {};

	if (search) {
		where.OR = [
			{ title: { contains: search, mode: 'insensitive' } },
			{ description: { contains: search, mode: 'insensitive' } },
			// Add artist name search
			{ 
				artists: {
					some: {
						name: { contains: search, mode: 'insensitive' }
					}
				}
			},
			// Add collection title search
			{
				collection: {
					title: { contains: search, mode: 'insensitive' }
				}
			}
		];
	}

	// Improved sorting logic
	const orderBy: Prisma.ArtworkOrderByWithRelationInput = {};
	
	switch (sortBy) {
		case 'title':
			orderBy.title = sortOrder as 'asc' | 'desc';
			break;
		case 'artist':
			// Sort by first artist's name
			orderBy.artists = {
				_count: sortOrder as 'asc' | 'desc'
			};
			break;
		case 'collection':
			orderBy.collection = {
				title: sortOrder as 'asc' | 'desc'
			};
			break;
		default:
			orderBy.id = sortOrder as 'asc' | 'desc';
	}

	try {
		const startTime = Date.now();
		
		const [artworks, totalCount] = await Promise.all([
			prisma.artwork.findMany({
				where,
				include: {
					collection: {
						select: {
							id: true,
							title: true
						}
					},
					artists: {
						select: {
							id: true,
							name: true,
							avatarUrl: true
						}
					}
				},
				orderBy,
				skip: offset,
				take: limit
			}),
			prisma.artwork.count({ where })
		]);

		const queryTime = Date.now() - startTime;
		
		// Log slow queries for debugging
		if (queryTime > 1000) {
			console.warn(`[API] Slow artworks query took ${queryTime}ms - page: ${page}, search: "${search}", sortBy: ${sortBy}`);
		}

		const transformedArtworks = artworks.map((artwork: ArtworkWithRelations) => ({
			...artwork,
			tokenID: artwork.tokenId,
			contractAddr: artwork.contractAddress,
			artists: artwork.artists || [],
			artist: artwork.artists && artwork.artists.length > 0 ? artwork.artists[0] : null
		}));

		return new Response(
			JSON.stringify({
				artworks: transformedArtworks,
				totalCount,
				page,
				limit,
				totalPages: Math.ceil(totalCount / limit),
				queryTime: queryTime
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('Error fetching artworks:', error);
		
		// Log connection pool status on errors
		try {
			const poolMetrics = await import('$lib/prisma').then(m => m.getConnectionPoolMetrics());
			if (poolMetrics) {
				console.warn(`[API] Connection pool status during error: ${poolMetrics.active}/${poolMetrics.max} (${poolMetrics.utilization}%)`);
			}
		} catch (poolError) {
			console.error('Failed to get pool metrics:', poolError);
		}
		
		return new Response(
			JSON.stringify({ 
				error: 'Failed to fetch artworks',
				details: error instanceof Error ? error.message : 'Unknown error'
			}), 
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
