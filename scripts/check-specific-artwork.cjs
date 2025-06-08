#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkArtwork() {
	try {
		const artwork = await prisma.artwork.findUnique({
			where: { id: 70 },
			include: {
				Artist: true
			}
		});

		if (artwork) {
			console.log('🎨 Artwork Details (ID 70):');
			console.log('Title:', artwork.title);
			console.log('Artist:', artwork.Artist?.name);
			console.log('Contract Address:', artwork.contractAddress);
			console.log('Token ID:', artwork.tokenId);
			console.log('Blockchain:', artwork.blockchain);
			console.log('');
			console.log('📅 Current Mint Date:', artwork.mintDate?.toISOString() || 'None');
			if (artwork.mintDate) {
				console.log('Current (human):', artwork.mintDate.toLocaleString());
			}
			console.log('');
			console.log('✅ Expected Mint Date: 2021-08-10T14:35:11.000Z (from Etherscan)');
			console.log('Expected (human): 8/10/2021, 9:35:11 AM CDT');
			console.log('');

			if (artwork.mintDate) {
				const currentDate = new Date(artwork.mintDate);
				const expectedDate = new Date('2021-08-10T14:35:11.000Z');
				const diffMs = Math.abs(expectedDate.getTime() - currentDate.getTime());
				const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
				const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

				console.log(`🔍 Difference from expected: ${diffDays} days, ${diffHours} hours`);

				if (diffMs > 86400000) {
					// More than 1 day
					console.log('🚨 SIGNIFICANT DIFFERENCE - needs fixing!');
				} else {
					console.log('✅ Close enough to expected date');
				}
			}

			console.log('');
			console.log('🔗 References:');
			console.log(
				'Etherscan TX:',
				'https://etherscan.io/tx/0x35a423db849b655bc164f9673fb2d901f8856c16d7cf2fd857f97d45816c5a64'
			);
			console.log(
				'Foundation:',
				'https://foundation.app/mint/eth/0x3B3ee1931Dc30C1957379FAc9aba94D1C48a5405/70679'
			);
			console.log('Local:', 'http://localhost:5173/artist/27/70');
		} else {
			console.log('❌ Artwork not found');
		}
	} catch (error) {
		console.error('💥 Error:', error);
	} finally {
		await prisma.$disconnect();
	}
}

checkArtwork();
