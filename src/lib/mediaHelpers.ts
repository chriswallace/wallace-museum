import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from '@ffprobe-installer/ffprobe';
import { fileTypeFromBuffer, type FileTypeResult } from 'file-type';
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// Import the moved utility functions
import {
	createHashForString,
	extensionFromMimeType,
	generateFileName,
	generateTags,
	removeQueryString,
	convertIpfsToHttpsUrl,
	isValidMimeType,
	getMediaType,
	sanitizeCloudinaryPublicId
} from './mediaUtils';

// Configure Cloudinary with environment variables
const configureCloudinary = () => {
	const config = {
		cloud_name: publicEnv.PUBLIC_CLOUDINARY_CLOUD_NAME,
		api_key: privateEnv.CLOUDINARY_API_KEY,
		api_secret: privateEnv.CLOUDINARY_API_SECRET,
		secure: true
	};

	// Validate required configuration
	if (!config.cloud_name || !config.api_key || !config.api_secret) {
		console.error('[CLOUDINARY_CONFIG] Missing required Cloudinary configuration:', {
			hasCloudName: !!config.cloud_name,
			hasApiKey: !!config.api_key,
			hasApiSecret: !!config.api_secret
		});
		throw new Error('Missing required Cloudinary configuration');
	}

	try {
		cloudinary.config(config);
		console.log(
			'[CLOUDINARY_CONFIG] Successfully configured Cloudinary with cloud name:',
			config.cloud_name
		);
	} catch (error) {
		console.error('[CLOUDINARY_CONFIG] Failed to configure Cloudinary:', error);
		throw error;
	}
};

// Configure Cloudinary immediately
configureCloudinary();

// Set the paths to the static binaries
if (typeof ffmpegPath === 'string') {
	ffmpeg.setFfmpegPath(ffmpegPath!);
} else {
	console.error('ffmpeg-static path is null or not a string.');
	// Handle error appropriately, maybe throw or disable features
}
if (typeof ffprobePath?.path === 'string') {
	ffmpeg.setFfprobePath(ffprobePath.path);
} else {
	console.error('@ffprobe-installer/ffprobe path is null or not a string.');
	// Handle error appropriately
}

// Add a list of IPFS gateways to try
const IPFS_GATEWAYS = [
	'https://gateway.pinata.cloud/ipfs/', // Added Pinata
	'https://nftstorage.link/ipfs/', // Added NFT.Storage
	'https://dweb.link/ipfs/', // Added Dweb
	'https://ipfs.io/ipfs/' // Kept ipfs.io
	// Add more gateways here if needed
];

// Define simple dimension type
interface Dimensions {
	width: number;
	height: number;
}

interface PartialDimensions {
	width?: number;
	height?: number;
}

function isDimensions(obj: any): obj is Dimensions {
	return (
		obj &&
		typeof obj === 'object' &&
		typeof obj.width === 'number' &&
		typeof obj.height === 'number'
	);
}

function ensureDimensions(dimensions: unknown): Dimensions | null {
	if (isDimensions(dimensions)) {
		return dimensions;
	}
	// return { ...DEFAULT_DIMENSIONS };
	return null;
}

function createDimensions(
	width: number | undefined,
	height: number | undefined
): Dimensions | null {
	// return {
	// 	width: typeof width === 'number' && width > 0 ? width : DEFAULT_DIMENSIONS.width,
	// 	height: typeof height === 'number' && height > 0 ? height : DEFAULT_DIMENSIONS.height
	// };
	if (typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0) {
		return { width, height };
	}
	return null;
}

// const createDefaultDimensions = (aspectRatio?: number): Dimensions => ({
// 	width: aspectRatio ? Math.round(1000 * aspectRatio) : DEFAULT_DIMENSIONS.width,
// 	heigh: DEFAULT_DIMENSIONS.height
// });

// Define return type for uploadToCloudinary
interface UploadResult {
	url: string;
	fileType: string;
	dimensions: Dimensions | null;
}

// Define basic structure for NFT and Metadata for normalization functions
// Use 'any' for now, but ideally define more specific interfaces based on actual data structure
interface NftCreator {
	holder?: {
		alias?: string;
		description?: string;
		logo?: string;
		website?: string;
		twitter?: string;
		instagram?: string;
	};
	creator_address?: string;
}

interface NftData {
	metadata?: any; // Keep any for flexibility or define a strict metadata type
	name?: string;
	description?: string;
	creator?: any; // Could be string or object depending on source
	creator_address?: string; // Add this field
	image_url?: string;
	display_image_url?: string;
	animation_url?: string;
	display_animation_url?: string;
	image_original_url?: string;
	image_preview_url?: string;
	image_thumbnail_url?: string;
	tags?: string[];
	website?: string;
	traits?: any[];
	tokenID?: string | number;
	tokenId?: string | number;
	identifier?: string | number;
	creators?: NftCreator[];
	mime?: string;
	fa?: {
		name?: string;
		contract?: string;
	}; // For Tezos collection info
	collection?: {
		name?: string;
		contract?: string;
		blockchain?: string;
		total_supply?: number;
		symbol?: string;
	};
	contract?: string; // OpenSea contract field
	symbol?: string;
	attributes?: any[];
	properties?: any;
	contractAddress?: string;
	contractAlias?: string;
	token_standard?: string;
	updated_at?: string | Date;
	aspect_ratio?: number;
	dimensions?: Dimensions | null; // Add dimensions property
	// Additional properties for Art Blocks and Tezos
	script_type?: string;
	license?: string;
	is_static?: boolean;
	platform?: string;
	features?: any;
	marketplace?: string;
	editions?: number | string;
	displayUri?: string;
	artifactUri?: string;
	animationUri?: string;
	interactive_uri?: string;
	collection_name?: string;
	collection_address?: string;
}

// Define return type for fetchMedia
interface FetchedMedia {
	buffer: Buffer;
	mimeType: string;
	fileName: string;
	httpUrlUsed: string;
	error?: undefined;
}

interface FetchedMediaError {
	httpUrlUsed?: string;
	error: 'unsupported_type' | 'fetch_error' | 'type_detection_error';
	message?: string;
}

// Define expected structure for convertIpfsToHttpsUrl return value
interface IpfsUrlResult {
	type: 'ipfs' | 'http' | 'unknown';
	value: string | null;
}

// Helper function to convert ReadableStream to Buffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		stream.on('error', (err) => reject(err));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
	});
}

const isArtBlocksUrl = (url: string): boolean => {
	const artBlocksDomains = [
		'generator.artblocks.io',
		'media-proxy.artblocks.io',
		'artblocks.io',
		'api.artblocks.io',
		'token.artblocks.io'
	];
	try {
		const urlObj = new URL(url);
		return artBlocksDomains.some((domain) => urlObj.hostname.endsWith(domain));
	} catch {
		return false;
	}
};

const getArtBlocksMediaType = (url: string): 'generator' | 'image' | 'unknown' => {
	if (url.includes('generator.artblocks.io')) {
		return 'generator';
	}
	if (url.includes('media-proxy.artblocks.io') || url.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
		return 'image';
	}
	return 'unknown';
};

const isFxHashUrl = (url: string): boolean => {
	const fxhashDomains = ['onchfs.fxhash2.xyz', 'fxhash.xyz'];
	try {
		const urlObj = new URL(url);
		return (
			fxhashDomains.some((domain) => urlObj.hostname.endsWith(domain)) ||
			url.startsWith('onchfs://')
		);
	} catch {
		return url.startsWith('onchfs://');
	}
};

