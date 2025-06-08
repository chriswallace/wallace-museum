#!/usr/bin/env node

/**
 * Test script for OpenSea Events API with pagination
 *
 * Usage:
 *   node scripts/test-opensea-events.js
 */

import dotenv from 'dotenv';
import { detectMintDateFromOpenSeaEvents } from '../src/lib/indexing/mintDateHelpers.js';

// Load environment variables
dotenv.config();

console.log(`🔍 Testing OpenSea Events API with pagination`);
console.log(`   API Key: ${process.env.OPENSEA_API_KEY ? 'Found ✅' : 'Missing ❌'}`);
console.log('');

async function testOpenSeaEvents() {
	try {
		// Test with artwork 70 (Foundation contract)
		const contractAddress = '0x3b3ee1931dc30c1957379fac9aba94d1c48a5405';
		const tokenId = '70679';
		const blockchain = 'ethereum';

		console.log(`📡 Testing OpenSea Events API for:`);
		console.log(`   Contract: ${contractAddress}`);
		console.log(`   Token ID: ${tokenId}`);
		console.log(`   Blockchain: ${blockchain}`);
		console.log('');

		const startTime = Date.now();
		const result = await detectMintDateFromOpenSeaEvents(contractAddress, tokenId, blockchain);
		const endTime = Date.now();

		console.log(`⏱️  Search completed in ${endTime - startTime}ms`);
		console.log('');

		if (result.mintDate) {
			console.log(`🎉 SUCCESS! Found mint date:`);
			console.log(`   ISO: ${result.mintDate}`);
			console.log(`   Human: ${new Date(result.mintDate).toLocaleString()}`);
			console.log(`   Source: ${result.source}`);
			console.log('');

			// Compare with expected
			const expectedDate = new Date('2021-08-10T14:35:11.000Z');
			const actualDate = new Date(result.mintDate);
			const diffMs = Math.abs(actualDate.getTime() - expectedDate.getTime());
			const diffSeconds = Math.floor(diffMs / 1000);
			const diffMinutes = Math.floor(diffSeconds / 60);
			const diffHours = Math.floor(diffMinutes / 60);
			const diffDays = Math.floor(diffHours / 24);

			console.log(`✅ Expected: ${expectedDate.toISOString()}`);
			console.log(
				`   Difference: ${diffDays} days, ${diffHours % 24} hours, ${diffMinutes % 60} minutes, ${diffSeconds % 60} seconds`
			);

			if (diffSeconds < 60) {
				console.log(`   🎯 PERFECT MATCH!`);
			} else if (diffMinutes < 60) {
				console.log(`   ✅ VERY CLOSE MATCH!`);
			} else if (diffHours < 24) {
				console.log(`   ✅ CLOSE MATCH (same day)`);
			} else {
				console.log(`   ⚠️  Different date`);
			}
		} else {
			console.log(`❌ No mint date found`);
			console.log(`   Source: ${result.source}`);
			console.log(`   This could mean:`);
			console.log(`   - No events found for this NFT`);
			console.log(`   - API rate limiting`);
			console.log(`   - NFT doesn't exist or is not indexed by OpenSea`);
		}
	} catch (error) {
		console.error('💥 Test failed:', error);
	}
}

testOpenSeaEvents();
