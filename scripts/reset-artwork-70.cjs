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

async function resetArtwork70() {
	try {
		const artworkId = 70;
		// Reset to the wrong date that was there before (from OpenSea updated_at)
		const wrongMintDate = new Date('2023-10-31T23:04:04.089Z');

		console.log(`🔄 Resetting artwork ${artworkId} to wrong mint date for testing...`);
		console.log(`   Setting mint date to: ${wrongMintDate.toISOString()}`);
		console.log(`   Human readable: ${wrongMintDate.toLocaleString()}`);
		console.log('');
		console.log('🎯 This will allow us to test if Etherscan API can automatically fix it');
		console.log('');

		// Update the mint date back to the wrong one
		const updatedArtwork = await prisma.artwork.update({
			where: { id: artworkId },
			data: { mintDate: wrongMintDate }
		});

		console.log('✅ Successfully reset mint date to wrong value!');
		console.log(`   Current mint date: ${updatedArtwork.mintDate?.toISOString()}`);
		console.log('');
		console.log('🧪 Now run: node scripts/test-specific-artworks.js 70');
		console.log('   This should detect the wrong date and fix it using Etherscan API');
	} catch (error) {
		console.error('💥 Error resetting artwork:', error);
	} finally {
		await prisma.$disconnect();
	}
}

resetArtwork70();
