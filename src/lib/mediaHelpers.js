// src/lib/mediaHelpers.js
import axios from 'axios';
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

function createHashForArtworkName(name) {
	// Create a SHA-256 hash from the artwork name
	return crypto.createHash('sha256').update(name).digest('hex');
}

function extensionFromMimeType(mimeType) {
	switch (mimeType) {
		case 'image/jpeg':
			return '.jpg';
		case 'image/png':
			return '.png';
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
			//console.log(`File already exists, skipping upload: ${searchResponse[0].url}`);
			return { url: searchResponse[0].url, fileType: searchResponse[0].fileType };
		}
	} catch (error) {
		console.error(`Error searching for existing file in ImageKit: ${error.message}`);
		return null;
	}

	// No existing file found, proceed with upload
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

export async function normalizeMetadata(artwork) {

	const normalizedMetadata = {
		name: artwork.metadata.name || '',
		tokenID: artwork.metadata.tokenID || artwork.metadata.tokenId || artwork.identifier || '',
		description: artwork.metadata.description || '',
		artist: artwork.metadata.artist || '',
		platform: artwork.metadata.platform || '',
		image: artwork.metadata.displayUri || artwork.metadata.image || '',
		video: artwork.metadata.video || artwork.metadata.animation_url || '',
		live_uri: '',
		tags: artwork.metadata.tags || [],
		website: artwork.metadata.website || '',
		attributes: artwork.metadata.attributes || normalizeAttributes(artwork.metadata.features) || []
	};

	const live_uri = artwork.metadata.generator_url || artwork.metadata.animation_url;
	if (live_uri) {
		// Only call convertIpfsUriToHttpUrl if live_uri is not undefined
		normalizedMetadata.live_uri = convertIpfsUriToHttpUrl(live_uri);
	}

	console.log(normalizedMetadata); // Debugging

	return normalizedMetadata;
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

// Function to convert IPFS URI to HTTP URL using a public gateway
function convertIpfsUriToHttpUrl(ipfsUri) {
	const ipfsPrefix = 'ipfs://';
	if (!ipfsUri.startsWith(ipfsPrefix)) {
		return ipfsUri; // Return the original URI if it's not an IPFS URI
	}
	const ipfsHash = ipfsUri.slice(ipfsPrefix.length);
	const httpUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`; // Using Cloudflare's IPFS gateway
	return httpUrl;
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
		//console.log(`MIME Type: ${mimeType}`); // Debugging

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
				console.log(`Image Dimensions: ${JSON.stringify(dimensions)}`); // Debugging
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
		console.error(`Error fetching media from ${uri}:`, error);
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

	const uploadResult = await uploadToImageKit(mediaData.buffer, artwork, mediaData.mimeType);

	// Return upload result or null if unsuccessful
	return uploadResult ? {
		url: uploadResult.url,
		fileType: mediaData.mimeType,
		dimensions: mediaData.dimensions
	} : null;
}

export async function resizeImage(buffer, targetWidth = 2000, targetHeight = 2000) {
	try {
		// Determine the file type of the buffer
		const fileTypeResult = await fileTypeFromBuffer(buffer);
		const isGif = fileTypeResult?.mime === 'image/gif';

		// Initialize variables for the resizing loop
		let sizeMB = Buffer.byteLength(buffer) / (1024 * 1024);
		let resizedBuffer = buffer;
		let attempt = 0;

		while (sizeMB > 25 && attempt < 10) {
			// Limit attempts to prevent infinite loops
			// Dynamically adjust dimensions to decrease size with each attempt
			let scaleFactor = attempt === 0 ? 1 : 0.9 ** attempt; // Reduce dimensions progressively
			let newWidth = Math.floor(targetWidth * scaleFactor);
			let newHeight = Math.floor(targetHeight * scaleFactor);

			// Resize image with adjusted dimensions
			if (isGif) {
				// For GIFs, including animated ones, ensuring we maintain the animation
				resizedBuffer = await sharp(resizedBuffer, { animated: isGif })
					.resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
					.gif()
					.toBuffer();
			} else {
				// For non-GIF images, just resize
				resizedBuffer = await sharp(resizedBuffer)
					.resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
					.toBuffer();
			}

			// Update the sizeMB for the next iteration check
			sizeMB = Buffer.byteLength(resizedBuffer) / (1024 * 1024);
			attempt++;
		}

		// After resizing attempts, check if the file size is below the desired threshold
		if (sizeMB > 25) {
			console.warn('Unable to reduce file size below 25MB after several attempts.');
			// At this point, further action could be needed, depending on requirements.
		}

		return resizedBuffer;
	} catch (error) {
		console.error('Error resizing image:', error);
		throw error;
	}
}
