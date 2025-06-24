import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import prisma from '$lib/prisma';

export interface CollectionGroup {
	id: number;
	title: string;
	slug: string;
	description: string | null;
	imageUrl: string | null;
	isSharedContract: boolean;
	artBlocksProjectId: number | null;
	fxhashProjectId: number | null;
	artworkCount: number;
	artworks: {
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
	}[];
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const limit = parseInt(url.searchParams.get('limit') || '6');
		const excludeCollectionIds = url.searchParams.get('excludeCollections')?.split(',').filter(Boolean).map(id => parseInt(id)) || [];
		
		// Get collections that are curatorially meaningful (not shared contracts)
		// and have multiple artworks to show relationships
		const collections = await prisma.collection.findMany({
			where: {
				AND: [
					{ enabled: true },
					{ isSharedContract: false }, // Exclude shared contracts like OpenSea
					excludeCollectionIds.length > 0 ? {
						id: {
							notIn: excludeCollectionIds
						}
					} : {},
					{
						Artwork: {
							some: {
								OR: [
									{ imageUrl: { not: null } },
									{ animationUrl: { not: null } }
								]
							}
						}
					}
				]
			},
			select: {
				id: true,
				title: true,
				slug: true,
				description: true,
				imageUrl: true,
				isSharedContract: true,
				artBlocksProjectId: true,
				fxhashProjectId: true,
				_count: {
					select: {
						Artwork: {
							where: {
								OR: [
									{ imageUrl: { not: null } },
									{ animationUrl: { not: null } }
								]
							}
						}
					}
				},
				Artwork: {
					where: {
						OR: [
							{ imageUrl: { not: null } },
							{ animationUrl: { not: null } }
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
					orderBy: [
						{ mintDate: 'asc' }, // Show chronological progression within collections
						{ id: 'asc' }
					],
					take: 8 // Max 8 artworks per collection for variety
				}
			},
			orderBy: [
				{ 
					Artwork: {
						_count: 'desc' // Prioritize collections with more artworks
					}
				},
				{ id: 'desc' }
			],
			take: limit
		});

		// Filter collections that actually have artworks and transform data
		const collectionGroups: CollectionGroup[] = collections
			.filter(collection => collection.Artwork.length > 0)
			.map(collection => ({
				id: collection.id,
				title: collection.title,
				slug: collection.slug,
				description: collection.description,
				imageUrl: collection.imageUrl,
				isSharedContract: collection.isSharedContract,
				artBlocksProjectId: collection.artBlocksProjectId,
				fxhashProjectId: collection.fxhashProjectId,
				artworkCount: collection._count.Artwork, // Use the actual count from _count
				artworks: collection.Artwork.map(artwork => ({
					id: String(artwork.id),
					title: artwork.title,
					imageUrl: artwork.imageUrl,
					animationUrl: artwork.animationUrl,
					mime: artwork.mime,
					dimensions: artwork.dimensions as { width: number; height: number } | null,
					mintDate: artwork.mintDate,
					artists: artwork.Artist
				}))
			}));

		// Check if there are more collections available
		const totalCollections = await prisma.collection.count({
			where: {
				AND: [
					{ enabled: true },
					{ isSharedContract: false },
					excludeCollectionIds.length > 0 ? {
						id: {
							notIn: excludeCollectionIds
						}
					} : {},
					{
						Artwork: {
							some: {
								OR: [
									{ imageUrl: { not: null } },
									{ animationUrl: { not: null } }
								]
							}
						}
					}
				]
			}
		});

		const hasMore = totalCollections > excludeCollectionIds.length + collectionGroups.length;

		return json({
			collections: collectionGroups,
			hasMore
		});

	} catch (error) {
		console.error('Failed to fetch collection groups:', error);
		return json(
			{ error: 'Failed to fetch collection groups' },
			{ status: 500 }
		);
	}
}; 