#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

// Create write client with write database URL
const getWriteDatabaseUrl = () => {
	const baseUrl = process.env.WRITE_DATABASE_URL || process.env.DATABASE_URL;
	if (!baseUrl) {
		throw new Error('WRITE_DATABASE_URL or DATABASE_URL environment variable is not set');
	}
	return baseUrl;
};

const prisma = new PrismaClient({
	datasources: {
		db: {
			url: getWriteDatabaseUrl()
		}
	}
});

async function fixArtwork70() {
	try {
		const artworkId = 70;
		// Correct mint date from Etherscan transaction: Aug-10-2021 02:35:11 PM UTC
		// https://etherscan.io/tx/0x35a423db849b655bc164f9673fb2d901f8856c16d7cf2fd857f97d45816c5a64
		const correctMintDate = new Date('2021-08-10T14:35:11.000Z');

		console.log(`🔧 Fixing artwork ${artworkId} mint date...`);
		console.log(`   Title: "Washint Folktale: Movement of the Ancestors"`);
		console.log(`   Contract: 0x3b3ee1931dc30c1957379fac9aba94d1c48a5405:70679`);
		console.log(`   Setting mint date to: ${correctMintDate.toISOString()}`);
		console.log(`   Human readable: ${correctMintDate.toLocaleString()}`);
		console.log('');
		console.log(
			'🔗 Source: https://etherscan.io/tx/0x35a423db849b655bc164f9673fb2d901f8856c16d7cf2fd857f97d45816c5a64'
		);
		console.log('');

		// Get current artwork data
		const currentArtwork = await prisma.artwork.findUnique({
			where: { id: artworkId },
			select: {
				id: true,
				title: true,
				mintDate: true
			}
		});

		if (!currentArtwork) {
			console.log('❌ Artwork not found');
			return;
		}

		console.log(`📋 Current artwork: ${currentArtwork.title}`);
		console.log(`   Current mint date: ${currentArtwork.mintDate?.toISOString() || 'None'}`);
		if (currentArtwork.mintDate) {
			console.log(`   Current (human): ${currentArtwork.mintDate.toLocaleString()}`);

			const diffMs = Math.abs(correctMintDate.getTime() - currentArtwork.mintDate.getTime());
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
			console.log(`   Difference: ${diffDays} days off!`);
		}
		console.log('');

		// Update the mint date
		const updatedArtwork = await prisma.artwork.update({
			where: { id: artworkId },
			data: { mintDate: correctMintDate }
		});

		console.log('✅ Successfully updated mint date!');
		console.log(`   New mint date: ${updatedArtwork.mintDate?.toISOString()}`);
		console.log(`   New (human): ${updatedArtwork.mintDate?.toLocaleString()}`);
		console.log('');
		console.log('🎯 Verification: Check http://localhost:5173/artist/27/70');
	} catch (error) {
		console.error('💥 Error fixing artwork:', error);
	} finally {
		await prisma.$disconnect();
	}
}

fixArtwork70();
