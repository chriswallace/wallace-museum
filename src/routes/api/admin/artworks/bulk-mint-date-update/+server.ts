import { json } from '@sveltejs/kit';
import { db } from '$lib/prisma';
import { fetchMintDateFromEtherscan } from '$lib/etherscanHelpers.js';
import { detectMintDateFromOpenSeaEvents } from '$lib/indexing/mintDateHelpers.js';

/**
 * Bulk update mint dates for artworks
 * Only updates the mintDate field, preserves all other manual overrides
 */
export async function POST({ request }) {
	try {
		const { artworkIds, dryRun = true } = await request.json();

		if (!artworkIds || !Array.isArray(artworkIds)) {
			return json({ error: 'artworkIds array is required' }, { status: 400 });
		}

		const results = [];
		let updated = 0;
		let skipped = 0;
		let failed = 0;

		console.log(`[bulk-mint-date-update] Processing ${artworkIds.length} artworks (dry run: ${dryRun})`);

		for (const artworkId of artworkIds) {
			try {
				// Get artwork details
				const artwork = await db.read.artwork.findUnique({
					where: { id: artworkId },
					select: {
						id: true,
						title: true,
						contractAddress: true,
						tokenId: true,
						blockchain: true,
						mintDate: true
					}
				});

				if (!artwork) {
					results.push({
						artworkId,
						status: 'failed',
						reason: 'Artwork not found'
					});
					failed++;
					continue;
				}

				if (!artwork.contractAddress || !artwork.tokenId) {
					results.push({
						artworkId,
						title: artwork.title,
						status: 'skipped',
						reason: 'Missing contract address or token ID'
					});
					skipped++;
					continue;
				}

				console.log(`[bulk-mint-date-update] Processing artwork ${artworkId}: ${artwork.title}`);

				// Try multiple sources for mint date detection
				let mintDateResult: string | null = null;
				let source = 'unknown';

				// 1. First try OpenSea Events API (most reliable for recent NFTs)
				console.log(`[bulk-mint-date-update] Trying OpenSea Events API for ${artwork.contractAddress}:${artwork.tokenId}`);
				const openSeaResult = await detectMintDateFromOpenSeaEvents(
					artwork.contractAddress,
					artwork.tokenId,
					artwork.blockchain || 'ethereum'
				);

				if (openSeaResult.mintDate) {
					mintDateResult = openSeaResult.mintDate;
					source = openSeaResult.source;
					console.log(`[bulk-mint-date-update] Found mint date from OpenSea Events: ${mintDateResult}`);
				}

				// 2. Fallback to Etherscan API (for older NFTs)
				if (!mintDateResult && artwork.blockchain === 'ethereum') {
					console.log(`[bulk-mint-date-update] Trying Etherscan API fallback`);
					const etherscanResult = await fetchMintDateFromEtherscan(
						artwork.contractAddress,
						artwork.tokenId,
						process.env.ETHERSCAN_API_KEY
					);

					if (etherscanResult) {
						mintDateResult = etherscanResult;
						source = 'Etherscan API';
						console.log(`[bulk-mint-date-update] Found mint date from Etherscan: ${mintDateResult}`);
					}
				}

				// Validate the retrieved mint date
				if (mintDateResult) {
					const retrievedDate = new Date(mintDateResult);
					const currentDate = new Date();

					// Reject obviously wrong dates
					if (retrievedDate > currentDate) {
						console.warn(`[bulk-mint-date-update] Rejecting future date: ${mintDateResult}`);
						mintDateResult = null;
						source = 'Rejected (future date)';
					} else if (retrievedDate > new Date('2024-01-01')) {
						// Be suspicious of very recent dates for older NFTs
						console.warn(`[bulk-mint-date-update] Suspicious recent date: ${mintDateResult}`);
						// Don't reject, but note it
						source += ' (suspicious recent date)';
					}
				}

				// Compare with current mint date
				const currentMintDate = artwork.mintDate;
				const shouldUpdate = mintDateResult && 
					(!currentMintDate || Math.abs(new Date(mintDateResult).getTime() - currentMintDate.getTime()) > 1000);

				if (shouldUpdate && mintDateResult) {
					if (!dryRun) {
						// Update only the mintDate field, preserve all other fields
						await db.write.artwork.update({
							where: { id: artworkId },
							data: { mintDate: new Date(mintDateResult) }
						});
					}

					const timeDiff = currentMintDate ? 
						Math.abs(new Date(mintDateResult).getTime() - currentMintDate.getTime()) : 0;
					const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
					const hoursDiff = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
					const minutesDiff = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

					results.push({
						artworkId,
						title: artwork.title,
						status: dryRun ? 'would-update' : 'updated',
						currentMintDate: currentMintDate?.toISOString(),
						currentMintDateHuman: currentMintDate?.toLocaleString(),
						retrievedMintDate: mintDateResult,
						retrievedMintDateHuman: new Date(mintDateResult).toLocaleString(),
						source,
						difference: `${daysDiff} days, ${hoursDiff} hours, ${minutesDiff} minutes`
					});

					updated++;
				} else {
					results.push({
						artworkId,
						title: artwork.title,
						status: 'skipped',
						reason: mintDateResult ? 'Mint date unchanged' : 'No reliable mint date found',
						currentMintDate: currentMintDate?.toISOString(),
						currentMintDateHuman: currentMintDate?.toLocaleString(),
						retrievedMintDate: mintDateResult,
						retrievedMintDateHuman: mintDateResult ? new Date(mintDateResult).toLocaleString() : null,
						source,
						difference: mintDateResult && currentMintDate ? 
							'<1 second (essentially same)' : 'N/A'
					});

					skipped++;
				}

				// Add delay between requests to be respectful to APIs
				await new Promise(resolve => setTimeout(resolve, 500));

			} catch (error) {
				console.error(`[bulk-mint-date-update] Error processing artwork ${artworkId}:`, error);
				results.push({
					artworkId,
					status: 'failed',
					reason: error instanceof Error ? error.message : 'Unknown error'
				});
				failed++;
			}
		}

		const message = dryRun 
			? `Dry run completed: ${updated} artworks would be updated, ${skipped} skipped, ${failed} failed`
			: `Update completed: ${updated} artworks updated, ${skipped} skipped, ${failed} failed`;

		return json({
			success: true,
			message,
			updated,
			skipped,
			failed,
			results
		});

	} catch (error) {
		console.error('[bulk-mint-date-update] Error:', error);
		return json({ 
			error: error instanceof Error ? error.message : 'Unknown error' 
		}, { status: 500 });
	}
} 