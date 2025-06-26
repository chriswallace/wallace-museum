import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { prismaWrite } from '$lib/prisma';
import { OptimizedIndexingWorkflow } from '$lib/optimized-indexing-workflow';
import { MinimalDBOperations } from '$lib/minimal-db-operations';
import { getWalletAddresses } from '$lib/settingsManager';
import { env } from '$env/dynamic/private';

// Rate limiting - now handled by the intelligent rate limiter
const WALLET_DELAY = 500; // 500ms between different wallets

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function processWallet(
	walletAddress: string, 
	blockchain: string, 
	indexingWorkflow: OptimizedIndexingWorkflow, 
	dbOps: MinimalDBOperations,
	provider: 'opensea' | 'alchemy' = 'opensea'
) {
	let result = {
		walletAddress: walletAddress,
		blockchain: blockchain,
		indexed: 0,
		cached: 0,
		new: 0,
		errors: [] as string[],
		stats: {} as any
	};

	console.log(`[ProcessWallet] Starting comprehensive indexing for ${walletAddress} on ${blockchain}`);

	try {
		// Process based on blockchain
		if (blockchain === 'ethereum') {
			// Fetch owned NFTs with comprehensive data and enhanced pagination
			const ownedNFTs = await indexingWorkflow.indexWalletNFTs(
				walletAddress, 
				'ethereum', 
				'owned',
				{ 
					maxPages: 500, // Increased for enhanced pagination
					pageSize: 50,
					enrichmentLevel: 'comprehensive', // Keep comprehensive data fetching
					useEnhancedPagination: true, // Enable enhanced pagination to work around OpenSea limits
					expectedNFTCount: undefined, // We don't know the expected count, but enhanced pagination will adapt
					provider: provider // Use the requested provider
				}
			);
			
			console.log(`[ProcessWallet] Fetched ${ownedNFTs.length} owned NFTs for ${walletAddress}`);
			
			// Store NFTs in database with type and wallet address
			const storeResult = await dbOps.batchStoreNFTs(ownedNFTs, 'owned', walletAddress);
			
			result.indexed = storeResult.stored;
			result.new = storeResult.stored;
			result.errors = storeResult.errors.map(e => e.error);
			
		} else if (blockchain === 'tezos') {
			// Fetch owned NFTs - run until no more data
			const ownedNFTs = await indexingWorkflow.indexWalletNFTs(
				walletAddress, 
				'tezos', 
				'owned',
				{
					pageSize: 500 // No maxPages limit - run until completion
				}
			);
			
			// Add delay between API calls
			await sleep(WALLET_DELAY);
			
			// Fetch created NFTs - run until no more data
			const createdNFTs = await indexingWorkflow.indexWalletNFTs(
				walletAddress, 
				'tezos', 
				'created',
				{
					pageSize: 500 // No maxPages limit - run until completion
				}
			);
			
			console.log(`[ProcessWallet] Fetched ${ownedNFTs.length} owned + ${createdNFTs.length} created NFTs for ${walletAddress} (total fetched: ${ownedNFTs.length + createdNFTs.length})`);
			
			// Store owned NFTs
			const ownedStoreResult = await dbOps.batchStoreNFTs(ownedNFTs, 'owned', walletAddress);
			console.log(`[ProcessWallet] Owned NFTs storage: ${ownedStoreResult.stored} stored out of ${ownedNFTs.length} fetched (${ownedStoreResult.errors.length} errors)`);
			
			// Store created NFTs
			const createdStoreResult = await dbOps.batchStoreNFTs(createdNFTs, 'created', walletAddress);
			console.log(`[ProcessWallet] Created NFTs storage: ${createdStoreResult.stored} stored out of ${createdNFTs.length} fetched (${createdStoreResult.errors.length} errors)`);
			
			const totalFetched = ownedNFTs.length + createdNFTs.length;
			const totalStored = ownedStoreResult.stored + createdStoreResult.stored;
			const totalErrors = ownedStoreResult.errors.length + createdStoreResult.errors.length;
			
			result.indexed = totalStored; // Report actual stored count, not fetched count
			result.new = totalStored;
			result.errors = [...ownedStoreResult.errors.map(e => e.error), ...createdStoreResult.errors.map(e => e.error)];
			
			console.log(`[ProcessWallet] Storage summary for ${walletAddress}: ${totalStored} stored out of ${totalFetched} fetched (${totalErrors} storage errors, ${totalFetched - totalStored - totalErrors} other discrepancies)`);
		}

		// Get final stats
		result.stats = indexingWorkflow.getStats();
		
		console.log(`[ProcessWallet] Completed comprehensive indexing for ${walletAddress}: ${result.indexed} NFTs stored`);

	} catch (error) {
		console.error(`[ProcessWallet] Error processing ${walletAddress}:`, error);
		result.errors.push(error instanceof Error ? error.message : 'Unknown error');
	}

	return result;
}

