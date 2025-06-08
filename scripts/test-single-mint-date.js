#!/usr/bin/env node

/**
 * Test script to check mint date for a single artwork
 *
 * Usage:
 *   node scripts/test-single-mint-date.js 455
 */

import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5173';
const artworkId = process.argv[2];

if (!artworkId) {
	console.log('❌ Please provide an artwork ID');
	console.log('Usage: node scripts/test-single-mint-date.js 455');
	process.exit(1);
}

console.log(`🔍 Testing mint date for artwork ID: ${artworkId}`);
console.log(`🌐 API URL: ${API_BASE_URL}`);
console.log('');

async function testSingleArtwork() {
	try {
		// First, get the current artwork data
		const artwork = await prisma.artwork.findUnique({
			where: { id: parseInt(artworkId) },
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
			console.log('❌ Artwork not found');
			return;
		}

		console.log('📋 Current artwork data:');
		console.log(`   Title: ${artwork.title}`);
		console.log(`   Contract: ${artwork.contractAddress}`);
		console.log(`   Token ID: ${artwork.tokenId}`);
		console.log(`   Blockchain: ${artwork.blockchain}`);
		console.log(
			`   Current mint date: ${artwork.mintDate ? artwork.mintDate.toISOString() : 'None'}`
		);
		console.log('');

		// Test the bulk mint date update API with dry run
		console.log('🔄 Testing mint date update (dry run)...');

		const response = await fetch(`${API_BASE_URL}/api/admin/artworks/bulk-mint-date-update`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				artworkIds: [parseInt(artworkId)],
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

		if (result.results.details.length > 0) {
			const detail = result.results.details[0];
			console.log('');
			console.log('📊 Detailed result:');
			console.log(`   Status: ${detail.status}`);
			console.log(`   Reason: ${detail.reason || 'N/A'}`);
			if (detail.oldMintDate) {
				console.log(`   Old mint date: ${detail.oldMintDate}`);
			}
			if (detail.newMintDate) {
				console.log(`   New mint date: ${detail.newMintDate}`);

				// Compare dates
				const oldDate = artwork.mintDate ? new Date(artwork.mintDate) : null;
				const newDate = new Date(detail.newMintDate);

				if (oldDate) {
					const diffMs = Math.abs(newDate.getTime() - oldDate.getTime());
					const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
					const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

					console.log(`   Difference: ${diffDays} days, ${diffHours} hours`);

					if (diffMs > 1000) {
						// More than 1 second difference
						console.log('   🎯 This would be a significant update!');
					} else {
						console.log('   ℹ️  Dates are essentially the same');
					}
				}
			}
		}

		if (result.results.errors.length > 0) {
			console.log('');
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

testSingleArtwork();
