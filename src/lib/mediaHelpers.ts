import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from '@ffprobe-installer/ffprobe';
import { fileTypeFromBuffer, type FileTypeResult } from 'file-type';
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary';

import { env } from '$env/dynamic/private';

// Import the moved utility functions
import {
	createHashForString,
	extensionFromMimeType,
	generateFileName,
	generateTags,
	removeQueryString,
	convertIpfsToHttpsUrl
} from './mediaUtils';

// Added Cloudinary initialization
cloudinary.config({
	// Use the public cloud name variable, also available privately
	cloud_name: env.PUBLIC_CLOUDINARY_CLOUD_NAME, 
	api_key: env.CLOUDINARY_API_KEY, 
	api_secret: env.CLOUDINARY_API_SECRET,
	secure: true
});

// Set the paths to the static binaries
if (typeof ffmpegPath === 'string') {
	ffmpeg.setFfmpegPath(ffmpegPath!);
} else {
	console.error("ffmpeg-static path is null or not a string.");
	// Handle error appropriately, maybe throw or disable features
}
if (typeof ffprobePath?.path === 'string') {
	ffmpeg.setFfprobePath(ffprobePath.path);
} else {
	console.error("@ffprobe-installer/ffprobe path is null or not a string.");
	// Handle error appropriately
}

// Add a list of IPFS gateways to try
const IPFS_GATEWAYS = [
	'https://gateway.pinata.cloud/ipfs/', // Added Pinata
	'https://nftstorage.link/ipfs/',     // Added NFT.Storage
	'https://dweb.link/ipfs/',           // Added Dweb
	'https://ipfs.io/ipfs/'              // Kept ipfs.io
	// Add more gateways here if needed
];

// Define simple dimension type
interface Dimensions {
	width: number | undefined;
	height: number | undefined;
}

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
	image_url?: string;
	display_image_url?: string;
	animation_url?: string;
	display_animation_url?: string;
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
	};
	symbol?: string;
	supply?: number;
	attributes?: any[];
	contractAddress?: string;
	dimensions?: { width?: number; height?: number };
	token_standard?: string;
	updated_at?: string | Date;
}

