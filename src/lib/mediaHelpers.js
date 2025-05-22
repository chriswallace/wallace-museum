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
import { ipfsToHttpUrl } from './mediaUtils';
import { sanitizeCloudinaryPublicId } from './cloudinaryUtils';

// Import env object instead of a specific variable
import { env } from '$env/dynamic/private';

// Set the paths to the static binaries
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

// Define a list of public IPFS gateways to try
const IPFS_GATEWAYS = [
	'https://ipfs.io/ipfs/', // Official IPFS Foundation gateway
	'https://gateway.ipfs.io/ipfs/', // Official IPFS Foundation gateway (alt subdomain)
	'https://w3s.link/ipfs/' // Web3.Storage gateway
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
			console.error(
				'[uploadToCloudinary] Failed to configure Cloudinary using CLOUDINARY_URL! Cloud Name MISSING.'
			);
			console.error(
				`[uploadToCloudinary] CLOUDINARY_URL value check: ${env.CLOUDINARY_URL ? 'Exists' : 'MISSING or empty'}`
			);
			throw new Error('Cloudinary configuration failed internally (URL method).');
		}

		// Determine resource type based on mime type
		let resource_type = 'auto';
		if (mimeType.startsWith('image/')) {
			resource_type = 'image';
		} else if (mimeType.startsWith('video/')) {
			resource_type = 'video';
		}

		// Generate a unique public_id using sanitized filename + hash
		const baseName = path.parse(fileName).name;
		const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 8);
		const sanitizedBaseName = sanitizeCloudinaryPublicId(baseName);
		const public_id = `compendium/${sanitizedBaseName}_${hash}`;

		const uploadOptions = {
			public_id: public_id,
			resource_type: resource_type,
			overwrite: true
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
				fileType: mimeType,
				dimensions: { height: result.height, width: result.width },
				publicId: result.public_id
			};
		} else {
			throw new Error('Cloudinary upload failed or did not return a secure URL.');
		}
	} catch (error) {
		console.error(`Error uploading to Cloudinary: ${error.message || error}`);
		if (error.error) {
			console.error('Cloudinary Error Details:', JSON.stringify(error.error, null, 2));
		}
		return null;
	}
}

/**
 * Normalizes attributes/traits into a consistent format
 * @param {Object} data - The NFT data containing attributes/traits
 * @param {Object} options - Additional options for normalization
 * @returns {Array} Normalized attributes array
 */
function normalizeAttributes(data, options = {}) {
	const { metadata = {}, platformMetadata = {}, includeNullValues = false } = options;

	let attributes = [];

	// Process standard attributes array
	const standardAttrs = data.attributes || metadata.attributes || [];
	if (Array.isArray(standardAttrs)) {
		attributes = attributes.concat(
			standardAttrs
				.map((attr) => {
					if (typeof attr === 'object' && attr !== null) {
						return {
							trait_type: String(attr.trait_type || attr.name || '').trim(),
							value: String(attr.value || '').trim()
						};
					}
					return null;
				})
				.filter(Boolean)
		);
	}

	// Process traits array
	const traits = data.traits || metadata.traits || [];
	if (Array.isArray(traits)) {
		attributes = attributes.concat(
			traits
				.map((trait) => {
					if (typeof trait === 'object' && trait !== null) {
						return {
							trait_type: String(trait.trait_type || trait.name || '').trim(),
							value: String(trait.value || '').trim()
						};
					}
					return null;
				})
				.filter(Boolean)
		);
	}

	// Process properties object
	const properties = data.properties || metadata.properties || {};
	if (typeof properties === 'object' && properties !== null && !Array.isArray(properties)) {
		const propertyTraits = Object.entries(properties)
			.filter(([_, value]) => includeNullValues || value !== null)
			.map(([key, value]) => ({
				trait_type: String(key).trim(),
				value: String(value || '').trim()
			}));
		attributes = attributes.concat(propertyTraits);
	}

	// Process features object (common in Art Blocks)
	const features = data.features || metadata.features || {};
	if (typeof features === 'object' && features !== null && !Array.isArray(features)) {
		const featureTraits = Object.entries(features)
			.filter(([_, value]) => includeNullValues || value !== null)
			.map(([key, value]) => ({
				trait_type: String(key).trim(),
				value: String(value || '').trim()
			}));
		attributes = attributes.concat(featureTraits);
	}

	// Add platform-specific metadata
	if (platformMetadata && typeof platformMetadata === 'object') {
		const metadataTraits = Object.entries(platformMetadata)
			.filter(([_, value]) => value !== '' && (includeNullValues || value !== null))
			.map(([key, value]) => ({
				trait_type: String(key).trim(),
				value: String(value || '').trim()
			}));
		attributes = attributes.concat(metadataTraits);
	}

	// Remove duplicates while preserving order
	const seenTraits = new Set();
	attributes = attributes.filter((attr) => {
		if (!attr || !attr.trait_type) return false;
		const key = `${attr.trait_type.toLowerCase()}:${attr.value.toLowerCase()}`;
		if (seenTraits.has(key)) return false;
		seenTraits.add(key);
		return true;
	});

	return attributes;
}

