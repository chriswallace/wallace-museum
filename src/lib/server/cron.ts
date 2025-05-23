import { CronJob } from 'cron';
import { dev } from '$app/environment';

/**
 * Runs the wallet indexer by making a request to the index-wallets API endpoint
 */
async function runWalletIndexer() {
	try {
		console.log('[CRON] Starting wallet indexer job...');

		// Get the API key from environment
		const apiKey = process.env.INDEXER_API_KEY;

		if (!apiKey) {
			console.error('[CRON] Missing INDEXER_API_KEY environment variable');
			return;
		}

		// Call the indexer API endpoint
		const baseUrl = dev
			? 'http://localhost:5173'
			: process.env.PUBLIC_SITE_URL || 'https://your-production-url.com';

		const response = await fetch(`${baseUrl}/api/admin/index-wallets?key=${apiKey}`);
		const result = await response.json();

		if (result.success) {
			console.log('[CRON] Wallet indexer completed successfully');
			console.log(`[CRON] Indexed ${result.results.length} wallets`);

			// Log summary
			let totalIndexed = 0;
			let totalCached = 0;
			let totalNew = 0;

			result.results.forEach((wallet: any) => {
				totalIndexed += wallet.indexed || 0;
				totalCached += wallet.cached || 0;
				totalNew += wallet.new || 0;
			});

			console.log(`[CRON] Total NFTs: ${totalIndexed} (${totalNew} new, ${totalCached} cached)`);
		} else {
			console.error('[CRON] Wallet indexer failed:', result.error);
		}
	} catch (error) {
		console.error('[CRON] Error running wallet indexer:', error);
	}
}

/**
 * Initialize cron jobs when the server starts
 */
export function initCronJobs() {
	// Run wallet indexer every 12 hours
	// Runs at 2:00 AM and 2:00 PM
	const walletIndexerJob = new CronJob('0 0 2,14 * * *', runWalletIndexer, null, false, 'UTC');

	// Start the job
	walletIndexerJob.start();

	console.log('[CRON] Initialized cron jobs');
	console.log('[CRON] Next wallet indexer run:', walletIndexerJob.nextDate().toLocaleString());
}
