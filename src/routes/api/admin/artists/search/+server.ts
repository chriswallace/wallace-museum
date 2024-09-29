// File: /src/routes/api/admin/artists/search/+server.ts
import prisma from '$lib/prisma';

// GET: Search Artist Names
export async function GET({ url }) {
	const searchQuery = url.searchParams.get('search') || '';

	try {
		const artists = await prisma.artist.findMany({
			where: {
				name: {
					contains: searchQuery,
					mode: 'insensitive' // Case-insensitive search
				}
			},
			include: {
				artworks: true // Optionally include related artworks
			},
			orderBy: {
				name: 'asc' // Order results alphabetically
			}
		});

		return new Response(JSON.stringify(artists), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Failed to search artists:', error);
		return new Response(JSON.stringify({ error: 'Failed to search artists' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
