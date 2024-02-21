// src/lib/mediaHelpers.js
import axios from 'axios';
import axiosRetry from 'axios-retry';
import sharp from 'sharp';
import path from 'path';
import { env } from '$env/dynamic/private';
import imageKit from 'imagekit';
import { fileTypeFromBuffer } from 'file-type';
import crypto from 'crypto';

const imagekit = new imageKit({
	publicKey: env.IMAGEKIT_PUBLIC_KEY,
	privateKey: env.IMAGEKIT_PRIVATE_KEY,
	urlEndpoint: env.IMAGEKIT_URL_ENDPOINT
});

// Configure axiosRetry to retry up to 3 times with a delay of 1000 milliseconds between retries
axiosRetry(axios, {
	retries: 3, // Number of retry attempts
	retryDelay: (retryCount) => {
		return retryCount * 1000; // Time in milliseconds between retries (1000ms = 1s)
	},
	// This is a function determining if a retry should be performed based on the error
	retryCondition: (error) => {
		// Retry on network errors and 5xx status codes
		return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response.status >= 500;
	}
});

function createHashForArtworkName(name) {
	if (!name) {
		console.warn('createHashForArtworkName called with undefined or null name.');
		return '';
	}
	return crypto.createHash('sha256').update(name).digest('hex');
}

function extensionFromMimeType(mimeType) {
	switch (mimeType) {
		case 'image/jpeg':
			return '.jpg';
		case 'image/png':
			return '.png';
		case 'image/gif':
			return '.gif';
		case 'video/mp4':
			return '.mp4';
		default:
			console.error(`Unsupported MIME type for extension: ${mimeType}`);
			return '';
	}
}

function generateFileName(artwork, mimeType) {
	let baseName;
	if (artwork.contractAddr && artwork.tokenID) {
		baseName = `artwork-${artwork.contractAddr}-${artwork.tokenID}`;
	} else {
		baseName = artwork.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
	}

	const extension = extensionFromMimeType(mimeType);
	return `${baseName}${extension}`;
}

function generateTags(artwork) {
	let tags = [];
	if (artwork.contractAddr && artwork.tokenID) {
		tags.push(`contractAddr:${artwork.contractAddr}`, `tokenID:${artwork.tokenID}`);
	} else {
		// Create a hash or a unique identifier for artworks without contractAddr and tokenID
		const hash = createHashForArtworkName(artwork.name);
		tags.push(`nameHash:${hash}`);
	}
	return tags.join(',');
}

export async function uploadToImageKit(fileStream, artwork, mimeType) {
	const tags = generateTags(artwork);

	// Search for existing files using the generated tags
	try {
		const searchResponse = await imagekit.listFiles({
			tags: tags
		});

		// Check if there's an existing file with the same unique tags
		if (searchResponse.length > 0) {
			return { url: searchResponse[0].url, fileType: searchResponse[0].fileType, dimensions: { height: searchResponse[0].height, width: searchResponse[0].width } };
		}
	} catch (error) {
		console.error(`Error searching for existing file in ImageKit: ${error.message}`);
		return null;
	}

	try {
		const fileName = generateFileName(artwork, mimeType); // Generate a base file name
		const response = await imagekit.upload({
			file: fileStream,
			fileName, // This name will get a unique suffix by ImageKit
			folder: 'compendium',
			tags: tags // Apply tags for later identification
		});

		if (response && response.url) {
			return { url: response.url, fileType: mimeType };
		} else {
			throw new Error('ImageKit upload failed with no response');
		}
	} catch (error) {
		console.error(`Error uploading to ImageKit: ${error.message}`);
		return null;
	}
}

