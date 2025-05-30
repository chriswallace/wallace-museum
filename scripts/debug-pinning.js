#!/usr/bin/env node

/**
 * Debug script to test CID extraction and pinning for artworks
 * Usage: node scripts/debug-pinning.js
 */

import { PrismaClient } from '@prisma/client';
import { extractCidsFromArtwork, pinCidToPinata, isCidPinned } from '../src/lib/pinataHelpers.ts';

const prisma = new PrismaClient();

async function debugArtworkPinning() {
	try {
		console.log('🔍 Debug: Artwork Pinning Analysis');
		console.log('=====================================\n');

		// Get some recent artworks to test
		const artworks = await prisma.artwork.findMany({
			take: 5,
			orderBy: { id: 'desc' },
			include: {
				collection: true
			}
		});

		if (artworks.length === 0) {
			console.log('❌ No artworks found in database');
			return;
		}

		console.log(`📊 Found ${artworks.length} artworks to analyze\n`);

		for (const artwork of artworks) {
			console.log(`\n🎨 Artwork: "${artwork.title}" (ID: ${artwork.id})`);
			console.log(`   Collection: ${artwork.collection?.title || 'None'}`);

			// Create artwork object for CID extraction
			const artworkForExtraction = {
				title: artwork.title,
				imageUrl: artwork.imageUrl,
				animationUrl: artwork.animationUrl,
				thumbnailUrl: artwork.thumbnailUrl,
				metadataUrl: artwork.metadataUrl,
				// Also include common API fields that might be present
				image_url: artwork.imageUrl,
				animation_url: artwork.animationUrl,
				thumbnail_url: artwork.thumbnailUrl,
				metadata_url: artwork.metadataUrl
			};

			console.log('   URLs found:');
			if (artwork.imageUrl) console.log(`     - imageUrl: ${artwork.imageUrl}`);
			if (artwork.animationUrl) console.log(`     - animationUrl: ${artwork.animationUrl}`);
			if (artwork.thumbnailUrl) console.log(`     - thumbnailUrl: ${artwork.thumbnailUrl}`);
			if (artwork.metadataUrl) console.log(`     - metadataUrl: ${artwork.metadataUrl}`);

			// Extract CIDs
			const cids = extractCidsFromArtwork(artworkForExtraction);
			console.log(`   🔗 Extracted ${cids.length} CIDs: ${cids.join(', ')}`);

			if (cids.length === 0) {
				console.log('   ⚠️  No IPFS CIDs found in this artwork');
				continue;
			}

			// Check pinning status for each CID
			for (const cid of cids) {
				try {
					const isPinned = await isCidPinned(cid);
					console.log(`   📌 CID ${cid}: ${isPinned ? '✅ Already pinned' : '❌ Not pinned'}`);

					if (!isPinned) {
						console.log(`   🔄 Attempting to pin CID: ${cid}`);
						const pinResult = await pinCidToPinata(cid, `${artwork.title} - ${cid}`);

						if (pinResult.error) {
							console.log(`   ❌ Pin failed: ${pinResult.error}`);
						} else {
							console.log(`   ✅ Pin successful: ${pinResult.IpfsHash}`);
						}
					}
				} catch (error) {
					console.log(`   ❌ Error checking/pinning CID ${cid}: ${error.message}`);
				}
			}
		}

		console.log('\n🏁 Debug analysis complete');
	} catch (error) {
		console.error('❌ Debug script error:', error);
	} finally {
		await prisma.$disconnect();
	}
}

// Run the debug function
debugArtworkPinning().catch(console.error);
