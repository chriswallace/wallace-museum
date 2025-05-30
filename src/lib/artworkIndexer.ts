import prisma from '$lib/prisma';
import type { Artwork } from '@prisma/client';
import { Prisma } from '@prisma/client';

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

interface ArtistForNormalization {
	id: number;
	name: string;
}

/**
 * Generate normalized data for an artwork
 */
export async function normalizeArtworkData(artworkId: number): Promise<IndexedArtworkData | null> {
	const artwork = await prisma.artwork.findUnique({
		where: { id: artworkId },
		include: {
			collection: true, // Include collection details
			walletAddresses: {
				// Include the wallet addresses (updated relation name)
				include: {
					artist: true // Include the artist linked to each wallet address
				}
			}
		}
	});

	if (!artwork) {
		console.error(`[artworkIndexer] Artwork with ID ${artworkId} not found for normalization.`);
		return null;
	}

	const artists: ArtistForNormalization[] = [];
	if (artwork.walletAddresses) {
		for (const walletAddress of artwork.walletAddresses) {
			if (walletAddress.artist) {
				artists.push({
					id: walletAddress.artist.id,
					name: walletAddress.artist.name
				});
			}
		}
	}

	const collectionData = artwork.collection
		? {
				id: artwork.collection.id,
				name: artwork.collection.title,
				slug: artwork.collection.slug
			}
		: {
				id: null,
				name: artwork.contractAddress ? `Contract ${artwork.contractAddress.substring(0, 10)}...` : 'Unknown Collection',
				slug: null
			};

	const attributes = artwork.attributes
		? (artwork.attributes as any[]).map((attr) => ({
				trait_type: attr.trait_type || '',
				value: attr.value || ''
			}))
		: [];

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

	const tags: string[] = []; // Assuming tags are not directly on artwork model as per linter errors

	const normalizedData: IndexedArtworkData = {
		id: artwork.id,
		title: artwork.title,
		description: artwork.description,
		image_url: artwork.imageUrl,
		animation_url: artwork.animationUrl,
		blockchain: artwork.blockchain,
		collection: collectionData,
		artists,
		attributes,
		tags,
		contractAddr: artwork.contractAddress,
		contractAlias: artwork.collection?.title || null, // Using collection title or null
		tokenID: artwork.tokenId,
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
	// Fetch the artwork to get its direct properties for uid and basic info
	const artworkForUid = await prisma.artwork.findUnique({
		where: { id: artworkId },
		select: { contractAddress: true, tokenId: true, blockchain: true, attributes: true }
	});

	if (!artworkForUid) {
		console.error(`[artworkIndexer] Artwork with ID ${artworkId} not found for indexing.`);
		return; // Don't proceed if artwork doesn't exist
	}

	const normalizedData = await normalizeArtworkData(artworkId);

	if (!normalizedData) {
		console.error(
			`[artworkIndexer] Normalization failed for artwork ${artworkId}. Skipping indexing.`
		);
		return;
	}

	const nftUid = `${artworkForUid.contractAddress || 'unknown'}:${artworkForUid.tokenId || 'unknown'}`;
	const blockchain = artworkForUid.blockchain || 'Ethereum';
	const dataSource = blockchain.toLowerCase() === 'tezos' ? 'teztok' : 'opensea';

	// Look for existing index record for this contract address and token ID
	const existingIndexRecord = await prisma.artworkIndex.findFirst({
		where: {
			contractAddress: artworkForUid.contractAddress || 'unknown',
			tokenId: artworkForUid.tokenId || 'unknown'
		}
	});

	if (existingIndexRecord) {
		// Update the existing index record to link it to the artwork
		await prisma.artworkIndex.update({
			where: { id: existingIndexRecord.id },
			data: {
				artworkId: artworkId,
				nftUid: nftUid,
				blockchain: blockchain,
				dataSource: dataSource,
				rawResponse: artworkForUid.attributes || Prisma.JsonNull,
				normalizedData: normalizedData as any,
				importStatus: 'imported', // Mark as imported since we're linking to an artwork
				updatedAt: new Date()
			}
		});
		console.log(`[artworkIndexer] Updated existing index record for artwork ${artworkId} (${nftUid})`);
	} else {
		// No existing index record found - this is expected for artworks created outside the indexing flow
		// Do NOT create new index records while user is managing Artworks - they should only be created during discovery phase
		console.warn(`[artworkIndexer] No existing index record found for artwork ${artworkId} (${nftUid}). Skipping indexing - index records should only be created during discovery phase.`);
	}
}

/**
 * Index all artworks
 */
export async function indexAllArtworks(): Promise<void> {
	const artworks = await prisma.artwork.findMany({
		select: { id: true } // Only select IDs to avoid fetching large amounts of data
	});

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
		force?: boolean; // `force` is not used in current logic, but kept for signature
	} = {}
): Promise<void> {
	const { artworkIds, collectionId } = options;

	let whereClause: Prisma.ArtworkWhereInput = {};

	if (artworkIds && artworkIds.length > 0) {
		whereClause.id = { in: artworkIds };
	}

	if (collectionId) {
		whereClause.collectionId = collectionId;
	}

	const artworksToReindex = await prisma.artwork.findMany({
		where: whereClause,
		select: { id: true }
	});

	for (const artwork of artworksToReindex) {
		await indexArtwork(artwork.id);
	}
}

