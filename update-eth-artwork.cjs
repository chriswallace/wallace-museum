const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const jsonFilePath = 'nfts-eth.json';

function slugToTitle(slug) {
    const lowerCaseWords = ['and', 'or', 'the', 'in', 'on', 'at', 'for', 'with', 'a', 'an', 'to', 'of', 'by'];

    return slug
        .split('-')
        .map((word, index, array) => {
            // Always capitalize the first and last word
            if (index === 0 || index === array.length - 1) {
                return capitalize(word);
            }

            // Check if the word is in the lowercase list
            if (lowerCaseWords.includes(word.toLowerCase())) {
                return word.toLowerCase();
            }

            // Capitalize other words
            return capitalize(word);
        })
        .join(' ');
}

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

async function updateArtworkDatabase() {
    // Read JSON data
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));

    // Fetch all artworks from the database
    const artworks = await prisma.artwork.findMany();

    for (const artwork of artworks) {
        // Find a matching token in the JSON data
        // Ensure that token and its metadata and title are defined
        const matchedToken = jsonData.find(token =>
            token.metadata &&
            token.metadata.name &&
            token.metadata.name === artwork.title);

        if (matchedToken) {
            const tokenID = parseInt(matchedToken.identifier);

            if (isNaN(tokenID)) {
                console.error(`Invalid tokenID for artwork: ${artwork.title}`);
                continue;
            }

            let updateData = {
                mintDate: new Date(matchedToken.mint_date * 1000),
                contractAddr: matchedToken.contract,
            };

            if (matchedToken.collection) {
                const contractAlias = slugToTitle(matchedToken.collection);
                updateData.contractAlias = contractAlias;
            }

            // Add tokenID to update data only if it's within the 32-bit signed integer range
            if (tokenID <= 2147483647 && tokenID >= -2147483648) {
                updateData.tokenID = tokenID;
            } else {
                console.log(`tokenID ${tokenID} for artwork '${artwork.title}' exceeds 32-bit integer range. Not updating tokenID.`);
            }

            // Update the artwork in the database
            await prisma.artwork.update({
                where: { id: artwork.id },
                data: updateData,
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
