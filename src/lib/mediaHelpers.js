import axios from 'axios';
import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from '@ffprobe-installer/ffprobe';
import { fileTypeFromBuffer } from 'file-type';
import { v2 as cloudinary } from 'cloudinary';

// Import CLOUDINARY_URL instead of individual keys
import { CLOUDINARY_URL } from '$env/dynamic/private';

// Log check for the URL variable
console.log('Cloudinary Env Vars Check:');
console.log('[$env] CLOUDINARY_URL:', CLOUDINARY_URL ? 'Loaded' : 'MISSING');

// Remove or comment out the previous check for individual keys
/*
console.log('[$env] Cloud Name:', CLOUDINARY_CLOUD_NAME ? 'Loaded' : 'MISSING');
console.log('[$env] API Key:', CLOUDINARY_API_KEY ? 'Loaded' : 'MISSING');
console.log('[$env] API Secret:', CLOUDINARY_API_SECRET ? 'Loaded' : 'MISSING');
*/

// Comment out or remove the top-level config (already commented out)
/*
const cloudName = CLOUDINARY_CLOUD_NAME;
const apiKey = CLOUDINARY_API_KEY;
const apiSecret = CLOUDINARY_API_SECRET;

if (!apiKey) {
	console.error('CRITICAL: Cloudinary API Key is missing from both $env and process.env!');
}

cloudinary.config({
	cloud_name: cloudName,
	api_key: apiKey,
	api_secret: apiSecret,
	secure: true // Use HTTPS
});
*/

// Set the paths to the static binaries
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

// Define a list of public IPFS gateways to try
const IPFS_GATEWAYS = [
	'https://ipfs.io', // Official IPFS Foundation gateway
	'https://dweb.link', // Official IPFS Foundation gateway (subdomain)
	'https://gateway.ipfs.io', // Official IPFS Foundation gateway (alt subdomain)
	'https://w3s.link', // Web3.Storage gateway
	'https://gateway.pinata.cloud', // Popular pinning service gateway
	'https://nftstorage.link', // NFT.Storage gateway
	'https://ipfs.fleek.co' // Fleek gateway
];

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
	let baseName = artwork.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

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

function removeQueryString(url) {
	try {
		const parsedUrl = new URL(url);
		parsedUrl.search = ''; // Remove the query string
		return parsedUrl.toString();
	} catch (error) {
		console.error('Invalid URL:', url);
		return url; // Return the original URL if parsing fails
	}
}

export async function uploadToCloudinary(fileBuffer, fileName, mimeType) {
	try {
		// Configure Cloudinary HERE, relying on CLOUDINARY_URL environment variable
		cloudinary.config(); // No arguments - SDK checks environment for CLOUDINARY_URL

		// Check if config worked by checking if cloud_name is now set
		const currentConfig = cloudinary.config();
		if (!currentConfig || !currentConfig.cloud_name) {
			// Check cloud_name as indicator
			console.error(
				'[uploadToCloudinary] Failed to configure Cloudinary using CLOUDINARY_URL! Cloud Name MISSING.'
			);
			// Log the URL variable itself (be careful if logs are public)
			console.error(
				`[uploadToCloudinary] CLOUDINARY_URL value check: ${CLOUDINARY_URL ? 'Exists' : 'MISSING or empty'}`
			);
			throw new Error('Cloudinary configuration failed internally (URL method).');
		}

		// Config seems okay, log the detected cloud name
		console.log(`[uploadToCloudinary] Configured via URL. Cloud Name: ${currentConfig.cloud_name}`);

		// Determine resource type based on mime type
		let resource_type = 'auto';
		if (mimeType.startsWith('image/')) {
			resource_type = 'image';
		} else if (mimeType.startsWith('video/')) {
			resource_type = 'video';
		}

		// Generate a unique public_id (optional, but recommended to avoid overwrites)
		// Using the original filename + a hash might work, or just let Cloudinary generate one
		const baseName = path.parse(fileName).name;
		const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 8);
		const public_id = `${baseName}_${hash}`;

		const uploadOptions = {
			public_id: public_id,
			folder: 'compendium', // Optional: specify a folder in Cloudinary
			resource_type: resource_type,
			overwrite: true // Or false if you want unique public_ids enforced
			// Add tags, context, etc. if needed
			// tags: generateTags(fileName) // If you adapt generateTags
		};

		// Upload using buffer
		const result = await new Promise((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
				if (error) {
					console.error('Cloudinary Upload Stream Error:', error);
					reject(error);
				} else {
					resolve(result);
				}
			});
			uploadStream.end(fileBuffer);
		});

		if (result && result.secure_url) {
			return {
				url: result.secure_url,
				fileType: mimeType, // Keep original mime type
				dimensions: { height: result.height, width: result.width },
				publicId: result.public_id // Return public_id if needed later
			};
		} else {
			throw new Error('Cloudinary upload failed or did not return a secure URL.');
		}
	} catch (error) {
		console.error(`Error uploading to Cloudinary: ${error.message || error}`);
		if (error.error) {
			console.error('Cloudinary Error Details:', JSON.stringify(error.error, null, 2));
		}
		return null; // Indicate failure
	}
}

