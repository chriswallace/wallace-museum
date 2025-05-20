import type { ServerLoad } from '@sveltejs/kit';
import prisma from '$lib/prisma'; // Assuming Prisma client is at $lib/prisma

// Define the structure of an Artwork for the preview
// This should match the fields you select from your Artwork model
export interface PreviewArtwork {
	id: string; // Assuming artwork IDs might be strings (UUIDs, CUIDs)
	title: string;
	image_url: string | null; // Changed to allow null
}

// Define the structure for an Artist, including a potential preview artwork
export interface ArtistWithPreview {
	id: number; // Changed to number based on linter hint for Artist.id
	name: string;
	previewArtwork: PreviewArtwork | null;
}

export const load: ServerLoad = async () => {
	try {
		const artistsFromDb = await prisma.artist.findMany({
			// where: { enabled: true }, // Uncomment if you have an 'enabled' field for artists
			include: {
				artworks: {
					// Include artworks to find a preview
					orderBy: {
						// createdAt: 'asc', // Or some other criteria to pick a consistent preview
						// For now, just take any one that might be returned by default ordering
					},
					take: 1, // We only need one artwork for the preview
					select: {
						// Select only necessary fields for the preview artwork
						id: true,
						title: true,
						image_url: true // Changed from imageUrl
					}
				}
			}
		});

		// Filter out artists who don't have any artworks (if `take: 1` didn't implicitly handle this with an empty array)
		// And map to the desired structure for the frontend
		const artists: ArtistWithPreview[] = artistsFromDb
			.filter((artist) => artist.artworks && artist.artworks.length > 0)
			.map((artist) => {
				const artworkPreviewData = artist.artworks[0];
				return {
					id: artist.id, // This should now match ArtistWithPreview.id (number)
					name: artist.name,
					previewArtwork: artworkPreviewData
						? {
								id: String(artworkPreviewData.id), // Ensure Artwork ID is string if PreviewArtwork.id is string
								title: artworkPreviewData.title,
								image_url: artworkPreviewData.image_url
							}
						: null
				};
			});

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
