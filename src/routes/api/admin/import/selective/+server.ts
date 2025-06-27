import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { prismaRead } from '$lib/prisma';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { selectedWallets, filter = 'all' } = body;

		console.log('[Selective Indexing] Request body:', JSON.stringify(body, null, 2));

		if (!selectedWallets || !Array.isArray(selectedWallets)) {
			return json({ error: 'selectedWallets array is required' }, { status: 400 });
		}

		// Extract wallet addresses from the selected wallets
		const walletAddresses = selectedWallets.map((wallet: any) => wallet.address);
		console.log('[Selective Indexing] Wallet addresses:', walletAddresses);



		// Always trigger indexing for selected wallets to ensure fresh data
		console.log(`[Selective Indexing] Triggering indexing for ${selectedWallets.length} selected wallets...`);
		
		try {
			// Call the indexer API for each selected wallet with retry logic
			const indexingPromises = selectedWallets.map(async (wallet: any) => {
				console.log(`[Selective Indexing] Starting indexing for wallet: ${wallet.address} (${wallet.blockchain})`);
				
				// Construct the base URL from the request
				const baseUrl = `${request.url.split('/api')[0]}`;
				const indexerUrl = `${baseUrl}/api/admin/index-wallets?walletAddress=${encodeURIComponent(wallet.address)}&blockchain=${wallet.blockchain}`;
				
				console.log(`[Selective Indexing] Calling indexer URL: ${indexerUrl}`);
				
				// Retry logic for network issues
				let lastError: any = null;
				for (let attempt = 1; attempt <= 3; attempt++) {
					try {
						const indexerResponse = await fetch(indexerUrl, {
							method: 'GET',
							headers: {
								'Content-Type': 'application/json'
							},
							signal: AbortSignal.timeout(300000) // 5 minute timeout for indexing
						});
						
						if (!indexerResponse.ok) {
							const errorText = await indexerResponse.text();
							console.error(`[Selective Indexing] Failed to index wallet ${wallet.address} (attempt ${attempt}):`, errorText);
							lastError = errorText;
							
							// Don't retry on client errors (4xx)
							if (indexerResponse.status >= 400 && indexerResponse.status < 500) {
								break;
							}
							
							// Wait before retrying (exponential backoff)
							if (attempt < 3) {
								const waitTime = Math.pow(2, attempt) * 1000;
								console.log(`[Selective Indexing] Waiting ${waitTime}ms before retry...`);
								await new Promise(resolve => setTimeout(resolve, waitTime));
								continue;
							}
						} else {
							const indexerResult = await indexerResponse.json();
							console.log(`[Selective Indexing] Successfully indexed wallet ${wallet.address}:`, {
								indexed: indexerResult.result?.indexed || 0,
								errors: indexerResult.result?.errors?.length || 0
							});
							
							return { 
								success: true, 
								wallet: wallet.address, 
								indexed: indexerResult.result?.indexed || 0,
								result: indexerResult 
							};
						}
					} catch (error) {
						console.error(`[Selective Indexing] Network error indexing wallet ${wallet.address} (attempt ${attempt}):`, error);
						lastError = error;
						
						// Don't retry on timeout errors - they usually indicate the operation is still running
						if (error instanceof Error && (error.name === 'TimeoutError' || error.message.includes('timeout'))) {
							console.log(`[Selective Indexing] Timeout detected for ${wallet.address} - this is normal for large wallets`);
							break;
						}
						
						// Wait before retrying
						if (attempt < 3) {
							const waitTime = Math.pow(2, attempt) * 1000;
							console.log(`[Selective Indexing] Waiting ${waitTime}ms before retry...`);
							await new Promise(resolve => setTimeout(resolve, waitTime));
						}
					}
				}
				
				return { 
					success: false, 
					wallet: wallet.address, 
					error: lastError instanceof Error ? lastError.message : (typeof lastError === 'string' ? lastError : 'Unknown error')
				};
			});

			const indexingResults = await Promise.all(indexingPromises);
			const successfulIndexing = indexingResults.filter(r => r.success);
			const totalIndexed = successfulIndexing.reduce((sum, r) => sum + (r.indexed || 0), 0);
			
			console.log(`[Selective Indexing] Indexing complete: ${successfulIndexing.length}/${selectedWallets.length} wallets indexed successfully`);
			console.log(`[Selective Indexing] Total NFTs indexed: ${totalIndexed}`);
			
			// If no wallets were successfully indexed, return an error
			if (successfulIndexing.length === 0) {
				const errors = indexingResults.map(r => `${r.wallet}: ${r.error || 'Unknown error'}`);
				return json({ 
					error: 'Failed to index any of the selected wallets.',
					details: errors,
					walletsAttempted: selectedWallets.map(w => w.address)
				}, { status: 500 });
			}
			
			// If some wallets failed, log warnings but continue
			if (successfulIndexing.length < selectedWallets.length) {
				const failedWallets = indexingResults.filter(r => !r.success);
				console.warn(`[Selective Indexing] Some wallets failed to index:`, failedWallets.map(r => r.wallet));
			}
			
		} catch (indexingError) {
			console.error('[Selective Indexing] Error during indexing:', indexingError);
			return json({ 
				error: 'Failed to index wallets before import.',
				details: indexingError instanceof Error ? indexingError.message : 'Unknown indexing error'
			}, { status: 500 });
		}

		// Now proceed with searching the indexed NFTs
		// Build search conditions for selected wallets
		let searchConditions: any = {
			OR: walletAddresses.flatMap(address => [
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
				},
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
			])
		};

		console.log('[Selective Indexing] Search conditions:', JSON.stringify(searchConditions, null, 2));

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

		console.log('[Selective Indexing] Final search conditions:', JSON.stringify(searchConditions, null, 2));

		// Get indexed NFTs from the selected wallets
		const results = await prismaRead.artworkIndex.findMany({
			where: searchConditions,
			orderBy: { createdAt: 'desc' },
			take: 1000 // Reasonable limit to prevent overwhelming the UI
		});

		console.log('[Selective Indexing] Query results count:', results.length);

		const total = await prismaRead.artworkIndex.count({ where: searchConditions });

		console.log('[Selective Indexing] Total matching records:', total);

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
		console.error('Selective indexing error:', error);
		return json({ error: 'Failed to index selected wallets', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
}; 