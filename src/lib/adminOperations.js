import prisma from "$lib/prisma";

export async function processArtist(artistInfo) {
    return await prisma.artist.upsert({
        where: { name: artistInfo.username || artistInfo.address },
        update: {
            bio: artistInfo.bio,
            avatarUrl: artistInfo.avatarUrl,
            websiteUrl: artistInfo.website,
            twitterHandle: artistInfo.social_media_accounts.twitter,
            instagramHandle: artistInfo.social_media_accounts.instagram,
        },
        create: {
            name: artistInfo.username || artistInfo.address,
            avatarUrl: artistInfo.avatarUrl,
            bio: artistInfo.bio,
            websiteUrl: artistInfo.website,
            twitterHandle: artistInfo.social_media_accounts.twitter,
            instagramHandle: artistInfo.social_media_accounts.instagram,
        }
    });
}

export async function processCollection(collectionInfo) {
    return await prisma.collection.upsert({
        where: { slug: collectionInfo.contract },
        update: {
            title: collectionInfo.name,
            description: collectionInfo.description,
            enabled: true,
            curatorNotes: collectionInfo.curatorNotes,
        },
        create: {
            slug: collectionInfo.contract,
            title: collectionInfo.name,
            description: collectionInfo.description,
            enabled: true,
            curatorNotes: collectionInfo.curatorNotes,
        }
    });
}

export async function saveArtwork(nft, artistId, collectionId) {

    //console.log("Saving artwork", nft);

    return await prisma.artwork.upsert({
        where: {
            tokenID_contractAddr: {
                tokenID: nft.tokenID,
                contractAddr: nft.collection.contract
            }
        },
        update: {
            title: nft.name,
            description: nft.description,
            image_url: nft.metadata.image_url,
            animation_url: nft.metadata.animation_url,
            attributes: nft.metadata.attributes,
            blockchain: nft.collection.blockchain,
            dimensions: JSON.stringify(nft.dimensions),
            contractAddr: nft.collection.contract,
            contractAlias: nft.collection.name,
            mime: nft.mime,
            totalSupply: nft.collection.total_supply,
            tokenStandard: nft.token_standard,
            tokenID: nft.tokenID,
            mintDate: new Date(nft.updated_at),
            artistId: artistId,
            collectionId: collectionId,
        },
        create: {
            title: nft.name,
            description: nft.description,
            image_url: nft.metadata.image_url,
            animation_url: nft.metadata.animation_url,
            attributes: nft.metadata.attributes,
            blockchain: nft.collection.blockchain,
            dimensions: JSON.stringify(nft.dimensions),
            contractAddr: nft.collection.contract,
            contractAlias: nft.collection.name,
            mime: nft.mime,
            totalSupply: nft.collection.total_supply,
            tokenStandard: nft.token_standard,
            tokenID: nft.tokenID,
            mintDate: new Date(nft.updated_at),
            enabled: true,
            artist: {
                connect: { id: artistId }
            },
            collection: {
                connect: { id: collectionId }
            },
        }
    });
}