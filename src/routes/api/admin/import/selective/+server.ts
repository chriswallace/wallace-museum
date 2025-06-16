import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prismaRead } from '$lib/prisma';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { selectedWallets, filter = 'all' } = body;

		if (!selectedWallets || !Array.isArray(selectedWallets) || selectedWallets.length === 0) {
			return json({ error: 'Selected wallets are required' }, { status: 400 });
		}

		// Extract wallet addresses from selected wallets - keep original case
		const walletAddresses = selectedWallets.map((wallet: any) => wallet.address);

		// Build search conditions based on selected wallets
		// For each wallet, check both original case and lowercase to handle different blockchains
		const walletConditions = walletAddresses.flatMap(address => [
			// Check if wallet is the creator (original case)
			{
				normalizedData: {
					path: ['creator', 'address'],
					equals: address
				}
			},
			// Check if wallet is the creator (lowercase)
			{
				normalizedData: {
					path: ['creator', 'address'],
					equals: address.toLowerCase()
				}
			},
			// Check if wallet is in the owners array (original case)
			{
				normalizedData: {
					path: ['owners'],
					array_contains: [{ address }]
				}
			},
			// Check if wallet is in the owners array (lowercase)
			{
				normalizedData: {
					path: ['owners'],
					array_contains: [{ address: address.toLowerCase() }]
				}
			}
		]);

		let searchConditions: any = {
			OR: walletConditions
		};

		// Apply filter logic
		if (filter === 'created') {
			// Only show artworks created by the selected wallets
			const createdConditions = walletAddresses.flatMap(address => [
				{
					normalizedData: {
						path: ['creator', 'address'],
						equals: address
					}
				},
				{
					normalizedData: {
						path: ['creator', 'address'],
						equals: address.toLowerCase()
					}
				}
			]);
			
			searchConditions = {
				OR: createdConditions
			};
		} else if (filter === 'owned') {
			// Only show artworks owned by the selected wallets but NOT created by them
			const ownedConditions = walletAddresses.flatMap(address => [
				{
					normalizedData: {
						path: ['owners'],
						array_contains: [{ address }]
					}
				},
				{
					normalizedData: {
						path: ['owners'],
						array_contains: [{ address: address.toLowerCase() }]
					}
				}
			]);
			
			const notCreatedConditions = walletAddresses.flatMap(address => [
				{
					normalizedData: {
						path: ['creator', 'address'],
						not: address
					}
				},
				{
					normalizedData: {
						path: ['creator', 'address'],
						not: address.toLowerCase()
					}
				}
			]);
			
			searchConditions = {
				AND: [
					{ OR: ownedConditions }, // Must be owned by selected wallets
					{ AND: notCreatedConditions } // Must NOT be created by selected wallets
				]
			};
		}

		// Get artworks from the selected wallets
		const results = await prismaRead.artworkIndex.findMany({
			where: searchConditions,
			orderBy: { createdAt: 'desc' },
			take: 1000 // Reasonable limit to prevent overwhelming the UI
		});

		const total = await prismaRead.artworkIndex.count({ where: searchConditions });

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
			artworkId: record.artworkId,
			importStatus: record.importStatus
		}));

		// Get artwork data for records that are already imported
		const linkedArtworkIds = contractTokenPairs
			.filter(pair => pair.artworkId !== null)
			.map(pair => pair.artworkId as number);

		const importedArtworks =
			linkedArtworkIds.length > 0
				? await prismaRead.artwork.findMany({
						where: {
							id: { in: linkedArtworkIds }
						},
						select: {
							id: true,
							contractAddress: true,
							tokenId: true,
							title: true,
							imageUrl: true,
							thumbnailUrl: true,
							animationUrl: true
						}
					})
				: [];

		// Create a lookup for imported artworks
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

		// Transform results to match the expected format
		const artworkResults = deduplicatedResults.map((indexRecord: any) => {
			const normalizedData = (indexRecord.normalizedData as any) || {};
			const importedInfo = indexRecord.artworkId ? importedLookup.get(indexRecord.artworkId) : null;
			
			const isImported = !!importedInfo && indexRecord.artworkId !== null;

			let imageUrl = normalizedData.thumbnailUrl || normalizedData.imageUrl || '';
			let animationUrl = normalizedData.animationUrl || '';
			let title = normalizedData.title;

			if (importedInfo && importedInfo.title) {
				title = importedInfo.title;
			}

			if (importedInfo) {
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
				artist: normalizedData.creator
					? {
							name: normalizedData.creator.username || normalizedData.creator.address,
							avatarUrl: normalizedData.creator.avatarUrl || null,
							walletAddress: normalizedData.creator.address
						}
					: null,
				supportsArtistLookup: !!normalizedData.creator,
				isImported: isImported,
				mintDate: normalizedData.mintDate || null,
				mint_date: normalizedData.mintDate || null,
				timestamp: normalizedData.timestamp || null,
				mime: normalizedData.mime || null
			};
		});

		return json({
			results: artworkResults,
			total,
			selectedWallets: selectedWallets.length,
			filter
		});
	} catch (error) {
		console.error('Selective import error:', error);
		return json({ error: 'Failed to import selected wallets' }, { status: 500 });
	}
}; 