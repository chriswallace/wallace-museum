// Importing modules using ESM syntax
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { promises as fs } from 'fs';  // Node.js built-in fs promises API
import path from 'path';
import imageKit from 'imagekit';
import { fileTypeFromBuffer } from 'file-type';
import slugify from 'slugify';
import sharp from 'sharp';
import gifResize from '@gumlet/gif-resize';  // Import a library for resizing GIFs
import { PrismaClient } from '@prisma/client';
import { env } from '$env/dynamic/private';

const prisma = new PrismaClient();

const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;  // 2 seconds

const imagekit = new imageKit({
    publicKey: env.IMAGEKIT_PUBLIC_KEY,
    privateKey: env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: env.URL_ENDPOINT
});

async function fetchMedia(uri) {
    try {
        let buffer;
        let fileName = '';

        if (uri.startsWith('ipfs://')) {
            const ipfsUri = `https://ipfs.io/ipfs/${uri.slice(7)}`;
            const response = await axios.get(ipfsUri, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);

            const fileType = await fileTypeFromBuffer(buffer);
            const ipfsHash = uri.split('/')[2];

            const dimensions = await sharp(buffer).metadata();

            const width = dimensions.width;
            const height = dimensions.height;

            return {
                buffer: buffer,
                extension: fileType.ext,
                fileName: ipfsHash,
                dimensions: { width, height }
            };

        } else if (uri.startsWith('https://') || uri.startsWith('http://')) {
            const response = await axios.get(uri, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);

            const fileType = await fileTypeFromBuffer(buffer);
            fileName = path.basename(uri, `.${fileType.ext}`);

            // Get image dimensions using sharp
            const dimensions = await sharp(buffer).metadata();
            const { width, height } = dimensions;

            return {
                buffer: buffer,
                extension: fileType.ext,
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

// Function to find or create collection and return its ID
async function findOrCreateCollection(collectionTitle) {
    // Check if collection exists
    const existingCollection = await prisma.collection.findFirst({
        where: { title: collectionTitle }
    });

    if (existingCollection) {
        return existingCollection.id; // Return existing collection ID
    } else {
        // Create new collection
        const collectionSlug = slugify(collectionTitle, {
            replacement: '_',
            remove: "#",
            lower: true,
            strict: true,
            locale: 'en'
        });
        const newCollection = await prisma.collection.create({
            data: {
                title: collectionTitle, slug: collectionSlug, enabled: true,
            }
        });
        return newCollection.id; // Return new collection ID
    }
}

async function resizeImage(buffer) {
    try {
        const fileType = await fileTypeFromBuffer(buffer);

        if (fileType.ext === 'gif') {
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

async function processMedia(ipfsUri, fileName) {
    const mediaData = await fetchMedia(ipfsUri);
    if (!mediaData) {
        console.error(`No media data found for URI: ${ipfsUri}`);
        return null; // Return early if mediaData is null
    }

    const dimensions = mediaData.dimensions;
    await logData({ stage: 'fetchMedia', ipfsUri, dimensions });

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
            dimensions: mediaData.dimensions
        };
    }

    const resizedBuffer = await resizeImage(mediaData.buffer);

    const imageKitUri = await uploadToImageKit(resizedBuffer, fileBasename);

    return {
        uri: imageKitUri,
        dimensions: mediaData.dimensions
    };
}

async function fetchMetadata(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching metadata:', error.message);
        return null;
    }
}

function normalizeAttributes(attributes) {
    if (!Array.isArray(attributes)) {
        // If attributes is not an array, return an empty array
        return [];
    }
    return attributes.map(attribute => {
        if (attribute.name && !attribute.trait_type) {
            attribute.trait_type = attribute.name;
            delete attribute.name;
        }
        return attribute;
    });
}


async function normalizeMetadata(metadata) {
    // Simplified to handle only metadata normalization
    const standardMetadata = {
        name: metadata.name || '',
        tokenID: metadata.tokenID || metadata.tokenId || '',
        description: metadata.description || '',
        artist: metadata.artist || '',
        platform: metadata.platform || '',
        image: '',  // Placeholder, to be updated later
        video: '',  // Placeholder, to be updated later
        live_uri: '',  // Placeholder, to be updated later
        tags: metadata.tags || [],
        website: metadata.website || '',
        attributes: metadata.features || normalizeAttributes(metadata.attributes) || [],
    };

    return standardMetadata;
}

async function scrapeAndStoreMetadata(filePath) {
    const html = await fs.readFile(filePath, 'utf8');
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Find all collection groups
    const collectionGroups = document.querySelectorAll('.collection-group');

    for (const collectionGroup of collectionGroups) {
        const artistElements = collectionGroup.querySelectorAll('.artist-title');

        for (const artistElement of artistElements) {
            const artistName = artistElement.textContent.trim();
            const artist = await prisma.artist.upsert({
                where: { name: artistName },
                update: {},
                create: { name: artistName }
            });

            let currentElement = artistElement.nextElementSibling;
            while (currentElement) {
                if (currentElement.classList.contains('collection-title')) {
                    const collectionTitle = currentElement.textContent.trim();
                    const collectionId = await findOrCreateCollection(collectionTitle);

                    // Check if the artist-collection link already exists
                    const existingLink = await prisma.artistCollections.findFirst({
                        where: {
                            artistId: artist.id,
                            collectionId: collectionId
                        }
                    });

                    // Create the link only if it doesn't exist
                    if (!existingLink) {
                        await prisma.artistCollections.create({
                            data: {
                                artistId: artist.id,
                                collectionId: collectionId
                            }
                        });
                    }

                    // Process the artwork within this collection
                    processArtworkElements(currentElement.nextElementSibling, artist, collectionId);
                }
                currentElement = currentElement.nextElementSibling;
            }
        }
    }
}

async function processArtworkElements(startElement, artist, collectionId) {
    let artworkElement = startElement;
    while (artworkElement && !artworkElement.classList.contains('artist-title') && !artworkElement.classList.contains('collection-title')) {
        if (artworkElement.tagName === 'IMG') {
            await processArtwork(artworkElement, artist, collectionId);
        } else {
            // If the element is a container, process its child IMG elements
            const nestedImages = artworkElement.querySelectorAll('img');
            for (const img of nestedImages) {
                await processArtwork(img, artist, collectionId);
            }
        }
        artworkElement = artworkElement.nextElementSibling;
    }
}

async function processArtwork(artworkElement, artist, collectionId) {
    const metadataUrl = artworkElement.getAttribute('data-metadata');
    let fetchedMetadata = await fetchMetadata(metadataUrl);
    const imageUri = artworkElement.getAttribute('src');
    const liveUri = artworkElement.getAttribute('data-iframe-src');
    const videoUri = artworkElement.getAttribute('data-video');

    if (fetchedMetadata) {
        const normalizedMetadata = await normalizeMetadata(fetchedMetadata);

        // Update image, video, and live_uri if available
        normalizedMetadata.image = imageUri || normalizedMetadata.image;
        normalizedMetadata.video = videoUri || normalizedMetadata.video;
        normalizedMetadata.live_uri = liveUri || normalizedMetadata.live_uri;

        // Fetch media and dimensions
        if (normalizedMetadata.image) {
            const mediaResult = await processMedia(normalizedMetadata.image, normalizedMetadata.name);
            if (mediaResult) {
                normalizedMetadata.image = mediaResult.uri;
                normalizedMetadata.dimensions = JSON.stringify(mediaResult.dimensions);
            }
        }

        // Check if artwork exists
        const existingArtwork = await prisma.artwork.findFirst({
            where: {
                title: normalizedMetadata.name,
                artistId: artist.id
            }
        });

        if (existingArtwork) {
            // Update existing artwork
            await prisma.artwork.update({
                where: { id: existingArtwork.id },
                data: {
                    description: normalizedMetadata.description,
                    image: normalizedMetadata.image,
                    video: normalizedMetadata.video,
                    liveUri: normalizedMetadata.live_uri,
                    dimensions: normalizedMetadata.dimensions,
                    attributes: normalizedMetadata.attributes,
                    tags: normalizedMetadata.tags,
                }
            });
        } else {
            // Create new artwork
            await prisma.artwork.create({
                data: {
                    title: normalizedMetadata.name,
                    description: normalizedMetadata.description,
                    image: normalizedMetadata.image,
                    enabled: true,
                    dimensions: normalizedMetadata.dimensions,
                    video: normalizedMetadata.video,
                    liveUri: normalizedMetadata.live_uri,
                    attributes: normalizedMetadata.attributes,
                    tags: normalizedMetadata.tags,
                    artistId: artist.id,
                    collectionId: collectionId,
                }
            });
        }

        // Log activity
        await logData({ stage: 'ArtworkProcessed', artworkId: existingArtwork ? existingArtwork.id : 'New', artworkData: normalizedMetadata });
    }
}

const logFile = 'log.json';

async function logData(data) {
    try {
        // Convert data to JSON string with indentation
        const dataString = JSON.stringify(data, null, 2);

        // Append data string to the file with a newline for separation
        await fs.appendFile(logFile, dataString + "\n", 'utf8');
    } catch (error) {
        console.error('Error logging data:', error.message);
    }
}

async function processAllFiles() {
    const dir = 'static/collection2';
    const files = await fs.readdir(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        if (path.extname(file) === '.html') {
            await scrapeAndStoreMetadata(filePath);
        }
    }

    await prisma.$disconnect();
}

processAllFiles();