import prisma from '$lib/prisma';
import { Prisma } from '@prisma/client';

// Define a type for the artwork object including relations we expect
type ArtworkWithRelations = Prisma.ArtworkGetPayload<{
	include: {
		collection: true;
		ArtistArtworks: {
			include: {
				artist: true;
			};
		};
	};
}>;

export async function GET({ url }) {
	try {
		const page = parseInt(url.searchParams.get('page') || '1');
		const sortColumn = url.searchParams.get('sort') || 'title';
		const sortOrder = url.searchParams.get('order') || 'asc';
		const limit = 25;
		const offset = (page - 1) * limit;

		let orderBy: Prisma.ArtworkOrderByWithRelationInput[] = [];
		if (sortColumn && sortOrder) {
			if (sortColumn === 'artist') {
				console.warn('Sorting by artist is not currently supported in this list view.');
				orderBy.push({ title: 'asc' });
			} else if (sortColumn === 'collection') {
				orderBy.push({
					collection: {
						title: sortOrder as Prisma.SortOrder
					}
				});
			} else {
				orderBy.push({
					[sortColumn]: sortOrder as Prisma.SortOrder
				});
			}
		} else {
			orderBy.push({ title: 'asc' });
		}

		const search = url.searchParams.get('search') || '';
		let whereClause: Prisma.ArtworkWhereInput = {};

		if (search) {
			whereClause = {
				OR: [
					{ title: { contains: search, mode: 'insensitive' } },
					{
						ArtistArtworks: {
							some: { artist: { name: { contains: search, mode: 'insensitive' } } }
						}
					},
					{ collection: { title: { contains: search, mode: 'insensitive' } } }
				]
			};
		}

		const totalArtworks = await prisma.artwork.count({ where: whereClause });

		const artworks: ArtworkWithRelations[] = await prisma.artwork.findMany({
			where: whereClause,
			skip: offset,
			take: limit,
			orderBy: orderBy,
			include: {
				collection: true,
				ArtistArtworks: {
					include: {
						artist: true
					}
				}
			}
		});

		const transformedArtworks = artworks.map((artwork) => {
			type ArtistArtworkJoin = Prisma.ArtistArtworksGetPayload<{ include: { artist: true } }>;

			const transformed = {
				...artwork,
				artists: artwork.ArtistArtworks.map((aa: ArtistArtworkJoin) => aa.artist)
			};
			return transformed;
		});

		return new Response(
			JSON.stringify({
				artworks: transformedArtworks,
				total: totalArtworks,
				page,
				totalPages: Math.ceil(totalArtworks / limit)
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	} catch (error) {
		console.error('Error fetching artworks list:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return new Response(JSON.stringify({ error: 'An error occurred', details: errorMessage }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
}