// Define return type for fetchMedia
interface FetchedMedia {
	buffer: Buffer;
	mimeType: string;
	fileName: string;
	dimensions: Dimensions | null;
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

export async function uploadToCloudinary(fileStream: Buffer | NodeJS.ReadableStream, baseName: string, mimeType: string, tagsToApply?: string): Promise<UploadResult | null> {
	// console.log(`[uploadToCloudinary] Uploading based on: ${baseName}, Mime: ${mimeType}`);

	try {
		const generatedFileName = generateFileName(baseName, mimeType);
		// console.log(`[uploadToCloudinary] Uploading as public_id: ${generatedFileName}...`);

		const uploadOptions: UploadApiOptions = {
			public_id: generatedFileName,
			folder: 'compendium',
			tags: tagsToApply ? tagsToApply.split(',') : undefined,
			resource_type: 'auto', // Let Cloudinary detect image/video
			overwrite: false, // Don't overwrite if public_id exists (existence check should handle this)
			use_filename: true, // Use the public_id as the base filename
			unique_filename: false // We are generating a unique name, don't let Cloudinary add random chars
		};

		// --- DEBUG LOG: Options before upload ---
		// console.log(`[DEBUG][uploadToCloudinary] Uploading. Options:`, JSON.stringify({
		// ... existing code ...


		const uploadPromise = new Promise<UploadApiResponse | undefined>((resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
				if (error) {
					console.error('[uploadToCloudinary] Cloudinary upload stream error:', error);
					reject(error);
				} else {
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

		// --- DEBUG LOG: Raw response from Cloudinary ---
		// console.log(`[DEBUG][uploadToCloudinary] Raw response for ${generatedFileName}:`, JSON.stringify(response));

		if (response && response.secure_url) {
			const dimensions: Dimensions | null = response.height && response.width ? { height: response.height, width: response.width } : null;
			// Determine a general fileType ('image', 'video', 'raw') based on resource_type or mimeType
			let fileType = 'raw'; // Default
			if (response.resource_type === 'image') fileType = 'image';
			else if (response.resource_type === 'video') fileType = 'video';
			else if (mimeType.startsWith('image/')) fileType = 'image';
			else if (mimeType.startsWith('video/')) fileType = 'video';

			const result: UploadResult = {
				url: response.secure_url.split('?')[0], // Use secure_url and remove query params if any
				fileType: fileType, // Use determined file type
				dimensions
			};

			// --- DEBUG LOG: Result returned by uploadToCloudinary ---
			// console.log(`[DEBUG][uploadToCloudinary] Returning result for ${generatedFileName}:`, JSON.stringify(result));

			return result;
		} else {
			console.error('[uploadToCloudinary] Cloudinary upload failed or returned no secure_url. Response:', response);
			// Throw error if response is missing or doesn't contain secure_url
			throw new Error(`Cloudinary upload failed with response: ${JSON.stringify(response)}`);
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[uploadToCloudinary] Error during Cloudinary upload: ${message}`);
		// Rethrow or handle specific errors as needed
		// For now, return null to indicate failure to the caller
		return null;
	}
}

export async function normalizeOpenSeaMetadata(nft: NftData): Promise<any> {
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

export async function normalizeTezosMetadata(nft: NftData): Promise<any> {
	const metadata = nft.metadata || {};
	const creator: NftCreator = (nft.creators && nft.creators.length > 0 ? nft.creators[0] : {});
	const holder = creator.holder || {}; // Handle potential undefined holder

	return {
		name: metadata.name || nft.name || 'Unknown Name',
		tokenID:
			nft.tokenId || nft.tokenID || metadata.tokenId || metadata.tokenID || 'Unknown Token ID',
		description: metadata.description || nft.description || 'No Description Available',
		artist: {
			address: creator.creator_address || '',
			username: holder.alias || '',
			bio: holder.description || '',
			avatarUrl: holder.logo || '',
			website: holder.website || '',
			social_media_accounts: {
				twitter: holder.twitter || '',
				instagram: holder.instagram || ''
			}
		},
		platform: 'Tezos',
		mime: nft.mime || '',
		image_url: nft.image_url,
		animation_url: nft.animation_url,
		tags: metadata.tags || [],
		website: holder.website || '',
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
				console.warn(`Retry ${i + 1}/${retries} for ${url} failed: ${message}. Retrying in ${delay}ms...`);
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
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
				console.log(`[MEDIA_DEBUG] Failed to fetch from all IPFS gateways for resource: ${ipfsResource}`);
				throw new Error(`Failed to fetch from all IPFS gateways for resource: ${ipfsResource}`);
			}
		} else {
			console.log(`[MEDIA_DEBUG] Invalid or empty URI provided: ${uri}`);
			throw new Error(`Invalid or empty URI provided: ${uri}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		buffer = Buffer.from(arrayBuffer);
		const fileTypeResult: FileTypeResult | undefined = await fileTypeFromBuffer(buffer);
		console.log(`[MEDIA_DEBUG] Detected file type: ${fileTypeResult ? fileTypeResult.mime : 'undefined'}`);
		if (!fileTypeResult) {
			return { httpUrlUsed: httpUrlUsed, error: 'type_detection_error', message: `Could not determine file type for ${httpUrlUsed}` };
		}

		const mimeType = fileTypeResult.mime;

		if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
			return { httpUrlUsed: httpUrlUsed, error: 'unsupported_type', message: `Unsupported media type: ${mimeType}` };
		}

		let fileName;
		try {
			if (!httpUrlUsed) { throw new Error('httpUrlUsed is undefined before creating filename'); }
			fileName = path.basename(new URL(httpUrlUsed).pathname);
			if (!fileName.includes('.') || path.extname(fileName).substring(1) !== fileTypeResult.ext) {
				fileName = `${fileName}.${fileTypeResult.ext}`;
			}
		} catch (e) {
			const hash = crypto.createHash('sha256').update(buffer).digest('hex');
			fileName = `${hash}.${fileTypeResult.ext}`;
		}

		let dimensions = null;

		if (mimeType.startsWith('image/')) {
			try {
				const metadata = await sharp(buffer).metadata();
				dimensions = { width: metadata.width, height: metadata.height };
			} catch (sharpError: unknown) {
			}
		} else if (mimeType.startsWith('video/')) {
			try {
				dimensions = await getVideoDimensions(buffer);
			} catch (videoError: unknown) {
			}
		}

		if (!httpUrlUsed) { 
			throw new Error('httpUrlUsed is undefined before successful return'); 
		}

		return {
			buffer,
			mimeType,
			fileName,
			dimensions,
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
				fs.unlink(tmpFile).catch(unlinkErr => console.error(`Error unlinking temp file ${tmpFile}:`, unlinkErr)); // Clean up the temp file, handle unlink error
				if (err) {
					reject(`Error processing video with ffmpeg: ${err.message}`);
				} else {
					const stream = metadata?.streams?.find((s) => s.codec_type === 'video' && s.width && s.height);
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
		fs.unlink(tmpFile).catch(unlinkErr => console.error(`Error unlinking temp file ${tmpFile} after write error:`, unlinkErr));
		return null; // Or throw error
	}
}

export async function handleMediaUpload(mediaUri: string, artwork: NftData): Promise<UploadResult | null> {
	// 1. Fetch Media
	let fetchedMediaResult: FetchedMedia | FetchedMediaError | null;
	try {
		fetchedMediaResult = await fetchMedia(mediaUri);
		// console.log(`[DEBUG][handleMediaUpload] Received result for ${mediaUri}. Type: ${typeof fetchedMediaResult}. Is error obj: ${fetchedMediaResult && typeof fetchedMediaResult === 'object' && 'error' in fetchedMediaResult}`);
	} catch (fetchError: unknown) {
		// This catch block might be redundant if fetchMedia now returns error objects
		// But keep it for safety in case of unexpected throws within fetchMedia itself
		const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
		console.error(`[handleMediaUpload] Unexpected error during fetchMedia call for ${mediaUri}: ${message}`);
		return null;
	}

	// Handle errors returned by fetchMedia
	if (!fetchedMediaResult || (fetchedMediaResult && 'error' in fetchedMediaResult)) {
		const errorInfo = fetchedMediaResult as FetchedMediaError | null;
		
		// Explicitly check if errorInfo exists and has a non-empty httpUrlUsed
		const hasErrorInfo = !!errorInfo;
		const hasUrl = !!(errorInfo && errorInfo.httpUrlUsed && typeof errorInfo.httpUrlUsed === 'string' && errorInfo.httpUrlUsed.length > 0);
		// console.log(`[DEBUG][handleMediaUpload] Error check: hasErrorInfo=${hasErrorInfo}, hasUrl=${hasUrl}`);

		if (hasErrorInfo && hasUrl) {
			// Log ENTRY and values
			// console.log(`[DEBUG][handleMediaUpload] Entered error handling block for error='${errorInfo.error}'. httpUrlUsed='${errorInfo.httpUrlUsed}'.`); 
			// console.log(`[handleMediaUpload] fetchMedia reported error ('${errorInfo.error}') but provided a URL for URI: ${mediaUri}. Assuming HTML/interactive.`);
			const assumedMime = errorInfo.message?.includes('application/pdf') ? 'application/pdf' : 'text/html'; 
			
			// Ensure httpUrlUsed is valid string before assignment (already checked by hasUrl, but to satisfy linter)
			if (typeof errorInfo.httpUrlUsed !== 'string' || errorInfo.httpUrlUsed.length === 0) {
				console.error('[handleMediaUpload] Inconsistent state: hasUrl was true but httpUrlUsed is invalid.');
				return null; // Should not happen
			}

			const result: UploadResult = {
				url: errorInfo.httpUrlUsed, 
				fileType: assumedMime, // Indicate it's likely interactive content
				dimensions: null // No dimensions applicable
			};
			// console.log('[handleMediaUpload] Returning assumed result:', JSON.stringify(result));
			return result;
		} else {
			// Log ENTRY into the ELSE block
			// console.log(`[DEBUG][handleMediaUpload] Entered ELSE block for error handling. errorInfo:`, JSON.stringify(errorInfo));
			const errorMsg = errorInfo ? `${errorInfo.error}: ${errorInfo.message}` : 'fetchMedia returned null';
			console.error(`[handleMediaUpload] fetchMedia failed definitively for URI: ${mediaUri}. Error: ${errorMsg}`);
			console.log('[handleMediaUpload] Returning null due to fetch error or null result.');
			return null;
		}
	}

	// Type assertion: If we reach here, it must be a successful FetchedMedia result
	const fetchedMedia = fetchedMediaResult as FetchedMedia;

	// console.log(`[handleMediaUpload] fetchMedia successful for ${mediaUri}. Mime: ${fetchedMedia.mimeType}, Proceeding with Cloudinary check/upload.`);

	const { buffer: originalBuffer, mimeType, fileName: originalFileNameFromFetch, dimensions: originalDimensions } = fetchedMedia;
	// Use the base name for tags and processing, generate filename separately if needed for upload
	const nameForProcessing = artwork?.metadata?.name || artwork?.name || originalFileNameFromFetch || 'untitled';
	
	// Generate tags including the unique mediaHash
	const tagsToSearch = generateTags(nameForProcessing, mimeType, artwork.collection?.contract, artwork.tokenID);
	// Extract the mediaHash tag for the specific search (assuming it's the first tag)
	const mediaHashTag = tagsToSearch.split(',').find(tag => tag.startsWith('mediaHash:'));

	// 2. Check Existence in Cloudinary using the specific mediaHash TAG
	let existingFileResult: UploadResult | null = null;
	if (mediaHashTag) { // Only search if we have the hash tag
		try {
			// console.log(`[handleMediaUpload] Searching Cloudinary for existing file with tag: ${mediaHashTag}`);
			// Search using the single mediaHash tag
			const searchResult = await cloudinary.search
				.expression(`tags:${mediaHashTag}`)
				.max_results(1) // We only need one match
				.execute();

			// console.log(`[handleMediaUpload] Cloudinary search found ${searchResult.total_count ?? 0} files with matching tag.`);

			if (searchResult.resources && searchResult.resources.length > 0) {
				const existingFile = searchResult.resources[0];
				// console.log(
				//     `[handleMediaUpload] Found existing file in Cloudinary via tag ${mediaHashTag}: ${existingFile.secure_url}`
				// );
				// Determine general fileType
				let fileType = 'raw';
				if (existingFile.resource_type === 'image') fileType = 'image';
				else if (existingFile.resource_type === 'video') fileType = 'video';

				existingFileResult = {
					url: existingFile.secure_url, // Use secure_url
					fileType: fileType,
					dimensions: { height: existingFile.height, width: existingFile.width }
				};
				return existingFileResult; // Return if found
			}
		} catch (searchError: unknown) {
			const message = searchError instanceof Error ? searchError.message : String(searchError);
			// Log specific Cloudinary search errors if possible
			if (searchError && typeof searchError === 'object' && 'error' in searchError) {
 				const cldError = searchError as { error: { message: string } };
 				console.error(`[handleMediaUpload] Cloudinary search API error for tag ${mediaHashTag}: ${cldError.error.message}`);
 			} else {
 				console.error(`[handleMediaUpload] Error searching Cloudinary for tag ${mediaHashTag}: ${message}`);
 			}
		}
	} else {
		// console.warn(`[handleMediaUpload] Could not generate mediaHash tag for ${nameForProcessing} / ${mimeType}. Skipping duplicate check.`);
	}

	// --- File Not Found by mediaHash Tag - Proceed with Resize/Upload ---
	const generatedFileNameForUpload = generateFileName(nameForProcessing, mimeType); // Regenerate filename for upload call consistency
	// console.log(`[handleMediaUpload] File with tag ${mediaHashTag || 'N/A'} not found in Cloudinary. Proceeding with processing/upload as ${generatedFileNameForUpload}.`);
	let bufferToUpload = originalBuffer;
	let finalDimensions = originalDimensions;
	const MAX_SIZE_MB = 25;

	try {
		// 3. Conditional Resize (If Not Found)
		const sizeMB = originalBuffer.length / (1024 * 1024);
		// Check mimeType directly for image/video, ignore MAX_SIZE_MB for videos here as resizeMedia handles video size check
		const needsResize = mimeType.startsWith('image/') || mimeType.startsWith('video/'); // Resize will check size internally

		if (needsResize) {
			// console.log(`[handleMediaUpload] Attempting resize for ${generatedFileNameForUpload} (Original Size: ${sizeMB.toFixed(2)}MB, Type: ${mimeType})`);
			try {
				// Pass MAX_SIZE_MB to resizeMedia
				const resizeResult = await resizeMedia(originalBuffer, mimeType, originalDimensions, MAX_SIZE_MB);
				if (resizeResult && resizeResult.buffer) {
					// Check if buffer actually changed size (resize might skip if already small enough)
					if (resizeResult.buffer.length !== originalBuffer.length) {
						bufferToUpload = resizeResult.buffer;
						finalDimensions = resizeResult.dimensions ?? finalDimensions; // Use dimensions from resize result
						// console.log(`[handleMediaUpload] Resized buffer size: ${(bufferToUpload.length / (1024 * 1024)).toFixed(2)}MB`);
					} else {
						// console.log(`[handleMediaUpload] resizeMedia returned original buffer for ${generatedFileNameForUpload}, likely already within size limits.`);
						// Keep original buffer and dimensions
						bufferToUpload = originalBuffer;
						finalDimensions = originalDimensions;
					}
				} else {
					// Log failure but proceed with original buffer
					// console.warn(`[handleMediaUpload] resizeMedia returned null or no buffer for ${generatedFileNameForUpload}. Attempting upload with original buffer.`);
					bufferToUpload = originalBuffer; // Fallback
					finalDimensions = originalDimensions; // Use original dimensions
				}
			} catch (resizeError: unknown) {
				// Log error but proceed with original buffer
				const resizeMsg = resizeError instanceof Error ? resizeError.message : String(resizeError);
				// console.warn(`[handleMediaUpload] Error during resizeMedia for ${generatedFileNameForUpload}: ${resizeMsg}. Attempting upload with original buffer.`);
				bufferToUpload = originalBuffer; // Fallback
				finalDimensions = originalDimensions; // Use original dimensions
			}
		} else {
			// console.log(`[handleMediaUpload] Skipping resize for ${generatedFileNameForUpload} (Size: ${sizeMB.toFixed(2)}MB, Type: ${mimeType})`);
		}


		// 4. Conditional Upload (If Not Found)
		// console.log(`[handleMediaUpload] Attempting upload for ${generatedFileNameForUpload}...`);
		// Pass all generated tags (including mediaHash) to uploadToCloudinary for organization
		const uploadResult = await uploadToCloudinary(bufferToUpload, nameForProcessing, mimeType, tagsToSearch);

		if (!uploadResult || !uploadResult.url) {
			console.error(`[handleMediaUpload] uploadToCloudinary failed for ${nameForProcessing}`);
			return null; // Upload failed
		}

		// console.log(
		//     `[handleMediaUpload] uploadToCloudinary successful for ${nameForProcessing}. URL: ${uploadResult.url}`
		// );

		// 5. Return URL and Details
		// Prioritize dimensions calculated *after* potential resize (finalDimensions)
		// Fallback to dimensions reported by Cloudinary if resize didn't happen or failed
		const returnDimensions = (finalDimensions?.width && finalDimensions.width > 0) ? finalDimensions : uploadResult.dimensions;
		const finalResult: UploadResult = {
			url: uploadResult.url,
			fileType: uploadResult.fileType, // Use fileType determined by uploadToCloudinary
			dimensions: returnDimensions
		};
		// console.log('[handleMediaUpload] Returning final Cloudinary upload result:', JSON.stringify(finalResult));
		return finalResult;
	} catch (processingError: unknown) { // Catch errors from resize or upload attempt
		const message = processingError instanceof Error ? processingError.message : String(processingError);
		console.error(
			`[handleMediaUpload] Error during media processing/upload for ${generatedFileNameForUpload}: ${message}`
		);
		return null;
	}
}

interface ResizeResult {
	buffer: Buffer;
	dimensions: Dimensions;
}

export async function resizeMedia(buffer: Buffer, mimeType: string, dimensions: Dimensions | null, maxSizeMB = 25): Promise<ResizeResult | null> {
	// Check if dimensions are valid at the start
	if (!dimensions || typeof dimensions.width !== 'number' || typeof dimensions.height !== 'number' || dimensions.width <= 0 || dimensions.height <= 0) {
        // console.warn("[resizeMedia] Invalid or missing dimensions provided, skipping resize.", dimensions);
        // Return original buffer and best-effort dimensions if skipping, but indicate potential issue by returning maybe null?
		// Let's return null to indicate resize wasn't properly possible due to bad input
		return null;
    }

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
					throw new Error("Invalid dimensions for scaling");
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
					throw new Error("Invalid dimensions for scaling");
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
										.then(resized => {
											// Clean up both files
											Promise.all([fs.unlink(tmpInputFile), fs.unlink(tmpOutputFile)])
												.catch(unlinkErr => console.error(`Error unlinking temp files:`, unlinkErr));
											resolve(resized);
										})
										.catch(readErr => {
											// Clean up both files even if read fails
											Promise.all([fs.unlink(tmpInputFile), fs.unlink(tmpOutputFile)])
												.catch(unlinkErr => console.error(`Error unlinking temp files after read error:`, unlinkErr));
											reject(`Error reading resized file: ${readErr}`);
										});
								});
						})
						.catch(writeErr => {
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
		const finalDimensions = await (mimeType.startsWith('image/') ? sharp(resizedBuffer).metadata().then(m => ({width: m.width, height: m.height})) : getVideoDimensions(resizedBuffer))
				.catch(e => {
					// console.error("[resizeMedia] Failed to get dimensions after resize/processing:", e);
					return null; // Return null if dimension extraction fails
				});

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