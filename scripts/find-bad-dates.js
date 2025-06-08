#!/usr/bin/env node

/**
 * Script to find artworks with suspicious mint dates
 *
 * Usage:
 *   node scripts/find-bad-dates.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findBadDates() {
	try {
		const now = new Date();
		const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
		const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

		console.log('🔍 Looking for artworks with suspicious mint dates...');
		console.log(`   Current time: ${now.toISOString()}`);
		console.log('');

		// Find artworks with future dates
		const futureArtworks = await prisma.artwork.findMany({
			where: {
				mintDate: { gt: now },
				contractAddress: { not: null },
				tokenId: { not: null }
			},
			select: {
				id: true,
				title: true,
				contractAddress: true,
				tokenId: true,
				blockchain: true,
				mintDate: true
			},
			orderBy: { mintDate: 'desc' }
		});

		console.log(`🚨 Found ${futureArtworks.length} artworks with FUTURE mint dates:`);
		futureArtworks.forEach((artwork, index) => {
			console.log(`   ${index + 1}. ID ${artwork.id}: ${artwork.title}`);
			console.log(
				`      Mint date: ${artwork.mintDate?.toISOString()} (${artwork.mintDate?.toLocaleString()})`
			);
			console.log(`      Contract: ${artwork.contractAddress}:${artwork.tokenId}`);
			console.log(`      Blockchain: ${artwork.blockchain}`);
			console.log('');
		});

		// Find artworks with very recent dates (suspicious for older contracts)
		const recentArtworks = await prisma.artwork.findMany({
			where: {
				mintDate: {
					gt: oneYearAgo,
					lte: now
				},
				contractAddress: { not: null },
				tokenId: { not: null },
				blockchain: 'ethereum' // Focus on Ethereum for now
			},
			select: {
				id: true,
				title: true,
				contractAddress: true,
				tokenId: true,
				blockchain: true,
				mintDate: true
			},
			orderBy: { mintDate: 'desc' },
			take: 10 // Just show top 10
		});

		console.log(
			`⚠️  Found ${recentArtworks.length} Ethereum artworks with recent mint dates (last year):`
		);
		recentArtworks.forEach((artwork, index) => {
			console.log(`   ${index + 1}. ID ${artwork.id}: ${artwork.title}`);
			console.log(
				`      Mint date: ${artwork.mintDate?.toISOString()} (${artwork.mintDate?.toLocaleString()})`
			);
			console.log(`      Contract: ${artwork.contractAddress}:${artwork.tokenId}`);
			console.log('');
		});

		// Summary
		console.log('📊 Summary:');
		console.log(`   ${futureArtworks.length} artworks with future dates (definitely wrong)`);
		console.log(`   ${recentArtworks.length} artworks with recent dates (potentially suspicious)`);

		if (futureArtworks.length > 0) {
			console.log('');
			console.log('💡 Recommendation: Test the bulk update on the future-dated artworks first:');
			const futureIds = futureArtworks.slice(0, 5).map((a) => a.id);
			console.log(`   node scripts/test-specific-artworks.js ${futureIds.join(' ')}`);
		}
	} catch (error) {
		console.error('💥 Error finding bad dates:', error);
	} finally {
		await prisma.$disconnect();
	}
}

findBadDates();
