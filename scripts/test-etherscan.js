#!/usr/bin/env node

/**
 * Test script to check Etherscan API for mint date
 *
 * Usage:
 *   node scripts/test-etherscan.js 0x3b3ee1931dc30c1957379fac9aba94d1c48a5405 70679
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const contractAddress = process.argv[2];
const tokenId = process.argv[3];

if (!contractAddress || !tokenId) {
	console.log('❌ Please provide contract address and token ID');
	console.log(
		'Usage: node scripts/test-etherscan.js 0x3b3ee1931dc30c1957379fac9aba94d1c48a5405 70679'
	);
	process.exit(1);
}

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

console.log(`🔍 Testing Etherscan API for:`);
console.log(`   Contract: ${contractAddress}`);
console.log(`   Token ID: ${tokenId}`);
console.log(`   API Key: ${ETHERSCAN_API_KEY ? 'Found ✅' : 'Missing ❌'}`);
console.log('');

async function testEtherscan() {
	try {
		// Etherscan API endpoint for ERC721 transfers
		const baseUrl = 'https://api.etherscan.io/api';
		const params = new URLSearchParams({
			module: 'account',
			action: 'tokennfttx',
			contractaddress: contractAddress,
			page: '1',
			offset: '100', // Get first 100 transfers to find the mint
			sort: 'asc' // Oldest first
		});

		// Add API key if available
		if (ETHERSCAN_API_KEY) {
			params.set('apikey', ETHERSCAN_API_KEY);
		}

		const url = `${baseUrl}?${params}`;
		console.log(`📡 Calling Etherscan API: ${url.replace(ETHERSCAN_API_KEY || '', 'HIDDEN_KEY')}`);

		const response = await fetch(url);

		if (!response.ok) {
			console.log(`❌ Etherscan API request failed: ${response.status}`);
			const errorText = await response.text();
			console.log(`Error response: ${errorText}`);
			return;
		}

		const data = await response.json();

		console.log(`📊 API Response:`);
		console.log(`   Status: ${data.status}`);
		console.log(`   Message: ${data.message}`);
		console.log(`   Result type: ${typeof data.result}`);

		if (data.status !== '1' || !data.result || !Array.isArray(data.result)) {
			console.log(`❌ Etherscan API returned error or no results`);
			if (data.result && typeof data.result === 'string') {
				console.log(`   Error details: ${data.result}`);
			}
			return;
		}

		console.log(`✅ Found ${data.result.length} total NFT transfers for this contract`);
		console.log('');

		// Look for transfers of this specific token
		const tokenTransfers = data.result.filter((tx) => tx.tokenID === tokenId);
		console.log(`🎯 Transfers for token ${tokenId}: ${tokenTransfers.length}`);

		if (tokenTransfers.length > 0) {
			tokenTransfers.forEach((tx, index) => {
				const date = new Date(parseInt(tx.timeStamp) * 1000);
				console.log(`   ${index + 1}. ${date.toISOString()} (${date.toLocaleString()})`);
				console.log(`      From: ${tx.from}`);
				console.log(`      To: ${tx.to}`);
				console.log(`      Hash: ${tx.hash}`);
				console.log(`      Block: ${tx.blockNumber}`);
				console.log('');
			});

			// Look for the mint event (from zero address)
			const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
			const mintTransfer = tokenTransfers.find(
				(tx) => tx.from.toLowerCase() === ZERO_ADDRESS.toLowerCase()
			);

			if (mintTransfer) {
				const mintDate = new Date(parseInt(mintTransfer.timeStamp) * 1000);
				console.log(`🎉 MINT EVENT FOUND!`);
				console.log(`   Date: ${mintDate.toISOString()}`);
				console.log(`   Human readable: ${mintDate.toLocaleString()}`);
				console.log(`   To: ${mintTransfer.to}`);
				console.log(`   Transaction: ${mintTransfer.hash}`);
				console.log(`   Block: ${mintTransfer.blockNumber}`);

				// Compare with expected
				const expectedDate = new Date('2021-08-10T14:35:11.000Z');
				const diffMs = Math.abs(mintDate.getTime() - expectedDate.getTime());
				const diffSeconds = Math.floor(diffMs / 1000);
				console.log(`   Expected: ${expectedDate.toISOString()}`);
				console.log(`   Difference: ${diffSeconds} seconds`);

				if (diffSeconds < 60) {
					console.log(`   ✅ MATCHES EXPECTED DATE!`);
				} else {
					console.log(`   ⚠️  Different from expected date`);
				}
			} else {
				console.log(`❌ No mint event found (no transfer from zero address)`);
			}
		} else {
			console.log(`❌ No transfers found for token ${tokenId}`);

			// Show a sample of other tokens to see if the API is working
			console.log('');
			console.log('📋 Sample of other tokens in this contract:');
			const sampleTokens = data.result.slice(0, 5);
			sampleTokens.forEach((tx, index) => {
				const date = new Date(parseInt(tx.timeStamp) * 1000);
				console.log(`   ${index + 1}. Token ${tx.tokenID} - ${date.toISOString()}`);
				console.log(`      From: ${tx.from} To: ${tx.to}`);
			});
		}
	} catch (error) {
		console.error('💥 Test failed:', error.message);
	}
}

testEtherscan();
