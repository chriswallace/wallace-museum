#!/usr/bin/env node

/**
 * Test script to run bulk mint date update on a small batch
 *
 * Usage:
 *   node scripts/test-bulk-update.js
 */

import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5173';

console.log(`🔍 Testing bulk mint date update...`);
console.log(`🌐 API URL: ${API_BASE_URL}`);
console.log('');

async function testBulkUpdate() {
	try {
		// Get a few Ethereum artworks to test with
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
			take: 5 // Just test with 5 artworks
		});

		if (artworks.length === 0) {
			console.log('❌ No Ethereum artworks found with contract address and token ID');
			return;
		}

		console.log(`📋 Found ${artworks.length} Ethereum artworks to test:`);
		artworks.forEach((artwork, index) => {
			console.log(`   ${index + 1}. ID ${artwork.id}: ${artwork.title}`);
			console.log(`      Contract: ${artwork.contractAddress}:${artwork.tokenId}`);
			console.log(`      Current mint date: ${artwork.mintDate?.toISOString() || 'None'}`);
			console.log('');
		});

		// Test the bulk mint date update API with dry run
		console.log('🔄 Testing bulk mint date update (dry run)...');

		const artworkIds = artworks.map((a) => a.id);
		const response = await fetch(`${API_BASE_URL}/api/admin/artworks/bulk-mint-date-update`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				artworkIds: artworkIds,
				dryRun: true
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(`API request failed: ${response.status} - ${errorData.error}`);
		}

		const result = await response.json();

		console.log('✅ API Response:');
		console.log(`   Message: ${result.message}`);
		console.log(`   Updated: ${result.results.updated}`);
		console.log(`   Skipped: ${result.results.skipped}`);
		console.log(`   Failed: ${result.results.failed}`);
		console.log('');

		if (result.results.details.length > 0) {
			console.log('📊 Detailed results:');
			result.results.details.forEach((detail, index) => {
				console.log(`   ${index + 1}. Artwork ${detail.artworkId}: ${detail.title}`);
				console.log(`      Status: ${detail.status}`);
				console.log(`      Reason: ${detail.reason || 'N/A'}`);

				// Show current mint date
				if (detail.currentMintDate || detail.oldMintDate) {
					const currentDate = detail.currentMintDate || detail.oldMintDate;
					console.log(`      Current mint date: ${currentDate}`);
					if (currentDate) {
						const date = new Date(currentDate);
						console.log(`      Current (human): ${date.toLocaleString()}`);
					}
				}

				// Show retrieved/new mint date
				if (detail.retrievedMintDate || detail.newMintDate) {
					const retrievedDate = detail.retrievedMintDate || detail.newMintDate;
					console.log(`      Retrieved mint date: ${retrievedDate}`);
					if (retrievedDate) {
						const date = new Date(retrievedDate);
						console.log(`      Retrieved (human): ${date.toLocaleString()}`);
					}
				}

				// Show source
				if (detail.source) {
					console.log(`      Source: ${detail.source}`);
				}

				// Show difference if both dates exist
				if (
					(detail.currentMintDate || detail.oldMintDate) &&
					(detail.retrievedMintDate || detail.newMintDate)
				) {
					const currentDate = new Date(detail.currentMintDate || detail.oldMintDate);
					const retrievedDate = new Date(detail.retrievedMintDate || detail.newMintDate);
					const diffMs = Math.abs(retrievedDate.getTime() - currentDate.getTime());
					const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
					const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
					const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

					if (diffMs > 1000) {
						console.log(`      Difference: ${diffDays}d ${diffHours}h ${diffMinutes}m`);
					} else {
						console.log(`      Difference: <1 second (essentially same)`);
					}
				}

				console.log('');
			});
		}

		if (result.results.errors.length > 0) {
			console.log('🚨 Errors:');
			result.results.errors.forEach((error) => {
				console.log(`   - ${error}`);
			});
		}
	} catch (error) {
		console.error('💥 Test failed:', error.message);
	} finally {
		await prisma.$disconnect();
	}
}

testBulkUpdate();
