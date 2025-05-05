// File: /src/routes/api/admin/artworks/search/+server.ts
import prisma from '$lib/prisma';

// GET: Search Artwork Titles
export async function GET({ url }) {
	const searchQuery = url.searchParams.get('query') || '';

	try {
		const artworks = await prisma.artwork.findMany({
			where: {
				title: {
					contains: searchQuery,
					mode: 'insensitive' // Case-insensitive search
				}
			},
			include: {
				ArtistArtworks: {
					include: {
						artist: true
					}
				},
				collection: true // Include collection details if needed
			}
		});

		return new Response(JSON.stringify(artworks), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Failed to search artworks:', error);
		return new Response(JSON.stringify({ error: 'Failed to search artworks' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
