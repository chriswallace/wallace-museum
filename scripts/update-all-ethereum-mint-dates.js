#!/usr/bin/env node

/**
 * Update all Ethereum artworks with correct mint dates
 * Uses the enhanced OpenSea Events API with pagination and proper timestamp parsing
 *
 * Usage:
 *   node scripts/update-all-ethereum-mint-dates.js [--dry-run]
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5173';

console.log(`🔄 Updating All Ethereum Artwork Mint Dates`);
console.log(`   API Base URL: ${API_BASE_URL}`);
console.log(`   OpenSea API Key: ${process.env.OPENSEA_API_KEY ? 'Found ✅' : 'Missing ❌'}`);
console.log(`   Etherscan API Key: ${process.env.ETHERSCAN_API_KEY ? 'Found ✅' : 'Missing ❌'}`);
console.log('');

async function getAllEthereumArtworkIds() {
	console.log('📋 Fetching all Ethereum artwork IDs...');

	const artworks = await prisma.artwork.findMany({
		where: {
			contractAddress: { not: null },
			tokenId: { not: null },
			blockchain: 'ethereum'
		},
		select: {
			id: true,
			title: true,
			contractAddress: true,
			tokenId: true,
			mintDate: true
		},
		orderBy: { id: 'asc' }
	});

	console.log(`✅ Found ${artworks.length} Ethereum artworks`);

	// Show a sample of what we're updating
	console.log('\n📝 Sample of artworks to update:');
	artworks.slice(0, 5).forEach((artwork, index) => {
		console.log(`   ${index + 1}. ID ${artwork.id}: ${artwork.title}`);
		console.log(`      Contract: ${artwork.contractAddress}:${artwork.tokenId}`);
		console.log(`      Current mint date: ${artwork.mintDate?.toISOString() || 'None'}`);
		console.log('');
	});

	if (artworks.length > 5) {
		console.log(`   ... and ${artworks.length - 5} more artworks`);
		console.log('');
	}

	return artworks.map((a) => a.id);
}

async function updateMintDates(artworkIds, dryRun = false) {
	console.log(
		`🔄 ${dryRun ? 'Testing' : 'Updating'} mint dates for ${artworkIds.length} artworks...`
	);
	console.log(`   Batch size: ${artworkIds.length} (processing all at once)`);
	console.log('');

	try {
		const response = await fetch(`${API_BASE_URL}/api/admin/artworks/bulk-mint-date-update`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				artworkIds: artworkIds,
				dryRun: dryRun
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(`API request failed: ${response.status} - ${errorData.error}`);
		}

		const result = await response.json();

		console.log('✅ Bulk Update Results:');
		console.log(`   Message: ${result.message}`);
		console.log(`   Updated: ${result.results.updated}`);
		console.log(`   Skipped: ${result.results.skipped}`);
		console.log(`   Failed: ${result.results.failed}`);
		console.log('');

		if (result.details && result.details.length > 0) {
			console.log('📋 Detailed Results:');
			result.details.forEach((detail, index) => {
				if (index < 10) {
					// Show first 10 details
					console.log(`   ${index + 1}. ID ${detail.artworkId}: ${detail.status}`);
					if (detail.currentMintDate && detail.newMintDate) {
						console.log(`      Current: ${detail.currentMintDate}`);
						console.log(`      New: ${detail.newMintDate}`);
						if (detail.source) {
							console.log(`      Source: ${detail.source}`);
						}
						if (detail.difference) {
							console.log(`      Difference: ${detail.difference}`);
						}
					}
					if (detail.error) {
						console.log(`      Error: ${detail.error}`);
					}
					console.log('');
				}
			});

			if (result.details.length > 10) {
				console.log(`   ... and ${result.details.length - 10} more results`);
				console.log('');
			}
		}

		return result;
	} catch (error) {
		console.error('💥 Error updating mint dates:', error);
		throw error;
	}
}

async function main() {
	try {
		const args = process.argv.slice(2);
		const dryRun = args.includes('--dry-run');

		if (dryRun) {
			console.log('🧪 DRY RUN MODE - No changes will be made');
			console.log('');
		}

		// Get all Ethereum artwork IDs
		const artworkIds = await getAllEthereumArtworkIds();

		if (artworkIds.length === 0) {
			console.log('❌ No Ethereum artworks found with contract address and token ID');
			return;
		}

		// Confirm before proceeding (unless dry run)
		if (!dryRun) {
			console.log('⚠️  WARNING: This will update mint dates for ALL Ethereum artworks!');
			console.log('   This action cannot be easily undone.');
			console.log('   Consider running with --dry-run first to see what would be changed.');
			console.log('');
			console.log('   Press Ctrl+C to cancel, or wait 10 seconds to continue...');

			// Wait 10 seconds
			await new Promise((resolve) => setTimeout(resolve, 10000));
			console.log('');
		}

		// Update mint dates
		const result = await updateMintDates(artworkIds, dryRun);

		console.log('🎉 Mint date update completed!');

		if (dryRun) {
			console.log('');
			console.log('💡 To apply these changes, run:');
			console.log('   node scripts/update-all-ethereum-mint-dates.js');
		} else {
			console.log('');
			console.log(
				'✅ All Ethereum artwork mint dates have been updated with accurate blockchain data!'
			);
		}
	} catch (error) {
		console.error('💥 Script failed:', error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
