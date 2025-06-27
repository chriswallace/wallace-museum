import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/prisma';

// Updated Artwork interface to include all media fields
interface Artwork {
	id: string;
	title: string;
	imageUrl: string;
	animationUrl?: string;
	generatorUrl?: string;
	thumbnailUrl?: string;
	mime?: string;
	description?: string;
	year?: number;
	artistId: string;
	dimensions?: {
		width: number;
		height: number;
	};
	supply?: number;
}

export const GET: RequestHandler = async ({ params }) => {
	const artistId = params.artistId;

	if (!artistId) {
		return json({ error: 'Artist ID is required' }, { status: 400 });
	}

	try {
		// Query the database for real artwork data with all media fields
		const artist = await prisma.artist.findUnique({
			where: { id: parseInt(artistId, 10) },
			include: {
				Artwork: {
					select: {
						id: true,
						title: true,
						description: true,
						imageUrl: true,
						animationUrl: true,
						generatorUrl: true,
						thumbnailUrl: true,
						mime: true,
						mintDate: true,
						dimensions: true,
						supply: true
					},
					where: {
						// Only return enabled artworks if that field exists
						// enabled: true
					}
				}
			}
		});

		if (!artist) {
			return json({ error: 'Artist not found' }, { status: 404 });
		}

		// Transform the data to match the expected interface
		const artworks: Artwork[] = artist.Artwork.map((artwork) => {
			// Parse dimensions if they exist
			let dimensions: { width: number; height: number } | undefined;
			if (artwork.dimensions && typeof artwork.dimensions === 'object') {
				const dims = artwork.dimensions as any;
				if (dims.width && dims.height) {
					dimensions = {
						width: dims.width,
						height: dims.height
					};
				}
			}

			return {
				id: String(artwork.id),
				title: artwork.title,
				imageUrl: artwork.imageUrl || '',
				animationUrl: artwork.animationUrl || undefined,
				generatorUrl: artwork.generatorUrl || undefined,
				thumbnailUrl: artwork.thumbnailUrl || undefined,
				mime: artwork.mime || undefined,
				description: artwork.description || undefined,
				year: artwork.mintDate ? new Date(artwork.mintDate).getFullYear() : undefined,
				artistId: artistId,
				dimensions,
				supply: artwork.supply ?? undefined
			};
		});

		return json(artworks);
	} catch (error) {
		console.error('Error fetching artworks for artist:', error);
		return json({ error: 'Failed to fetch artworks' }, { status: 500 });
	}
};