export async function normalizeOpenSeaMetadata(nft) {
	const metadata = nft.metadata || {};

	return {
		name: metadata.name || nft.name,
		tokenID: metadata.tokenID || metadata.tokenId || nft.tokenID || nft.tokenId || nft.identifier,
		description: metadata.description || nft.description,
		artist: nft.creator || 'Unknown Artist',
		blockchain: 'Ethereum',
		image_url: metadata.image || nft.image_url || nft.display_image_url,
		animation_url: metadata.animation_url || nft.animation_url || nft.display_animation_url,
		tags: nft.tags || [],
		website: nft.website || metadata.external_url || '',
		attributes: metadata.attributes || nft.traits || []
	};
}

export async function normalizeTezosMetadata(nft) {
	const metadata = nft.metadata || {};
	const creator = nft.creators && nft.creators.length > 0 ? nft.creators[0] : {};

	return {
		name: metadata.name || nft.name || 'Unknown Name',
		tokenID:
			nft.tokenId || nft.tokenID || metadata.tokenId || metadata.tokenID || 'Unknown Token ID',
		description: metadata.description || nft.description || 'No Description Available',
		artist: {
			address: creator.creator_address || '',
			username: creator.holder?.alias || '',
			bio: creator.holder?.description || '',
			avatarUrl: creator.holder?.logo || '',
			website: creator.holder?.website || '',
			social_media_accounts: {
				twitter: creator.holder?.twitter || '',
				instagram: creator.holder?.instagram || ''
			}
		},
		platform: 'Tezos',
		mime: nft.mime || '',
		image_url: nft.image_url,
		animation_url: nft.animation_url,
		tags: metadata.tags || [],
		website: metadata.website || '',
		attributes: nft.attributes || metadata.attributes || [],
		symbol: nft.symbol || metadata.symbol || '',
		supply: nft.supply || 1,
		collection: {
			name: nft.fa?.name || '',
			address: nft.fa?.contract || '',
			blockchain: 'Tezos'
		}
	};
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

export function fixIpfsUrl(url) {
	if (url) {
		url = convertIpfsUriToHttpUrl(url);
	}
	return url;
}

function convertIpfsUriToHttpUrl(ipfsUri) {
	if (!ipfsUri || typeof ipfsUri !== 'string') {
		console.warn(`convertIpfsUriToHttpUrl: Input is invalid or not a string: ${ipfsUri}`);
		return { type: 'error', value: '' }; // Indicate error
	}

	const ipfsPrefix = 'ipfs://';
	const ipfsPathPrefix = '/ipfs/';

	if (ipfsUri.startsWith(ipfsPrefix)) {
		const cidPath = ipfsUri.slice(ipfsPrefix.length);
		// Return the CID/path part, fetchMedia will prepend gateways
		return { type: 'ipfs', value: `/${ipfsPathPrefix}${cidPath}` };
	} else if (ipfsUri.startsWith(ipfsPathPrefix)) {
		// Return the path directly, fetchMedia will prepend gateways
		return { type: 'ipfs', value: ipfsUri };
	} else if (ipfsUri.startsWith('http://') || ipfsUri.startsWith('https://')) {
		// If it's already an HTTP/HTTPS URL, return it directly
		return { type: 'http', value: ipfsUri };
	}

	// If it doesn't match IPFS patterns or HTTP, return original but mark as unknown
	console.warn(`convertIpfsUriToHttpUrl: Input does not appear to be IPFS or HTTP URI: ${ipfsUri}`);
	return { type: 'unknown', value: ipfsUri };
}

export async function fetchMedia(uri) {
	let response = null;
	let buffer = null;
	let httpUrlUsed = ''; // Keep track of the URL that succeeded or last failed

	try {
		const sanitizedUri = removeQueryString(uri);
		if (!sanitizedUri) {
			console.error('[fetchMedia] Sanitized URI is empty.');
			return null;
		}

		const processedUri = convertIpfsUriToHttpUrl(sanitizedUri);

		if (processedUri.type === 'error' || !processedUri.value) {
			console.error(`[fetchMedia] Could not process URI: ${uri}`);
			return null;
		}

		const axiosOptions = {
			responseType: 'arraybuffer',
			timeout: 15000, // 15 second timeout
			headers: {
				// Add a basic user-agent, might help with some blocks
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
			}
		};

		if (processedUri.type === 'http') {
			// It's a direct HTTP/HTTPS URL
			httpUrlUsed = processedUri.value;
			console.log(`[fetchMedia] Fetching directly from HTTP URL: ${httpUrlUsed}`);
			try {
				response = await axios.get(httpUrlUsed, axiosOptions);
			} catch (error) {
				console.error(
					`[fetchMedia] Error fetching direct URL ${httpUrlUsed}:`,
					error.message || error
				);
				// Potentially add retry logic here if needed
				throw error; // Re-throw to be caught by the outer catch block
			}
		} else if (processedUri.type === 'ipfs') {
			// It's an IPFS path, try gateways
			const ipfsPath = processedUri.value;
			console.log(`[fetchMedia] Attempting to fetch IPFS resource: ${ipfsPath}`);

			for (const gateway of IPFS_GATEWAYS) {
				httpUrlUsed = `${gateway}${ipfsPath}`; // Construct full URL
				console.log(`[fetchMedia] Trying IPFS gateway: ${httpUrlUsed}`);
				try {
					response = await axios.get(httpUrlUsed, axiosOptions);
					// If successful (status 2xx), break the loop
					if (response.status >= 200 && response.status < 300) {
						console.log(`[fetchMedia] Successfully fetched from ${httpUrlUsed}`);
						break; // Exit loop on success
					} else {
						console.warn(`[fetchMedia] Gateway ${httpUrlUsed} returned status ${response.status}`);
						response = null; // Reset response to try next gateway
					}
				} catch (error) {
					const errorMessage = error.response
						? `status ${error.response.status}`
						: error.message || 'Unknown error';
					console.warn(`[fetchMedia] Failed to fetch from ${httpUrlUsed}: ${errorMessage}`);
					response = null; // Reset response if fetch failed
				}
			}

			if (!response) {
				// Check if a successful response was ever received
				throw new Error(`Failed to fetch from all IPFS gateways for resource: ${ipfsPath}`);
			}
		} else {
			// Handle 'unknown' type or add more types if needed
			console.error(`[fetchMedia] Unhandled URI type '${processedUri.type}' for URI: ${uri}`);
			return null;
		}

		// --- Process the successful response ---
		buffer = Buffer.from(response.data);

		const fileTypeResult = await fileTypeFromBuffer(buffer);
		if (!fileTypeResult) {
			console.error(`[fetchMedia] Could not determine file type for ${httpUrlUsed}`);
			return null;
		}

		const mimeType = fileTypeResult.mime;

		if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
			console.error(`[fetchMedia] Unsupported media type: ${mimeType} from ${httpUrlUsed}`);
			return null;
		}

		// Try creating filename from URL path, fallback if needed
		let fileName;
		try {
			// Extract filename from the successfully used URL
			fileName = path.basename(new URL(httpUrlUsed).pathname);
			// Basic sanitization and ensure extension matches detected type
			const baseName = fileName.includes('.')
				? fileName.substring(0, fileName.lastIndexOf('.'))
				: fileName;
			const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_.-]/g, '_'); // Allow dots and hyphens
			fileName = `${sanitizedBaseName}.${fileTypeResult.ext}`;
		} catch (e) {
			// Fallback filename if URL parsing/basename extraction fails
			console.warn(
				`[fetchMedia] Could not parse filename from URL ${httpUrlUsed}, generating fallback.`
			);
			const hash = crypto.createHash('sha256').update(buffer).digest('hex');
			fileName = `${hash}.${fileTypeResult.ext}`;
		}

		let dimensions = null;

		if (mimeType.startsWith('image/')) {
			try {
				const metadata = await sharp(buffer).metadata();
				dimensions = { width: metadata.width, height: metadata.height };
			} catch (sharpError) {
				console.error(
					`[fetchMedia] Error processing image with sharp from ${httpUrlUsed}:`,
					sharpError
				);
				// Continue without dimensions, or return null if critical
			}
		} else if (mimeType.startsWith('video/')) {
			// SKIP GETTING VIDEO DIMENSIONS TO AVOID TEMP FILE
			/*
			try {
				dimensions = await getVideoDimensions(buffer);
			} catch (videoError) {
				console.error(
					`[fetchMedia] Error getting video dimensions from ${httpUrlUsed}:`,
					videoError
				);
				// Continue without dimensions, or return null if critical
			}
			*/
		}

		return {
			buffer,
			mimeType,
			fileName,
			dimensions
		};
	} catch (error) {
		// Log the detailed error from Axios or other steps
		const errorMessage = error.response?.data
			? Buffer.from(error.response.data).toString()
			: error.message || String(error);
		console.error(`[fetchMedia] Error fetching media for URI "${uri}": ${errorMessage}`);
		if (httpUrlUsed) {
			console.error(`[fetchMedia] Last attempted/failed URL: ${httpUrlUsed}`);
		}
		if (error.response) {
			console.error(`[fetchMedia] Failed with status: ${error.response.status}`);
		}
		return null;
	}
}