function constructFxHashGeneratorUrl(metadata: any): string | null {
	// Check for fxhash display_animation_url
	if (metadata?.display_animation_url?.includes('onchfs.fxhash2.xyz')) {
		return metadata.display_animation_url;
	}
	return null;
}

function detectGenerativeArtPlatform(metadata: any, contractAddress?: string): string | null {
	// Check for fxhash
	if (metadata?.display_animation_url?.includes('onchfs.fxhash2.xyz')) {
		return 'fxhash';
	}

	// Check for Alba.art
	if (metadata?.collectionId && metadata?.seed) {
		return 'alba';
	}

	// Check for GM Studio
	if (metadata?.project && metadata?.seed) {
		return 'gmstudio';
	}

	// Check for known GM Studio contracts
	const GM_STUDIO_CONTRACTS = [
		'0x32d4be5ee74376e08038d652d4dc26e62c67f436' // Factura
		// Add other GM Studio contracts here
	];

	if (contractAddress && GM_STUDIO_CONTRACTS.includes(contractAddress.toLowerCase())) {
		return 'gmstudio';
	}

	return null;
}

import { isArtBlocksContract, getArtBlocksContractAlias } from './constants/artBlocks';

export async function normalizeOpenSeaMetadata(nft: NftData): Promise<any> {
	const metadata = nft.metadata || {};

	// Extract platform-specific metadata
	const platformMetadata = metadata.platform_metadata || {};

	// Extract contract details
	const contractAddress = nft.contractAddress || nft.contract || metadata.contractAddress;
	const contractAlias = metadata.contractAlias || nft.contractAlias;
	const tokenStandard = metadata.token_standard || nft.token_standard;
	const symbol = metadata.symbol || nft.symbol;
	const totalSupply = metadata.total_supply || nft.collection?.total_supply;
	const platform = metadata.platform || nft.platform;

	// Extract generator URL if available
	const generator_url = metadata.generator_url || '';

	// Process artist information
	const artist = {
		name:
			metadata.artist ||
			nft.creator?.name ||
			nft.creator ||
			metadata.creator?.name ||
			metadata.creator ||
			'',
		address: metadata.creator?.address || nft.creator?.address || nft.creator_address || '',
		bio: metadata.creator?.bio || metadata.creator?.description || nft.creator?.bio || '',
		avatarUrl: metadata.creator?.image || metadata.creator?.avatar || nft.creator?.image || '',
		website:
			metadata.creator?.website || metadata.creator?.external_url || nft.creator?.website || '',
		social_media_accounts: {
			twitter: metadata.creator?.twitter || nft.creator?.twitter || '',
			instagram: metadata.creator?.instagram || nft.creator?.instagram || ''
		}
	};

	console.log('[METADATA_DEBUG] Processed artist info:', artist);

	// Normalize attributes
	const attributes = normalizeAttributes(nft, {
		metadata,
		platformMetadata,
		includeNullValues: false
	});

	// Prioritize image fields
	const image_url =
		nft.image_url ||
		nft.display_image_url || // Add display_image_url from fxhash
		metadata.image ||
		metadata.image_url ||
		nft.image_original_url ||
		nft.image_preview_url ||
		nft.image_thumbnail_url;

	// Prioritize animation fields with fxhash support
	const animation_url =
		nft.display_animation_url || // Prioritize fxhash display_animation_url
		nft.animation_url ||
		metadata.animation_url;

	// Ensure collection contract is properly set
	const collection = {
		name: contractAlias,
		contract: contractAddress,
		blockchain: 'Ethereum',
		platform: platform || 'Ethereum',
		total_supply: totalSupply
	};

	const result = {
		name: metadata.name || nft.name || 'Unknown Name',
		tokenID: nft.identifier || nft.tokenId || nft.tokenID || metadata.tokenId || metadata.tokenID,
		description: metadata.description || nft.description || '',
		artist: artist.name || '',
		artist_info: artist,
		blockchain: 'Ethereum',
		image_url,
		animation_url,
		generator_url,
		tags: nft.tags || metadata.tags || [],
		website: nft.website || metadata.external_url || '',
		attributes: attributes,
		collection,
		contractAlias,
		symbol,
		token_standard: tokenStandard,
		raw_data: {
			attributes: metadata.attributes || nft.attributes,
			traits: metadata.traits || nft.traits,
			features: metadata.features || nft.features,
			seed: metadata.seed,
			collectionId: metadata.collectionId
		}
	};

	console.log('[METADATA_DEBUG] Final normalized result:', {
		name: result.name,
		tokenID: result.tokenID,
		artist: result.artist,
		artist_info: result.artist_info
	});

	return result;
}

export async function normalizeTezosMetadata(nft: NftData): Promise<any> {
	const metadata = nft.metadata || {};

	// Extract contract details
	const contractAddress = nft.contractAddress || nft.contract || metadata.contractAddress;
	const contractAlias = metadata.contractAlias || nft.contractAlias;
	const tokenStandard = metadata.token_standard || nft.token_standard;
	const symbol = metadata.symbol || nft.symbol;
	const totalSupply = metadata.total_supply || nft.collection?.total_supply;

	// Extract creator information
	const creator = {
		creator_address: metadata.creator_address || nft.creator_address || '',
		holder: metadata.creator?.holder || nft.creator?.holder || {}
	};

	// Extract social media accounts
	const social_media_accounts = {
		twitter: creator.holder?.twitter || metadata.creator?.twitter || nft.creator?.twitter || '',
		instagram:
			creator.holder?.instagram || metadata.creator?.instagram || nft.creator?.instagram || ''
	};

	// Process image and animation URLs
	const image_url =
		metadata.image_url ||
		metadata.image ||
		metadata.artifactUri ||
		nft.image_url ||
		nft.artifactUri;

	const animation_url =
		metadata.animation_url || metadata.animationUri || nft.animation_url || nft.animationUri;

	// Process attributes
	const attributes = normalizeAttributes(nft, {
		metadata,
		platformMetadata: {
			Platform: 'Tezos',
			'Token Standard': tokenStandard
		},
		includeNullValues: false
	});

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
		attributes: attributes,
		symbol,
		token_standard: tokenStandard,
		contractAlias,
		collection: {
			name: nft.fa?.name || metadata.collection_name || nft.collection_name || '',
			contract: contractAddress,
			blockchain: 'Tezos',
			total_supply: totalSupply
		},
		raw_data: {
			attributes: metadata.attributes || nft.attributes,
			properties: metadata.properties || nft.properties,
			traits: metadata.traits || nft.traits
		}
	};
}

export async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
	for (let i = 0; i < retries; i++) {
		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(10000) // Timeout of 10 seconds using AbortSignal
			});
			if (response.ok) {
				return response;
			}
			// Throw an error for non-successful status codes to trigger retry
			throw new Error(`Fetch failed with status: ${response.status}`);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			if (i < retries - 1) {
				console.warn(
					`Retry ${i + 1}/${retries} for ${url} failed: ${message}. Retrying in ${delay}ms...`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			} else {
				console.error(`Failed to fetch ${url} after ${retries} retries: ${message}`);
				throw error; // Re-throw the last error
			}
		}
	}
	// This part should theoretically be unreachable due to the throw in the catch block
	throw new Error(`Failed to fetch ${url} after ${retries} retries.`);
}

