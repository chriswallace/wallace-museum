// File: /src/routes/api/admin/artists/search/+server.ts
import prisma from '$lib/prisma';

// GET: Search Artist Names
export async function GET({ url }: { url: URL }) {
	const searchQuery = url.searchParams.get('search') || '';

	try {
		const artists = await prisma.artist.findMany({
			where: {
				name: {
					contains: searchQuery,
					mode: 'insensitive' // Case-insensitive search
				}
			},
			orderBy: {
				name: 'asc' // Order results alphabetically
			}
		});

		// For now, return artists without artworks to avoid the include issue
		// TODO: Fix the walletAddresses relationship and add artworks back
		const transformedArtists = artists.map((artist) => ({
			...artist,
			artworks: [] // Empty array for now
		}));

		return new Response(JSON.stringify(transformedArtists), {
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
