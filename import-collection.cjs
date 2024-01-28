const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const sdk = require('api')('@opensea/v2.0#kke226lqeabeu1');
const prisma = new PrismaClient();
const imageKit = require('imagekit');
const slugify = require('slugify');
const sharp = require('sharp');
const path = require('path');
const axios = require('axios');
const gifResize = require('@gumlet/gif-resize'); // Library for resizing GIFs
const { env } = require('$env/dynamic/private');

const openseaApiKey = env.OPENSEA_API_KEY; // Replace with your OpenSea API key

//sdk.auth(openseaApiKey);
//sdk.server('https://api.opensea.io');

const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;  // 2 seconds

// Initialize ImageKit
const imagekit = new imageKit({
    publicKey: env.IMAGEKIT_PUBLIC_KEY,
    privateKey: env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: env.URL_ENDPOINT
});

async function fetchMedia(uri) {
    try {
        let buffer;
        let fileName = '';

        const fileType = await import('file-type');

        if (uri.startsWith('ipfs://')) {
            const ipfsUri = `https://ipfs.io/ipfs/${uri.slice(7)}`;
            const response = await axios.get(ipfsUri, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);

            const fileTypeResult = await fileType.fileTypeFromBuffer(buffer);
            const ipfsHash = uri.split('/')[2];

            const dimensions = await sharp(buffer).metadata();

            const width = dimensions.width;
            const height = dimensions.height;

            return {
                buffer: buffer,
                extension: fileTypeResult ? fileTypeResult.ext : '',
                fileName: ipfsHash,
                dimensions: { width, height }
            };

        } else if (uri.startsWith('https://') || uri.startsWith('http://')) {
            const response = await axios.get(uri, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);

            const fileTypeResult = await fileType.fileTypeFromBuffer(buffer);
            fileName = path.basename(uri, fileTypeResult ? `.${fileTypeResult.ext}` : '');

            // Get image dimensions using sharp
            const dimensions = await sharp(buffer).metadata();
            const { width, height } = dimensions;

            return {
                buffer: buffer,
                extension: fileTypeResult ? fileTypeResult.ext : '',
                fileName: fileName,
                dimensions: { width, height }
            };
        } else {
            throw new Error('Unsupported URI scheme');
        }
    } catch (error) {
        console.error('Error fetching media:', error.message);
        console.error(uri);
    }
    return null;
}

async function uploadToImageKit(media, fileBasename) {
    const folderName = 'wallace_collection';

    const requestBody = {
        file: media,
        fileName: fileBasename,
        folder: folderName,
        useUniqueFileName: false
    };

    console.log("Uploading media to ImageKit: ", requestBody.folder + "/" + requestBody.fileName);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await imagekit.upload(requestBody);
            if (response && response.url) {
                return response.url;
            } else {
                throw new Error('Invalid response from ImageKit');
            }
        } catch (error) {
            if (attempt < MAX_RETRIES) {
                console.log(`Retrying in ${RETRY_DELAY} milliseconds...`);
                await sleep(RETRY_DELAY);
            } else {
                console.error('Max retries reached. Upload failed.');
                return null;
            }
        }
    }
}

async function checkExistsOnImageKit(fileName) {
    const imageKitUri = `https://ik.imagekit.io/UltraDAO/wallace_collection/${fileName}`;

    try {
        const response = await axios.head(imageKitUri);
        return imageKitUri;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return false;
        } else {
            return false;
        }
    }
}

async function resizeImage(buffer) {
    try {
        const fileType = await import('file-type');

        const fileTypeResult = await fileType.fileTypeFromBuffer(buffer);

        if (fileTypeResult.ext === 'gif') {
            const resizedGifBuffer = await gifResize({
                width: 2000,
                height: 2000,
                optimizationLevel: 2
            })(buffer);
            return resizedGifBuffer;
        } else {
            const resizedBuffer = await sharp(buffer)
                .resize({
                    width: 2000,
                    height: 2000,
                    fit: sharp.fit.inside,
                    withoutEnlargement: true
                })
                .toBuffer();
            return resizedBuffer;
        }
    } catch (error) {
        console.error('Error resizing image:', error.message);
        return null;
    }
}

async function processMedia(ipfsUri, fileName) {
    const mediaData = await fetchMedia(ipfsUri);
    if (!mediaData) {
        console.error(`No media data found for URI: ${ipfsUri}`);
        return null;
    }

    const dimensions = mediaData.dimensions;

    const fileBasename = slugify(fileName, {
        replacement: '_',
        remove: "#",
        lower: true,
        strict: true,
        locale: 'en'
    }) + '.' + mediaData.extension;

    const exists = await checkExistsOnImageKit(fileBasename);

    if (exists) {
        return {
            uri: exists,
            dimensions: dimensions
        };
    }

    const resizedBuffer = await resizeImage(mediaData.buffer);

    const imageKitUri = await uploadToImageKit(resizedBuffer, fileBasename);

    return {
        uri: imageKitUri,
        dimensions: dimensions
    };
}