export async function fetchMedia(uri: string): Promise<FetchedMedia | FetchedMediaError | null> {
	let response: Response | null = null;
	let buffer: Buffer;
	let httpUrlUsed: string | undefined = undefined; // Track the URL used for fetching

	try {
		const sanitizedUri = removeQueryString(uri);
		console.log(`[MEDIA_DEBUG] Processing URI: ${sanitizedUri}`);

		// Check if the URL is an Arweave URL with or without prefix
		const isArweave =
			sanitizedUri.startsWith('ar://') ||
			sanitizedUri.includes('arweave.net/') ||
			(sanitizedUri.startsWith('https://') && sanitizedUri.includes('.arweave.net/')) ||
			sanitizedUri.match(/^[a-zA-Z0-9_-]{43}$/) !== null; // Raw Arweave transaction ID (43 chars)

		if (isArweave) {
			console.log(`[MEDIA_DEBUG] Detected Arweave URL: ${sanitizedUri}`);
			let arweaveUrl = sanitizedUri;

			// Handle ar:// protocol
			if (arweaveUrl.startsWith('ar://')) {
				const txId = arweaveUrl.replace('ar://', '');
				arweaveUrl = `https://arweave.net/${txId}`;
			}
			// Handle raw transaction ID
			else if (arweaveUrl.match(/^[a-zA-Z0-9_-]{43}$/)) {
				arweaveUrl = `https://arweave.net/${arweaveUrl}`;
			}
			// Handle URLs that end with a slash
			else if (arweaveUrl.endsWith('/')) {
				arweaveUrl = arweaveUrl.slice(0, -1);
			}

			console.log(`[MEDIA_DEBUG] Fetching from Arweave URL: ${arweaveUrl}`);
			httpUrlUsed = arweaveUrl;

			try {
				response = await fetch(arweaveUrl, {
					method: 'GET',
					headers: {
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
					},
					signal: AbortSignal.timeout(20000) // 20 second timeout for Arweave which can be slow
				});

				if (!response.ok) {
					throw new Error(`HTTP error ${response.status} fetching Arweave URL`);
				}

				console.log(
					`[MEDIA_DEBUG] Successful Arweave response: ${response.status}, Content-Type: ${response.headers.get('content-type')}`
				);
			} catch (arweaveError) {
				console.error(`[MEDIA_DEBUG] Error fetching from Arweave: ${arweaveError}`);
				// Fall back to regular IPFS/HTTP handling
			}
		}

		// If not an Arweave URL or Arweave fetch failed, continue with regular IPFS/HTTP handling
		if (!response || !response.ok) {
			// Assume convertIpfsToHttpsUrl returns IpfsUrlResult or string
			const ipfsResourceResult = convertIpfsToHttpsUrl(sanitizedUri) as IpfsUrlResult | string;

			let ipfsResource: string | null = null;
			if (typeof ipfsResourceResult === 'string') {
				ipfsResource = ipfsResourceResult;
			} else if (ipfsResourceResult && typeof ipfsResourceResult === 'object') {
				if (ipfsResourceResult.type === 'ipfs' || ipfsResourceResult.type === 'http') {
					ipfsResource = ipfsResourceResult.value;
				}
			}

			if (!ipfsResource) {
				console.log(`[MEDIA_DEBUG] Could not resolve URI to a fetchable resource: ${uri}`);
				throw new Error(`Could not resolve URI to a fetchable resource: ${uri}`);
			}

			const fetchOptions: RequestInit = {
				method: 'GET',
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
				},
				signal: AbortSignal.timeout(15000) // 15 second timeout for fetch
			};

			if (ipfsResource.startsWith('http://') || ipfsResource.startsWith('https://')) {
				httpUrlUsed = ipfsResource;
				console.log(`[MEDIA_DEBUG] Fetching HTTP(S) URL: ${httpUrlUsed}`);
				response = await fetch(httpUrlUsed, fetchOptions);
				console.log(`[MEDIA_DEBUG] Response status: ${response.status}`);
				console.log(`[MEDIA_DEBUG] Content-Type: ${response.headers.get('content-type')}`);
				if (!response.ok) {
					throw new Error(`HTTP error ${response.status} fetching direct URL`);
				}
			} else if (ipfsResource) {
				for (const gateway of IPFS_GATEWAYS) {
					httpUrlUsed = `${gateway}${ipfsResource}`;
					console.log(`[MEDIA_DEBUG] Trying IPFS gateway: ${httpUrlUsed}`);
					try {
						response = await fetch(httpUrlUsed, fetchOptions);
						console.log(`[MEDIA_DEBUG] Response status: ${response.status}`);
						console.log(`[MEDIA_DEBUG] Content-Type: ${response.headers.get('content-type')}`);
						if (response.ok) {
							break;
						} else {
							response = null;
						}
					} catch (error: unknown) {
						response = null;
					}
				}
				if (!response || !response.ok) {
					console.log(
						`[MEDIA_DEBUG] Failed to fetch from all IPFS gateways for resource: ${ipfsResource}`
					);
					throw new Error(`Failed to fetch from all IPFS gateways for resource: ${ipfsResource}`);
				}
			} else {
				console.log(`[MEDIA_DEBUG] Invalid or empty URI provided: ${uri}`);
				throw new Error(`Invalid or empty URI provided: ${uri}`);
			}
		}

		const arrayBuffer = await response.arrayBuffer();
		buffer = Buffer.from(arrayBuffer);
		const fileTypeResult: FileTypeResult | undefined = await fileTypeFromBuffer(buffer);
		console.log(
			`[MEDIA_DEBUG] Detected file type: ${fileTypeResult ? fileTypeResult.mime : 'undefined'}`
		);
		if (!fileTypeResult) {
			// For files with no detectable type, check the Content-Type header
			const contentType = response.headers.get('content-type');
			if (contentType && (contentType.startsWith('image/') || contentType.startsWith('video/'))) {
				console.log(`[MEDIA_DEBUG] Using Content-Type header for mime type: ${contentType}`);
				// Extract extension from content type
				const ext = contentType.split('/')[1];
				return {
					buffer,
					mimeType: contentType,
					fileName: `file.${ext}`,
					httpUrlUsed: httpUrlUsed || ''
				};
			}

			return {
				httpUrlUsed: httpUrlUsed,
				error: 'type_detection_error',
				message: `Could not determine file type for ${httpUrlUsed}`
			};
		}

		const mimeType = fileTypeResult.mime;

		if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
			return {
				httpUrlUsed: httpUrlUsed,
				error: 'unsupported_type',
				message: `Unsupported media type: ${mimeType}`
			};
		}

		let fileName;
		try {
			if (!httpUrlUsed) {
				throw new Error('httpUrlUsed is undefined before creating filename');
			}
			fileName = path.basename(new URL(httpUrlUsed).pathname);
			if (!fileName.includes('.') || path.extname(fileName).substring(1) !== fileTypeResult.ext) {
				fileName = `${fileName}.${fileTypeResult.ext}`;
			}
		} catch (e) {
			const hash = crypto.createHash('sha256').update(buffer).digest('hex');
			fileName = `${hash}.${fileTypeResult.ext}`;
		}

		let dimensions: Dimensions | null = null;

		if (mimeType.startsWith('image/')) {
			try {
				console.log(`[MEDIA_DEBUG] Extracting image dimensions for ${fileName}`);
				const metadata = await sharp(buffer).metadata();
				if (metadata.width && metadata.height) {
					dimensions = createDimensions(metadata.width, metadata.height);
					console.log(`[MEDIA_DEBUG] Image dimensions: ${dimensions?.width}x${dimensions?.height}`);
				} else {
					console.log(`[MEDIA_DEBUG] Image dimensions could not be determined from metadata`);
					dimensions = null;
				}
			} catch (sharpError: unknown) {
				console.error(`[MEDIA_DEBUG] Error extracting image dimensions:`, sharpError);
				dimensions = null;
			}
		} else if (mimeType.startsWith('video/')) {
			try {
				console.log(`[MEDIA_DEBUG] Extracting video dimensions for ${fileName}`);
				const videoDimensions = await getVideoDimensions(buffer);
				if (videoDimensions) {
					dimensions = createDimensions(videoDimensions.width, videoDimensions.height);
					console.log(`[MEDIA_DEBUG] Video dimensions: ${dimensions?.width}x${dimensions?.height}`);
				} else {
					console.log(`[MEDIA_DEBUG] Video dimensions could not be determined`);
					dimensions = null;
				}
			} catch (videoError: unknown) {
				console.error(`[MEDIA_DEBUG] Error extracting video dimensions:`, videoError);
				dimensions = null;
			}
		}

		if (!httpUrlUsed) {
			throw new Error('httpUrlUsed is undefined before successful return');
		}

		return {
			buffer,
			mimeType,
			fileName,
			httpUrlUsed
		};
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.log(`[MEDIA_DEBUG] Error fetching media for URI "${uri}": ${errorMessage}`);
		return { httpUrlUsed: httpUrlUsed, error: 'fetch_error', message: errorMessage };
	}
}