export async function normalizeOpenSeaMetadata(nft) {
	const metadata = nft.metadata || {};

	// Try to get a collection identifier/slug for contract
	let contract = '';
	if (nft.collection && (nft.collection.contract || nft.collection.slug)) {
		contract = nft.collection.contract || nft.collection.slug;
	} else if (nft.contract || nft.slug) {
		contract = nft.contract || nft.slug;
	} else if (nft.collection) {
		contract = nft.collection.id || nft.collection.name || '';
	}

	// Prioritize image fields
	const image_url =
		metadata.image ||
		metadata.image_url ||
		nft.image ||
		nft.image_url ||
		nft.image_original_url ||
		nft.image_preview_url ||
		nft.display_image_url ||
		nft.image_thumbnail_url;

	// Prioritize animation fields
	const animation_url = metadata.animation_url || nft.animation_url || nft.display_animation_url;

	// Platform-specific metadata for attributes
	const platformMetadata = {
		Platform: metadata.platform === 'Art Blocks Presents' ? 'Art Blocks Presents' : 'Ethereum',
		'Script Type': metadata.script_type || nft.script_type || '',
		License: metadata.license || nft.license || '',
		'Is Static': String(metadata.is_static || nft.is_static || false)
	};

	// Normalize attributes
	const attributes = normalizeAttributes(nft, {
		metadata,
		platformMetadata,
		includeNullValues: false
	});

	// Extract dimensions from metadata if available
	let dimensions = null;
	if (
		metadata.image_details &&
		typeof metadata.image_details.width === 'number' &&
		typeof metadata.image_details.height === 'number'
	) {
		dimensions = {
			width: metadata.image_details.width,
			height: metadata.image_details.height
		};
		console.log(
			`[OPENSEA_METADATA] Found dimensions in metadata: ${dimensions.width}x${dimensions.height}`
		);
	}

	return {
		name: metadata.name || nft.name,
		tokenID: metadata.tokenID || metadata.tokenId || nft.tokenID || nft.tokenId || nft.identifier,
		description: metadata.description || nft.description,
		artist: metadata.artist || nft.artist || 'Unknown Artist',
		blockchain: 'Ethereum',
		image_url,
		animation_url,
		tags: metadata.tags || nft.tags || [],
		website: metadata.website || metadata.external_url || nft.website || nft.external_url || '',
		attributes: JSON.stringify(attributes),
		collection: {
			name: (nft.collection && nft.collection.name) || '',
			contract: contract,
			blockchain: 'Ethereum',
			platform: metadata.platform || nft.platform || 'Ethereum'
		},
		dimensions: dimensions,
		raw_data: JSON.stringify({
			attributes: metadata.attributes || nft.attributes,
			traits: metadata.traits || nft.traits,
			features: metadata.features || nft.features
		})
	};
}

