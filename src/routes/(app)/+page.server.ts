import type { ServerLoad } from '@sveltejs/kit';
import prisma from '$lib/prisma'; // Assuming Prisma client is at $lib/prisma

// Define the structure of an Artwork for the preview
// This should match the fields you select from your Artwork model
export interface PreviewArtwork {
	id: string; // Assuming artwork IDs might be strings (UUIDs, CUIDs)
	title: string;
	image_url: string | null; // Changed to allow null
	dimensions?: {
		width: number;
		height: number;
	} | null;
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
		// Use a more efficient query with proper includes instead of raw SQL
		const artists = await prisma.artist.findMany({
			select: {
				id: true,
				name: true,
				avatarUrl: true,
				artworks: {
					select: {
						id: true,
						title: true,
						imageUrl: true,
						dimensions: true
					},
					take: 10 // Limit artworks per artist
				}
			},
			orderBy: {
				name: 'asc'
			}
		});

		// Transform the data to match the expected interface
		const artistsWithPreview: ArtistWithPreview[] = artists.map((artist) => {
			const transformedArtworks: PreviewArtwork[] = artist.artworks.map((artwork) => ({
				id: String(artwork.id),
				title: artwork.title,
				image_url: artwork.imageUrl,
				dimensions: artwork.dimensions as { width: number; height: number } | null
			}));

			return {
				id: artist.id,
				name: artist.name,
				previewArtwork: transformedArtworks.length > 0 ? transformedArtworks[0] : null,
				artworks: transformedArtworks
			};
		});

		// Filter to only include artists with artworks
		const artistsWithArtworks = artistsWithPreview.filter((artist) => artist.artworks.length > 0);

		// If no artists with artworks, return all artists anyway for debugging
		if (artistsWithArtworks.length === 0 && artists.length > 0) {
			const artistsWithoutArtworks: ArtistWithPreview[] = artists.map((artist) => ({
				id: artist.id,
				name: artist.name,
				previewArtwork: null,
				artworks: []
			}));
			
			return {
				artists: artistsWithoutArtworks
			};
		}

		return {
			artists: artistsWithArtworks
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
