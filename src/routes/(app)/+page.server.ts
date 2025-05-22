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
		const artistsFromDb = await prisma.artist.findMany({
			// where: { enabled: true }, // Uncomment if you have an 'enabled' field for artists
			include: {
				ArtistArtworks: {
					include: {
						artwork: {
							select: {
								id: true,
								title: true,
								image_url: true
							}
						}
					}
				}
			}
		});

		// Map to the desired structure for the frontend, using the first artwork from ArtistArtworks if available
		const artists: ArtistWithPreview[] = artistsFromDb
			.filter((artist) => artist.ArtistArtworks && artist.ArtistArtworks.length > 0)
			.map((artist) => {
				const aa = artist.ArtistArtworks[0];
				const artworkPreviewData = aa?.artwork;
				const allArtworks = artist.ArtistArtworks.map((aa) => ({
					id: String(aa.artwork.id),
					title: aa.artwork.title,
					image_url: aa.artwork.image_url
				}));
				return {
					id: artist.id,
					name: artist.name,
					previewArtwork: artworkPreviewData
						? {
								id: String(artworkPreviewData.id),
								title: artworkPreviewData.title,
								image_url: artworkPreviewData.image_url
							}
						: null,
					artworks: allArtworks
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
