#!/usr/bin/env node

/**
 * Test script to run bulk mint date update on specific artworks
 *
 * Usage:
 *   node scripts/test-specific-artworks.js 452 144 472 465 435
 */

import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5173';

// Get artwork IDs from command line arguments
const artworkIds = process.argv
	.slice(2)
	.map((id) => parseInt(id, 10))
	.filter((id) => !isNaN(id));

if (artworkIds.length === 0) {
	console.log('❌ Please provide artwork IDs as arguments');
	console.log('Usage: node scripts/test-specific-artworks.js 452 144 472 465 435');
	process.exit(1);
}

console.log(`🔍 Testing bulk mint date update on specific artworks...`);
console.log(`🌐 API URL: ${API_BASE_URL}`);
console.log(`🎯 Artwork IDs: ${artworkIds.join(', ')}`);
console.log('');

async function testSpecificArtworks() {
	try {
		// Get the specific artworks
		const artworks = await prisma.artwork.findMany({
			where: {
				id: { in: artworkIds }
			},
			select: {
				id: true,
				title: true,
				contractAddress: true,
				tokenId: true,
				blockchain: true,
				mintDate: true
			},
			orderBy: { id: 'asc' }
		});

		if (artworks.length === 0) {
			console.log('❌ No artworks found with the provided IDs');
			return;
		}

		console.log(`📋 Found ${artworks.length} artworks:`);
		artworks.forEach((artwork, index) => {
			console.log(`   ${index + 1}. ID ${artwork.id}: ${artwork.title}`);
			console.log(`      Contract: ${artwork.contractAddress}:${artwork.tokenId}`);
			console.log(`      Blockchain: ${artwork.blockchain}`);
			console.log(`      Current mint date: ${artwork.mintDate?.toISOString() || 'None'}`);
			if (artwork.mintDate) {
				console.log(`      Current (human): ${artwork.mintDate.toLocaleString()}`);
			}
			console.log('');
		});

		// Test the bulk mint date update API with dry run
		console.log('🔄 Testing bulk mint date update (dry run)...');

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
		console.log(`   Updated: ${result.updated}`);
		console.log(`   Skipped: ${result.skipped}`);
		console.log(`   Failed: ${result.failed}`);
		console.log('');

		if (result.results && result.results.length > 0) {
			console.log('📊 Detailed results:');
			result.results.forEach((detail, index) => {
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

				// Show difference if available
				if (detail.difference) {
					console.log(`      Difference: ${detail.difference}`);
				} else if (
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

						// Highlight significant differences
						if (diffDays > 30) {
							console.log(`      🚨 SIGNIFICANT DIFFERENCE! (${diffDays} days)`);
						} else if (diffDays > 1) {
							console.log(`      ⚠️  Notable difference (${diffDays} days)`);
						}
					} else {
						console.log(`      Difference: <1 second (essentially same)`);
					}
				}

				console.log('');
			});
		}

		if (result.results && result.results.errors && result.results.errors.length > 0) {
			console.log('🚨 Errors:');
			result.results.errors.forEach((error) => {
				console.log(`   - ${error}`);
			});
		}

		// Ask if user wants to apply the changes
		if (result.updated > 0) {
			console.log('');
			console.log('💡 To apply these changes (not dry run), run:');
			console.log(`   node scripts/apply-specific-updates.js ${artworkIds.join(' ')}`);
		}
	} catch (error) {
		console.error('💥 Test failed:', error.message);
	} finally {
		await prisma.$disconnect();
	}
}

testSpecificArtworks();