async function getVideoDimensions(buffer) {
	const tmpFile = path.join('/tmp', `tmp_video_${Date.now()}.mp4`);
	await fs.writeFile(tmpFile, buffer);

	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(tmpFile, (err, metadata) => {
			fs.unlink(tmpFile); // Clean up the temp file
			if (err) {
				reject(`Error processing video with ffmpeg: ${err.message}`);
			} else {
				const stream = metadata.streams.find((s) => s.width && s.height);
				if (stream) {
					resolve({ width: stream.width, height: stream.height });
				} else {
					resolve(null);
				}
			}
		});
	});
}

export async function handleMediaUpload(mediaUri, artwork) {
	const mediaData = await fetchMedia(mediaUri);
	if (!mediaData) {
		console.error(`Unsupported or unprocessable media at URI: ${mediaUri}`);
		return null;
	}

	let dimensions = mediaData.dimensions;
	if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
		console.warn(
			'Dimensions are missing or invalid, resizing might not correctly adjust dimensions.'
		);
		dimensions = { width: undefined, height: undefined };
	}

	try {
		let finalBuffer = mediaData.buffer;
		let finalDimensions = dimensions;

		// Only resize if it's an image
		if (mediaData.mimeType.startsWith('image/')) {
			const resizeResult = await resizeMedia(mediaData.buffer, mediaData.mimeType, dimensions);
			finalBuffer = resizeResult.buffer;
			finalDimensions = resizeResult.dimensions || dimensions;
		} else {
			// If it's a video, skip resizing and use original buffer/dimensions (which will be null if fetchMedia was modified)
			console.log(`[handleMediaUpload] Skipping resize for video: ${mediaUri}`);
		}

		console.log('finalBuffer (pre-upload)', finalBuffer);
		console.log('artwork name', artwork.name);
		console.log('mimeType', mediaData.mimeType);

		const uploadResult = await uploadToCloudinary(
			finalBuffer,
			mediaData.fileName,
			mediaData.mimeType
		);

		return uploadResult
			? {
					url: uploadResult.url,
					fileType: mediaData.mimeType,
					dimensions: finalDimensions
				}
			: null;
	} catch (error) {
		console.error(`Failed to handle media upload for URI: ${mediaUri}`, error);
		return null;
	}
}

