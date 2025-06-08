#!/usr/bin/env node

/**
 * Debug version of OpenSea Events API test to see raw event data
 *
 * Usage:
 *   node scripts/test-opensea-events-debug.js
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log(`🔍 Debug test of OpenSea Events API`);
console.log(`   API Key: ${process.env.OPENSEA_API_KEY ? 'Found ✅' : 'Missing ❌'}`);
console.log('');

async function debugOpenSeaEvents() {
	try {
		// Test with artwork 70 (Foundation contract)
		const contractAddress = '0x3b3ee1931dc30c1957379fac9aba94d1c48a5405';
		const tokenId = '70679';
		const blockchain = 'ethereum';

		console.log(`📡 Fetching raw events from OpenSea for:`);
		console.log(`   Contract: ${contractAddress}`);
		console.log(`   Token ID: ${tokenId}`);
		console.log('');

		const baseUrl = `https://api.opensea.io/api/v2/events/chain/${blockchain}/contract/${contractAddress}/nfts/${tokenId}`;
		const params = new URLSearchParams({
			limit: '50',
			event_type: 'transfer'
		});

		const url = `${baseUrl}?${params}`;
		console.log(`🌐 URL: ${url}`);
		console.log('');

		const response = await fetch(url, {
			headers: {
				'X-API-KEY': process.env.OPENSEA_API_KEY || ''
			}
		});

		if (!response.ok) {
			console.log(`❌ API request failed: ${response.status}`);
			const errorText = await response.text();
			console.log(`Error response: ${errorText}`);
			return;
		}

		const data = await response.json();

		console.log(`📊 Raw API Response:`);
		console.log(`   Status: ${response.status}`);
		console.log(`   Has asset_events: ${!!data.asset_events}`);
		console.log(`   Events count: ${data.asset_events?.length || 0}`);
		console.log(`   Has next cursor: ${!!data.next}`);
		console.log('');

		if (data.asset_events && data.asset_events.length > 0) {
			console.log(`📋 All events for this NFT:`);
			data.asset_events.forEach((event, index) => {
				console.log(`   ${index + 1}. Event Type: ${event.event_type}`);
				console.log(`      From: ${event.from_address || 'null'}`);
				console.log(`      To: ${event.to_address || 'null'}`);
				console.log(`      Transaction: ${event.transaction || 'null'}`);
				console.log(`      Event Timestamp: ${event.event_timestamp}`);
				console.log(
					`      Event Timestamp (parsed): ${new Date(event.event_timestamp).toISOString()}`
				);
				console.log(
					`      Event Timestamp (human): ${new Date(event.event_timestamp).toLocaleString()}`
				);

				// Check if this looks like a mint (from null address)
				const isFromNull =
					!event.from_address ||
					event.from_address === '0x0000000000000000000000000000000000000000';
				if (isFromNull) {
					console.log(`      🎯 THIS IS A MINT EVENT!`);
				}

				console.log('');
			});

			// Look for mint events specifically
			const mintEvents = data.asset_events.filter(
				(event) =>
					event.event_type === 'transfer' &&
					(!event.from_address ||
						event.from_address === '0x0000000000000000000000000000000000000000')
			);

			if (mintEvents.length > 0) {
				console.log(`🎉 Found ${mintEvents.length} mint event(s):`);
				mintEvents.forEach((event, index) => {
					console.log(`   Mint ${index + 1}:`);
					console.log(`      Transaction: ${event.transaction}`);
					console.log(`      Raw timestamp: ${event.event_timestamp}`);
					console.log(`      Parsed timestamp: ${new Date(event.event_timestamp).toISOString()}`);
					console.log(
						`      Expected transaction: 0x35a423db849b655bc164f9673fb2d901f8856c16d7cf2fd857f97d45816c5a64`
					);
					console.log(
						`      Transaction match: ${event.transaction === '0x35a423db849b655bc164f9673fb2d901f8856c16d7cf2fd857f97d45816c5a64' ? '✅' : '❌'}`
					);
					console.log('');
				});
			}
		} else {
			console.log(`❌ No events found`);
		}

		// Also show the full raw response for debugging
		console.log(`🔍 Full raw response (first 1000 chars):`);
		console.log(JSON.stringify(data, null, 2).substring(0, 1000) + '...');
	} catch (error) {
		console.error('💥 Debug test failed:', error);
	}
}

debugOpenSeaEvents();