async function getVideoDimensions(buffer: Buffer): Promise<Dimensions | null> {
	const tmpFile = path.join('/tmp', `tmp_video_${Date.now()}.mp4`); // Consider using OS temp dir module
	try {
		await fs.writeFile(tmpFile, buffer);

		return new Promise((resolve, reject) => {
			ffmpeg.ffprobe(tmpFile, (err, metadata) => {
				fs.unlink(tmpFile).catch((unlinkErr) =>
					console.error(`Error unlinking temp file ${tmpFile}:`, unlinkErr)
				); // Clean up the temp file, handle unlink error
				if (err) {
					reject(`Error processing video with ffmpeg: ${err.message}`);
				} else {
					const stream = metadata?.streams?.find(
						(s) => s.codec_type === 'video' && s.width && s.height
					);
					if (stream && typeof stream.width === 'number' && typeof stream.height === 'number') {
						resolve({ width: stream.width, height: stream.height });
					} else {
						// console.warn(`[getVideoDimensions] Could not find video stream with dimensions in metadata for ${tmpFile}`);
						resolve(null); // Resolve with null if no suitable stream found
					}
				}
			});
		});
	} catch (writeError: unknown) {
		console.error(`[getVideoDimensions] Error writing temp file ${tmpFile}:`, writeError);
		// Attempt cleanup even if write failed, might not exist
		fs.unlink(tmpFile).catch((unlinkErr) =>
			console.error(`Error unlinking temp file ${tmpFile} after write error:`, unlinkErr)
		);
		return null; // Or throw error
	}
}

