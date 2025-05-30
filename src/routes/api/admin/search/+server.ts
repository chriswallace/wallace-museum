import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import prisma from '$lib/prisma';
import { getWalletAddresses } from '$lib/settingsManager';
import type { RequestEvent } from './$types';
import type { Prisma } from '@prisma/client';

type NormalizedData = {
	title: string;
	description: string;
	image_url?: string;
	animation_url?: string;
	contractAddr?: string;
	contractAlias?: string;
	tokenID?: string;
	blockchain?: string;
	ownerAddresses?: string[];
	isCreatedBy?: string | null;
	attributes?: any[];
	tags?: string[];
	[key: string]: any;
};

type ArtworkResult = {
	id: number;
	title: string;
	description: string;
	image_url: string | null;
	animation_url: string | null;
	thumbnailUrl?: string | null;
	contractAddr: string;
	contractAlias: string;
	tokenID: string;
	blockchain: string;
	indexed: boolean;
	ownerAddresses: string[];
	isCreatedBy: string | null;
	attributes: any[];
	tags: string[];
	// Add artist information
	artist?: {
		name: string;
		avatarUrl: string | null;
		walletAddress?: string;
	} | null;
	// Add a flag to indicate if this supports rich artist lookup
	supportsArtistLookup: boolean;
	// Add import status
	isImported: boolean;
	// Add mint date
	mintDate?: string | null;
	mint_date?: string | null;
	timestamp?: string | null;
};

/**
 * API endpoint to search indexed artworks
 * This endpoint is used by the import page to search for artworks to import
 * It implements fuzzy search across all indexed data fields
 */
