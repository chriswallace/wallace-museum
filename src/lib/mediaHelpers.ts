import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from '@ffprobe-installer/ffprobe';
import { fileTypeFromBuffer, type FileTypeResult } from 'file-type';
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
	sanitizePinataFileName
} from './mediaUtils';

// Import Pinata helpers
import { uploadToPinata as pinataUpload } from './pinataHelpers';

// Helper function to dynamically import Sharp with error handling
async function getSharp() {
	try {
		const sharp = await import('sharp');
		return sharp.default;
	} catch (error) {
		console.warn('Sharp not available in this environment:', error);
		return null;
	}
}

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
	'https://ipfs.wallacemuseum.com/ipfs/?pinataGatewayToken=ezmv1YoBrLBuXqWs1CyFxZ2P1SOpOF-X9mgJTP1EmH9d-1F6m6spo1dpD4YoXxw6', // Wallace Museum custom gateway with auth token
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

// Define return type for uploadToPinata
interface UploadResult {
	url: string;
	fileType: string;
	dimensions: Dimensions | null;
	animated_url?: string;
	animation_fileType?: string;
}

// Define basic structure for NFT and Metadata for normalization functions
interface TezosHolder {
	address: string;
	alias?: string;
	tzdomain?: string;
	logo?: string;
	twitter?: string;
	farcaster?: string;
	website?: string;
	instagram?: string;
	description?: string;
	__typename?: string;
}

interface TezosCreator {
	holder: TezosHolder;
	__typename?: string;
}

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
	address?: string; // Add address field for objkt API
}

