import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import prisma from '$lib/prisma';

export interface FeedArtwork {
	id: string;
	title: string;
	imageUrl: string | null;
	animationUrl: string | null;
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
	}[];
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const limit = parseInt(url.searchParams.get('limit') || '10');
		const excludeIds = url.searchParams.get('exclude')?.split(',').filter(Boolean) || [];
		
		// Get total count for random selection
		const eligibleCount = await prisma.artwork.count({
			where: {
				AND: [
					{
						OR: [
							{ imageUrl: { not: null } },
							{ animationUrl: { not: null } }
						]
					},
					excludeIds.length > 0 ? {
						id: {
							notIn: excludeIds.map(id => parseInt(id))
						}
					} : {}
				]
			}
		});

		// Generate random offset, but ensure we don't exceed available artworks
		const maxOffset = Math.max(0, eligibleCount - limit);
		const randomOffset = Math.floor(Math.random() * (maxOffset + 1));

		const artworks = await prisma.artwork.findMany({
			where: {
				AND: [
					{
						OR: [
							{ imageUrl: { not: null } },
							{ animationUrl: { not: null } }
						]
					},
					excludeIds.length > 0 ? {
						id: {
							notIn: excludeIds.map(id => parseInt(id))
						}
					} : {}
				]
			},
			select: {
				id: true,
				title: true,
				imageUrl: true,
				animationUrl: true,
				mime: true,
				dimensions: true,
				mintDate: true,
				Artist: {
					select: {
						id: true,
						name: true,
						avatarUrl: true
					}
				}
			},
			skip: randomOffset,
			take: limit
		});

		const transformedArtworks: FeedArtwork[] = artworks.map((artwork) => ({
			id: String(artwork.id),
			title: artwork.title,
			imageUrl: artwork.imageUrl,
			animationUrl: artwork.animationUrl,
			mime: artwork.mime,
			dimensions: artwork.dimensions as { width: number; height: number } | null,
			mintDate: artwork.mintDate,
			artists: artwork.Artist
		}));

		// Check if there are more artworks available
		const totalCount = await prisma.artwork.count({
			where: {
				AND: [
					{
						OR: [
							{ imageUrl: { not: null } },
							{ animationUrl: { not: null } }
						]
					},
					excludeIds.length > 0 ? {
						id: {
							notIn: excludeIds.map(id => parseInt(id))
						}
					} : {}
				]
			}
		});

		const remainingCount = totalCount - excludeIds.length - artworks.length;
		const hasMore = remainingCount > 0;

		return json({
			artworks: transformedArtworks,
			hasMore
		});

	} catch (error) {
		console.error('Failed to fetch artworks:', error);
		return json(
			{ error: 'Failed to fetch artworks' },
			{ status: 500 }
		);
	}
}; 