export async function normalizeTezosMetadata(nft) {
	const metadata = nft.metadata || {};
	const creator = nft.creators && nft.creators.length > 0 ? nft.creators[0] : {};

	// Normalize media URLs
	const image_url =
		metadata.image ||
		metadata.displayUri ||
		metadata.artifactUri ||
		nft.image_url ||
		nft.displayUri ||
		nft.artifactUri;

	// For Tezos, animation_url could be in various fields
	const animation_url =
		metadata.animation_url ||
		metadata.animationUri ||
		metadata.interactive_uri ||
		nft.animation_url ||
		nft.animationUri ||
		nft.interactive_uri;

	// Platform-specific metadata for attributes
	const platformMetadata = {
		Platform: 'Tezos',
		Marketplace: metadata.marketplace || nft.marketplace || '',
		Editions: String(metadata.editions || nft.editions || '1'),
		'MIME Type': metadata.mimeType || metadata.mime || nft.mime || ''
	};

	// Normalize attributes
	const attributes = normalizeAttributes(nft, {
		metadata,
		platformMetadata,
		includeNullValues: false
	});

	// Format social media accounts
	const social_media_accounts = {
		twitter: creator.holder?.twitter || '',
		instagram: creator.holder?.instagram || ''
	};

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
			social_media_accounts: JSON.stringify(social_media_accounts)
		},
		platform: 'Tezos',
		mime: metadata.mimeType || metadata.mime || nft.mime || '',
		image_url,
		animation_url,
		tags: metadata.tags || nft.tags || [],
		website: metadata.website || metadata.homepage || nft.website || '',
		attributes: JSON.stringify(attributes),
		symbol: metadata.symbol || nft.symbol || '',
		supply: metadata.editions || nft.editions || metadata.supply || nft.supply || 1,
		collection: {
			name: nft.fa?.name || metadata.collection_name || nft.collection_name || '',
			address: nft.fa?.contract || metadata.collection_address || nft.collection_address || '',
			blockchain: 'Tezos'
		},
		raw_data: JSON.stringify({
			attributes: metadata.attributes || nft.attributes,
			properties: metadata.properties || nft.properties,
			traits: metadata.traits || nft.traits
		})
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