export async function normalizeMetadata(nft) {
	// Check if the NFT data is directly at the top level or nested under 'nft'.
	const artwork = nft.nft || nft;

	// Defaulting to an empty object if metadata is undefined
	const metadata = artwork.metadata || {};

	// Use top-level data if metadata_url is null (indicating OpenSea Shared Storefront contract scenario)
	const standardMetadata = {
		name: artwork.name || metadata.name || '',
		tokenID: artwork.identifier || metadata.tokenID || metadata.tokenId || '',
		description: artwork.description || metadata.description || '',
		artist: artwork.creator || metadata.artist || '', // Assuming 'creator' field exists at top level for OpenSea data
		platform: artwork.platform || metadata.platform || '',
		image: artwork.image_url || metadata.displayUri || metadata.image || '',
		video: artwork.animation_url || metadata.video || metadata.animation_url || '',
		live_uri: artwork.live_uri || metadata.generator_url ? convertIpfsUriToHttpUrl(metadata.generator_url || artwork.generator_url) : '',
		tags: metadata.tags || [],
		website: artwork.website || metadata.website || '',
		attributes: artwork.traits || metadata.attributes || metadata.features || {},
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

export async function fetchWithRetry(url, retries = 3, delay = 1000) {
	for (let i = 0; i < retries; i++) {
		try {
			return await axios.get(url, {
				responseType: 'arraybuffer',
				timeout: 10000 // Timeout of 10 seconds
			});
		} catch (error) {
			if (i < retries - 1) {
				await new Promise(resolve => setTimeout(resolve, delay));
				continue;
			} else {
				throw error;
			}
		}
	}
}

function convertIpfsUriToHttpUrl(ipfsUri) {
	if (!ipfsUri) {
		return ''; // Return an empty string or some default value if ipfsUri is undefined
	}
	const ipfsPrefix = 'ipfs://';
	if (ipfsUri.startsWith(ipfsPrefix)) {
		const ipfsHash = ipfsUri.slice(ipfsPrefix.length);
		return `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
	}
	return ipfsUri;
}

export async function fetchMedia(uri) {
	try {
		const httpUrl = convertIpfsUriToHttpUrl(uri);
		const response = await axios.get(httpUrl, { responseType: 'arraybuffer' });
		const buffer = Buffer.from(response.data);

		const fileTypeResult = await fileTypeFromBuffer(buffer);
		if (!fileTypeResult) {
			console.error('Could not determine file type.');
			return null;
		}

		const mimeType = fileTypeResult.mime;

		if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
			console.error(`Unsupported media type: ${mimeType}`);
			return null;
		}

		const fileName = path.basename(new URL(httpUrl).pathname) + '.' + fileTypeResult.ext;
		let dimensions = null;

		if (mimeType.startsWith('image/')) {
			try {
				const metadata = await sharp(buffer).metadata();
				dimensions = { width: metadata.width, height: metadata.height };
			} catch (sharpError) {
				console.error('Error processing image with sharp:', sharpError);
			}
		}

		return {
			buffer,
			mimeType,
			fileName,
			dimensions // Include dimensions only for images
		};
	} catch (error) {
		//console.error(`Error fetching media from ${uri}:`, error);
		return null;
	}
}

/**
 * @param {any} mediaUri
 */
export async function handleMediaUpload(mediaUri, artwork) {
	const mediaData = await fetchMedia(mediaUri);
	if (!mediaData) return null;

	// Ensure we only proceed with supported types
	if (!mediaData.mimeType.startsWith('image/') && !mediaData.mimeType.startsWith('video/')) {
		console.error(`Unsupported media type: ${mediaData.mimeType}`);
		return null;
	}

	// Check for dimensions before resizing and uploading
	let dimensions = mediaData.dimensions;
	if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
		console.warn("Dimensions are missing or invalid, resizing might not correctly adjust dimensions.");
		dimensions = { width: undefined, height: undefined }; // Use undefined or a default value
	}

	const resizeResult = await resizeImage(mediaData.buffer, dimensions.width || 2000, dimensions.height || 2000); // Default/fallback dimensions if missing
	const resizedBuffer = resizeResult.buffer;
	const resizedDimensions = resizeResult.dimensions || dimensions; // Use original or resized dimensions

	const uploadResult = await uploadToImageKit(resizedBuffer, artwork, mediaData.mimeType);

	// Return upload result or null if unsuccessful
	return uploadResult ? {
		url: uploadResult.url,
		fileType: mediaData.mimeType,
		dimensions: resizedDimensions // Use the resized or fallback dimensions
	} : null;
}


export async function resizeImage(buffer, targetWidth = 2000, targetHeight = 2000) {
	try {
		let sizeMB = Buffer.byteLength(buffer) / (1024 * 1024);
		let attempt = 0;
		let resizedBuffer = buffer;

		while (sizeMB > 25 && attempt < 10) {
			let scaleFactor = attempt === 0 ? 1 : Math.pow(0.9, attempt);
			let newWidth = Math.floor(targetWidth * scaleFactor);
			let newHeight = Math.floor(targetHeight * scaleFactor);

			// Create a sharp instance for the current buffer and resize
			let image = sharp(resizedBuffer).resize(newWidth, newHeight, {
				fit: 'inside',
				withoutEnlargement: true
			});

			// Obtain the resized buffer
			resizedBuffer = await image.toBuffer();

			// Extract metadata from the resized image
			let metadata = await sharp(resizedBuffer).metadata();
			dimensions.width = newWidth;
			dimensions.height = newHeight;

			// Update the size for the next loop iteration
			sizeMB = Buffer.byteLength(resizedBuffer) / (1024 * 1024);
			attempt++;
		}

		if (sizeMB > 25) {
			console.warn('Unable to reduce file size below 25MB after several attempts.');
		}

		// Return the final resized buffer along with its dimensions
		return { buffer: resizedBuffer, dimensions: { width: targetWidth, height: targetHeight } };
	} catch (error) {
		console.error('Error resizing image:', error);
		throw error;
	}
}