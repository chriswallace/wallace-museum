#!/usr/bin/env node

/**
 * Test script to search through paginated Etherscan results for a specific token
 *
 * Usage:
 *   node scripts/test-etherscan-paginated.js 0x3b3ee1931dc30c1957379fac9aba94d1c48a5405 70679
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
		'Usage: node scripts/test-etherscan-paginated.js 0x3b3ee1931dc30c1957379fac9aba94d1c48a5405 70679'
	);
	process.exit(1);
}

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

console.log(`🔍 Searching for token ${tokenId} in contract ${contractAddress}`);
console.log(`   API Key: ${ETHERSCAN_API_KEY ? 'Found ✅' : 'Missing ❌'}`);
console.log('');

async function searchForToken() {
	try {
		const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
		let page = 1;
		const maxPages = 50; // Limit search to prevent infinite loop
		let found = false;

		while (page <= maxPages && !found) {
			console.log(`📄 Searching page ${page}...`);

			const baseUrl = 'https://api.etherscan.io/api';
			const params = new URLSearchParams({
				module: 'account',
				action: 'tokennfttx',
				contractaddress: contractAddress,
				page: page.toString(),
				offset: '100',
				sort: 'asc'
			});

			if (ETHERSCAN_API_KEY) {
				params.set('apikey', ETHERSCAN_API_KEY);
			}

			const url = `${baseUrl}?${params}`;
			const response = await fetch(url);

			if (!response.ok) {
				console.log(`❌ API request failed: ${response.status}`);
				break;
			}

			const data = await response.json();

			if (data.status !== '1' || !data.result || !Array.isArray(data.result)) {
				console.log(`❌ No more results on page ${page}`);
				break;
			}

			console.log(`   Found ${data.result.length} transfers on page ${page}`);

			// Look for our specific token
			const tokenTransfers = data.result.filter((tx) => tx.tokenID === tokenId);

			if (tokenTransfers.length > 0) {
				console.log(`🎯 FOUND TOKEN ${tokenId} on page ${page}!`);
				console.log('');

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
					console.log('');

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

				found = true;
			} else {
				// Show range of tokens on this page
				if (data.result.length > 0) {
					const firstToken = data.result[0].tokenID;
					const lastToken = data.result[data.result.length - 1].tokenID;
					console.log(`   Token range: ${firstToken} - ${lastToken}`);
				}
			}

			page++;

			// Add delay to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 200));
		}

		if (!found) {
			console.log(`❌ Token ${tokenId} not found in first ${maxPages} pages`);
			console.log('   The token might be in later pages or not exist in this contract');
		}
	} catch (error) {
		console.error('💥 Search failed:', error.message);
	}
}

searchForToken();
