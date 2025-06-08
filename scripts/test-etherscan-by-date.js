#!/usr/bin/env node

/**
 * Test script to search for transactions around a specific date
 *
 * Usage:
 *   node scripts/test-etherscan-by-date.js 0x3b3ee1931dc30c1957379fac9aba94d1c48a5405 70679
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
		'Usage: node scripts/test-etherscan-by-date.js 0x3b3ee1931dc30c1957379fac9aba94d1c48a5405 70679'
	);
	process.exit(1);
}

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

console.log(`🔍 Searching for token ${tokenId} around the known mint date`);
console.log(`   Contract: ${contractAddress}`);
console.log(`   Expected mint: Aug-10-2021 02:35:11 PM UTC`);
console.log(`   API Key: ${ETHERSCAN_API_KEY ? 'Found ✅' : 'Missing ❌'}`);
console.log('');

async function searchByDate() {
	try {
		// Known mint date: Aug-10-2021 02:35:11 PM UTC
		const expectedMintDate = new Date('2021-08-10T14:35:11.000Z');
		const expectedTimestamp = Math.floor(expectedMintDate.getTime() / 1000);

		// Search in a range around the expected date (±1 day)
		const startTimestamp = expectedTimestamp - 24 * 60 * 60; // 1 day before
		const endTimestamp = expectedTimestamp + 24 * 60 * 60; // 1 day after

		console.log(`📅 Searching transactions between:`);
		console.log(`   Start: ${new Date(startTimestamp * 1000).toISOString()}`);
		console.log(`   End: ${new Date(endTimestamp * 1000).toISOString()}`);
		console.log('');

		const baseUrl = 'https://api.etherscan.io/api';
		const params = new URLSearchParams({
			module: 'account',
			action: 'tokennfttx',
			contractaddress: contractAddress,
			startblock: '0',
			endblock: '99999999',
			page: '1',
			offset: '10000', // Get more results
			sort: 'asc'
		});

		if (ETHERSCAN_API_KEY) {
			params.set('apikey', ETHERSCAN_API_KEY);
		}

		const url = `${baseUrl}?${params}`;
		console.log(`📡 Calling Etherscan API with large offset...`);

		const response = await fetch(url);

		if (!response.ok) {
			console.log(`❌ API request failed: ${response.status}`);
			return;
		}

		const data = await response.json();

		if (data.status !== '1' || !data.result || !Array.isArray(data.result)) {
			console.log(`❌ No results returned`);
			console.log(`   Status: ${data.status}`);
			console.log(`   Message: ${data.message}`);
			return;
		}

		console.log(`✅ Found ${data.result.length} total transfers`);

		// Filter transactions around our target date
		const targetTransactions = data.result.filter((tx) => {
			const txTimestamp = parseInt(tx.timeStamp);
			return txTimestamp >= startTimestamp && txTimestamp <= endTimestamp;
		});

		console.log(`🎯 Found ${targetTransactions.length} transfers around target date`);

		if (targetTransactions.length > 0) {
			console.log('');
			console.log('📋 Transactions around target date:');
			targetTransactions.forEach((tx, index) => {
				const date = new Date(parseInt(tx.timeStamp) * 1000);
				console.log(`   ${index + 1}. Token ${tx.tokenID} - ${date.toISOString()}`);
				console.log(`      From: ${tx.from} To: ${tx.to}`);
				console.log(`      Hash: ${tx.hash}`);

				// Check if this is our target token
				if (tx.tokenID === tokenId) {
					console.log(`      🎉 THIS IS OUR TOKEN!`);
				}
				console.log('');
			});

			// Look specifically for our token
			const ourTokenTx = targetTransactions.find((tx) => tx.tokenID === tokenId);
			if (ourTokenTx) {
				const mintDate = new Date(parseInt(ourTokenTx.timeStamp) * 1000);
				console.log(`🎉 FOUND OUR TOKEN ${tokenId}!`);
				console.log(`   Mint date: ${mintDate.toISOString()}`);
				console.log(`   Human readable: ${mintDate.toLocaleString()}`);
				console.log(`   From: ${ourTokenTx.from}`);
				console.log(`   To: ${ourTokenTx.to}`);
				console.log(`   Transaction: ${ourTokenTx.hash}`);
				console.log(`   Block: ${ourTokenTx.blockNumber}`);

				// Compare with expected
				const diffMs = Math.abs(mintDate.getTime() - expectedMintDate.getTime());
				const diffSeconds = Math.floor(diffMs / 1000);
				console.log(`   Expected: ${expectedMintDate.toISOString()}`);
				console.log(`   Difference: ${diffSeconds} seconds`);

				if (diffSeconds < 60) {
					console.log(`   ✅ MATCHES EXPECTED DATE!`);
				} else {
					console.log(`   ⚠️  Different from expected date`);
				}
			} else {
				console.log(`❌ Our token ${tokenId} not found in this date range`);
			}
		} else {
			console.log('❌ No transactions found around the target date');
		}

		// Also show some stats about the token ranges we got
		if (data.result.length > 0) {
			const tokenIds = data.result.map((tx) => parseInt(tx.tokenID)).sort((a, b) => a - b);
			const minToken = tokenIds[0];
			const maxToken = tokenIds[tokenIds.length - 1];
			console.log('');
			console.log(`📊 Token range in results: ${minToken} - ${maxToken}`);
			console.log(`   Our target token: ${tokenId}`);

			if (parseInt(tokenId) > maxToken) {
				console.log(`   ⚠️  Our token is higher than the max token in results`);
				console.log(`   💡 Try increasing the offset or using a different approach`);
			}
		}
	} catch (error) {
		console.error('💥 Search failed:', error.message);
	}
}

searchByDate();
