import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import prisma from '$lib/prisma';

export interface FeaturedArtworkData {
	id: string;
	title: string;
	description: string | null;
	imageUrl: string | null;
	animationUrl: string | null;
	generatorUrl: string | null;
	mime: string | null;
	dimensions: {
		width: number;
		height: number;
	} | null;
	mintDate: Date | null;
	artists: {
		id: number;
		name: string;
		avatarUrl: string | null;
		artworkCount: number;
	}[];
	collection: {
		id: number;
		title: string;
		slug: string;
		description: string | null;
		imageUrl: string | null;
		artworkCount: number;
	} | null;
}

export const GET: RequestHandler = async () => {
	try {
		// Get total count of eligible artworks
		const totalCount = await prisma.artwork.count({
			where: {
				AND: [
					{
						OR: [
							{ imageUrl: { not: null } },
							{ animationUrl: { not: null } },
							{ generatorUrl: { not: null } }
						]
					}
				]
			}
		});

		if (totalCount === 0) {
			return json(
				{ error: 'No artworks found' },
				{ status: 404 }
			);
		}

		// Generate a random offset
		const randomOffset = Math.floor(Math.random() * totalCount);

		// Get a random artwork with all necessary relations
		const artwork = await prisma.artwork.findFirst({
			where: {
				AND: [
					{
						OR: [
							{ imageUrl: { not: null } },
							{ animationUrl: { not: null } },
							{ generatorUrl: { not: null } }
						]
					}
				]
			},
			select: {
				id: true,
				title: true,
				description: true,
				imageUrl: true,
				animationUrl: true,
				generatorUrl: true,
				mime: true,
				dimensions: true,
				mintDate: true,
				collectionId: true,
				Artist: {
					select: {
						id: true,
						name: true,
						avatarUrl: true
					}
				},
				Collection: {
					select: {
						id: true,
						title: true,
						slug: true,
						description: true,
						imageUrl: true
					}
				}
			},
			skip: randomOffset
		});

		if (!artwork) {
			return json(
				{ error: 'No artworks found' },
				{ status: 404 }
			);
		}

		// Get artwork counts for each artist
		const artistsWithCounts = await Promise.all(
			artwork.Artist.map(async (artist) => {
				const artworkCount = await prisma.artwork.count({
					where: {
						Artist: {
							some: {
								id: artist.id
							}
						}
					}
				});

				return {
					...artist,
					artworkCount
				};
			})
		);

		// Get collection artwork count if the artwork has a collection
		let collectionWithCount = null;
		if (artwork.Collection) {
			const collectionArtworkCount = await prisma.artwork.count({
				where: {
					collectionId: artwork.Collection.id
				}
			});

			collectionWithCount = {
				...artwork.Collection,
				artworkCount: collectionArtworkCount
			};
		}

		const featuredArtwork: FeaturedArtworkData = {
			id: String(artwork.id),
			title: artwork.title,
			description: artwork.description,
			imageUrl: artwork.imageUrl,
			animationUrl: artwork.animationUrl,
			generatorUrl: artwork.generatorUrl,
			mime: artwork.mime,
			dimensions: artwork.dimensions as { width: number; height: number } | null,
			mintDate: artwork.mintDate,
			artists: artistsWithCounts,
			collection: collectionWithCount
		};

		return json({
			artwork: featuredArtwork
		});

	} catch (error) {
		console.error('Failed to fetch featured artwork:', error);
		return json(
			{ error: 'Failed to fetch featured artwork' },
			{ status: 500 }
		);
	}
}; 