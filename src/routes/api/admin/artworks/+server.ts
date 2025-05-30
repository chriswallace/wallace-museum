import prisma from '$lib/prisma';
import { Prisma } from '@prisma/client';

// Define a type for the artwork object including relations we expect
type ArtworkWithRelations = Prisma.ArtworkGetPayload<{
	include: {
		collection: true;
		artists: true;
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
			{ description: { contains: search, mode: 'insensitive' } }
		];
	}

	const orderBy: Prisma.ArtworkOrderByWithRelationInput = {};
	orderBy[sortBy as keyof Prisma.ArtworkOrderByWithRelationInput] = sortOrder as 'asc' | 'desc';

	try {
		const [artworks, totalCount] = await Promise.all([
			prisma.artwork.findMany({
				where,
				include: {
					collection: true,
					artists: true
				},
				orderBy,
				skip: offset,
				take: limit
			}),
			prisma.artwork.count({ where })
		]);

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