// Convert image buffer to WebP format to reduce file size
async function convertToWebP(
	buffer: Buffer,
	dimensions: Dimensions | null,
	quality = 80,
	maxSizeMB = 8
): Promise<{ buffer: Buffer; mimeType: string }> {
	try {
		console.log('[WEBP_CONVERT] Converting image to WebP format');
		const maxSizeBytes = maxSizeMB * 1024 * 1024;
		const originalSize = buffer.length;

		// Don't do any conversion if the image is already small enough
		if (buffer.length <= maxSizeBytes) {
			console.log('[WEBP_CONVERT] Image already small enough, skipping conversion');
			// Still convert format to webp but without size reduction
			const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();

			return {
				buffer: webpBuffer,
				mimeType: 'image/webp'
			};
		}

		// Initial conversion with specified quality, preserving aspect ratio
		let webpBuffer = await sharp(buffer)
			.webp({ quality }) // Use quality parameter (0-100)
			.toBuffer();

		// Check if we need to reduce size
		if (webpBuffer.length <= maxSizeBytes) {
			console.log('[WEBP_CONVERT] Initial conversion successful, no further reduction needed');
			return {
				buffer: webpBuffer,
				mimeType: 'image/webp'
			};
		}

		// Only reduce quality to 60% as minimum
		let currentQuality = quality;
		let attempts = 0;
		const maxAttempts = 3; // Limit quality reduction attempts

		while (webpBuffer.length > maxSizeBytes && currentQuality > 60 && attempts < maxAttempts) {
			// Reduce quality by 10% each time, but don't go below 60
			currentQuality = Math.max(60, currentQuality - 10);
			attempts++;

			console.log(
				`[WEBP_CONVERT] File still too large (${(webpBuffer.length / 1024 / 1024).toFixed(2)}MB), reducing quality to ${currentQuality}`
			);

			webpBuffer = await sharp(buffer).webp({ quality: currentQuality }).toBuffer();

			if (webpBuffer.length <= maxSizeBytes) {
				console.log('[WEBP_CONVERT] Quality reduction sufficient');
				return {
					buffer: webpBuffer,
					mimeType: 'image/webp'
				};
			}
		}

		// If still too large, resize the image but maintain aspect ratio
		if (webpBuffer.length > maxSizeBytes && dimensions) {
			console.log(
				'[WEBP_CONVERT] Quality reduction insufficient, resizing image while maintaining aspect ratio'
			);

			const aspectRatio = dimensions.width / dimensions.height;
			let targetWidth = dimensions.width;
			let targetHeight = dimensions.height;
			attempts = 0;

			// Use a more gradual scale factor
			while (webpBuffer.length > maxSizeBytes && attempts < 5) {
				// Scale down by 10% each time
				targetWidth = Math.floor(targetWidth * 0.9);
				targetHeight = Math.floor(targetHeight * 0.9);
				attempts++;

				console.log(
					`[WEBP_CONVERT] Resizing to ${targetWidth}x${targetHeight} (maintaining aspect ratio)`
				);

				webpBuffer = await sharp(buffer)
					.resize(targetWidth, targetHeight, {
						fit: 'inside', // Always use 'inside' to preserve aspect ratio
						withoutEnlargement: true
					})
					.webp({ quality: currentQuality })
					.toBuffer();
			}
		}

		// Log final result
		console.log(
			`[WEBP_CONVERT] Conversion complete. Original: ${(originalSize / 1024 / 1024).toFixed(2)}MB, WebP: ${(
				webpBuffer.length /
				1024 /
				1024
			).toFixed(2)}MB (${Math.round((1 - webpBuffer.length / originalSize) * 100)}% reduction)`
		);

		return {
			buffer: webpBuffer,
			mimeType: 'image/webp'
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[WEBP_CONVERT] Error converting to WebP: ${errorMessage}`);

		// Return original buffer on error
		return {
			buffer,
			mimeType: buffer.length > 0 ? 'image/jpeg' : 'application/octet-stream'
		};
	}
}

/**
 * Helper function to verify and log aspect ratio preservation
 */
function verifyAspectRatioPreservation(
	originalDimensions: Dimensions | null,
	uploadedDimensions: Dimensions | null
): void {
	if (originalDimensions && uploadedDimensions) {
		const originalAspectRatio = originalDimensions.width / originalDimensions.height;
		const uploadedAspectRatio = uploadedDimensions.width / uploadedDimensions.height;
		const aspectRatioPercentDiff = Math.abs(1 - uploadedAspectRatio / originalAspectRatio) * 100;

		console.log(
			`[MEDIA_UPLOAD_DEBUG] Original aspect ratio: ${originalAspectRatio.toFixed(4)} (${originalDimensions.width}x${originalDimensions.height})`
		);
		console.log(
			`[MEDIA_UPLOAD_DEBUG] Uploaded aspect ratio: ${uploadedAspectRatio.toFixed(4)} (${uploadedDimensions.width}x${uploadedDimensions.height})`
		);
		console.log(
			`[MEDIA_UPLOAD_DEBUG] Aspect ratio difference: ${aspectRatioPercentDiff.toFixed(2)}%`
		);

		if (aspectRatioPercentDiff > 1) {
			console.warn(
				`[MEDIA_UPLOAD_DEBUG] WARNING: Aspect ratio changed by ${aspectRatioPercentDiff.toFixed(2)}% during upload!`
			);
		} else {
			console.log('[MEDIA_UPLOAD_DEBUG] Aspect ratio successfully preserved ✓');
		}
	}
}

export async function handleMediaUpload(
	mediaUri: string,
	artwork: NftData
): Promise<UploadResult | null> {
	if (!mediaUri || typeof mediaUri !== 'string') {
		console.error('[MEDIA_UPLOAD_DEBUG] Invalid media URI provided:', mediaUri);
		return null;
	}

	// Store the original dimensions for later use
	let originalDimensions: Dimensions | null = artwork.dimensions || null;

	// Log artwork dimensions if available
	if (originalDimensions) {
		console.log(
			`[MEDIA_UPLOAD_DEBUG] Original artwork dimensions from metadata: ${originalDimensions.width}x${originalDimensions.height}`
		);
	}

	// Retry configuration
	const MAX_RETRIES = 3;
	const RETRY_DELAY = 2000; // 2 seconds
	let retryCount = 0;

	// Special handling for fxhash URLs - these are HTML generators, not direct media
	if (isFxHashUrl(mediaUri)) {
		const dimensions = ensureDimensions(artwork.dimensions);
		return {
			url: mediaUri,
			fileType: 'text/html',
			dimensions
		};
	}

	// Special handling for Art Blocks URLs - these can be generators or images
	if (isArtBlocksUrl(mediaUri)) {
		const mediaType = getArtBlocksMediaType(mediaUri);

		// For generator URLs, we don't upload to Cloudinary as they're HTML
		if (mediaType === 'generator') {
			const dimensions = ensureDimensions(artwork.dimensions);
			return {
				url: mediaUri,
				fileType: 'text/html',
				dimensions
			};
		}

		// For image URLs, always upload to Cloudinary
		if (mediaType === 'image') {
			while (retryCount < MAX_RETRIES) {
				try {
					const mediaData = await fetchMedia(mediaUri);
					if (!mediaData || 'error' in mediaData) {
						throw new Error(`Failed to fetch Art Blocks image: ${mediaUri}`);
					}

					if (!isValidMimeType(mediaData.mimeType)) {
						throw new Error(`Invalid MIME type detected: ${mediaData.mimeType}`);
					}

					// Convert image to WebP if it's an image type
					let uploadBuffer = mediaData.buffer;
					let uploadMimeType = mediaData.mimeType;

					// Convert to WebP only for non-SVG, non-GIF images
					if (
						mediaData.mimeType.startsWith('image/') &&
						!mediaData.mimeType.includes('svg') &&
						!mediaData.mimeType.includes('gif')
					) {
						const dimensions = await getImageDimensionsFromBuffer(mediaData.buffer);
						console.log(
							`[MEDIA_UPLOAD_DEBUG] Original image dimensions: ${dimensions?.width}x${dimensions?.height}`
						);

						// Store dimensions for proper aspect ratio preservation
						originalDimensions = dimensions || originalDimensions;

						const webpResult = await convertToWebP(mediaData.buffer, dimensions, 80, 8);
						uploadBuffer = webpResult.buffer;
						uploadMimeType = webpResult.mimeType;

						// Get dimensions after WebP conversion
						const webpDimensions = await getImageDimensionsFromBuffer(uploadBuffer);
						console.log(
							`[MEDIA_UPLOAD_DEBUG] WebP converted dimensions: ${webpDimensions?.width}x${webpDimensions?.height}`
						);
					}

					// Get the original dimensions to track aspect ratio preservation
					const originalImageDimensions = await getImageDimensionsFromBuffer(uploadBuffer);

					// Log dimensions but not aspect ratio since that's handled by the verification function
					if (originalImageDimensions) {
						console.log(
							`[MEDIA_UPLOAD_DEBUG] Original image dimensions before upload: ${originalImageDimensions.width}x${originalImageDimensions.height}`
						);
					}

					console.log(
						`[MEDIA_UPLOAD_DEBUG] Uploading to Cloudinary with mime type: ${uploadMimeType}`
					);
					const uploadResult = await uploadToCloudinary(
						uploadBuffer,
						artwork.name || mediaData.fileName || 'artwork',
						uploadMimeType,
						generateTags(
							artwork.name || mediaData.fileName || 'artwork',
							uploadMimeType,
							artwork.collection?.contract,
							artwork.tokenID
						)
					);

					if (!uploadResult) {
						throw new Error('Cloudinary upload failed');
					}

					// Verify aspect ratio was preserved
					verifyAspectRatioPreservation(originalImageDimensions, uploadResult.dimensions);

					console.log(
						`[MEDIA_UPLOAD_DEBUG] Cloudinary upload successful. Dimensions from result: ${uploadResult.dimensions?.width}x${uploadResult.dimensions?.height}`
					);

					return {
						url: uploadResult.url,
						fileType: uploadMimeType,
						dimensions: uploadResult.dimensions
					};
				} catch (error) {
					console.error(`[MEDIA_UPLOAD_DEBUG] Attempt ${retryCount + 1} failed:`, error);
					retryCount++;
					if (retryCount < MAX_RETRIES) {
						await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
					}
				}
			}
			console.error('[MEDIA_UPLOAD_DEBUG] All retry attempts failed for Art Blocks image');
			return null;
		}
	}

	// Regular media handling
	let fetchedMediaResult: FetchedMedia | FetchedMediaError | null;
	try {
		fetchedMediaResult = await fetchMedia(mediaUri);
	} catch (error) {
		console.error('[MEDIA_UPLOAD_DEBUG] Error fetching media:', error);
		return null;
	}

	// If we couldn't fetch the media or got an error, handle potential HTML/PDF content
	if (!fetchedMediaResult || 'error' in fetchedMediaResult) {
		const errorInfo = fetchedMediaResult as FetchedMediaError | null;

		// For HTML/PDF content that can't be fetched normally, return the URL directly
		if (errorInfo?.httpUrlUsed && typeof errorInfo.httpUrlUsed === 'string') {
			const mediaType = getMediaType(
				errorInfo.message?.includes('application/pdf') ? 'application/pdf' : 'text/html'
			);

			if (mediaType === 'interactive' || mediaType === 'document') {
				return {
					url: errorInfo.httpUrlUsed,
					fileType: mediaType === 'document' ? 'application/pdf' : 'text/html',
					dimensions: null
				};
			}
		}

		console.error(
			`[MEDIA_UPLOAD_DEBUG] Media fetch failed: ${errorInfo?.error}: ${errorInfo?.message}`
		);
		return null;
	}

	// Successfully fetched media - validate it
	const fetchedMedia = fetchedMediaResult as FetchedMedia;
	if (!isValidMimeType(fetchedMedia.mimeType)) {
		console.error(`[MEDIA_UPLOAD_DEBUG] Invalid MIME type: ${fetchedMedia.mimeType}`);
		return null;
	}

	const mediaType = getMediaType(fetchedMedia.mimeType);
	if (mediaType === 'unknown') {
		console.error(`[MEDIA_UPLOAD_DEBUG] Unsupported media type: ${fetchedMedia.mimeType}`);
		return null;
	}

	// Always upload valid media to Cloudinary
	while (retryCount < MAX_RETRIES) {
		try {
			// Convert image to WebP if it's an image type (excluding SVGs and GIFs)
			let uploadBuffer = fetchedMedia.buffer;
			let uploadMimeType = fetchedMedia.mimeType;

			// Convert to WebP only for non-SVG, non-GIF images
			if (
				fetchedMedia.mimeType.startsWith('image/') &&
				!fetchedMedia.mimeType.includes('svg') &&
				!fetchedMedia.mimeType.includes('gif')
			) {
				const dimensions = await getImageDimensionsFromBuffer(fetchedMedia.buffer);
				console.log(
					`[MEDIA_UPLOAD_DEBUG] Original image dimensions: ${dimensions?.width}x${dimensions?.height}`
				);

				// Store dimensions for proper aspect ratio preservation
				originalDimensions = dimensions || originalDimensions;

				const webpResult = await convertToWebP(fetchedMedia.buffer, dimensions, 80, 8);
				uploadBuffer = webpResult.buffer;
				uploadMimeType = webpResult.mimeType;

				// Get dimensions after WebP conversion
				const webpDimensions = await getImageDimensionsFromBuffer(uploadBuffer);
				console.log(
					`[MEDIA_UPLOAD_DEBUG] WebP converted dimensions: ${webpDimensions?.width}x${webpDimensions?.height}`
				);
			}

			// Get the original dimensions to track aspect ratio preservation
			const originalImageDimensions = await getImageDimensionsFromBuffer(uploadBuffer);

			// Log dimensions but not aspect ratio since that's handled by the verification function
			if (originalImageDimensions) {
				console.log(
					`[MEDIA_UPLOAD_DEBUG] Original image dimensions before upload: ${originalImageDimensions.width}x${originalImageDimensions.height}`
				);
			}

			console.log(`[MEDIA_UPLOAD_DEBUG] Uploading to Cloudinary with mime type: ${uploadMimeType}`);
			const uploadResult = await uploadToCloudinary(
				uploadBuffer,
				artwork.name || fetchedMedia.fileName || 'artwork',
				uploadMimeType,
				generateTags(
					artwork.name || fetchedMedia.fileName || 'artwork',
					uploadMimeType,
					artwork.collection?.contract,
					artwork.tokenID
				)
			);

			if (!uploadResult) {
				throw new Error('Cloudinary upload failed');
			}

			// Verify aspect ratio was preserved
			verifyAspectRatioPreservation(originalImageDimensions, uploadResult.dimensions);

			console.log(
				`[MEDIA_UPLOAD_DEBUG] Cloudinary upload successful. Dimensions from result: ${uploadResult.dimensions?.width}x${uploadResult.dimensions?.height}`
			);

			return {
				url: uploadResult.url,
				fileType: uploadMimeType,
				dimensions: uploadResult.dimensions
			};
		} catch (error) {
			console.error(`[MEDIA_UPLOAD_DEBUG] Upload attempt ${retryCount + 1} failed:`, error);
			retryCount++;
			if (retryCount < MAX_RETRIES) {
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
			}
		}
	}

	console.error('[MEDIA_UPLOAD_DEBUG] All upload retry attempts failed');
	return null;
}

interface ResizeResult {
	buffer: Buffer;
	dimensions: Dimensions | null;
}

export async function resizeMedia(
	buffer: Buffer,
	mimeType: string,
	dimensions: Dimensions | null,
	maxSizeMB = 25
): Promise<ResizeResult | null> {
	console.log('[RESIZE_MEDIA] Starting resizeMedia function');
	console.log(
		`[RESIZE_MEDIA] Input - MimeType: ${mimeType}, Dimensions: ${JSON.stringify(dimensions)}, MaxSizeMB: ${maxSizeMB}`
	);

	if (!buffer || buffer.length === 0) {
		console.error('[RESIZE_MEDIA] Input buffer is null or empty.');
		return null;
	}

	if (
		!dimensions ||
		typeof dimensions.width !== 'number' ||
		typeof dimensions.height !== 'number' ||
		dimensions.width <= 0 ||
		dimensions.height <= 0
	) {
		console.warn(
			'[RESIZE_MEDIA] Invalid or missing dimensions for resizing. Attempting to get from buffer.'
		);
		const currentDimensions = await getImageDimensionsFromBuffer(buffer);
		if (
			!currentDimensions ||
			typeof currentDimensions.width !== 'number' ||
			typeof currentDimensions.height !== 'number' ||
			currentDimensions.width <= 0 ||
			currentDimensions.height <= 0
		) {
			console.warn(
				'[RESIZE_MEDIA] Could not determine valid dimensions from buffer. Cannot resize.'
			);
			return { buffer, dimensions: null };
		}
		dimensions = currentDimensions;
		console.log(
			'[RESIZE_MEDIA] Using dimensions from buffer for resize:',
			JSON.stringify(dimensions)
		);
	}

	const MAX_DIMENSION = 4000; // Max width or height for Cloudinary
	const MAX_FILE_SIZE_BYTES = maxSizeMB * 1024 * 1024;

	try {
		let sizeMB = Buffer.byteLength(buffer) / (1024 * 1024);
		let attempt = 0;
		let resizedBuffer = buffer;
		let success = false; // Flag to track if resize loop completed successfully

		if (mimeType.startsWith('image/')) {
			while (sizeMB > maxSizeMB && attempt < 10) {
				let scaleFactor = attempt === 0 ? 1 : Math.pow(0.9, attempt);

				// Ensure dimensions are valid numbers before scaling
				const currentWidth = dimensions?.width ?? 0;
				const currentHeight = dimensions?.height ?? 0;
				if (currentWidth <= 0 || currentHeight <= 0) {
					// console.error("[resizeMedia] Invalid dimensions provided for scaling image.", dimensions);
					throw new Error('Invalid dimensions for scaling');
				}

				let newWidth = Math.floor(currentWidth * scaleFactor);
				let newHeight = Math.floor(currentHeight * scaleFactor);

				let image = sharp(resizedBuffer).resize(newWidth, newHeight, {
					fit: 'inside',
					withoutEnlargement: true
				});

				resizedBuffer = await image.toBuffer();
				sizeMB = Buffer.byteLength(resizedBuffer) / (1024 * 1024);
				attempt++;
			}
			success = sizeMB <= maxSizeMB; // Image resize successful if size is now within limit
		} else if (mimeType.startsWith('video/')) {
			while (sizeMB > maxSizeMB && attempt < 10) {
				let scaleFactor = attempt === 0 ? 1 : Math.pow(0.9, attempt);

				// Ensure dimensions are valid numbers before scaling
				const currentWidth = dimensions?.width ?? 0;
				const currentHeight = dimensions?.height ?? 0;
				if (currentWidth <= 0 || currentHeight <= 0) {
					// console.error("[resizeMedia] Invalid dimensions provided for scaling video.", dimensions);
					throw new Error('Invalid dimensions for scaling');
				}

				let newWidth = Math.floor(currentWidth * scaleFactor);
				let newHeight = Math.floor(currentHeight * scaleFactor);

				resizedBuffer = await new Promise<Buffer>((resolve, reject) => {
					const tmpInputFile = path.join('/tmp', `tmp_video_input_${Date.now()}.mp4`); // Use OS temp dir
					const tmpOutputFile = path.join('/tmp', `tmp_video_resized_${Date.now()}.mp4`); // Use OS temp dir

					fs.writeFile(tmpInputFile, resizedBuffer)
						.then(() => {
							ffmpeg(tmpInputFile)
								.size(`${newWidth}x${newHeight}`)
								.outputOptions('-preset', 'fast') // Consider 'medium' or 'slow' for better compression/quality trade-off
								.outputOptions('-crf', '28') // Constant Rate Factor (lower is better quality, larger file). 23 is often default, 28 is lower quality.
								.outputOptions('-movflags', '+faststart') // Good for web video
								.on('end', () => {
									fs.readFile(tmpOutputFile)
										.then((resized) => {
											// Clean up both files
											Promise.all([fs.unlink(tmpInputFile), fs.unlink(tmpOutputFile)]).catch(
												(unlinkErr) => console.error(`Error unlinking temp files:`, unlinkErr)
											);
											resolve(resized);
										})
										.catch((readErr) => {
											// Clean up both files even if read fails
											Promise.all([fs.unlink(tmpInputFile), fs.unlink(tmpOutputFile)]).catch(
												(unlinkErr) =>
													console.error(`Error unlinking temp files after read error:`, unlinkErr)
											);
											reject(`Error reading resized file: ${readErr}`);
										});
								});
						})
						.catch((writeErr) => {
							console.error(`[resizeMedia] Error writing resized file: ${writeErr}`);
							reject(writeErr);
						});
				});
				sizeMB = Buffer.byteLength(resizedBuffer) / (1024 * 1024);
				attempt++;
			}
			success = sizeMB <= maxSizeMB; // Video resize successful if size is now within limit
		}

		if (!success && sizeMB > maxSizeMB) {
			// console.warn(`[resizeMedia] Unable to reduce file size below ${maxSizeMB}MB after several attempts.`);
			// Decide how to handle failure to resize enough: return original? return null?
			// Returning null signals failure to meet size requirement.
			return null;
		}

		// Try to get dimensions of the final buffer (original or resized)
		const finalDimensions = await (
			mimeType.startsWith('image/')
				? sharp(resizedBuffer)
						.metadata()
						.then((m) =>
							createDimensions(m.width || dimensions.width, m.height || dimensions.height)
						)
				: getVideoDimensions(resizedBuffer).then((d) => d || dimensions)
		).catch(() => dimensions);

		if (!finalDimensions) {
			// console.warn("[resizeMedia] Could not determine final dimensions, resize considered failed.");
			return null; // Fail if we can't get final dimensions
		}

		return {
			buffer: resizedBuffer,
			dimensions: finalDimensions
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[resizeMedia] Error during resizing: ${message}`);
		return null; // Return null on any exception during resize
	}
}

