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
	dbOps: MinimalDBOperations
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
			// Fetch owned NFTs with comprehensive data
			const ownedNFTs = await indexingWorkflow.indexWalletNFTs(
				walletAddress, 
				'ethereum', 
				'owned',
				{ 
					maxPages: 300,
					pageSize: 50,
					enrichmentLevel: 'comprehensive' // Keep comprehensive data fetching
				}
			);
			
			console.log(`[ProcessWallet] Fetched ${ownedNFTs.length} owned NFTs for ${walletAddress}`);
			
			// Store NFTs in database with type and wallet address
			const storeResult = await dbOps.batchStoreNFTs(ownedNFTs, 'owned', walletAddress);
			
			result.indexed = storeResult.stored;
			result.new = storeResult.stored;
			result.errors = storeResult.errors.map(e => e.error);
			
		} else if (blockchain === 'tezos') {
			// Fetch owned NFTs
			const ownedNFTs = await indexingWorkflow.indexWalletNFTs(
				walletAddress, 
				'tezos', 
				'owned'
			);
			
			// Add delay between API calls
			await sleep(WALLET_DELAY);
			
			// Fetch created NFTs
			const createdNFTs = await indexingWorkflow.indexWalletNFTs(
				walletAddress, 
				'tezos', 
				'created'
			);
			
			console.log(`[ProcessWallet] Fetched ${ownedNFTs.length} owned + ${createdNFTs.length} created NFTs for ${walletAddress}`);
			
			// Store owned NFTs
			const ownedStoreResult = await dbOps.batchStoreNFTs(ownedNFTs, 'owned', walletAddress);
			
			// Store created NFTs
			const createdStoreResult = await dbOps.batchStoreNFTs(createdNFTs, 'created', walletAddress);
			
			result.indexed = ownedStoreResult.stored + createdStoreResult.stored;
			result.new = ownedStoreResult.stored + createdStoreResult.stored;
			result.errors = [...ownedStoreResult.errors.map(e => e.error), ...createdStoreResult.errors.map(e => e.error)];
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

	if (!env.OPENSEA_API_KEY) {
		return json({ error: 'OpenSea API key not configured' }, { status: 500 });
	}

	console.log(`[IndexWallets] Starting comprehensive indexing`);

	try {
		// Initialize optimized workflow and database operations
		const indexingWorkflow = new OptimizedIndexingWorkflow(env.OPENSEA_API_KEY);
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

			console.log(`[IndexWallets] Processing ${configuredWallets.length} configured wallets with comprehensive indexing`);

			const results = [];
			
			for (const wallet of configuredWallets) {
				const walletResult = await processWallet(
					wallet.address, 
					wallet.blockchain, 
					indexingWorkflow, 
					dbOps
				);
				
				results.push(walletResult);
				
				// Add delay between wallets to avoid overwhelming the API
				if (configuredWallets.indexOf(wallet) < configuredWallets.length - 1) {
					console.log(`[IndexWallets] Waiting ${WALLET_DELAY}ms before next wallet...`);
					await sleep(WALLET_DELAY);
				}
			}

			// Get final comprehensive stats
			const finalStats = indexingWorkflow.getStats();

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

		const result = await processWallet(walletAddressParam, blockchain, indexingWorkflow, dbOps);

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
