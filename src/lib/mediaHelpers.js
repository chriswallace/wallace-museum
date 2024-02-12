// src/lib/mediaHelpers.js
import axios from 'axios';
import sharp from 'sharp';
import fileType from 'file-type';
import { env } from '$env/dynamic/private';
import imageKit from 'imagekit';

const imagekit = new imageKit({
    publicKey: env.IMAGEKIT_PUBLIC_KEY,
    privateKey: env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: env.IMAGEKIT_URL_ENDPOINT
});

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export async function uploadToImageKit(fileStream, fileName) {
    try {

        const response = await imagekit.upload({
            file: fileStream,
            fileName: fileName,
        });

        if (response && response.url) {
            // Return an object with both URL and fileType
            return {
                url: response.url,
                fileType: response.fileType || 'image' // Default to 'image' if fileType is not provided
            };
        } else {
            throw new Error('Invalid response from ImageKit');
        }
    } catch (error) {
        console.error('Error uploading to ImageKit:', error);
        return null;
    }
}

export async function normalizeMetadata(artwork) {
    // Simplified to handle only metadata normalization
    const standardMetadata = {
        name: artwork.metadata.name || '',
        tokenID: artwork.metadata.tokenID || artwork.metadata.tokenId || artwork.identifier || '',
        description: artwork.metadata.description || '',
        artist: artwork.metadata.artist || '',
        platform: artwork.metadata.platform || '',
        image: artwork.metadata.image_url || artwork.metadata.display_url || artwork.metadata.image || '',
        video: artwork.metadata.animation_url || '',
        live_uri: artwork.metadata.generator_url || artwork.metadata.animation_url,
        tags: artwork.metadata.tags || [],
        website: artwork.metadata.website || '',
        attributes: artwork.metadata.attributes || normalizeAttributes(artwork.metadata.features) || [],
    };

    return standardMetadata;
}

function normalizeAttributes(features) {
    if (typeof features !== 'object' || features === null) {
        // If features is not an object or is null, return an empty array
        return [];
    }

    return Object.entries(features).map(([trait_type, value]) => {
        return { trait_type, value: String(value) }; // Convert value to string as your target format seems to represent all values as strings
    });
}

export async function fetchMedia(uri) {
    try {
        let buffer;
        let fileName = '';

        const fileType = await import('file-type');

        // Replace calls to images starting with https://ipfs.io to https://cloudflare-ipfs.com
        if (uri.startsWith('ipfs://')) {
            // Updated to use the new gateway URL
            const ipfsUri = uri.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
            const response = await axios.get(ipfsUri, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);

            const fileTypeResult = await fileType.fileTypeFromBuffer(buffer);

            console.log(fileTypeResult);

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

        } else if (uri.startsWith('https://ipfs.io')) {
            // Direct replacement for images already using https://ipfs.io
            const updatedUri = uri.replace('https://ipfs.io', 'https://cloudflare-ipfs.com');
            const response = await axios.get(updatedUri, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);

            const fileTypeResult = await fileType.fileTypeFromBuffer(buffer);

            console.log(fileTypeResult);

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
        } else if (uri.startsWith('https://') || uri.startsWith('http://')) {
            // Handle other URIs normally
            const response = await axios.get(uri, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);

            const fileTypeResult = await fileType.fileTypeFromBuffer(buffer);

            console.log(fileTypeResult);

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

export async function resizeImage(buffer, width = 2000, height = 2000) {
    try {
        const resizedBuffer = await sharp(buffer)
            .resize(width, height, { fit: 'inside', withoutEnlargement: true })
            .toBuffer();
        return resizedBuffer;
    } catch (error) {
        console.error('Error resizing image:', error);
        throw error;
    }
}