const getCollectionDataFromOpenSea = async (collectionSlug) => {
    try {
        const response = await sdk.get_collection({ collection_slug: collectionSlug });
        return response.data;
    } catch (error) {
        console.error('Error fetching collection data from OpenSea:', error);
        return null;
    }
};

function normalizeAttributes(features) {
    if (typeof features !== 'object' || features === null) {
        // If features is not an object or is null, return an empty array
        return [];
    }

    return Object.entries(features).map(([trait_type, value]) => {
        return { trait_type, value: String(value) }; // Convert value to string as your target format seems to represent all values as strings
    });
}

async function normalizeMetadata(artwork) {
    // Simplified to handle only metadata normalization
    const standardMetadata = {
        name: artwork.metadata.name || '',
        tokenID: artwork.metadata.tokenID || artwork.metadata.tokenId || '',
        description: artwork.metadata.description || '',
        artist: artwork.metadata.artist || '',
        platform: artwork.metadata.platform || '',
        image: artwork.metadata.image_url || artwork.metadata.image || '',
        video: artwork.metadata.animation_url || '',
        live_uri: artwork.metadata.generator_url || artwork.metadata.animation_url,
        tags: artwork.metadata.tags || [],
        website: artwork.metadata.website || '',
        attributes: artwork.metadata.attributes || normalizeAttributes(artwork.metadata.features) || [],
    };

    return standardMetadata;
}

async function importArtworks(filePath, collectionSlugs = []) {
    try {
        const rawData = fs.readFileSync(filePath);
        const artworksData = JSON.parse(rawData);

        for (const artwork of artworksData) {
            if (collectionSlugs.length === 0 || collectionSlugs.includes(artwork.collection)) {
                const collectionData = artwork.collection;

                if (!collectionData) continue;

                // Upsert Artist
                const artist = await prisma.artist.upsert({
                    where: { name: artistName },
                    update: {},
                    create: { name: artistName },
                });

                // Upsert Collection
                const collection = await prisma.collection.upsert({
                    where: { slug: artwork.collection },
                    update: {},
                    create: {
                        slug: artwork.collection,
                        title: artwork.name,
                        enabled: true,
                        description: collectionData.description,
                        blockchain: "Ethereum"
                    },
                });

                // Create new collection
                const artworkSlug = slugify(artwork.name, {
                    replacement: '_',
                    remove: "#",
                    lower: true,
                    strict: true,
                    locale: 'en'
                });

                let artworkImage;

                const normalizedMetadata = await normalizeMetadata(artwork);

                if (artwork.metadata.image) {
                    const artworkImageResult = await processMedia(normalizedMetadata.image, artworkSlug); // Corrected with await
                    if (artworkImageResult) {
                        // Update image URI and dimensions
                        normalizedMetadata.image = artworkImageResult.uri;
                        normalizedMetadata.dimensions = JSON.stringify(artworkImageResult.dimensions);
                    }
                }

                // Fetch media and dimensions
                if (normalizedMetadata.image) {
                    const mediaResult = await processMedia(normalizedMetadata.image, normalizedMetadata.name);
                    if (mediaResult) {
                        normalizedMetadata.image = mediaResult.uri;
                        normalizedMetadata.dimensions = JSON.stringify(mediaResult.dimensions);
                    }
                }

                // Check if Artwork exists
                const existingArtwork = await prisma.artwork.findFirst({
                    where: {
                        title: artwork.name,
                    }
                });

                if (existingArtwork) {
                    await prisma.artwork.update({
                        where: { id: existingArtwork.id },
                        data: {
                            title: artwork.name,
                            description: artwork.description,
                            image: normalizedMetadata.image,
                            liveUri: normalizedMetadata.live_uri,
                            attributes: normalizedMetadata.attributes,
                            dimensions: normalizedMetadata.dimensions,
                            contractAddr: artwork.contract,
                            contractAlias: collectionData.name,
                            tokenID: artwork.identifier || normalizedMetadata.tokenID,
                            mintDate: artwork.mint_date,
                            enabled: true,
                            artist: {
                                connect: { id: artist.id },
                            },
                            collection: {
                                connect: { id: collection.id },
                            }
                        }
                    });
                } else {
                    // Create new Artwork
                    await prisma.artwork.create({
                        data: {
                            title: artwork.name,
                            description: artwork.description,
                            image: normalizedMetadata.image,
                            liveUri: normalizedMetadata.live_uri,
                            attributes: normalizedMetadata.attributes,
                            dimensions: normalizedMetadata.dimensions,
                            contractAddr: artwork.contract,
                            contractAlias: collectionData.name,
                            tokenID: artwork.identifier || normalizedMetadata.tokenID,
                            mintDate: artwork.mint_date,
                            enabled: true,
                            artist: {
                                connect: { id: artist.id },
                            },
                            collection: {
                                connect: { id: collection.id },
                            }
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error importing artworks:', error);
    }
};

const artistName = "Olga Fradina";
importArtworks('nfts-tezos.json', ['sadok']);