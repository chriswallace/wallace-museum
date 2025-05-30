import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugImport() {
	try {
		// Find the imported artwork
		const importedArtwork = await prisma.artwork.findFirst({
			where: {
				contractAddress: '0x3b3ee1931dc30c1957379fac9aba94d1c48a5405',
				tokenId: '35388'
			},
			include: { artists: true }
		});

		if (importedArtwork) {
			console.log('\nImported Artwork:');
			console.log(`Title: ${importedArtwork.title}`);
			console.log(`ID: ${importedArtwork.id}`);
			console.log(`Artists linked: ${importedArtwork.artists.length}`);
		}

		// Find the corresponding index record
		const indexRecord = await prisma.artworkIndex.findFirst({
			where: {
				contractAddress: '0x3b3ee1931dc30c1957379fac9aba94d1c48a5405',
				tokenId: '35388'
			}
		});

		if (indexRecord) {
			console.log('\nCorresponding Index Record:');
			console.log(`Index ID: ${indexRecord.id}`);
			console.log(`Import Status: ${indexRecord.importStatus}`);

			// Parse normalized data
			const normalizedData =
				typeof indexRecord.normalizedData === 'string'
					? JSON.parse(indexRecord.normalizedData)
					: indexRecord.normalizedData;

			console.log(`\nNormalized Data Creator Info:`);
			if (normalizedData.creator) {
				console.log(`Creator Address: ${normalizedData.creator.address}`);
				console.log(`Creator Username: ${normalizedData.creator.username || 'None'}`);
				console.log(`Full creator data:`, JSON.stringify(normalizedData.creator, null, 2));
			} else {
				console.log('No creator data in normalized data');
			}
		}

		// Check if an artist exists with the creator address
		if (indexRecord) {
			const normalizedData =
				typeof indexRecord.normalizedData === 'string'
					? JSON.parse(indexRecord.normalizedData)
					: indexRecord.normalizedData;

			if (normalizedData.creator?.address) {
				const creatorAddress = normalizedData.creator.address.toLowerCase();

				// Search all artists for this wallet address
				const allArtists = await prisma.artist.findMany();
				const artistWithAddress = allArtists.find((artist) => {
					if (!artist.walletAddresses || !Array.isArray(artist.walletAddresses)) return false;
					return artist.walletAddresses.some((w) => w.address?.toLowerCase() === creatorAddress);
				});

				if (artistWithAddress) {
					console.log(`\nFound artist with matching wallet address:`);
					console.log(`Artist Name: ${artistWithAddress.name}`);
					console.log(`Artist ID: ${artistWithAddress.id}`);
					console.log(
						`Wallet Addresses:`,
						JSON.stringify(artistWithAddress.walletAddresses, null, 2)
					);
				} else {
					console.log(`\nNo artist found with wallet address: ${creatorAddress}`);
				}
			}
		}

		// Let's trace through what happens during import
		console.log('\n--- Import Process Debug ---');

		// Check import logs in the last hour
		const recentLogs = await prisma.artworkIndex.findMany({
			where: {
				importStatus: 'imported',
				updatedAt: {
					gte: new Date(Date.now() - 3600000) // Last hour
				}
			},
			orderBy: { updatedAt: 'desc' },
			take: 5
		});

		console.log(`\nRecently imported (last hour): ${recentLogs.length}`);
		recentLogs.forEach((log) => {
			console.log(`- ${log.contractAddress}:${log.tokenId} at ${log.updatedAt}`);
		});
	} catch (error) {
		console.error('Error:', error);
	} finally {
		await prisma.$disconnect();
	}
}

debugImport();
