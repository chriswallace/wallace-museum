#!/usr/bin/env node

/**
 * Debug script to check what the OpenSea events API returns for mint date
 *
 * Usage:
 *   node scripts/debug-mint-date.js 0x5927ef9c92e47f87d1e76db2a9936f91ea24c88c 522
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
		'Usage: node scripts/debug-mint-date.js 0x5927ef9c92e47f87d1e76db2a9936f91ea24c88c 522'
	);
	process.exit(1);
}

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;

if (!OPENSEA_API_KEY) {
	console.log('❌ OPENSEA_API_KEY not found in environment');
	process.exit(1);
}

console.log(`🔍 Debugging mint date for:`);
console.log(`   Contract: ${contractAddress}`);
console.log(`   Token ID: ${tokenId}`);
console.log('');

async function debugMintDate() {
	try {
		// Call the OpenSea events API directly
		const eventsUrl = `https://api.opensea.io/api/v2/events/chain/ethereum/contract/${contractAddress}/nfts/${tokenId}`;
		console.log(`📡 Calling OpenSea events API: ${eventsUrl}`);

		const eventsResponse = await fetch(eventsUrl, {
			headers: { 'X-API-KEY': OPENSEA_API_KEY }
		});

		if (!eventsResponse.ok) {
			console.log(`❌ Events API request failed: ${eventsResponse.status}`);
			const errorText = await eventsResponse.text();
			console.log(`Error response: ${errorText}`);
		} else {
			const eventsData = await eventsResponse.json();
			const events = eventsData.events || [];

			console.log(`✅ Found ${events.length} events`);
			console.log('');

			if (events.length > 0) {
				// Look for all transfer events
				const transferEvents = events.filter((event) => event.event_type === 'transfer');
				console.log(`🔄 Transfer events (${transferEvents.length}):`);

				transferEvents.forEach((event, index) => {
					console.log(`   ${index + 1}. ${event.event_timestamp}`);
					console.log(`      From: ${event.from_address || 'null'}`);
					console.log(`      To: ${event.to_address || 'null'}`);
					console.log(`      Type: ${event.event_type}`);
					console.log(`      Transaction: ${event.transaction || 'N/A'}`);
					console.log('');
				});

				// Look specifically for mint events (from zero address)
				const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
				const mintEvents = events.filter(
					(event) => event.event_type === 'transfer' && event.from_address === ZERO_ADDRESS
				);

				console.log(`🎯 Mint events (from zero address) (${mintEvents.length}):`);

				if (mintEvents.length > 0) {
					mintEvents.forEach((event, index) => {
						console.log(`   ${index + 1}. ${event.event_timestamp}`);
						console.log(`      From: ${event.from_address}`);
						console.log(`      To: ${event.to_address}`);
						console.log(`      Transaction: ${event.transaction || 'N/A'}`);

						// Parse the date
						const mintDate = new Date(event.event_timestamp);
						console.log(`      Parsed date: ${mintDate.toISOString()}`);
						console.log(`      Human readable: ${mintDate.toLocaleString()}`);
						console.log('');
					});
				} else {
					console.log('   ❌ No mint events found!');
				}
			} else {
				console.log('   ❌ No events found at all!');
			}
		}

		console.log('');

		// Also check the basic NFT data
		console.log('📋 Checking basic NFT data...');
		const nftUrl = `https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}/nfts/${tokenId}`;
		console.log(`📡 Calling OpenSea NFT API: ${nftUrl}`);

		const nftResponse = await fetch(nftUrl, {
			headers: { 'X-API-KEY': OPENSEA_API_KEY }
		});

		if (nftResponse.ok) {
			const nftData = await nftResponse.json();
			const nft = nftData.nft || nftData;

			console.log('✅ Basic NFT data found:');
			console.log(`   - name: ${nft.name || 'N/A'}`);
			console.log(`   - created_date: ${nft.created_date || 'N/A'}`);
			console.log(`   - updated_at: ${nft.updated_at || 'N/A'}`);
			console.log(`   - mint_date: ${nft.mint_date || 'N/A'}`);

			// Parse dates if they exist
			if (nft.created_date) {
				const createdDate = new Date(nft.created_date);
				console.log(`   - created_date parsed: ${createdDate.toISOString()}`);
				console.log(`   - created_date human: ${createdDate.toLocaleString()}`);
			}

			if (nft.updated_at) {
				const updatedDate = new Date(nft.updated_at);
				console.log(`   - updated_at parsed: ${updatedDate.toISOString()}`);
				console.log(`   - updated_at human: ${updatedDate.toLocaleString()}`);
			}

			if (nft.mint_date) {
				const mintDate = new Date(nft.mint_date);
				console.log(`   - mint_date parsed: ${mintDate.toISOString()}`);
				console.log(`   - mint_date human: ${mintDate.toLocaleString()}`);
			}
		} else {
			console.log(`❌ NFT API request failed: ${nftResponse.status}`);
			const errorText = await nftResponse.text();
			console.log(`Error response: ${errorText}`);
		}

		// Try to get collection info
		console.log('');
		console.log('📋 Checking collection data...');
		const collectionUrl = `https://api.opensea.io/api/v2/collections/${contractAddress}`;
		console.log(`📡 Calling OpenSea collection API: ${collectionUrl}`);

		const collectionResponse = await fetch(collectionUrl, {
			headers: { 'X-API-KEY': OPENSEA_API_KEY }
		});

		if (collectionResponse.ok) {
			const collectionData = await collectionResponse.json();
			console.log('✅ Collection data found:');
			console.log(`   - name: ${collectionData.name || 'N/A'}`);
			console.log(`   - created_date: ${collectionData.created_date || 'N/A'}`);
		} else {
			console.log(`❌ Collection API request failed: ${collectionResponse.status}`);
		}
	} catch (error) {
		console.error('💥 Debug failed:', error.message);
	}
}

debugMintDate();
