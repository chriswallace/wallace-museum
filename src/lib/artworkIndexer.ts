import prisma from '$lib/prisma';
import type { Artwork } from '@prisma/client';

/**
 * Normalized structure for indexed artwork data
 */
export interface IndexedArtworkData {
	id: number;
	title: string;
	description: string | null;
	image_url: string | null;
	animation_url: string | null;
	blockchain: string | null;
	collection: {
		id: number | null;
		name: string | null;
		slug: string | null;
	};
	artists: Array<{
		id: number;
		name: string;
	}>;
	attributes: Array<{
		trait_type: string;
		value: string;
	}>;
	tags: string[];
	contractAddr: string | null;
	contractAlias: string | null;
	tokenID: string | null;
	mime: string | null;
	tokenStandard: string | null;
	mintDate: string | null;
	editionSize: number | null;
}

/**
 * Generate normalized data for an artwork
 */
export async function normalizeArtworkData(artwork: Artwork): Promise<IndexedArtworkData> {
	// Get related artists
	const artistArtworks = await prisma.artistArtworks.findMany({
		where: { artworkId: artwork.id },
		include: {
			artist: true
		}
	});

	// Get collection data
	const collection = artwork.collectionId
		? await prisma.collection.findUnique({
				where: { id: artwork.collectionId }
			})
		: null;

	// Parse attributes from JSON
	const attributes = artwork.attributes
		? (artwork.attributes as any[]).map((attr) => ({
				trait_type: attr.trait_type || '',
				value: attr.value || ''
			}))
		: [];

	// Extract edition size from attributes if available
	let editionSize = null;
	const editionAttr = attributes.find(
		(attr) =>
			attr.trait_type.toLowerCase().includes('edition') &&
			attr.trait_type.toLowerCase().includes('size')
	);

	if (editionAttr) {
		const match = editionAttr.value.match(/(\d+)/);
		if (match) {
			editionSize = parseInt(match[1], 10);
		}
	}

	// Parse tags from JSON
	const tags = artwork.tags ? (artwork.tags as string[]) : [];

	// Normalize the data
	const normalizedData: IndexedArtworkData = {
		id: artwork.id,
		title: artwork.title,
		description: artwork.description,
		image_url: artwork.image_url,
		animation_url: artwork.animation_url,
		blockchain: artwork.blockchain,
		collection: {
			id: collection?.id || null,
			name: collection?.title || artwork.contractAlias || null,
			slug: collection?.slug || null
		},
		artists: artistArtworks.map((aa) => ({
			id: aa.artist.id,
			name: aa.artist.name
		})),
		attributes,
		tags,
		contractAddr: artwork.contractAddr,
		contractAlias: artwork.contractAlias,
		tokenID: artwork.tokenID,
		mime: artwork.mime,
		tokenStandard: artwork.tokenStandard,
		mintDate: artwork.mintDate ? artwork.mintDate.toISOString() : null,
		editionSize
	};

	return normalizedData;
}

/**
 * Index a single artwork
 */
export async function indexArtwork(artworkId: number): Promise<void> {
	const artwork = await prisma.artwork.findUnique({
		where: { id: artworkId }
	});

	if (!artwork) {
		throw new Error(`Artwork with ID ${artworkId} not found`);
	}

	const normalizedData = await normalizeArtworkData(artwork);

	// Upsert the index record
	await prisma.artworkIndex.upsert({
		where: { artworkId: artwork.id },
		create: {
			artworkId: artwork.id,
			indexedData: normalizedData as any
		},
		update: {
			indexedData: normalizedData as any,
			updatedAt: new Date()
		}
	});
}

/**
 * Index all artworks
 */
export async function indexAllArtworks(): Promise<void> {
	const artworks = await prisma.artwork.findMany();

	for (const artwork of artworks) {
		await indexArtwork(artwork.id);
	}
}

/**
 * Reindex artworks
 * @param options Options for reindexing
 */
export async function reindexArtworks(
	options: {
		artworkIds?: number[];
		collectionId?: number;
		force?: boolean;
	} = {}
): Promise<void> {
	const { artworkIds, collectionId, force = false } = options;

	let whereClause: any = {};

	if (artworkIds && artworkIds.length > 0) {
		whereClause.id = { in: artworkIds };
	}

	if (collectionId) {
		whereClause.collectionId = collectionId;
	}

	const artworks = await prisma.artwork.findMany({
		where: whereClause
	});

	for (const artwork of artworks) {
		await indexArtwork(artwork.id);
	}
}

/**
 * Search indexed artworks
 */
export async function searchIndexedArtworks(params: {
	search?: string;
	artist?: string | number;
	collection?: string | number;
	blockchain?: string;
	tags?: string[];
	minEditionSize?: number;
	maxEditionSize?: number;
	page?: number;
	pageSize?: number;
	sortBy?: string;
	sortDirection?: 'asc' | 'desc';
}) {
	const {
		search,
		artist,
		collection,
		blockchain,
		tags,
		minEditionSize,
		maxEditionSize,
		page = 1,
		pageSize = 20,
		sortBy = 'id',
		sortDirection = 'desc'
	} = params;

	const skip = (page - 1) * pageSize;

	// Build where clause
	let whereClause: any = {};

	// Handle search term
	if (search) {
		whereClause.OR = [
			{ indexedData: { path: ['title'], string_contains: search } },
			{ indexedData: { path: ['description'], string_contains: search } },
			{ indexedData: { path: ['collection', 'name'], string_contains: search } },
			{ indexedData: { path: ['artists'], array_contains: [{ name: { contains: search } }] } }
		];
	}

	// Filter by artist
	if (artist) {
		const artistCondition = typeof artist === 'number' ? { id: artist } : { name: artist };

		whereClause.indexedData = {
			path: ['artists'],
			array_contains: [artistCondition]
		};
	}

	// Filter by collection
	if (collection) {
		if (typeof collection === 'number') {
			whereClause.indexedData = {
				path: ['collection', 'id'],
				equals: collection
			};
		} else {
			whereClause.OR = [
				{ indexedData: { path: ['collection', 'name'], string_contains: collection } },
				{ indexedData: { path: ['collection', 'slug'], string_contains: collection } }
			];
		}
	}

	// Filter by blockchain
	if (blockchain) {
		whereClause.indexedData = {
			path: ['blockchain'],
			equals: blockchain
		};
	}

	// Filter by tags
	if (tags && tags.length > 0) {
		whereClause.indexedData = {
			path: ['tags'],
			array_contains: tags
		};
	}

	// Filter by edition size
	if (minEditionSize !== undefined || maxEditionSize !== undefined) {
		const editionSizeCondition: any = {};

		if (minEditionSize !== undefined) {
			editionSizeCondition.gte = minEditionSize;
		}

		if (maxEditionSize !== undefined) {
			editionSizeCondition.lte = maxEditionSize;
		}

		whereClause.indexedData = {
			path: ['editionSize'],
			...editionSizeCondition
		};
	}

	// Get total count for pagination
	const totalCount = await prisma.artworkIndex.count({
		where: whereClause
	});

	// Get the indexed artworks
	const indexedArtworks = (await prisma.artworkIndex.findMany({
		where: whereClause,
		orderBy: {
			indexedData: {
				path: [sortBy],
				sort: sortDirection
			}
		},
		skip,
		take: pageSize
	})) as { indexedData: any }[];

	return {
		items: indexedArtworks.map((ia) => ia.indexedData),
		pagination: {
			page,
			pageSize,
			totalCount,
			totalPages: Math.ceil(totalCount / pageSize)
		}
	};
}
