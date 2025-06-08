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

async function fixArtwork() {
	try {
		const artworkId = 455;
		const correctMintDate = new Date('2023-05-18T17:32:11.000Z'); // May 18, 2023 05:32:11 PM UTC

		console.log(`🔧 Fixing artwork ${artworkId} mint date...`);
		console.log(`   Setting mint date to: ${correctMintDate.toISOString()}`);
		console.log(`   Human readable: ${correctMintDate.toLocaleString()}`);

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

		// Update the mint date
		const updatedArtwork = await prisma.artwork.update({
			where: { id: artworkId },
			data: { mintDate: correctMintDate }
		});

		console.log('✅ Successfully updated mint date!');
		console.log(`   New mint date: ${updatedArtwork.mintDate?.toISOString()}`);
	} catch (error) {
		console.error('💥 Error fixing artwork:', error);
	} finally {
		await prisma.$disconnect();
	}
}

fixArtwork();
