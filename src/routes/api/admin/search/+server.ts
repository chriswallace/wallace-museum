import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import prisma from '$lib/prisma';
import type { ArtworkIndex } from '@prisma/client';

type IndexedData = {
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

/**
 * API endpoint to search indexed artworks
 * This endpoint is used by the import page to search for artworks to import
 * It implements fuzzy search across all indexed data fields
 */
export const GET: RequestHandler = async ({ url, request }) => {
	try {
		const searchTerm = url.searchParams.get('q') || '';
		const limit = parseInt(url.searchParams.get('limit') || '40');
		const offset = parseInt(url.searchParams.get('offset') || '0');

		// Build the query conditions
		const whereConditions: any = {
			// Only show artworks that haven't been imported yet
			artworkId: null
		};

		// Add search term if provided for fuzzy search across multiple fields
		if (searchTerm) {
			const searchTerms = searchTerm
				.toLowerCase()
				.split(' ')
				.filter((term) => term.length > 0);

			if (searchTerms.length > 0) {
				const searchConditions = [];

				// Search across common text fields
				for (const term of searchTerms) {
					searchConditions.push(
						{ indexedData: { path: ['title'], string_contains: term } },
						{ indexedData: { path: ['description'], string_contains: term } },
						{ indexedData: { path: ['contractAddr'], string_contains: term } },
						{ indexedData: { path: ['contractAlias'], string_contains: term } },
						{ indexedData: { path: ['tokenID'], string_contains: term } },
						{ indexedData: { path: ['blockchain'], string_contains: term } }
					);
				}

				whereConditions.OR = searchConditions;
			}
		}

		// Count total matching records for pagination
		const totalCount = await prisma.artworkIndex.count({
			where: whereConditions
		});

		// Get the actual records with pagination
		const results = (await prisma.artworkIndex.findMany({
			where: whereConditions,
			orderBy: {
				updatedAt: 'desc'
			},
			skip: offset,
			take: limit
		})) as (ArtworkIndex & { indexedData: any })[];

		// Format the results
		const formattedResults = results.map((item: ArtworkIndex) => {
			const indexedData = item.indexedData as IndexedData;

			// Generate a unique ID for the artwork (needed for selection)
			const uniqueId = item.id;

			return {
				id: uniqueId,
				title: indexedData.title || 'Untitled',
				description: indexedData.description || '',
				image_url: indexedData.image_url || null,
				animation_url: indexedData.animation_url || null,
				contractAddr: indexedData.contractAddr || '',
				contractAlias: indexedData.contractAlias || '',
				tokenID: indexedData.tokenID || '',
				blockchain: indexedData.blockchain || '',
				indexed: true,
				ownerAddresses: indexedData.ownerAddresses || [],
				isCreatedBy: indexedData.isCreatedBy || null,
				// Include any other fields needed for display or import
				attributes: indexedData.attributes || [],
				tags: indexedData.tags || []
			};
		});

		return json({
			success: true,
			results: formattedResults,
			pagination: {
				total: totalCount,
				offset,
				limit,
				hasMore: offset + limit < totalCount
			}
		});
	} catch (error) {
		console.error('Error in search endpoint:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};
