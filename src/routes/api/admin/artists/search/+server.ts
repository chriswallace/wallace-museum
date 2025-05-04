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
				ArtistArtworks: {
					include: {
						artwork: true // Include the actual artwork data
					}
				}
			},
			orderBy: {
				name: 'asc' // Order results alphabetically
			}
		});

		// OPTIONAL: Transform the result if needed to provide a simple `artworks` array per artist
		const transformedArtists = artists.map(artist => ({
			...artist,
			artworks: artist.ArtistArtworks.map(aa => aa.artwork)
			// Optionally remove ArtistArtworks if not needed directly:
			// delete artist.ArtistArtworks; 
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
