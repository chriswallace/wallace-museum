import type { ServerLoad } from '@sveltejs/kit';
import prisma from '$lib/prisma'; // Assuming Prisma client is at $lib/prisma

// Define the structure of an Artwork for the preview
// This should match the fields you select from your Artwork model
export interface PreviewArtwork {
	id: string; // Assuming artwork IDs might be strings (UUIDs, CUIDs)
	title: string;
	image_url: string | null; // Changed to allow null
}

// Define the structure for an Artist, including all artworks
export interface ArtistWithPreview {
	id: number;
	name: string;
	previewArtwork: PreviewArtwork | null;
	artworks: PreviewArtwork[]; // Add all artworks for preloading
}

export const load: ServerLoad = async () => {
	try {
		// First, let's get all artists and see if there are any
		const allArtists = await prisma.artist.findMany({
			select: {
				id: true,
				name: true,
				avatarUrl: true
			}
		});

		// Get all artworks to see what's available
		const allArtworks = await prisma.artwork.findMany({
			select: {
				id: true,
				title: true,
				imageUrl: true
			},
			take: 10
		});

		// Get artists with their artworks using raw query
		const artistsWithArtworks = await Promise.all(
			allArtists.map(async (artist) => {
				const artworks = await prisma.$queryRaw`
					SELECT a.id, a.title, a."imageUrl"
					FROM "Artwork" a
					JOIN "_ArtistArtworks" aa ON a.id = aa."B"
					WHERE aa."A" = ${artist.id}
					LIMIT 10
				` as any[];

				const transformedArtworks: PreviewArtwork[] = artworks.map((artwork) => ({
					id: String(artwork.id),
					title: artwork.title,
					image_url: artwork.imageUrl
				}));

				return {
					id: artist.id,
					name: artist.name,
					previewArtwork: transformedArtworks.length > 0 ? transformedArtworks[0] : null,
					artworks: transformedArtworks
				};
			})
		);

		// Filter to only include artists with artworks
		const artists = artistsWithArtworks.filter((artist) => artist.artworks.length > 0);

		// Sort artists alphabetically by name
		artists.sort((a, b) => a.name.localeCompare(b.name));

		// If no artists with artworks, return all artists anyway for debugging
		if (artists.length === 0 && allArtists.length > 0) {
			const artistsWithoutArtworks: ArtistWithPreview[] = allArtists.map((artist) => ({
				id: artist.id,
				name: artist.name,
				previewArtwork: null,
				artworks: []
			}));
			
			// Sort the fallback list alphabetically as well
			artistsWithoutArtworks.sort((a, b) => a.name.localeCompare(b.name));
			
			return {
				artists: artistsWithoutArtworks
			};
		}

		return {
			artists: artists
		};
	} catch (error) {
		console.error('Failed to load artists:', error);
		// Return an empty array or an error state for the page to handle
		return {
			artists: [],
			error: 'Could not load artists from the database.'
		};
	}
};