export async function GET({ url, request }: RequestEvent) {
	try {
		// Check for authentication using the session pattern
		const cookies = request.headers.get('cookie') || '';
		const sessionCookie = cookies.split(';').find((c) => c.trim().startsWith('session='));
		const sessionId = sessionCookie ? sessionCookie.split('=')[1] : '';

		let isAuthenticated = false;
		if (sessionId) {
			const session = await prisma.session.findUnique({
				where: { sessionId },
				include: { user: true }
			});

			// Check if the session is valid and not expired
			if (session && new Date(session.expiresAt) > new Date()) {
				isAuthenticated = true;
			}
		}

		if (!isAuthenticated) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const searchParams = url.searchParams;
		const query = searchParams.get('q') || '';
		const limit = parseInt(searchParams.get('limit') || '20', 10);
		const offset = parseInt(searchParams.get('offset') || '0', 10);
		const filter = searchParams.get('filter') || 'all';

		// Get user's wallet addresses for filtering
		const walletAddresses = await getWalletAddresses();
		const userAddresses = Array.isArray(walletAddresses) 
			? walletAddresses.map((addr) => addr.address.toLowerCase())
			: [];

		const searchConditions: Prisma.ArtworkIndexWhereInput = {
			// Remove the filter that excludes imported artworks
			// importStatus: {
			// 	not: 'imported' // Show all artworks that are NOT imported yet
			// }
		};

		// Add search query conditions
		if (query) {
			searchConditions.OR = [
				{ contractAddress: { contains: query, mode: 'insensitive' } },
				{ tokenId: { contains: query, mode: 'insensitive' } },
				{ blockchain: { contains: query, mode: 'insensitive' } },
				// Search in normalized data JSON for title and creator info
				{
					normalizedData: {
						path: ['title'],
						string_contains: query
					}
				} as any,
				{
					normalizedData: {
						path: ['creator', 'username'],
						string_contains: query
					}
				} as any,
				{
					normalizedData: {
						path: ['creator', 'address'],
						string_contains: query
					}
				} as any
			];
		}

		// Add filter conditions based on wallet addresses
		if (filter === 'created' && userAddresses.length > 0) {
			searchConditions.OR = searchConditions.OR || [];
			searchConditions.OR.push({
				normalizedData: {
					path: ['creator', 'address'],
					in: userAddresses
				}
			} as any);
		}
		// Note: 'owned' filter would require owner data which isn't stored in ArtworkIndex currently
		// For now, treat 'owned' the same as 'all'

		const results = await prisma.artworkIndex.findMany({
			where: searchConditions,
			take: limit,
			skip: offset,
			orderBy: { createdAt: 'desc' }
		});

		const total = await prisma.artworkIndex.count({ where: searchConditions });

		// Deduplicate by contract address and token ID
		const seenKeys = new Set<string>();
		const deduplicatedResults = [];

		for (const indexRecord of results) {
			const dedupeKey = `${indexRecord.contractAddress}-${indexRecord.tokenId}`;
			if (!seenKeys.has(dedupeKey)) {
				seenKeys.add(dedupeKey);
				deduplicatedResults.push(indexRecord);
			}
		}

		// Check import status for all deduplicated results
		const contractTokenPairs = deduplicatedResults.map((record) => ({
			contractAddress: record.contractAddress,
			tokenId: record.tokenId,
			artworkId: record.artworkId, // Include the artworkId from the index record
			importStatus: record.importStatus
		}));

		// Only get artwork data for records that are actually linked (have artworkId)
		const linkedArtworkIds = contractTokenPairs
			.filter(pair => pair.artworkId !== null)
			.map(pair => pair.artworkId as number); // Type assertion since we filtered out nulls

		const importedArtworks =
			linkedArtworkIds.length > 0
				? await prisma.artwork.findMany({
						where: {
							id: { in: linkedArtworkIds }
						},
						select: {
							id: true,
							contractAddress: true,
							tokenId: true,
							title: true, // Include title from Artwork table
							imageUrl: true,
							thumbnailUrl: true,
							animationUrl: true
						}
					})
				: [];

		// Create a lookup for imported artworks by their ID (not contract/token)
		const importedLookup = new Map(
			importedArtworks.map((artwork) => [
				artwork.id,
				{
					id: artwork.id,
					title: artwork.title,
					imageUrl: artwork.imageUrl,
					thumbnailUrl: artwork.thumbnailUrl,
					animationUrl: artwork.animationUrl,
					contractAddress: artwork.contractAddress,
					tokenId: artwork.tokenId
				}
			])
		);

		const artworkResults: ArtworkResult[] = deduplicatedResults.map((indexRecord: any) => {
			// Parse normalized data to get additional info
			const normalizedData = (indexRecord.normalizedData as any) || {};
			const importedInfo = indexRecord.artworkId ? importedLookup.get(indexRecord.artworkId) : null;
			
			// An artwork is considered imported only if:
			// 1. The ArtworkIndex record is linked to an artwork (artworkId is not null) AND
			// 2. That artwork actually exists in the database
			const isImported = !!importedInfo && indexRecord.artworkId !== null;

			// Use the normalized data for image URLs - prioritize thumbnailUrl for import screen
			let imageUrl = normalizedData.thumbnailUrl || normalizedData.imageUrl || '';
			let animationUrl = normalizedData.animationUrl || '';
			
			// Use the title from the imported artwork if available, otherwise use normalized data title
			let title = normalizedData.title;
			if (importedInfo && importedInfo.title) {
				title = importedInfo.title;
			}

			if (importedInfo) {
				// Use processed URLs from imported artwork, prioritizing thumbnailUrl for consistency
				imageUrl = importedInfo.thumbnailUrl || importedInfo.imageUrl || imageUrl;
				animationUrl = importedInfo.animationUrl || animationUrl;
			}

			return {
				id: indexRecord.id,
				title: title,
				description: normalizedData.description || '',
				image_url: imageUrl,
				animation_url: animationUrl,
				thumbnailUrl: normalizedData.thumbnailUrl,
				contractAddr: indexRecord.contractAddress,
				contractAlias: normalizedData.collection?.name || normalizedData.collection?.title || '',
				tokenID: indexRecord.tokenId,
				blockchain: indexRecord.blockchain,
				indexed: true,
				ownerAddresses: normalizedData.owners?.map((o: any) => o.address) || [],
				isCreatedBy: normalizedData.creator?.address,
				attributes: normalizedData.attributes || [],
				tags: normalizedData.tags || [],
				// Add artist information from the normalized data
				artist: normalizedData.creator
					? {
							name: normalizedData.creator.username || normalizedData.creator.address,
							avatarUrl: normalizedData.creator.avatarUrl || null,
							walletAddress: normalizedData.creator.address
						}
					: null,
				supportsArtistLookup: !!normalizedData.creator,
				// Add import status
				isImported: isImported,
				// Add mint date fields
				mintDate: normalizedData.mintDate || null,
				mint_date: normalizedData.mintDate || null,
				timestamp: normalizedData.timestamp || null
			};
		});

		return json({
			results: artworkResults,
			total,
			offset,
			limit
		});
	} catch (error) {
		console.error('Search error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