export async function fetchMedia(uri) {
	let response = null;
	let buffer = null;
	let httpUrlUsed = '';

	try {
		const sanitizedUri = removeQueryString(uri);
		if (!sanitizedUri) {
			return null;
		}

		const normalizedUrl = ipfsToHttpUrl(sanitizedUri);
		//console.log('[IPFS_IMPORT_DEBUG] fetchMedia original:', uri, 'normalized:', normalizedUrl);

		const axiosOptions = {
			responseType: 'arraybuffer',
			timeout: 15000, // 15 second timeout
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
			}
		};

		if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
			httpUrlUsed = normalizedUrl;
			try {
				response = await axios.get(httpUrlUsed, axiosOptions);
			} catch (error) {
				throw error;
			}
		} else {
			// Try all gateways if not already HTTP(S)
			for (const gateway of IPFS_GATEWAYS) {
				httpUrlUsed = ipfsToHttpUrl(sanitizedUri, gateway);
				try {
					response = await axios.get(httpUrlUsed, axiosOptions);
					if (response.status >= 200 && response.status < 300) {
						break;
					} else {
						response = null;
					}
				} catch (error) {
					response = null;
				}
			}
			if (!response) {
				throw new Error(`Failed to fetch from all IPFS gateways for resource: ${sanitizedUri}`);
			}
		}

		const fileTypeResult = await fileTypeFromBuffer(Buffer.from(response.data));
		return {
			buffer: Buffer.from(response.data),
			mimeType: fileTypeResult ? fileTypeResult.mime : null,
			fileName: null,
			dimensions: null
		};
	} catch (error) {
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
	if (!mediaUri) {
		console.error('No media URI provided for upload');
		return null;
	}

	// Special handling for Art Blocks generator URLs
	if (mediaUri && mediaUri.includes('generator.artblocks.io')) {
		return {
			url: mediaUri,
			fileType: 'text/html',
			dimensions: artwork.dimensions || {
				width: artwork.aspect_ratio ? Math.round(1000 * artwork.aspect_ratio) : 1000,
				height: 1000
			}
		};
	}

	// Handle Art Blocks media proxy URLs and direct image URLs
	if (
		mediaUri &&
		(mediaUri.includes('media-proxy.artblocks.io') ||
			mediaUri.includes('artblocks.io') ||
			mediaUri.match(/\.(png|jpg|jpeg|gif|webp)$/i))
	) {
		try {
			// Always try to fetch and process the image
			const mediaData = await fetchMedia(mediaUri);
			if (!mediaData || !mediaData.buffer) {
				return null;
			}

			// Upload to Cloudinary
			const uploadResult = await uploadToCloudinary(
				mediaData.buffer,
				artwork.name || 'artblocks_image',
				mediaData.mimeType || 'image/png'
			);

			if (!uploadResult) {
				console.error('[MEDIA_UPLOAD] Cloudinary upload failed');
				return null;
			}

			return {
				url: uploadResult.url,
				fileType: mediaData.mimeType || 'image/png',
				dimensions: uploadResult.dimensions ||
					artwork.dimensions || {
						width: artwork.aspect_ratio ? Math.round(1000 * artwork.aspect_ratio) : 1000,
						height: 1000
					}
			};
		} catch (error) {
			console.error('[MEDIA_UPLOAD] Error processing Art Blocks media:', error);
			return null;
		}
	}

	// Special handling for Tezos IPFS URLs
	if (
		mediaUri &&
		(mediaUri.includes('ipfs://') ||
			mediaUri.includes('ipfs.io') ||
			mediaUri.includes('cloudflare-ipfs.com') ||
			mediaUri.includes('pinata.cloud'))
	) {
		// Convert IPFS URL to HTTP URL if needed
		const httpUrl = ipfsToHttpUrl(mediaUri);

		// For known HTML/interactive content
		if (
			(artwork.mime && artwork.mime === 'text/html') ||
			httpUrl.includes('fxhash.xyz') ||
			httpUrl.includes('objkt.com/o/')
		) {
			return {
				url: httpUrl,
				fileType: 'text/html',
				dimensions: artwork.dimensions || { width: 1000, height: 1000 }
			};
		}

		// For known image types
		const isImage =
			httpUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
			(artwork.mime && artwork.mime.startsWith('image/'));

		if (isImage) {
			return {
				url: httpUrl,
				fileType: artwork.mime || 'image/png',
				dimensions: artwork.dimensions || { width: 1000, height: 1000 }
			};
		}

		// For known video types
		const isVideo =
			httpUrl.match(/\.(mp4|webm|ogg)$/i) || (artwork.mime && artwork.mime.startsWith('video/'));

		if (isVideo) {
			return {
				url: httpUrl,
				fileType: artwork.mime || 'video/mp4',
				dimensions: artwork.dimensions || { width: 1000, height: 1000 }
			};
		}
	}

	// Regular media handling for other URLs
	const mediaData = await fetchMedia(mediaUri);
	if (!mediaData) {
		console.error(`[MEDIA_UPLOAD] Failed to fetch/process media from ${mediaUri}`);
		return null;
	}

	let dimensions = mediaData.dimensions;
	if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
		console.warn('[MEDIA_UPLOAD] Missing dimensions, using defaults');
		dimensions = null;
	}

	try {
		// Skip resizing and directly upload the media
		console.log('[MEDIA_UPLOAD] Uploading media directly without resizing');

		const uploadResult = await uploadToCloudinary(
			mediaData.buffer,
			artwork.name || 'artwork',
			mediaData.mimeType
		);

		if (!uploadResult) {
			console.error('[MEDIA_UPLOAD] Cloudinary upload failed');
			return null;
		}

		return {
			url: uploadResult.url,
			fileType: mediaData.mimeType,
			dimensions: uploadResult.dimensions || dimensions
		};
	} catch (error) {
		console.error('[MEDIA_UPLOAD] Error during media processing:', error);
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
