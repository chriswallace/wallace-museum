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

axiosRetry(axios, {
	retries: 3,
	retryDelay: (retryCount) => {
		return retryCount * 1000;
	},
	retryCondition: (error) => {
		return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response.status >= 500;
	}
});

function createHashForString(string) {
	if (!string) {
		console.warn('createHashForString called with undefined or null name.');
		return '';
	}
	return crypto.createHash('sha256').update(string).digest('hex');
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

function generateTags(fileName, contractAddr, tokenID) {
	let tags = [];

	const fileHash = createHashForString(fileName);

	if (contractAddr && tokenID) {
		tags.push(`contractAddr:${contractAddr}`, `tokenID:${tokenID}`);
	}
	if (fileHash) {
		tags.push(`fileHash:${fileHash}`);
	}
	return tags.join(',');
}

export async function uploadToImageKit(fileStream, file, mimeType) {

	const tags = generateTags(fileStream);

	try {
		const searchResponse = await imagekit.listFiles({
			tags: tags
		});

		if (searchResponse.length > 0) {
			return {
				url: searchResponse[0].url,
				fileType: searchResponse[0].fileType,
				dimensions: { height: searchResponse[0].height, width: searchResponse[0].width }
			};
		}
	} catch (error) {
		console.error(`Error searching for existing file in ImageKit: ${error.message}`);
		return null;
	}

	try {
		const fileName = generateFileName(file, mimeType);
		const response = await imagekit.upload({
			file: fileStream,
			fileName,
			folder: 'compendium',
			tags: tags
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
	const artwork = nft.nft || nft;

	const metadata = artwork.metadata || {};

	const standardMetadata = {
		name: artwork.name || metadata.name || '',
		tokenID: artwork.identifier || metadata.tokenID || metadata.tokenId || '',
		description: artwork.description || metadata.description || '',
		artist: artwork.creator || metadata.artist || '', // Assuming 'creator' field exists at top level for OpenSea data
		platform: artwork.platform || metadata.platform || '',
		image: artwork.image_url || metadata.displayUri || metadata.image || '',
		video: artwork.animation_url || metadata.video || metadata.animation_url || '',
		live_uri:
			artwork.live_uri || metadata.generator_url
				? convertIpfsUriToHttpUrl(metadata.generator_url || artwork.generator_url)
				: '',
		tags: metadata.tags || [],
		website: artwork.website || metadata.website || '',
		attributes: artwork.traits || metadata.attributes || metadata.features || {}
	};

	return standardMetadata;
}

function normalizeAttributes(features) {
	if (typeof features !== 'object' || features === null) {
		return [];
	}

	return Object.entries(features).map(([trait_type, value]) => {
		return { trait_type, value: String(value) };
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
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			} else {
				throw error;
			}
		}
	}
}

export async function fixIpfsUrl(nft) {
	if (nft.image_url) {
		nft.image_url = convertIpfsUriToHttpUrl(nft.image_url)
		nft.image_url = convertIpfsUrlToCloudflareUrl(nft.image_url);
	}
	return nft;
}

function convertIpfsUrlToCloudflareUrl(ipfsUri) {
	if (ipfsUri.startsWith('https://ipfs.io')) {
		return ipfsUri.replace('https://ipfs.io', 'https://cloudflare-ipfs.com');
	}
	return ipfsUri;
}

function convertIpfsUriToHttpUrl(ipfsUri) {
	if (!ipfsUri) {
		return '';
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
			dimensions
		};
	} catch (error) {
		return null;
	}
}

/**
 * @param {any} mediaUri
 */
export async function handleMediaUpload(mediaUri, artwork) {
	const mediaData = await fetchMedia(mediaUri);
	if (!mediaData) return null;

	if (!mediaData.mimeType.startsWith('image/') && !mediaData.mimeType.startsWith('video/')) {
		console.error(`Unsupported media type: ${mediaData.mimeType}`);
		return null;
	}

	let dimensions = mediaData.dimensions;
	if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
		console.warn(
			'Dimensions are missing or invalid, resizing might not correctly adjust dimensions.'
		);
		dimensions = { width: undefined, height: undefined };
	}

	const resizeResult = await resizeImage(
		mediaData.buffer,
		dimensions.width || 2000,
		dimensions.height || 2000
	);

	const resizedBuffer = resizeResult.buffer;
	const resizedDimensions = resizeResult.dimensions || dimensions;

	const uploadResult = await uploadToImageKit(resizedBuffer, artwork, mediaData.mimeType);

	return uploadResult
		? {
			url: uploadResult.url,
			fileType: mediaData.mimeType,
			dimensions: resizedDimensions
		}
		: null;
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

			let image = sharp(resizedBuffer).resize(newWidth, newHeight, {
				fit: 'inside',
				withoutEnlargement: true
			});

			resizedBuffer = await image.toBuffer();

			// Extract metadata from the resized image
			let metadata = await sharp(resizedBuffer).metadata();
			dimensions.width = newWidth;
			dimensions.height = newHeight;

			sizeMB = Buffer.byteLength(resizedBuffer) / (1024 * 1024);
			attempt++;
		}

		if (sizeMB > 25) {
			console.warn('Unable to reduce file size below 25MB after several attempts.');
		}

		return { buffer: resizedBuffer, dimensions: { width: targetWidth, height: targetHeight } };
	} catch (error) {
		console.error('Error resizing image:', error);
		throw error;
	}
}
