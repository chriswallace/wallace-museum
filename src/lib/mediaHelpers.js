// src/lib/mediaHelpers.js
import axios from 'axios';
import sharp from 'sharp';
import path from 'path';
import { env } from '$env/dynamic/private';
import imageKit from 'imagekit';
import { fileTypeFromBuffer } from 'file-type';

const imagekit = new imageKit({
	publicKey: env.IMAGEKIT_PUBLIC_KEY,
	privateKey: env.IMAGEKIT_PRIVATE_KEY,
	urlEndpoint: env.IMAGEKIT_URL_ENDPOINT
});

export async function uploadToImageKit(fileStream, fileName) {
	try {
		const response = await imagekit.upload({
			file: fileStream,
			folder: 'compendium',
			fileName: fileName
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
	//console.log(artwork.metadata.attributes);

	const standardMetadata = {
		name: artwork.metadata.name || '',
		tokenID: artwork.metadata.tokenID || artwork.metadata.tokenId || artwork.identifier || '',
		description: artwork.metadata.description || '',
		artist: artwork.metadata.artist || '',
		platform: artwork.metadata.platform || '',
		image: artwork.metadata.displayUri || artwork.metadata.image || '',
		video: artwork.metadata.video || artwork.metadata.animation_url || '',
		live_uri: artwork.metadata.generator_url || artwork.metadata.animation_url || '',
		tags: artwork.metadata.tags || [],
		website: artwork.metadata.website || '',
		attributes: artwork.metadata.attributes || normalizeAttributes(artwork.metadata.features) || []
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

		// Correct usage of fileTypeFromBuffer
		const fileTypeResult = await fileTypeFromBuffer(buffer);

		if (!fileTypeResult) {
			console.error('Could not determine file type.');
			return null;
		}

		const mimeType = fileTypeResult.mime;

		// Only process supported image and video files
		if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
			console.error(`Unsupported media type: ${mimeType}`);
			return null;
		}

		// Extract the file name
		const fileName = path.basename(new URL(httpUrl).pathname) + '.' + fileTypeResult.ext;

		// Determine dimensions for images
		let dimensions = null;
		if (mimeType.startsWith('image/')) {
			const metadata = await sharp(buffer).metadata();
			dimensions = { width: metadata.width, height: metadata.height };
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
export async function handleMediaUpload(mediaUri) {
	const mediaData = await fetchMedia(mediaUri);
	if (!mediaData) return null;

	// Only proceed if the media is an image or a video
	if (!mediaData.mimeType.startsWith('image/') && !mediaData.mimeType.startsWith('video/')) {
		console.error(`Unsupported media type: ${mediaData.mimeType}`);
		return null;
	}

	let fileStreamToUpload = mediaData.buffer;

	// Resize image if necessary, though this example doesn't directly include resizing logic
	// Consider adding conditional resizing here based on your requirements

	const uploadResult = await uploadToImageKit(fileStreamToUpload, mediaData.fileName);

	return {
		url: uploadResult?.url,
		fileType: mediaData.mimeType,
		dimensions: mediaData.dimensions
	};
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
