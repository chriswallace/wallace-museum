#!/usr/bin/env node

/**
 * Script to update mint dates for all artworks while preserving manual overrides
 *
 * Usage:
 *   node scripts/update-mint-dates.js --dry-run    # Preview changes without updating
 *   node scripts/update-mint-dates.js              # Actually update the mint dates
 *   node scripts/update-mint-dates.js --batch-size=50  # Process in smaller batches
 */

import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5173';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const DRY_RUN = process.argv.includes('--dry-run');

// Parse command line arguments
const args = process.argv.slice(2);
const batchSizeArg = args.find((arg) => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : BATCH_SIZE;

console.log(`🚀 Starting mint date update script`);
console.log(`📊 Batch size: ${batchSize}`);
console.log(`🔍 Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);
console.log(`🌐 API URL: ${API_BASE_URL}`);
console.log('');

async function getAllArtworkIds() {
	console.log('📋 Fetching all artwork IDs...');

	const artworks = await prisma.artwork.findMany({
		where: {
			contractAddress: { not: null },
			tokenId: { not: null }
		},
		select: { id: true },
		orderBy: { id: 'asc' }
	});

	console.log(`✅ Found ${artworks.length} artworks with contract address and token ID`);
	return artworks.map((a) => a.id);
}

async function updateMintDatesInBatch(artworkIds, batchIndex, totalBatches) {
	console.log(
		`\n🔄 Processing batch ${batchIndex + 1}/${totalBatches} (${artworkIds.length} artworks)`
	);

	try {
		const response = await fetch(`${API_BASE_URL}/api/admin/artworks/bulk-mint-date-update`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				artworkIds,
				dryRun: DRY_RUN
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(`API request failed: ${response.status} - ${errorData.error}`);
		}

		const result = await response.json();

		console.log(`✅ Batch ${batchIndex + 1} completed:`);
		console.log(`   📈 Updated: ${result.results.updated}`);
		console.log(`   ⏭️  Skipped: ${result.results.skipped}`);
		console.log(`   ❌ Failed: ${result.results.failed}`);

		if (result.results.errors.length > 0) {
			console.log(`   🚨 Errors:`);
			result.results.errors.slice(0, 5).forEach((error) => {
				console.log(`      - ${error}`);
			});
			if (result.results.errors.length > 5) {
				console.log(`      ... and ${result.results.errors.length - 5} more errors`);
			}
		}

		return result.results;
	} catch (error) {
		console.error(`❌ Error processing batch ${batchIndex + 1}:`, error.message);
		return {
			total: artworkIds.length,
			updated: 0,
			skipped: 0,
			failed: artworkIds.length,
			errors: [`Batch failed: ${error.message}`]
		};
	}
}

async function main() {
	try {
		// Get all artwork IDs
		const allArtworkIds = await getAllArtworkIds();

		if (allArtworkIds.length === 0) {
			console.log('ℹ️  No artworks found with contract address and token ID');
			return;
		}

		// Split into batches
		const batches = [];
		for (let i = 0; i < allArtworkIds.length; i += batchSize) {
			batches.push(allArtworkIds.slice(i, i + batchSize));
		}

		console.log(`\n📦 Processing ${allArtworkIds.length} artworks in ${batches.length} batches`);

		if (DRY_RUN) {
			console.log('🔍 DRY RUN MODE - No changes will be made');
		}

		// Process each batch
		const overallResults = {
			total: 0,
			updated: 0,
			skipped: 0,
			failed: 0,
			errors: []
		};

		for (let i = 0; i < batches.length; i++) {
			const batchResults = await updateMintDatesInBatch(batches[i], i, batches.length);

			overallResults.total += batchResults.total;
			overallResults.updated += batchResults.updated;
			overallResults.skipped += batchResults.skipped;
			overallResults.failed += batchResults.failed;
			overallResults.errors.push(...batchResults.errors);

			// Add delay between batches to avoid overwhelming the API
			if (i < batches.length - 1) {
				console.log('⏳ Waiting 2 seconds before next batch...');
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		}

		// Final summary
		console.log('\n🎉 Mint date update completed!');
		console.log('📊 Final Results:');
		console.log(`   📈 Total artworks: ${overallResults.total}`);
		console.log(`   ✅ Updated: ${overallResults.updated}`);
		console.log(`   ⏭️  Skipped: ${overallResults.skipped}`);
		console.log(`   ❌ Failed: ${overallResults.failed}`);

		if (overallResults.errors.length > 0) {
			console.log(`\n🚨 Errors encountered (${overallResults.errors.length} total):`);
			overallResults.errors.slice(0, 10).forEach((error) => {
				console.log(`   - ${error}`);
			});
			if (overallResults.errors.length > 10) {
				console.log(`   ... and ${overallResults.errors.length - 10} more errors`);
			}
		}

		if (DRY_RUN) {
			console.log('\n💡 This was a dry run. To actually update the mint dates, run:');
			console.log('   node scripts/update-mint-dates.js');
		}
	} catch (error) {
		console.error('💥 Script failed:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
	console.log('\n🛑 Script interrupted by user');
	await prisma.$disconnect();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	console.log('\n🛑 Script terminated');
	await prisma.$disconnect();
	process.exit(0);
});

main().catch(async (error) => {
	console.error('💥 Unhandled error:', error);
	await prisma.$disconnect();
	process.exit(1);
});
