import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkArtists() {
	try {
		// Count total artists
		const totalArtists = await prisma.artist.count();
		console.log(`\nTotal artists in database: ${totalArtists}`);

		// Get all artists with their wallet addresses
		const artists = await prisma.artist.findMany({
			take: 10, // Show first 10 artists
			orderBy: { createdAt: 'desc' }
		});

		if (artists.length > 0) {
			console.log('\nRecent artists:');
			artists.forEach((artist, index) => {
				console.log(`\n${index + 1}. ${artist.name}`);
				console.log(`   ID: ${artist.id}`);
				console.log(`   Created: ${artist.createdAt}`);

				// Parse and display wallet addresses
				if (artist.walletAddresses) {
					const wallets = artist.walletAddresses;
					console.log(`   Wallet addresses: ${JSON.stringify(wallets, null, 2)}`);
				}
			});
		}

		// Count artworks with artist relationships
		const artworksWithArtists = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT aa."B") as count
      FROM "_ArtistArtworks" aa
    `;

		console.log(`\nArtworks linked to artists: ${artworksWithArtists[0]?.count || 0}`);

		// Show some artwork-artist relationships
		const artworkArtistRelations = await prisma.$queryRaw`
      SELECT a.id as artist_id, a.name as artist_name, 
             aw.id as artwork_id, aw.title as artwork_title
      FROM "Artist" a
      JOIN "_ArtistArtworks" aa ON a.id = aa."A"
      JOIN "Artwork" aw ON aw.id = aa."B"
      LIMIT 5
    `;

		if (artworkArtistRelations.length > 0) {
			console.log('\nSample artwork-artist relationships:');
			artworkArtistRelations.forEach((rel) => {
				console.log(
					`- Artist "${rel.artist_name}" (ID: ${rel.artist_id}) -> Artwork "${rel.artwork_title}" (ID: ${rel.artwork_id})`
				);
			});
		}
	} catch (error) {
		console.error('Error:', error);
	} finally {
		await prisma.$disconnect();
	}
}

checkArtists();
