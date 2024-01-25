const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const jsonFilePath = 'nfts-tezos.json';

async function updateArtworkDatabase() {
    // Read JSON data
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));

    // Fetch all artworks from the database
    const artworks = await prisma.artwork.findMany();

    for (const artwork of artworks) {
        // Find a matching token in the JSON data
        // Ensure that token and its metadata and name are defined
        const matchedToken = jsonData.find(token =>
            token.token &&
            token.token.metadata &&
            token.token.metadata.name &&
            token.token.metadata.name === artwork.title);

        if (matchedToken) {
            // Update the artwork in the database
            await prisma.artwork.update({
                where: { id: artwork.id },
                data: {
                    mintDate: new Date(matchedToken.mintDate),
                    contractAddr: matchedToken.token.contract.address,
                    contractAlias: matchedToken.token.contract.alias,
                    totalSupply: matchedToken.token.totalSupply,
                    symbol: matchedToken.token.metadata.symbol,
                    tokenID: parseInt(matchedToken.token.tokenId),
                },
            });

            console.log(`Updated artwork: ${artwork.title}`);
        }
    }

    console.log('Database update complete.');
}

updateArtworkDatabase()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });