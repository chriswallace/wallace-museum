import { prismaRead } from '$lib/prisma';
import { Prisma } from '@prisma/client';

// Define a type for the artwork object including relations we expect
type ArtworkWithRelations = Prisma.ArtworkGetPayload<{
	include: {
		Collection: {
			select: {
				id: true;
				title: true;
				slug: true;
			};
		};
		Artist: {
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
			{ 
				Artist: {
					some: {
						name: { contains: search, mode: 'insensitive' }
					}
				}
			},
			{
				Collection: {
					title: { contains: search, mode: 'insensitive' }
				}
			}
		];
	}

	// Validate and map sort field
	const validSortFields = {
		'id': 'id',
		'title': 'title',
		'artist': { Artist: { _count: sortOrder as 'asc' | 'desc' } },
		'collection': { Collection: { title: sortOrder as 'asc' | 'desc' } }
	};

	let orderBy: Prisma.ArtworkOrderByWithRelationInput = {};
	
	if (sortBy === 'artist') {
		// For artist sorting, we'll sort by the first artist's name
		orderBy = {
			Artist: {
				_count: sortOrder as 'asc' | 'desc'
			}
		};
	} else if (sortBy === 'collection') {
		// For collection sorting
		orderBy = {
			Collection: {
				title: sortOrder as 'asc' | 'desc'
			}
		};
	} else if (validSortFields[sortBy as keyof typeof validSortFields]) {
		orderBy[sortBy as keyof Prisma.ArtworkOrderByWithRelationInput] = sortOrder as 'asc' | 'desc';
	} else {
		// Default fallback
		orderBy = { id: 'desc' };
	}

	try {
		const [artworks, totalCount] = await Promise.all([
			prismaRead.artwork.findMany({
				where,
				include: {
					Collection: {
						select: {
							id: true,
							title: true,
							slug: true
						}
					},
					Artist: {
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
			prismaRead.artwork.count({ where })
		]);

		const transformedArtworks = artworks.map((artwork: ArtworkWithRelations) => ({
			...artwork,
			tokenID: artwork.tokenId,
			contractAddr: artwork.contractAddress,
			artists: artwork.Artist || [],
			artist: artwork.Artist && artwork.Artist.length > 0 ? artwork.Artist[0] : null,
			collection: artwork.Collection
		}));

		return new Response(
			JSON.stringify({
				artworks: transformedArtworks,
				totalCount,
				page,
				limit,
				totalPages: Math.ceil(totalCount / limit)
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('Error fetching artworks:', error);
		return new Response(JSON.stringify({ error: 'Failed to fetch artworks' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