// Define the attribute interface
interface Attribute {
	trait_type: string;
	value: string;
}

/**
 * Normalizes attributes/traits into a consistent format
 * @param {Object} data - The NFT data containing attributes/traits
 * @param {Object} options - Additional options for normalization
 * @returns {Array<Attribute>} Normalized attributes array
 */
function normalizeAttributes(
	data: any,
	options: { metadata?: any; platformMetadata?: any; includeNullValues?: boolean } = {}
): Attribute[] {
	const { metadata = {}, platformMetadata = {}, includeNullValues = false } = options;

	let attributes: Attribute[] = [];

	// Process standard attributes array
	const standardAttrs = data.attributes || metadata.attributes || [];
	if (Array.isArray(standardAttrs)) {
		attributes = attributes.concat(
			standardAttrs
				.map((attr: any) => {
					if (typeof attr === 'object' && attr !== null) {
						return {
							trait_type: String(attr.trait_type || attr.name || '').trim(),
							value: String(attr.value || '').trim()
						};
					}
					return null;
				})
				.filter((attr): attr is Attribute => attr !== null)
		);
	}

	// Process traits array
	const traits = data.traits || metadata.traits || [];
	if (Array.isArray(traits)) {
		attributes = attributes.concat(
			traits
				.map((trait: any) => {
					if (typeof trait === 'object' && trait !== null) {
						return {
							trait_type: String(trait.trait_type || trait.name || '').trim(),
							value: String(trait.value || '').trim()
						};
					}
					return null;
				})
				.filter((attr): attr is Attribute => attr !== null)
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

async function searchCloudinaryByTag(tag: string): Promise<UploadApiResponse | null> {
	configureCloudinary(); // Configure Cloudinary on-demand
	try {
		console.log(`[CLOUDINARY_SEARCH] Searching for assets with tag: ${tag}`);
		const searchResult = await new Promise<any>((resolve, reject) => {
			cloudinary.search
				.expression(`tags=${tag}`)
				.with_field('tags')
				.max_results(1)
				.execute()
				.then(resolve)
				.catch(reject);
		});

		if (searchResult?.resources?.length > 0) {
			console.log('[CLOUDINARY_DEBUG] Found existing resource with tag:', tag);
			return searchResult.resources[0];
		}
		return null;
	} catch (error) {
		return null;
	}
}

export async function uploadToCloudinary(
	fileStream: Buffer | NodeJS.ReadableStream,
	baseName: string,
	mimeType: string,
	tagsToApply?: string
): Promise<UploadResult | null> {
	configureCloudinary(); // Configure Cloudinary on-demand
	const publicId = sanitizeCloudinaryPublicId(baseName);
	const resourceType = mimeType.startsWith('video') ? 'video' : 'image';

	try {
		let dimensionsToReturn: Dimensions | null = null; // Declare at a higher scope

		// First, check if we already have this file using the mediaHash tag
		if (tagsToApply) {
			const mediaHashTag = tagsToApply.split(',').find((tag) => tag.startsWith('mediaHash:'));
			if (mediaHashTag) {
				const existingResource = await searchCloudinaryByTag(mediaHashTag);
				if (existingResource) {
					console.log('[CLOUDINARY_DEBUG] Using existing resource:', existingResource.public_id);
					// Extract dimensions from existing resource
					let width = existingResource.width;
					let height = existingResource.height;

					if (!width || !height) {
						console.log(
							'[CLOUDINARY_DEBUG] Missing dimensions from existing resource, attempting to get them or using null'
						);
						// Try to get dimensions using getCloudinaryImageDimensions, or fallback to null if not possible.
						const liveDimensions = await getCloudinaryImageDimensions(existingResource.secure_url);
						if (liveDimensions) {
							console.log(
								`[CLOUDINARY_DEBUG] Fetched live dimensions for existing resource: ${liveDimensions.width}x${liveDimensions.height}`
							);
							dimensionsToReturn = liveDimensions;
						} else {
							console.log(
								'[CLOUDINARY_DEBUG] Could not fetch live dimensions for existing resource. Dimensions set to null.'
							);
						}
					} else {
						console.log(
							`[CLOUDINARY_DEBUG] Found dimensions from existing resource: ${width}x${height}`
						);
						dimensionsToReturn = createDimensions(width, height);
					}

					return {
						url: existingResource.secure_url.split('?')[0],
						fileType:
							existingResource.resource_type === 'image'
								? existingResource.format || 'image'
								: existingResource.resource_type === 'video'
									? existingResource.format || 'video'
									: 'raw',
						dimensions: dimensionsToReturn
					};
				}
			}
		}

		// If no existing resource found, proceed with upload
		const hash = createHashForString(baseName).substring(0, 8);
		const fullPublicId = `compendium/${publicId}_${hash}`;

		console.log('[CLOUDINARY_DEBUG] Generated public_id:', fullPublicId);

		const uploadOptions: UploadApiOptions = {
			public_id: fullPublicId,
			tags: tagsToApply ? tagsToApply.split(',') : undefined,
			resource_type: resourceType,
			overwrite: false,
			use_filename: false,
			unique_filename: false,
			quality: 'auto', // Use Cloudinary's auto quality instead of fixed 100
			fetch_format: null, // Don't change the image format
			transformation: [
				{
					crop: 'limit', // Use 'limit' to ensure aspect ratio is preserved
					width: null, // Let the original dimensions be preserved
					height: null // Let the original dimensions be preserved
				}
			]
		};

		const uploadPromise = new Promise<UploadApiResponse | undefined>((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
				if (error) {
					console.error('[CLOUDINARY_DEBUG] Upload stream error:', error);
					reject(error);
				} else {
					console.log('[CLOUDINARY_DEBUG] Upload successful:', {
						public_id: result?.public_id,
						url: result?.secure_url,
						width: result?.width,
						height: result?.height
					});
					resolve(result);
				}
			});

			if (Buffer.isBuffer(fileStream)) {
				uploadStream.end(fileStream);
			} else {
				fileStream.pipe(uploadStream);
			}
		});

		const response = await uploadPromise;

		if (response && response.secure_url) {
			// Extract dimensions directly from the Cloudinary response
			let width = response.width;
			let height = response.height;
			let respDimensions: Dimensions | null = null;

			if (!width || !height) {
				console.log(
					'[CLOUDINARY_DEBUG] No dimensions returned from Cloudinary, attempting to fetch live or using null'
				);
				// Attempt to get live dimensions as a fallback
				const liveDimensions = await getCloudinaryImageDimensions(response.secure_url);
				respDimensions = liveDimensions; // This will be Dimensions | null
				if (liveDimensions) {
					console.log(
						`[CLOUDINARY_DEBUG] Fetched live dimensions after upload: ${liveDimensions.width}x${liveDimensions.height}`
					);
				} else {
					console.log(
						'[CLOUDINARY_DEBUG] Could not fetch live dimensions after upload. Dimensions set to null.'
					);
				}
			} else {
				console.log(
					`[CLOUDINARY_DEBUG] Got dimensions from Cloudinary response: ${width}x${height}`
				);
				respDimensions = createDimensions(width, height);
			}

			return {
				url: response.secure_url.split('?')[0],
				fileType:
					response.resource_type === 'image'
						? response.format || 'image'
						: response.resource_type === 'video'
							? response.format || 'video'
							: 'raw',
				dimensions: respDimensions
			};
		} else {
			console.error(
				'[CLOUDINARY_DEBUG] Upload failed or returned no secure_url. Response:',
				response
			);
			throw new Error(`Upload failed with response: ${JSON.stringify(response)}`);
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[CLOUDINARY_DEBUG] Error during upload: ${message}`);
		return null;
	}
}

function constructAlbaGeneratorUrl(metadata: any): string | null {
	// Check if we have the required Alba.art fields
	if (metadata?.collectionId && metadata?.seed && metadata?.tokenId !== undefined) {
		// Construct the Alba.art generator URL with default resolution
		return `https://api.alba.art/render-preview/${metadata.collectionId}/seed/${metadata.seed}/token/${metadata.tokenId}/res/735`;
	}
	return null;
}

function constructGMStudioGeneratorUrl(metadata: any): string | null {
	// Check if we have GM Studio specific fields
	if (metadata?.project && metadata?.seed) {
		// Construct the GM Studio URL with their live render format
		return `https://www.gmstudio.art/live/${metadata.project}/${metadata.seed}`;
	}
	return null;
}

async function fetchOpenSeaCollectionData(
	contractAddress: string
): Promise<{ name: string; symbol: string; total_supply: number | null } | null> {
	if (!contractAddress) return null;

	try {
		const apiKey = privateEnv.OPENSEA_API_KEY;
		if (!apiKey) {
			console.warn('[OPENSEA_DEBUG] No OpenSea API key found in environment variables');
			return null;
		}

		const response = await fetch(
			`https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}`,
			{
				headers: {
					'X-API-KEY': apiKey,
					Accept: 'application/json'
				}
			}
		);

		if (!response.ok) {
			console.error(`[OPENSEA_DEBUG] Failed to fetch collection data: ${response.status}`);
			return null;
		}

		const data = await response.json();
		return {
			name: data.collection?.name || data.name || null,
			symbol: data.symbol || null,
			total_supply: data.total_supply || null
		};
	} catch (error) {
		console.error('[OPENSEA_DEBUG] Error fetching OpenSea collection data:', error);
		return null;
	}
}

/**
 * Get the dimensions of an existing Cloudinary image by its URL
 * @param imageUrl The URL of the Cloudinary image
 * @returns The width and height of the image, or null if dimensions couldn't be retrieved
 */
export async function getCloudinaryImageDimensions(imageUrl: string): Promise<Dimensions | null> {
	configureCloudinary(); // Configure Cloudinary on-demand
	if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
		console.error('[CLOUDINARY_DEBUG] Invalid Cloudinary URL:', imageUrl);
		return null;
	}

	try {
		// Extract the public ID from the URL
		// Example URL: https://res.cloudinary.com/cloud-name/image/upload/v1234567890/compendium/image_name_12345678.jpg
		const urlParts = imageUrl.split('/');
		const uploadIndex = urlParts.indexOf('upload');

		if (uploadIndex === -1) {
			console.error('[CLOUDINARY_DEBUG] Could not parse Cloudinary URL:', imageUrl);
			return null;
		}

		// Get everything after 'upload' excluding version (v1234567890)
		let publicId = urlParts.slice(uploadIndex + 1).join('/');

		// Remove version if present
		if (publicId.startsWith('v') && /^v\d+\//.test(publicId)) {
			publicId = publicId.replace(/^v\d+\//, '');
		}

		// Remove file extension if present
		publicId = publicId.replace(/\.[^/.]+$/, '');

		console.log('[CLOUDINARY_DEBUG] Extracted public ID:', publicId);

		// Use the Cloudinary API to get resource details
		const result = await new Promise<any>((resolve, reject) => {
			cloudinary.api.resource(
				publicId,
				{
					resource_type: 'image',
					type: 'upload'
				},
				(error, result) => {
					if (error) {
						reject(error);
					} else {
						resolve(result);
					}
				}
			);
		});

		if (result && typeof result.width === 'number' && typeof result.height === 'number') {
			console.log(`[CLOUDINARY_DEBUG] Found dimensions: ${result.width}x${result.height}`);
			return createDimensions(result.width, result.height);
		} else {
			console.error('[CLOUDINARY_DEBUG] Resource found but no dimensions:', result);
			return null;
		}
	} catch (error) {
		console.error('[CLOUDINARY_DEBUG] Error getting image dimensions:', error);
		return null;
	}
}

async function getImageDimensionsFromBuffer(buffer: Buffer): Promise<Dimensions | null> {
	try {
		if (!buffer || buffer.length === 0) {
			console.error('[DIMENSIONS_IMAGE_BUFFER] Empty buffer provided');
			return null;
		}

		console.log(
			`[DIMENSIONS_IMAGE_BUFFER] Getting dimensions from buffer of size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`
		);

		const metadata = await sharp(buffer).metadata();
		if (metadata.width && metadata.height) {
			console.log(
				`[DIMENSIONS_IMAGE_BUFFER] Successfully got dimensions: ${metadata.width}x${metadata.height}`
			);
			return { width: metadata.width, height: metadata.height };
		}

		console.warn('[DIMENSIONS_IMAGE_BUFFER] Could not extract width or height from metadata');
		console.log('[DIMENSIONS_IMAGE_BUFFER] Available metadata:', metadata);
		return null; // Fallback if no dimensions found
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(
			`[DIMENSIONS_IMAGE_BUFFER] Error getting image dimensions from buffer: ${errorMessage}`
		);
		return null; // Fallback in case of error
	}
}