export const GET: RequestHandler = async ({ url, request, cookies, locals }) => {
	const walletAddressParam = url.searchParams.get('walletAddress');
	const forceRefresh = url.searchParams.get('forceRefresh') === 'true' || url.searchParams.get('force') === 'true';
	const blockchainParam = url.searchParams.get('blockchain');
	const walletIndexParam = url.searchParams.get('walletIndex'); // New parameter to process specific wallet by index
	const providerParam = url.searchParams.get('provider') || 'hybrid'; // Default to hybrid approach

	if (!env.OPENSEA_API_KEY) {
		return json({ error: 'OpenSea API key not configured' }, { status: 500 });
	}

	if (providerParam === 'alchemy' && !env.ALCHEMY_API_KEY) {
		return json({ error: 'Alchemy API key not configured but Alchemy provider requested' }, { status: 500 });
	}

	console.log(`[IndexWallets] Starting comprehensive indexing`);

	try {
		// Initialize optimized workflow and database operations
		const indexingWorkflow = new OptimizedIndexingWorkflow(env.OPENSEA_API_KEY, env.ALCHEMY_API_KEY);
		const dbOps = new MinimalDBOperations(prismaWrite);

		// If no wallet address is provided, index all configured wallet addresses
		if (!walletAddressParam) {
			const configuredWallets = await getWalletAddresses();
			if (configuredWallets.length === 0) {
				return json({ 
					success: true, 
					message: 'No wallet addresses configured',
					results: []
				});
			}

			console.log(`[IndexWallets] Found ${configuredWallets.length} configured wallets:`);
			configuredWallets.forEach((wallet, index) => {
				console.log(`[IndexWallets] ${index + 1}. ${wallet.address} (${wallet.blockchain}) - ${wallet.alias || 'No alias'}`);
			});

			// If walletIndex is specified, process only that wallet
			if (walletIndexParam) {
				const walletIndex = parseInt(walletIndexParam);
				if (walletIndex < 0 || walletIndex >= configuredWallets.length) {
					return json({ 
						error: `Invalid wallet index ${walletIndex}. Must be between 0 and ${configuredWallets.length - 1}`,
						availableWallets: configuredWallets.map((w, i) => ({ index: i, address: w.address, blockchain: w.blockchain, alias: w.alias }))
					}, { status: 400 });
				}

				const wallet = configuredWallets[walletIndex];
				console.log(`[IndexWallets] Processing single wallet by index ${walletIndex}: ${wallet.address} (${wallet.blockchain})`);

				const walletResult = await processWallet(
					wallet.address, 
					wallet.blockchain, 
					indexingWorkflow, 
					dbOps,
					providerParam as 'opensea' | 'alchemy'
				);

				return json({
					success: true,
					result: walletResult,
					walletIndex: walletIndex,
					totalWallets: configuredWallets.length,
					finalStats: indexingWorkflow.getStats()
				}, { status: 200 });
			}

			console.log(`[IndexWallets] Processing all ${configuredWallets.length} configured wallets with comprehensive indexing`);

			const results = [];
			
			for (let i = 0; i < configuredWallets.length; i++) {
				const wallet = configuredWallets[i];
				console.log(`[IndexWallets] ========================================`);
				console.log(`[IndexWallets] Processing wallet ${i + 1}/${configuredWallets.length}: ${wallet.address} (${wallet.blockchain}) - ${wallet.alias || 'No alias'}`);
				console.log(`[IndexWallets] ========================================`);

				const walletResult = await processWallet(
					wallet.address, 
					wallet.blockchain, 
					indexingWorkflow, 
					dbOps,
					providerParam as 'opensea' | 'alchemy'
				);
				
				results.push({
					...walletResult,
					walletIndex: i,
					alias: wallet.alias
				});
				
				console.log(`[IndexWallets] Completed wallet ${i + 1}/${configuredWallets.length}: ${walletResult.indexed} NFTs indexed`);
				
				// Add delay between wallets to avoid overwhelming the API
				if (i < configuredWallets.length - 1) {
					console.log(`[IndexWallets] Waiting ${WALLET_DELAY}ms before next wallet...`);
					await sleep(WALLET_DELAY);
				}
			}

			// Get final comprehensive stats
			const finalStats = indexingWorkflow.getStats();

			console.log(`[IndexWallets] ========================================`);
			console.log(`[IndexWallets] FINAL SUMMARY:`);
			console.log(`[IndexWallets] Total wallets processed: ${results.length}`);
			console.log(`[IndexWallets] Total NFTs indexed: ${results.reduce((sum, r) => sum + r.indexed, 0)}`);
			console.log(`[IndexWallets] Total errors: ${results.reduce((sum, r) => sum + r.errors.length, 0)}`);
			results.forEach((result, index) => {
				console.log(`[IndexWallets] Wallet ${index + 1} (${result.walletAddress}): ${result.indexed} NFTs, ${result.errors.length} errors`);
			});
			console.log(`[IndexWallets] ========================================`);

			return json({
				success: true,
				results,
				totalWallets: configuredWallets.length,
				totalIndexed: results.reduce((sum, r) => sum + r.indexed, 0),
				totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
				finalStats
			}, { status: 200 });
		}

		// Process single wallet address
		const blockchain = blockchainParam || 'ethereum';

		console.log(`[IndexWallets] Processing single wallet ${walletAddressParam} on ${blockchain} with comprehensive indexing`);

		const result = await processWallet(walletAddressParam, blockchain, indexingWorkflow, dbOps, providerParam as 'opensea' | 'alchemy');

		return json({
			success: true,
			result,
			finalStats: indexingWorkflow.getStats()
		}, { status: 200 });

	} catch (error) {
		console.error('[IndexWallets] Error indexing wallet:', error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};
