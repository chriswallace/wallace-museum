#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getArtwork() {
	try {
		const artwork = await prisma.artwork.findUnique({
			where: { id: 455 },
			include: {
				Artist: true
			}
		});

		if (artwork) {
			console.log('Artwork Details:');
			console.log('ID:', artwork.id);
			console.log('Title:', artwork.title);
			console.log('Artist:', artwork.Artist?.name);
			console.log('Contract Address:', artwork.contractAddress);
			console.log('Token ID:', artwork.tokenId);
			console.log('Current Mint Date:', artwork.mintDate);
			console.log('Created At:', artwork.createdAt);
			console.log('Updated At:', artwork.updatedAt);
			console.log('Image URL:', artwork.imageUrl);
			console.log('Thumbnail URL:', artwork.thumbnailUrl);
			console.log('Description:', artwork.description?.substring(0, 200) + '...');
		} else {
			console.log('Artwork not found');
		}
	} catch (error) {
		console.error('Error:', error);
	} finally {
		await prisma.$disconnect();
	}
}

getArtwork();