export interface NftData {
	// Added export here
	metadata?: any; // Keep any for flexibility or define a strict metadata type
	name?: string;
	title?: string; // Add title field for Tezos NFTs
	description?: string;
	creator?: any; // Could be string or object depending on source
	creator_address?: string; // Add this field
	creators?: TezosCreator[]; // Use the proper GraphQL structure
	token_creators?: string[]; // Keep as fallback
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



function detectGenerativeArtPlatform(metadata: any, contractAddress?: string): string | null {
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

export async function fetchMedia(
	uri: string,
	skipIpfsProcessing: boolean = false
): Promise<FetchedMedia | FetchedMediaError | null> {
	let response: Response | null = null;
	let buffer: Buffer;
	let httpUrlUsed: string | undefined = undefined; // Track the URL used for fetching

	try {
		const sanitizedUri = removeQueryString(uri);
		//console.log(`[MEDIA_DEBUG] Processing URI: ${sanitizedUri}`);

		// Check if the URL is an Arweave URL with or without prefix
		const isArweave =
			sanitizedUri.startsWith('ar://') ||
			sanitizedUri.includes('arweave.net/') ||
			(sanitizedUri.startsWith('https://') && sanitizedUri.includes('.arweave.net/')) ||
			sanitizedUri.match(/^[a-zA-Z0-9_-]{43}$/) !== null; // Raw Arweave transaction ID (43 chars)

		if (isArweave) {
			//console.log(`[MEDIA_DEBUG] Detected Arweave URL: ${sanitizedUri}`);
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

			//console.log(`[MEDIA_DEBUG] Fetching from Arweave URL: ${arweaveUrl}`);
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

				/*console.log(
					`[MEDIA_DEBUG] Successful Arweave response: ${response.status}, Content-Type: ${response.headers.get('content-type')}`
				);*/
			} catch (arweaveError) {
				console.error(`[MEDIA_DEBUG] Error fetching from Arweave: ${arweaveError}`);
				// Fall back to regular IPFS/HTTP handling
			}
		}

		// If not an Arweave URL or Arweave fetch failed, continue with regular IPFS/HTTP handling
		if (!response || !response.ok) {
			let ipfsResource: string | null = null;

			if (skipIpfsProcessing) {
				// For import process, convert IPFS protocol URLs to gateway URLs but don't use proxy
				if (sanitizedUri.startsWith('ipfs://')) {
					// Convert ipfs:// to gateway URL
					const hash = sanitizedUri.replace('ipfs://', '');
					ipfsResource = `https://ipfs.io/ipfs/${hash}`;
					//console.log(`[MEDIA_DEBUG] Converted IPFS protocol URL to gateway: ${ipfsResource}`);
				} else {
					// Use other URLs as-is
					ipfsResource = sanitizedUri;
					//console.log(`[MEDIA_DEBUG] Using URL as-is (skipIpfsProcessing): ${ipfsResource}`);
				}
			} else {
				// Normal processing for display/other uses
				const ipfsResourceResult = convertIpfsToHttpsUrl(sanitizedUri) as IpfsUrlResult | string;

				if (typeof ipfsResourceResult === 'string') {
					ipfsResource = ipfsResourceResult;
				} else if (ipfsResourceResult && typeof ipfsResourceResult === 'object') {
					if (ipfsResourceResult.type === 'ipfs' || ipfsResourceResult.type === 'http') {
						ipfsResource = ipfsResourceResult.value;
					}
				}
			}

			if (!ipfsResource) {
				//console.log(`[MEDIA_DEBUG] Could not resolve URI to a fetchable resource: ${uri}`);
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
				//console.log(`[MEDIA_DEBUG] Fetching HTTP(S) URL: ${httpUrlUsed}`);
				response = await fetch(httpUrlUsed, fetchOptions);
				//console.log(`[MEDIA_DEBUG] Response status: ${response.status}`);
				//console.log(`[MEDIA_DEBUG] Content-Type: ${response.headers.get('content-type')}`);
				if (!response.ok) {
					throw new Error(`HTTP error ${response.status} fetching direct URL`);
				}
			} else if (ipfsResource && !skipIpfsProcessing) {
				// Only try IPFS gateways if not skipping processing
				for (const gateway of IPFS_GATEWAYS) {
					httpUrlUsed = `${gateway}${ipfsResource}`;
					//console.log(`[MEDIA_DEBUG] Trying IPFS gateway: ${httpUrlUsed}`);
					try {
						response = await fetch(httpUrlUsed, fetchOptions);
						//console.log(`[MEDIA_DEBUG] Response status: ${response.status}`);
						//console.log(`[MEDIA_DEBUG] Content-Type: ${response.headers.get('content-type')}`);
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
					/*console.log(
						`[MEDIA_DEBUG] Failed to fetch from all IPFS gateways for resource: ${ipfsResource}`
					);*/
					throw new Error(`Failed to fetch from all IPFS gateways for resource: ${ipfsResource}`);
				}
			} else {
				//console.log(`[MEDIA_DEBUG] Invalid or empty URI provided: ${uri}`);
				throw new Error(`Invalid or empty URI provided: ${uri}`);
			}
		}

		const arrayBuffer = await response.arrayBuffer();
		buffer = Buffer.from(arrayBuffer);
		const fileTypeResult: FileTypeResult | undefined = await fileTypeFromBuffer(buffer);
		/*console.log(
			`[MEDIA_DEBUG] Detected file type: ${fileTypeResult ? fileTypeResult.mime : 'undefined'}`
		);*/
		if (!fileTypeResult) {
			// For files with no detectable type, check the Content-Type header
			const contentType = response.headers.get('content-type');
			if (contentType && (contentType.startsWith('image/') || contentType.startsWith('video/'))) {
				//console.log(`[MEDIA_DEBUG] Using Content-Type header for mime type: ${contentType}`);
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
				//console.log(`[MEDIA_DEBUG] Extracting image dimensions for ${fileName}`);
				const sharp = await getSharp();
				if (!sharp) {
					console.warn('[MEDIA_DEBUG] Sharp not available, skipping image dimension extraction');
					dimensions = null;
				} else {
					const metadata = await sharp(buffer).metadata();
					if (metadata.width && metadata.height) {
						dimensions = createDimensions(metadata.width, metadata.height);
						//console.log(`[MEDIA_DEBUG] Image dimensions: ${dimensions?.width}x${dimensions?.height}`);
					} else {
						//console.log(`[MEDIA_DEBUG] Image dimensions could not be determined from metadata`);
						dimensions = null;
					}
				}
			} catch (sharpError: unknown) {
				console.error(`[MEDIA_DEBUG] Error extracting image dimensions:`, sharpError);
				dimensions = null;
			}
		} else if (mimeType.startsWith('video/')) {
			try {
				//console.log(`[MEDIA_DEBUG] Extracting video dimensions for ${fileName}`);
				const videoDimensions = await getVideoDimensions(buffer);
				if (videoDimensions) {
					dimensions = createDimensions(videoDimensions.width, videoDimensions.height);
					//console.log(`[MEDIA_DEBUG] Video dimensions: ${dimensions?.width}x${dimensions?.height}`);
				} else {
					//console.log(`[MEDIA_DEBUG] Video dimensions could not be determined`);
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
		//console.log(`[MEDIA_DEBUG] Error fetching media for URI "${uri}": ${errorMessage}`);
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
		//console.log('[WEBP_CONVERT] Converting image to WebP format');
		const maxSizeBytes = maxSizeMB * 1024 * 1024;
		const originalSize = buffer.length;

		const sharp = await getSharp();
		if (!sharp) {
			console.warn('[WEBP_CONVERT] Sharp not available, returning original buffer');
			// Return original buffer if Sharp is not available
			return {
				buffer,
				mimeType: 'image/jpeg' // Assume JPEG as fallback
			};
		}

		// Don't do any conversion if the image is already small enough
		if (buffer.length <= maxSizeBytes) {
			//console.log('[WEBP_CONVERT] Image already small enough, skipping conversion');
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

		// Only reduce quality to 40% as minimum (was 60%)
		let currentQuality = quality;
		let attempts = 0;
		const maxAttempts = 5; // Increased from 3

		while (webpBuffer.length > maxSizeBytes && currentQuality > 40 && attempts < maxAttempts) {
			// Reduce quality by 10% each time, but don't go below 40
			currentQuality = Math.max(40, currentQuality - 10);
			attempts++;

			console.log(
				`[WEBP_CONVERT] File still too large (${(webpBuffer.length / 1024 / 1024).toFixed(2)}MB), reducing quality to ${currentQuality}`
			);

			webpBuffer = await sharp(buffer).webp({ quality: currentQuality }).toBuffer();

			if (webpBuffer.length <= maxSizeBytes) {
				//console.log('[WEBP_CONVERT] Quality reduction sufficient');
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
			while (webpBuffer.length > maxSizeBytes && attempts < 8) { // Increased from 5
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
			mimeType: 'image/jpeg' // Assume JPEG as fallback
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

		/*console.log(
			`[MEDIA_UPLOAD_DEBUG] Original aspect ratio: ${originalAspectRatio.toFixed(4)} (${originalDimensions.width}x${originalDimensions.height})`
		);
		console.log(
			`[MEDIA_UPLOAD_DEBUG] Uploaded aspect ratio: ${uploadedAspectRatio.toFixed(4)} (${uploadedDimensions.width}x${uploadedDimensions.height})`
		);
		console.log(
			`[MEDIA_UPLOAD_DEBUG] Aspect ratio difference: ${aspectRatioPercentDiff.toFixed(2)}%`
		);*/

		if (aspectRatioPercentDiff > 1) {
			console.warn(
				`[MEDIA_UPLOAD_DEBUG] WARNING: Aspect ratio changed by ${aspectRatioPercentDiff.toFixed(2)}% during upload!`
			);
		} else {
			//console.log('[MEDIA_UPLOAD_DEBUG] Aspect ratio successfully preserved ✓');
		}
	}
}

export async function handleMediaUpload(
	mediaUri: string,
	artwork: NftData,
	skipIpfsProcessing: boolean = false
): Promise<UploadResult | null> {
	if (!mediaUri || typeof mediaUri !== 'string') {
		return null;
	}

	// Store the original dimensions for later use
	let originalDimensions: Dimensions | null = artwork.dimensions || null;

	// Log artwork dimensions if available
	if (originalDimensions) {
		/*console.log(
			`[MEDIA_UPLOAD_DEBUG] Original artwork dimensions from metadata: ${originalDimensions.width}x${originalDimensions.height}`
		);*/
	}

	// Retry configuration
	const MAX_RETRIES = 3;
	const RETRY_DELAY = 2000; // 2 seconds
	let retryCount = 0;

	// Initialize return object fields for animated media
	let animated_url: string | undefined = undefined;
	let animation_fileType: string | undefined = undefined;


	// Special handling for Art Blocks URLs - these can be generators or images
	if (isArtBlocksUrl(mediaUri)) {
		const mediaTypeResult = getArtBlocksMediaType(mediaUri);

		// For generator URLs, we don't upload to Pinata as they're HTML
		if (mediaTypeResult === 'generator') {
			const dimensions = ensureDimensions(artwork.dimensions);
			return {
				url: mediaUri, // Primary URL will be the generator itself
				fileType: 'text/html',
				dimensions,
				animated_url: mediaUri, // Animated URL is also the generator
				animation_fileType: 'text/html'
			};
		}

		// For Art Blocks "image" type (never GIF, always a static image like PNG/JPG)
		if (mediaTypeResult === 'image') {
			retryCount = 0; // Reset retry count for this path
			while (retryCount < MAX_RETRIES) {
				try {
					const mediaData = await fetchMedia(mediaUri, skipIpfsProcessing);
					if (!mediaData || 'error' in mediaData) {
						throw new Error(`Failed to fetch Art Blocks image: ${mediaUri}`);
					}

					if (!isValidMimeType(mediaData.mimeType)) {
						throw new Error(
							`Invalid MIME type detected for Art Blocks image: ${mediaData.mimeType}`
						);
					}
					// Art Blocks images are static; no special animated handling needed here.
					// Convert to WebP if it's a non-SVG static image.
					let uploadBuffer = mediaData.buffer;
					let uploadMimeType = mediaData.mimeType;

					if (mediaData.mimeType.startsWith('image/') && !mediaData.mimeType.includes('svg')) {
						const dimensions = await getImageDimensionsFromBuffer(mediaData.buffer);
						originalDimensions = dimensions || originalDimensions;
						const webpResult = await convertToWebP(mediaData.buffer, dimensions, 80, 8);
						uploadBuffer = webpResult.buffer;
						uploadMimeType = webpResult.mimeType;
					}

					const imageDimensions = await getImageDimensionsFromBuffer(uploadBuffer);
					const uploadResult = await pinataUpload(
						uploadBuffer,
						artwork.name || mediaData.fileName || 'artwork',
						uploadMimeType,
						{
							tags: generateTags(
								artwork.name || mediaData.fileName || 'artwork',
								uploadMimeType,
								artwork.collection?.contract,
								artwork.tokenID
							)
						}
					);

					if (!uploadResult) {
						throw new Error('Pinata upload failed for Art Blocks image');
					}
					verifyAspectRatioPreservation(imageDimensions, uploadResult.dimensions);

					// For a static Art Blocks image, animated_url is not set.
					return {
						url: uploadResult.url,
						fileType: uploadMimeType,
						dimensions: uploadResult.dimensions,
						animated_url: undefined, // Explicitly undefined
						animation_fileType: undefined // Explicitly undefined
					};
				} catch (error) {
					console.error(
						`[MEDIA_UPLOAD_DEBUG] Art Blocks Image Attempt ${retryCount + 1} failed:`,
						error
					);
					retryCount++;
					if (retryCount < MAX_RETRIES) {
						await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
					} else {
						console.error(
							'[MEDIA_UPLOAD_DEBUG] All retry attempts failed for Art Blocks image. Using original URI.'
						);
						const mediaData = await fetchMedia(mediaUri, skipIpfsProcessing);
						if (mediaData && !('error' in mediaData)) {
							const dims = await getImageDimensionsFromBuffer(mediaData.buffer);
							return {
								url: mediaData.httpUrlUsed,
								fileType: mediaData.mimeType,
								dimensions: dims,
								animated_url: undefined,
								animation_fileType: undefined
							};
						}
						return { url: mediaUri, fileType: 'unknown', dimensions: null }; // Minimal fallback
					}
				}
			}
		}
	}

	// Regular media handling
	let fetchedMediaResult: FetchedMedia | FetchedMediaError | null;
	try {
		fetchedMediaResult = await fetchMedia(mediaUri, skipIpfsProcessing);
	} catch (error) {
		return null;
	}

	if (!fetchedMediaResult || 'error' in fetchedMediaResult) {
		const errorInfo = fetchedMediaResult as FetchedMediaError | null;
		// For HTML/PDF content that can't be fetched normally, return the URL directly
		// This could be considered "animated" or "interactive"
		if (errorInfo?.httpUrlUsed && typeof errorInfo.httpUrlUsed === 'string') {
			const detectedMediaType = getMediaType(
				errorInfo.message?.includes('application/pdf') ? 'application/pdf' : 'text/html'
			);

			if (detectedMediaType === 'interactive' || detectedMediaType === 'document') {
				const fileType = detectedMediaType === 'document' ? 'application/pdf' : 'text/html';
				return {
					url: errorInfo.httpUrlUsed, // Or placeholder?
					fileType: fileType,
					dimensions: null,
					animated_url: errorInfo.httpUrlUsed,
					animation_fileType: fileType
				};
			}
		}
		console.error(
			`[MEDIA_UPLOAD_DEBUG] Media fetch failed: ${errorInfo?.error}: ${errorInfo?.message}`
		);
		return null;
	}

	const fetchedMedia = fetchedMediaResult as FetchedMedia;
	if (!isValidMimeType(fetchedMedia.mimeType)) {
		return null;
	}

	const primaryMediaType = getMediaType(fetchedMedia.mimeType); // image, video, document, interactive, unknown
	let isPrimaryAnimated = primaryMediaType === 'video' || fetchedMedia.mimeType === 'image/gif';

	// Main media upload attempt (could be static image, video, or GIF)
	retryCount = 0; // Reset retry count for this new attempt
	let mainPinataUrl: string | null = null;
	let mainPinataFileType: string | null = null;
	let mainPinataDimensions: Dimensions | null = null;
	let mainUploadFailedDueToSize = false;

	while (retryCount < MAX_RETRIES) {
		try {
			let uploadBuffer = fetchedMedia.buffer;
			let uploadMimeType = fetchedMedia.mimeType;

			// Convert to WebP only for non-SVG, non-GIF, non-video (handled by Pinata) static images
			if (
				primaryMediaType === 'image' &&
				!fetchedMedia.mimeType.includes('svg') &&
				!isPrimaryAnimated // Don't convert if it's a GIF meant for animation_url
			) {
				const dimensions = await getImageDimensionsFromBuffer(fetchedMedia.buffer);
				originalDimensions = dimensions || originalDimensions; // Keep original dimensions
				
				// Check file size before attempting upload
				const fileSizeMB = fetchedMedia.buffer.length / (1024 * 1024);
				if (fileSizeMB > 10) {
					// Use more aggressive compression for large files
					const webpResult = await convertToWebP(fetchedMedia.buffer, dimensions, 60, 9.5);
					uploadBuffer = webpResult.buffer;
					uploadMimeType = webpResult.mimeType;
				} else {
					const webpResult = await convertToWebP(fetchedMedia.buffer, dimensions, 80, 8);
					uploadBuffer = webpResult.buffer;
					uploadMimeType = webpResult.mimeType;
				}
			}

			// For videos and GIFs, upload them as they are. Pinata will handle video processing.
			// For static images (even if original was GIF but we want a static WebP), upload the (potentially converted) buffer.

			const currentMediaDimensions =
				(await getImageDimensionsFromBuffer(uploadBuffer)) ??
				(await getVideoDimensions(uploadBuffer));

			const uploadResult = await pinataUpload(
				uploadBuffer,
				artwork.name || fetchedMedia.fileName || 'artwork',
				uploadMimeType, // This is important: use the actual type being uploaded
				{
					tags: generateTags(
						artwork.name || fetchedMedia.fileName || 'artwork',
						uploadMimeType,
						artwork.collection?.contract,
						artwork.tokenID
					)
				}
			);

			if (!uploadResult) {
				throw new Error('Pinata upload returned null');
			}

			verifyAspectRatioPreservation(currentMediaDimensions, uploadResult.dimensions);
			mainPinataUrl = uploadResult.url;
			mainPinataFileType = uploadMimeType; // This should be the mime type of what was sent to Pinata
			mainPinataDimensions = uploadResult.dimensions;
			break; // Success
		} catch (error: any) {
			
			// Check specifically for Pinata file size error
			const errorMessage = error?.message || error?.toString() || '';
			if (errorMessage.includes('File size too large') || errorMessage.includes('Maximum is 10485760')) {
				mainUploadFailedDueToSize = true;
				break; // Don't retry if it's a size issue
			}
			
			retryCount++;
			if (retryCount >= MAX_RETRIES) {
				mainUploadFailedDueToSize = true; // Assume failure is due to size or unrecoverable issue
			} else {
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
			}
		}
	}

	let finalDisplayUrl: string;
	let finalDisplayFileType: string;
	let finalDisplayDimensions: Dimensions | null;

	if (isPrimaryAnimated) {
		// The mediaUri was for an animation (video/gif)
		if (mainPinataUrl && mainPinataFileType) {
			animated_url = mainPinataUrl;
			animation_fileType = mainPinataFileType; // or fetchedMedia.mimeType if transformation occurred
		} else {
			// Pinata upload failed for the animation, use original IPFS/HTTP
			animated_url = fetchedMedia.httpUrlUsed;
			animation_fileType = fetchedMedia.mimeType;
		}

		// Now, determine the static display_url
		// Priority: artwork.image_url (fetched and uploaded) > Pinata poster > original animation URL (if nothing else)
		let staticImageUrlToProcess: string | null =
			artwork.image_url || artwork.display_image_url || null;
		if (staticImageUrlToProcess && staticImageUrlToProcess !== mediaUri) {
			// Avoid re-processing the same animated URI
			//console.log(`[MEDIA_UPLOAD_DEBUG] Animation detected. Trying to fetch and upload separate static image: ${staticImageUrlToProcess}`);
			const staticImageFetchResult = await fetchMedia(staticImageUrlToProcess, skipIpfsProcessing);
			if (staticImageFetchResult && !('error' in staticImageFetchResult)) {
				retryCount = 0;
				let staticPinataUrl: string | null = null;
				let staticPinataFileType: string | null = null;
				let staticPinataDimensions: Dimensions | null = null;
				let staticUploadFailedDueToSize = false;

				while (retryCount < MAX_RETRIES) {
					try {
						let staticUploadBuffer = staticImageFetchResult.buffer;
						let staticUploadMimeType = staticImageFetchResult.mimeType;
						if (
							staticUploadMimeType.startsWith('image/') &&
							!staticUploadMimeType.includes('svg') &&
							!staticUploadMimeType.includes('gif')
						) {
							const dims = await getImageDimensionsFromBuffer(staticImageFetchResult.buffer);
							
							// Check file size before attempting upload
							const staticFileSizeMB = staticImageFetchResult.buffer.length / (1024 * 1024);
							if (staticFileSizeMB > 10) {
								// Use more aggressive compression for large files
								const webpResult = await convertToWebP(staticImageFetchResult.buffer, dims, 60, 9.5);
								staticUploadBuffer = webpResult.buffer;
								staticUploadMimeType = webpResult.mimeType;
							} else {
								const webpResult = await convertToWebP(staticImageFetchResult.buffer, dims, 80, 8);
								staticUploadBuffer = webpResult.buffer;
								staticUploadMimeType = webpResult.mimeType;
							}
						}
						const staticImgDimensions = await getImageDimensionsFromBuffer(staticUploadBuffer);
						const staticUpload = await pinataUpload(
							staticUploadBuffer,
							(artwork.name || fetchedMedia.fileName || 'artwork') + '_static',
							staticUploadMimeType,
							{
								tags: generateTags(
									artwork.name || fetchedMedia.fileName || 'artwork',
									staticUploadMimeType,
									artwork.collection?.contract,
									artwork.tokenID
								)
							}
						);
						if (!staticUpload) throw new Error('Static image Pinata upload failed');
						verifyAspectRatioPreservation(staticImgDimensions, staticUpload.dimensions);
						staticPinataUrl = staticUpload.url;
						staticPinataFileType = staticUploadMimeType;
						staticPinataDimensions = staticUpload.dimensions;
						break;
					} catch (error: any) {
						console.error(
							`[MEDIA_UPLOAD_DEBUG] Static image upload attempt ${retryCount + 1} failed:`,
							error
						);
						
						// Check specifically for Pinata file size error
						const errorMessage = error?.message || error?.toString() || '';
						if (errorMessage.includes('File size too large') || errorMessage.includes('Maximum is 10485760')) {
							staticUploadFailedDueToSize = true;
							break; // Don't retry if it's a size issue
						}
						
						retryCount++;
						if (retryCount >= MAX_RETRIES) {
							staticUploadFailedDueToSize = true;
							break;
						}
						await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
					}
				}
				if (staticPinataUrl && staticPinataFileType) {
					finalDisplayUrl = staticPinataUrl;
					finalDisplayFileType = staticPinataFileType;
					finalDisplayDimensions = staticPinataDimensions;
				} else {
					// Static image from metadata failed to upload
					finalDisplayUrl = staticImageFetchResult.httpUrlUsed; // Fallback to its original IPFS/HTTP
					finalDisplayFileType = staticImageFetchResult.mimeType;
					finalDisplayDimensions = await getImageDimensionsFromBuffer(
						staticImageFetchResult.buffer
					);
				}
			} else {
				// No separate static image_url in metadata, or fetch failed.
				// What to use for display_url? Could be poster from Pinata if video, or just the animated_url itself.
				// For now, if it's a video on Pinata, Pinata might add a poster.
				// If it's a GIF, the animated_url is also the display_url.
				finalDisplayUrl = animated_url;
				finalDisplayFileType = animation_fileType!; // animation_fileType should be set if animated_url is
				finalDisplayDimensions =
					mainPinataDimensions ??
					(await getImageDimensionsFromBuffer(fetchedMedia.buffer)) ??
					(await getVideoDimensions(fetchedMedia.buffer));
				//console.log(`[MEDIA_UPLOAD_DEBUG] No separate static image; using animated media URL as display URL: ${finalDisplayUrl}`);
			}
		} else {
			// No artwork.image_url provided for the animated media.
			// The mainPinataUrl (if successful) is the animated media.
			// Use this as the primary display URL as well.
			finalDisplayUrl = animated_url!; // animated_url is already set from main upload
			finalDisplayFileType = animation_fileType!;
			finalDisplayDimensions =
				mainPinataDimensions ??
				(await getImageDimensionsFromBuffer(fetchedMedia.buffer)) ??
				(await getVideoDimensions(fetchedMedia.buffer));
			if (mainPinataUrl && primaryMediaType === 'video') {
				// Potentially, Pinata URL for video might have transformations for poster.
				// For now, url and animated_url are the same.
				//console.log(`[MEDIA_UPLOAD_DEBUG] Video uploaded to Pinata. Using its URL for both display and animation: ${mainPinataUrl}`);
			} else if (mainPinataUrl && isPrimaryAnimated) {
				// GIF case
				//console.log(`[MEDIA_UPLOAD_DEBUG] GIF uploaded to Pinata. Using its URL for both display and animation: ${mainPinataUrl}`);
			}
		}
	} else {
		// The mediaUri was for a static image
		if (mainPinataUrl && mainPinataFileType) {
			finalDisplayUrl = mainPinataUrl;
			finalDisplayFileType = mainPinataFileType;
			finalDisplayDimensions = mainPinataDimensions;
		} else {
			// Pinata upload failed for the static image, use original IPFS/HTTP
			finalDisplayUrl = fetchedMedia.httpUrlUsed;
			finalDisplayFileType = fetchedMedia.mimeType;
			finalDisplayDimensions = await getImageDimensionsFromBuffer(fetchedMedia.buffer);
		}
		// No animated_url in this case, unless artwork.animation_url was also present and processed separately (not part of this simplified flow yet)
	}

	// Fallback for dimensions if not fetched from Pinata or buffer
	if (!finalDisplayDimensions && originalDimensions) {
		finalDisplayDimensions = originalDimensions;
	}
	if (!finalDisplayDimensions && artwork.dimensions) {
		finalDisplayDimensions = ensureDimensions(artwork.dimensions);
	}

	/*console.log(
		`[MEDIA_UPLOAD_DEBUG] Final result: URL: ${finalDisplayUrl}, Type: ${finalDisplayFileType}, Animated URL: ${animated_url}, Anim Type: ${animation_fileType}`
	);*/

	return {
		url: finalDisplayUrl,
		fileType: finalDisplayFileType,
		dimensions: finalDisplayDimensions,
		animated_url: animated_url,
		animation_fileType: animation_fileType
	};
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
	//console.log('[RESIZE_MEDIA] Starting resizeMedia function');
	/*console.log(
		`[RESIZE_MEDIA] Input - MimeType: ${mimeType}, Dimensions: ${JSON.stringify(dimensions)}, MaxSizeMB: ${maxSizeMB}`
	);*/

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
		/*console.log(
			'[RESIZE_MEDIA] Using dimensions from buffer for resize:',
			JSON.stringify(dimensions)
		);*/
	}

	const MAX_DIMENSION = 4000; // Max width or height for Pinata
	const MAX_FILE_SIZE_BYTES = maxSizeMB * 1024 * 1024;

	try {
		let sizeMB = Buffer.byteLength(buffer) / (1024 * 1024);
		let attempt = 0;
		let resizedBuffer = buffer;
		let success = false; // Flag to track if resize loop completed successfully

		if (mimeType.startsWith('image/')) {
			const sharp = await getSharp();
			if (!sharp) {
				console.warn('[RESIZE_MEDIA] Sharp not available, cannot resize image');
				return null;
			}

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
				? (async () => {
					const sharp = await getSharp();
					if (!sharp) return dimensions;
					try {
						const metadata = await sharp(resizedBuffer).metadata();
						return createDimensions(metadata.width || dimensions?.width, metadata.height || dimensions?.height);
					} catch (error) {
						return dimensions;
					}
				})()
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

async function searchPinataByTag(tag: string): Promise<any | null> {
	// Configure Pinata on-demand
	try {
		//console.log(`[PINATA_SEARCH] Searching for assets with tag: ${tag}`);
		const searchResult = await new Promise<any>((resolve, reject) => {
			// Pinata search logic would be implemented here
			resolve(null); // Placeholder return, actual implementation needed
		});

		if (searchResult?.resources?.length > 0) {
			//console.log('[PINATA_DEBUG] Found existing resource with tag:', tag);
			return searchResult.resources[0];
		}
		return null;
	} catch (error) {
		return null;
	}
}

export async function uploadToPinata(
	fileStream: Buffer | NodeJS.ReadableStream,
	baseName: string,
	mimeType: string,
	tagsToApply?: string
): Promise<UploadResult | null> {
	try {
		// Convert stream to buffer if needed
		let buffer: Buffer;
		if (Buffer.isBuffer(fileStream)) {
			buffer = fileStream;
		} else {
			// Convert ReadableStream to Buffer
			const chunks: Buffer[] = [];
			for await (const chunk of fileStream) {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			}
			buffer = Buffer.concat(chunks);
		}

		// Create metadata from tags
		const metadata: Record<string, any> = {};
		if (tagsToApply) {
			const tags = tagsToApply.split(',');
			tags.forEach((tag, index) => {
				metadata[`tag_${index}`] = tag.trim();
			});
		}

		// Upload to Pinata
		const result = await pinataUpload(buffer, baseName, mimeType, metadata);
		
		if (!result) {
			return null;
		}

		return {
			url: result.url,
			fileType: result.fileType,
			dimensions: result.dimensions
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[PINATA_DEBUG] Error during upload: ${message}`);
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

/**
 * Get the dimensions of an existing Pinata image by its URL
 * @param imageUrl The URL of the Pinata image
 * @returns The width and height of the image, or null if dimensions couldn't be retrieved
 */
export async function getPinataImageDimensions(imageUrl: string): Promise<Dimensions | null> {
	// Configure Pinata on-demand
	if (!imageUrl || !imageUrl.includes('pinata.cloud')) {
		console.error('[PINATA_DEBUG] Invalid Pinata URL:', imageUrl);
		return null;
	}

	try {
		// Extract the public ID from the URL
		// Example URL: https://res.pinata.cloud/image/upload/v1234567890/compendium/image_name_12345678.jpg
		const urlParts = imageUrl.split('/');
		const uploadIndex = urlParts.indexOf('upload');

		if (uploadIndex === -1) {
			console.error('[PINATA_DEBUG] Could not parse Pinata URL:', imageUrl);
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

		//console.log('[PINATA_DEBUG] Extracted public ID:', publicId);

		// Use the Pinata API to get resource details
		const result = await new Promise<any>((resolve, reject) => {
			// Pinata image dimensions retrieval logic would be implemented here
			resolve(null); // Placeholder return, actual implementation needed
		});

		if (result && typeof result.width === 'number' && typeof result.height === 'number') {
			//console.log(`[PINATA_DEBUG] Found dimensions: ${result.width}x${result.height}`);
			return createDimensions(result.width, result.height);
		} else {
			console.error('[PINATA_DEBUG] Resource found but no dimensions:', result);
			return null;
		}
	} catch (error) {
		console.error('[PINATA_DEBUG] Error getting image dimensions:', error);
		return null;
	}
}

async function getImageDimensionsFromBuffer(buffer: Buffer): Promise<Dimensions | null> {
	try {
		if (!buffer || buffer.length === 0) {
			console.error('[DIMENSIONS_IMAGE_BUFFER] Empty buffer provided');
			return null;
		}

		// Validate that this is actually an image format before trying to process with Sharp
		const fileTypeResult = await fileTypeFromBuffer(buffer);

		if (!fileTypeResult || !fileTypeResult.mime.startsWith('image/')) {
			console.warn(
				'[DIMENSIONS_IMAGE_BUFFER] Buffer does not contain a valid image format:',
				fileTypeResult?.mime || 'unknown'
			);
			return null;
		}

		// Check if the detected format is supported by Sharp
		const supportedFormats = [
			'image/jpeg',
			'image/jpg',
			'image/png',
			'image/webp',
			'image/gif',
			'image/svg+xml',
			'image/tiff',
			'image/avif',
			'image/heif'
		];
		if (!supportedFormats.includes(fileTypeResult.mime)) {
			console.warn(
				`[DIMENSIONS_IMAGE_BUFFER] Unsupported image format for Sharp: ${fileTypeResult.mime}`
			);
			return null;
		}

		/*console.log(
			`[DIMENSIONS_IMAGE_BUFFER] Getting dimensions from ${fileTypeResult.mime} buffer of size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`
		);*/

		const sharp = await getSharp();
		if (!sharp) {
			console.warn('[DIMENSIONS_IMAGE_BUFFER] Sharp not available, skipping image dimension extraction');
			return null;
		}
		const metadata = await sharp(buffer).metadata();
		if (metadata.width && metadata.height) {
			/*console.log(
				`[DIMENSIONS_IMAGE_BUFFER] Successfully got dimensions: ${metadata.width}x${metadata.height}`
			);*/
			return { width: metadata.width, height: metadata.height };
		}

		console.warn('[DIMENSIONS_IMAGE_BUFFER] Could not extract width or height from metadata');
		//console.log('[DIMENSIONS_IMAGE_BUFFER] Available metadata:', metadata);
		return null; // Fallback if no dimensions found
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(
			`[DIMENSIONS_IMAGE_BUFFER] Error getting image dimensions from buffer: ${errorMessage}`
		);
		return null; // Fallback in case of error
	}
}
