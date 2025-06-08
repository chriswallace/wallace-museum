#!/usr/bin/env node

/**
 * Direct test of the Etherscan helper function
 *
 * Usage:
 *   node scripts/test-etherscan-direct.js
 */

import dotenv from 'dotenv';
import { fetchMintDateFromEtherscan } from '../src/lib/etherscanHelpers.js';

// Load environment variables
dotenv.config();

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

console.log(`🔍 Direct test of Etherscan helper function`);
console.log(`   API Key: ${ETHERSCAN_API_KEY ? 'Found ✅' : 'Missing ❌'}`);
console.log('');

async function testEtherscanHelper() {
	try {
		const contractAddress = '0x3b3ee1931dc30c1957379fac9aba94d1c48a5405';
		const tokenId = '70679';

		console.log(`📡 Calling fetchMintDateFromEtherscan...`);
		console.log(`   Contract: ${contractAddress}`);
		console.log(`   Token ID: ${tokenId}`);
		console.log('');

		const startTime = Date.now();
		const mintDate = await fetchMintDateFromEtherscan(contractAddress, tokenId, ETHERSCAN_API_KEY);
		const endTime = Date.now();

		console.log(`⏱️  Search completed in ${endTime - startTime}ms`);
		console.log('');

		if (mintDate) {
			console.log(`🎉 SUCCESS! Found mint date:`);
			console.log(`   ISO: ${mintDate}`);
			console.log(`   Human: ${new Date(mintDate).toLocaleString()}`);
			console.log('');

			// Compare with expected
			const expectedDate = new Date('2021-08-10T14:35:11.000Z');
			const actualDate = new Date(mintDate);
			const diffMs = Math.abs(actualDate.getTime() - expectedDate.getTime());
			const diffSeconds = Math.floor(diffMs / 1000);

			console.log(`✅ Expected: ${expectedDate.toISOString()}`);
			console.log(`   Difference: ${diffSeconds} seconds`);

			if (diffSeconds < 60) {
				console.log(`   🎯 PERFECT MATCH!`);
			} else {
				console.log(`   ⚠️  Different from expected`);
			}
		} else {
			console.log(`❌ No mint date found`);
			console.log(`   This could mean:`);
			console.log(`   - Token not found in search results`);
			console.log(`   - API rate limiting`);
			console.log(`   - Token ID too high for current search range`);
		}
	} catch (error) {
		console.error('💥 Test failed:', error);
	}
}

testEtherscanHelper();
