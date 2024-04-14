import prisma from "$lib/prisma";

export async function processArtist(artistInfo) {
    return await prisma.artist.upsert({
        where: { name: artistInfo.username || artistInfo.address },
        update: {
            bio: artistInfo.bio,
            websiteUrl: artistInfo.website,
            twitterHandle: artistInfo.social_media_accounts.twitter,
            instagramHandle: artistInfo.social_media_accounts.instagram,
        },
        create: {
            name: artistInfo.username || artistInfo.address,
            bio: artistInfo.bio,
            websiteUrl: artistInfo.website,
            twitterHandle: artistInfo.social_media_accounts.twitter,
            instagramHandle: artistInfo.social_media_accounts.instagram,
        }
    });
}

export async function processCollection(collectionInfo) {
    return await prisma.collection.upsert({
        where: { slug: collectionInfo.collection },
        update: {
            title: collectionInfo.name,
            description: collectionInfo.description,
            enabled: true,
            curatorNotes: collectionInfo.curatorNotes,
        },
        create: {
            slug: collectionInfo.collection,
            title: collectionInfo.name,
            description: collectionInfo.description,
            enabled: true,
            curatorNotes: collectionInfo.curatorNotes,
        }
    });
}

export async function saveArtwork(nft, artistId, collectionId) {

    const imageUrl = nft.metadata?.image; // Use optional chaining to safely access .image
    const videoUrl = nft.metadata?.video; // Same for video

    return await prisma.artwork.upsert({
        where: {
            tokenID_contractAddr: {
                tokenID: nft.identifier,
                contractAddr: nft.contract
            }
        },
        update: {
            title: nft.name,
            description: nft.description,
            image: imageUrl,
            video: videoUrl,
            liveUri: nft.metadata?.live_uri,
            attributes: nft.metadata.attributes,
            blockchain: nft.collection.blockchain,
            dimensions: JSON.stringify(nft.dimensions),
            contractAddr: nft.contract,
            contractAlias: nft.collection.name,
            totalSupply: nft.collection.total_supply,
            tokenStandard: nft.token_standard,
            tokenID: nft.identifier,
            mintDate: new Date(nft.updated_at),
            artistId: artistId,
            collectionId: collectionId,
        },
        create: {
            title: nft.name,
            description: nft.description,
            image: imageUrl,
            video: videoUrl,
            liveUri: nft.metadata?.live_uri,
            attributes: nft.metadata.attributes,
            blockchain: nft.collection.blockchain,
            dimensions: JSON.stringify(nft.dimensions),
            contractAddr: nft.contract,
            contractAlias: nft.collection.name,
            totalSupply: nft.collection.total_supply,
            tokenStandard: nft.token_standard,
            tokenID: nft.identifier,
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