import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/prisma';

// Re-using the Artwork interface, assuming it might be defined in a shared types file in a real app
// For now, let's define it here for simplicity, or ensure it can be imported if it lives elsewhere (e.g., from the page.ts)
interface Artwork {
	id: string;
	title: string;
	imageUrl: string; // Will be the original image_url for frontend transformation
	description?: string; // Added for potential use in details
	year?: number;
	artistId: string; // To associate artwork with an artist
	// Add other relevant artwork properties here
}

export const GET: RequestHandler = async ({ params }) => {
	const artistId = params.artistId;

	if (!artistId) {
		return json({ error: 'Artist ID is required' }, { status: 400 });
	}

	try {
		// Query the database for real artwork data
		const artist = await prisma.artist.findUnique({
			where: { id: parseInt(artistId, 10) },
			include: {
				ArtistArtworks: {
					include: {
						artwork: {
							select: {
								id: true,
								title: true,
								description: true,
								image_url: true,
								mintDate: true,
								enabled: true
							}
						}
					}
				}
			}
		});

		if (!artist) {
			return json({ error: 'Artist not found' }, { status: 404 });
		}

		// Transform the data to match the expected interface
		const artworks: Artwork[] = artist.ArtistArtworks.filter((aa) => aa.artwork.enabled) // Only return enabled artworks
			.map((aa) => {
				const artwork = aa.artwork;
				return {
					id: String(artwork.id),
					title: artwork.title,
					imageUrl: artwork.image_url || '', // Original URL for frontend transformation
					description: artwork.description || undefined,
					year: artwork.mintDate ? new Date(artwork.mintDate).getFullYear() : undefined,
					artistId: artistId
				};
			});

		return json(artworks);
	} catch (error) {
		console.error('Error fetching artworks for artist:', error);
		return json({ error: 'Failed to fetch artworks' }, { status: 500 });
	}
};