/**
 * Search indexed artworks
 */
export async function searchIndexedArtworks(params: {
	search?: string;
	artist?: string | number; // Can be artist ID (number) or artist name (string)
	collection?: string | number; // Can be collection ID (number) or slug/name (string)
	blockchain?: string;
	tags?: string[];
	minEditionSize?: number;
	maxEditionSize?: number;
	page?: number;
	pageSize?: number;
	sortBy?: string; // Field in normalizedData to sort by
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
		sortBy = 'id', // Default sort field (ensure 'id' exists in your normalizedData or adjust)
		sortDirection = 'desc'
	} = params;

	const skip = (page - 1) * pageSize;

	const whereConditions: Prisma.ArtworkIndexWhereInput[] = [];

	if (search) {
		whereConditions.push({
			OR: [
				{ normalizedData: { path: ['title'], string_contains: search } },
				{ normalizedData: { path: ['description'], string_contains: search } },
				{ normalizedData: { path: ['collection', 'name'], string_contains: search } },
				{ normalizedData: { path: ['artists'], array_contains: [{ name: search }] } } // Assumes artist name for search
			]
		});
	}

	if (artist) {
		if (typeof artist === 'number') {
			whereConditions.push({
				normalizedData: { path: ['artists'], array_contains: [{ id: artist }] }
			});
		} else {
			whereConditions.push({
				normalizedData: { path: ['artists'], array_contains: [{ name: artist }] }
			});
		}
	}

	if (collection) {
		if (typeof collection === 'number') {
			whereConditions.push({ normalizedData: { path: ['collection', 'id'], equals: collection } });
		} else {
			whereConditions.push({
				OR: [
					{ normalizedData: { path: ['collection', 'name'], string_contains: collection } },
					{ normalizedData: { path: ['collection', 'slug'], equals: collection } }
				]
			});
		}
	}

	if (blockchain) {
		whereConditions.push({ normalizedData: { path: ['blockchain'], equals: blockchain } });
	}

	if (tags && tags.length > 0) {
		// Assuming tags is an array of strings in normalizedData
		whereConditions.push({ normalizedData: { path: ['tags'], array_contains: tags } });
	}

	if (minEditionSize !== undefined || maxEditionSize !== undefined) {
		const editionSizeConditions: any = {};
		if (minEditionSize !== undefined) {
			editionSizeConditions.gte = minEditionSize;
		}
		if (maxEditionSize !== undefined) {
			editionSizeConditions.lte = maxEditionSize;
		}
		whereConditions.push({ normalizedData: { path: ['editionSize'], ...editionSizeConditions } });
	}

	const finalWhereClause: Prisma.ArtworkIndexWhereInput =
		whereConditions.length > 0 ? { AND: whereConditions } : {};

	const totalCount = await prisma.artworkIndex.count({
		where: finalWhereClause
	});

	// Prisma does not directly support orderBy on JSON sub-properties in a generic way for all DBs.
	// Sorting might need to be done in-memory after fetching, or by denormalizing sortable fields.
	const artworkIndexes = await prisma.artworkIndex.findMany({
		where: finalWhereClause,
		// orderBy: { normalizedData: { path: [sortBy], sort: sortDirection } }, // This specific JSON path ordering is not universally supported
		skip,
		take: pageSize
	});

	const items = artworkIndexes.map((ai) => {
		if (typeof ai.normalizedData === 'string') {
			try {
				return JSON.parse(ai.normalizedData);
			} catch (e) {
				console.error('Failed to parse normalizedData from artworkIndex record:', ai.id, e);
				return ai.normalizedData;
			}
		}
		return ai.normalizedData;
	});

	// If sorting is critical and needs to be DB-driven, consider denormalizing key sort fields
	// onto the ArtworkIndex table itself or use raw SQL for that specific query part.
	if (sortBy && sortDirection) {
		items.sort((a: any, b: any) => {
			const valA = a && a[sortBy] !== undefined ? a[sortBy] : null;
			const valB = b && b[sortBy] !== undefined ? b[sortBy] : null;

			if (valA === null && valB === null) return 0;
			if (valA === null) return sortDirection === 'asc' ? -1 : 1;
			if (valB === null) return sortDirection === 'asc' ? 1 : -1;

			if (typeof valA === 'string' && typeof valB === 'string') {
				return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
			}
			if (typeof valA === 'number' && typeof valB === 'number') {
				return sortDirection === 'asc' ? valA - valB : valB - valA;
			}
			return 0;
		});
	}

	return {
		items,
		pagination: {
			page,
			pageSize,
			totalCount,
			totalPages: Math.ceil(totalCount / pageSize)
		}
	};
}
