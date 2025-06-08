#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function getStats() {
	try {
		const total = await prisma.artwork.count({
			where: {
				contractAddress: { not: null },
				tokenId: { not: null },
				blockchain: 'ethereum'
			}
		});

		const withMintDate = await prisma.artwork.count({
			where: {
				contractAddress: { not: null },
				tokenId: { not: null },
				blockchain: 'ethereum',
				mintDate: { not: null }
			}
		});

		const withoutMintDate = total - withMintDate;

		console.log('📊 Ethereum Artwork Statistics:');
		console.log(`   Total Ethereum artworks: ${total}`);
		console.log(`   With mint date: ${withMintDate}`);
		console.log(`   Without mint date: ${withoutMintDate}`);
		console.log(`   Coverage: ${Math.round((withMintDate / total) * 100)}%`);

		// Check for suspicious future dates
		const futureDate = new Date();
		const suspiciousDates = await prisma.artwork.count({
			where: {
				contractAddress: { not: null },
				tokenId: { not: null },
				blockchain: 'ethereum',
				mintDate: { gt: futureDate }
			}
		});

		console.log(`   Suspicious future dates: ${suspiciousDates}`);
	} catch (error) {
		console.error('Error:', error);
	} finally {
		await prisma.$disconnect();
	}
}

getStats();