export async function resizeMedia(buffer, mimeType, dimensions, maxSizeMB = 25) {
	try {
		let sizeMB = Buffer.byteLength(buffer) / (1024 * 1024);
		let attempt = 0;
		let resizedBuffer = buffer;

		if (mimeType.startsWith('image/')) {
			while (sizeMB > maxSizeMB && attempt < 10) {
				let scaleFactor = attempt === 0 ? 1 : Math.pow(0.9, attempt);
				let newWidth = Math.floor(dimensions.width * scaleFactor);
				let newHeight = Math.floor(dimensions.height * scaleFactor);

				let image = sharp(resizedBuffer).resize(newWidth, newHeight, {
					fit: 'inside',
					withoutEnlargement: true
				});

				resizedBuffer = await image.toBuffer();
				sizeMB = Buffer.byteLength(resizedBuffer) / (1024 * 1024);
				attempt++;
			}
		} else if (mimeType.startsWith('video/')) {
			while (sizeMB > maxSizeMB && attempt < 10) {
				let scaleFactor = attempt === 0 ? 1 : Math.pow(0.9, attempt);
				let newWidth = Math.floor(dimensions.width * scaleFactor);
				let newHeight = Math.floor(dimensions.height * scaleFactor);

				resizedBuffer = await new Promise((resolve, reject) => {
					const tmpFile = path.join('/tmp', `tmp_video_${Date.now()}.mp4`);
					const outputTmpFile = path.join('/tmp', `tmp_video_resized_${Date.now()}.mp4`);

					fs.writeFile(tmpFile, resizedBuffer);

					ffmpeg(tmpFile)
						.size(`${newWidth}x${newHeight}`)
						.outputOptions('-preset', 'fast')
						.outputOptions('-crf', '28') // Adjust the quality here as needed
						.on('end', () => {
							const resized = fs.readFile(outputTmpFile);
							fs.unlink(tmpFile);
							fs.unlink(outputTmpFile);
							resolve(resized);
						})
						.on('error', (err) => {
							reject(`Error resizing video with ffmpeg: ${err.message}`);
						})
						.save(outputTmpFile);
				});
				sizeMB = Buffer.byteLength(resizedBuffer) / (1024 * 1024);
				attempt++;
			}
		}

		if (sizeMB > maxSizeMB) {
			console.warn('Unable to reduce file size below 25MB after several attempts.');
		}

		return {
			buffer: resizedBuffer,
			dimensions: { width: dimensions.width, height: dimensions.height }
		};
	} catch (error) {
		console.error('Error resizing media:', error);
		throw error;
	}
}
