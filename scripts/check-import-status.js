import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkImportStatus() {
	try {
		// Count total artworks
		const totalArtworks = await prisma.artwork.count();
		console.log(`\nTotal artworks in database: ${totalArtworks}`);

		// Count total artwork indexes
		const totalIndexed = await prisma.artworkIndex.count();
		console.log(`Total NFTs indexed: ${totalIndexed}`);

		// Count imported vs pending
		const importedCount = await prisma.artworkIndex.count({
			where: { importStatus: 'imported' }
		});
		const pendingCount = await prisma.artworkIndex.count({
			where: { importStatus: 'pending' }
		});
		console.log(`Imported: ${importedCount}, Pending: ${pendingCount}`);

		// Get some indexed NFTs and check for creator data in JavaScript
		const someIndexed = await prisma.artworkIndex.findMany({
			take: 10,
			orderBy: { createdAt: 'desc' }
		});

		// Filter for those with creator data
		const indexedWithCreator = someIndexed.filter((indexed) => {
			try {
				const data =
					typeof indexed.normalizedData === 'string'
						? JSON.parse(indexed.normalizedData)
						: indexed.normalizedData;
				return data?.creator?.address;
			} catch (e) {
				return false;
			}
		});

		console.log(
			`\nIndexed NFTs with creator data: ${indexedWithCreator.length} out of ${someIndexed.length} checked`
		);

		if (indexedWithCreator.length > 0) {
			console.log('\nSample NFTs with creator data:');
			indexedWithCreator.slice(0, 5).forEach((indexed, i) => {
				const data =
					typeof indexed.normalizedData === 'string'
						? JSON.parse(indexed.normalizedData)
						: indexed.normalizedData;
				const creator = data?.creator;
				console.log(`${i + 1}. ${indexed.contractAddress}:${indexed.tokenId}`);
				console.log(`   Title: ${data?.title || 'Unknown'}`);
				console.log(
					`   Creator: ${creator?.address || 'None'} (${creator?.username || 'unnamed'})`
				);
				console.log(`   Import Status: ${indexed.importStatus}`);
			});
		}

		// Check recently imported artworks
		const recentImports = await prisma.artwork.findMany({
			take: 5,
			orderBy: { id: 'desc' },
			include: {
				artists: true
			}
		});

		if (recentImports.length > 0) {
			console.log('\nRecently imported artworks:');
			recentImports.forEach((artwork, i) => {
				console.log(`${i + 1}. ${artwork.title} (ID: ${artwork.id})`);
				console.log(`   Contract: ${artwork.contractAddress}:${artwork.tokenId}`);
				console.log(`   Artists linked: ${artwork.artists.length}`);
				if (artwork.artists.length > 0) {
					artwork.artists.forEach((artist) => {
						console.log(`     - ${artist.name} (ID: ${artist.id})`);
					});
				}
			});
		}

		// Check the link between the indexed data and imported artwork
		const linkedIndex = await prisma.artworkIndex.findFirst({
			where: {
				artworkId: { not: null },
				importStatus: 'imported'
			}
		});

		if (linkedIndex) {
			console.log('\nExample of linked index -> artwork:');
			console.log(`Index ID: ${linkedIndex.id} -> Artwork ID: ${linkedIndex.artworkId}`);

			const linkedArtwork = await prisma.artwork.findUnique({
				where: { id: linkedIndex.artworkId },
				include: { artists: true }
			});

			if (linkedArtwork) {
				console.log(`Artwork: ${linkedArtwork.title}`);
				console.log(`Artists: ${linkedArtwork.artists.map((a) => a.name).join(', ') || 'None'}`);
			}
		}
	} catch (error) {
		console.error('Error:', error);
	} finally {
		await prisma.$disconnect();
	}
}

checkImportStatus();
