import { env } from '$env/dynamic/private';

/**
 * Interface for Pinata API pin response
 */
interface PinataResponse {
	IpfsHash: string;
	PinSize: number;
	Timestamp: string;
	isDuplicate?: boolean;
	error?: string;
	status?: string;
}

/**
 * Interface for Pinata API pin list response
 */
interface PinataPinListResponse {
	count: number;
	rows: Array<{
		id: string;
		ipfs_pin_hash: string;
		size: number;
		user_id: string;
		date_pinned: string;
		date_unpinned: string | null;
		metadata: {
			name: string;
			keyvalues: Record<string, string>;
		};
	}>;
}

/**
 * Extract CID from various IPFS URL formats
 * @param url - The URL or CID string to extract from
 * @returns The extracted CID or null if not found
 */
export function extractCidFromUrl(url: string): string | null {
	if (!url) return null;

	// Clean the URL by removing any leading/trailing whitespace
	url = url.trim();

	// If it's already just a CID (starts with Qm or bafy), extract only the CID part
	if (url.startsWith('Qm') || url.startsWith('bafy')) {
		// Remove any query parameters or fragments that might be appended
		const cidMatch = url.match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{55})/);
		return cidMatch ? cidMatch[1] : null;
	}

	// Handle ipfs:// protocol
	if (url.startsWith('ipfs://')) {
		const withoutProtocol = url.replace('ipfs://', '');
		// Extract only the CID part, removing any path, query params, or fragments
		const cidMatch = withoutProtocol.match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{55})/);
		return cidMatch ? cidMatch[1] : null;
	}

	// Handle gateway URLs
	const gatewayRegex = /https?:\/\/[^/]+\/ipfs\/([^/?#]+)/;
	const match = url.match(gatewayRegex);
	if (match && match[1]) {
		// Extract only the CID part from the matched group
		const cidMatch = match[1].match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{55})/);
		return cidMatch ? cidMatch[1] : null;
	}

	return null;
}

/**
 * Get the Pinata gateway URL from environment variables
 * @returns The configured Pinata gateway URL
 *
 * Environment variable format:
 * - PINATA_GATEWAY: Your subdomain (e.g., 'my-gateway') for https://my-gateway.mypinata.cloud/ipfs/
 * - If not provided, falls back to the public gateway
 */
export function getPinataGateway(): string {
	const gateway = env.PINATA_GATEWAY;
	if (gateway) {
		// Support both subdomain format and full URL format
		if (gateway.startsWith('http')) {
			// Full URL provided (e.g., 'https://my-gateway.mypinata.cloud/ipfs/')
			return gateway.endsWith('/') ? gateway : `${gateway}/`;
		} else {
			// Subdomain format (e.g., 'my-gateway')
			return `https://${gateway}.mypinata.cloud/ipfs/`;
		}
	}
	return 'https://gateway.pinata.cloud/ipfs/';
}

/**
 * Pin a single CID to Pinata
 * @param cid - The CID to pin
 * @param name - Optional name for the pin
 * @param keyValues - Optional key-value metadata
 * @returns The pin response or error
 */
export async function pinCidToPinata(
	cid: string,
	name?: string,
	keyValues?: Record<string, string>
): Promise<PinataResponse> {
	try {
		const jwt = env.PINATA_JWT;

		if (!jwt) {
			throw new Error('Pinata JWT not found in environment variables');
		}

		// Extract CID if it's a URL
		const extractedCid = extractCidFromUrl(cid);
		if (!extractedCid) {
			throw new Error(`Invalid CID or IPFS URL: ${cid}`);
		}

		console.log(`[PINATA_PIN] Starting pin for CID: ${extractedCid} with name: ${name || 'unnamed'}`);

		// Get group ID from environment variable if available
		const groupId = env.PINATA_GROUP || '';
		if (groupId) {
			console.log(`[PINATA_PIN] Using Pinata group ID from environment: ${groupId}`);
		}

		// Format metadata correctly for Pinata v3 API
		const metadata: Record<string, any> = {
			name: name || `Pinned CID ${extractedCid}`
		};

		// Only include keyvalues if there are actual values
		if (keyValues && Object.keys(keyValues).length > 0) {
			metadata.keyvalues = keyValues;
		}

		// Create payload for v3 API - pay attention to JSON structure
		const payload: Record<string, any> = {
			hashToPin: extractedCid,
			pinataMetadata: metadata
		};

		if (groupId) {
			payload.pinataOptions = {
				groupId: groupId
			};
		}

		console.log(`[PINATA_PIN] Payload:`, JSON.stringify(payload, null, 2));

		// Using the v3 API endpoint for pinning by CID
		const response = await fetch('https://api.pinata.cloud/pinning/pinByHash', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${jwt}`
			},
			body: JSON.stringify(payload)
		});

		const responseText = await response.text();
		console.log(`[PINATA_PIN] API response status: ${response.status} ${response.statusText}`);
		console.log(`[PINATA_PIN] API response body: ${responseText}`);

		if (!response.ok) {
			let errorData;
			try {
				errorData = JSON.parse(responseText);
			} catch (e) {
				errorData = { error: responseText };
			}

			console.error(`[PINATA_PIN] Pinning failed for CID ${extractedCid}:`, errorData);
			return {
				error: `Pinata error: ${errorData.error || response.statusText}`,
				IpfsHash: extractedCid,
				PinSize: 0,
				Timestamp: new Date().toISOString()
			};
		}

		let result;
		try {
			result = JSON.parse(responseText);
			// Handle v2 vs v3 API response formats
			if (result.id) {
				// v3 API response has 'id' field
				console.log(`[PINATA_PIN] Successfully pinned CID ${extractedCid} with ID: ${result.id}`);
				result = {
					IpfsHash: extractedCid,
					PinSize: 0, // Size not provided in v3 API
					Timestamp: new Date().toISOString(),
					isDuplicate: false,
					status: 'pinned'
				};
			}
		} catch (e) {
			console.error(`[PINATA_PIN] Error parsing Pinata response for CID ${extractedCid}:`, e);
			result = {};
		}

		console.log(`[PINATA_PIN] Final result for CID ${extractedCid}:`, result);

		return {
			...result,
			IpfsHash: extractedCid,
			PinSize: result.PinSize || 0,
			Timestamp: result.Timestamp || new Date().toISOString(),
			status: result.status || 'pinned'
		};
	} catch (error) {
		console.error(`[PINATA_PIN] Error pinning CID ${cid} to Pinata:`, error);
		return {
			error: error instanceof Error ? error.message : String(error),
			IpfsHash: cid,
			PinSize: 0,
			Timestamp: new Date().toISOString()
		};
	}
}

/**
 * Get list of pins from Pinata
 * @param limit - Number of pins to retrieve
 * @param offset - Offset for pagination
 * @returns The list of pins or error
 */
export async function getPinataPins(
	limit: number = 100,
	offset: number = 0
): Promise<PinataPinListResponse> {
	try {
		const jwt = env.PINATA_JWT;

		if (!jwt) {
			throw new Error('Pinata JWT not found in environment variables');
		}

		console.log(`Fetching pins with limit: ${limit}, offset: ${offset}`);

		const response = await fetch(
			`https://api.pinata.cloud/pinning/pinList?status=pinned&pageLimit=${limit}&pageOffset=${offset}`,
			{
				method: 'GET',
				headers: {
					Authorization: `Bearer ${jwt}`
				}
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Pinata API error: ${response.status} ${response.statusText}`, errorText);
			throw new Error(`Pinata API error: ${response.statusText}`);
		}

		const data = await response.json();
		console.log(`Fetched ${data.count} pins from Pinata`);
		return data;
	} catch (error) {
		console.error('Error fetching Pinata pins:', error);
		throw error;
	}
}

/**
 * Check if a CID is already pinned
 * @param cid - The CID to check
 * @returns Boolean indicating if the CID is pinned
 */
export async function isCidPinned(cid: string): Promise<boolean> {
	try {
		const extractedCid = extractCidFromUrl(cid);
		if (!extractedCid) return false;

		const jwt = env.PINATA_JWT;

		if (!jwt) {
			throw new Error('Pinata JWT not found in environment variables');
		}

		console.log(`Checking if CID is pinned: ${extractedCid}`);

		// Use the correct v3 API endpoint with network parameter and cid query parameter
		const response = await fetch(`https://api.pinata.cloud/v3/files/public?cid=${extractedCid}`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${jwt}`
			}
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Pinata API error: ${response.status} ${response.statusText}`, errorText);
			throw new Error(`Pinata API error: ${response.statusText}`);
		}

		const data = await response.json();
		const isPinned = data.data && data.data.files && data.data.files.length > 0;
		console.log(`CID ${extractedCid} is ${isPinned ? 'already' : 'not'} pinned`);
		return isPinned;
	} catch (error) {
		console.error('Error checking if CID is pinned:', error);
		return false;
	}
}

/**
 * Extract all IPFS CIDs from an artwork object
 * @param artwork - The artwork object to extract CIDs from
 * @returns Array of unique CIDs found in the artwork
 */
export function extractCidsFromArtwork(artwork: any): string[] {
	const cids = new Set<string>();
	const foundUrls: string[] = [];

	// URL fields from the Artwork model schema
	const artworkModelFields = [
		'imageUrl',
		'animationUrl', 
		'thumbnailUrl',
		'metadataUrl'
	];

	// Common API response fields that might contain IPFS URLs
	const commonApiFields = [
		'image_url',
		'animation_url',
		'thumbnail_url',
		'metadata_url',
		'image_original_url',
		'display_uri',
		'artifact_uri',
		'thumbnail_uri',
		'displayUri',
		'artifactUri',
		'thumbnailUri',
		'display_image_url',
		'display_animation_url',
		// Additional fields that might contain IPFS URLs
		'external_url',
		'externalUrl',
		'generator_url',
		'generatorUrl',
		'html_url',
		'htmlUrl',
		'code_url',
		'codeUrl'
	];

	// Combine all fields to check
	const fieldsToCheck = [...artworkModelFields, ...commonApiFields];

	// Helper function to extract and log CIDs
	const extractAndLog = (url: string, source: string) => {
		if (url && typeof url === 'string') {
			foundUrls.push(`${source}: ${url}`);
			const cid = extractCidFromUrl(url);
			if (cid) {
				cids.add(cid);
				console.log(`[CID_EXTRACTION] Found CID ${cid} from ${source}: ${url}`);
			}
		}
	};

	// Check main fields on the artwork object
	for (const field of fieldsToCheck) {
		if (artwork[field]) {
			extractAndLog(artwork[field], `artwork.${field}`);
		}
	}

	// Check nested metadata if available
	if (artwork.metadata && typeof artwork.metadata === 'object') {
		for (const field of fieldsToCheck) {
			if (artwork.metadata[field]) {
				extractAndLog(artwork.metadata[field], `artwork.metadata.${field}`);
			}
		}

		// Check for additional metadata patterns
		if (artwork.metadata.image) {
			extractAndLog(artwork.metadata.image, 'artwork.metadata.image');
		}
		if (artwork.metadata.animation) {
			extractAndLog(artwork.metadata.animation, 'artwork.metadata.animation');
		}
	}

	// Check additional nested structures that might contain IPFS URLs
	if (artwork.token && typeof artwork.token === 'object') {
		for (const field of fieldsToCheck) {
			if (artwork.token[field]) {
				extractAndLog(artwork.token[field], `artwork.token.${field}`);
			}
		}
	}

	// Check for Art Blocks or generative art specific fields
	if (artwork.generator_url || artwork.generatorUrl) {
		extractAndLog(artwork.generator_url || artwork.generatorUrl, 'artwork.generator_url');
	}

	// Check for any field that might contain 'ipfs://' or gateway URLs
	const checkForIpfsUrls = (obj: any, prefix: string = '') => {
		if (!obj || typeof obj !== 'object') return;
		
		for (const [key, value] of Object.entries(obj)) {
			if (typeof value === 'string' && (value.includes('ipfs://') || value.includes('/ipfs/'))) {
				extractAndLog(value, `${prefix}${key}`);
			} else if (typeof value === 'object' && value !== null) {
				checkForIpfsUrls(value, `${prefix}${key}.`);
			}
		}
	};

	// Deep scan for any IPFS URLs
	checkForIpfsUrls(artwork, 'artwork.');

	console.log(`[CID_EXTRACTION] Artwork "${artwork.title || artwork.name || 'Unknown'}" - Found ${foundUrls.length} URLs, extracted ${cids.size} unique CIDs`);
	if (foundUrls.length > 0) {
		console.log(`[CID_EXTRACTION] All URLs found:`, foundUrls);
	} else {
		console.log(`[CID_EXTRACTION] No URLs found in artwork object. Checked fields:`, fieldsToCheck);
		console.log(`[CID_EXTRACTION] Artwork object keys:`, Object.keys(artwork));
	}

	return Array.from(cids);
}

/**
 * Unpin a file from Pinata by CID
 * @param cid - The CID to unpin
 * @returns Object with success status and details about what happened
 */
export async function unpinFromPinata(cid: string): Promise<{ success: boolean; wasNotPinned?: boolean; error?: string }> {
	try {
		const extractedCid = extractCidFromUrl(cid);
		if (!extractedCid) {
			console.error('Invalid CID for unpinning:', cid);
			return { success: false, error: 'Invalid CID' };
		}

		const jwt = env.PINATA_JWT;
		if (!jwt) {
			throw new Error('Pinata JWT not found in environment variables');
		}

		console.log(`Unpinning CID: ${extractedCid}`);

		// First, get the file ID from the CID using the correct v3 API endpoint
		const filesResponse = await fetch(`https://api.pinata.cloud/v3/files/public?cid=${extractedCid}`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${jwt}`
			}
		});

		if (!filesResponse.ok) {
			console.error(`Failed to find file for CID ${extractedCid}: ${filesResponse.statusText}`);
			return { success: false, error: `Failed to find file: ${filesResponse.statusText}` };
		}

		const filesData = await filesResponse.json();
		if (!filesData.data || !filesData.data.files || filesData.data.files.length === 0) {
			console.log(`CID ${extractedCid} is not pinned, nothing to unpin`);
			return { success: true, wasNotPinned: true };
		}

		// Unpin each file with this CID using the correct v3 API endpoint
		for (const file of filesData.data.files) {
			const unpinResponse = await fetch(`https://api.pinata.cloud/v3/files/public/${file.id}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${jwt}`
				}
			});

			if (!unpinResponse.ok) {
				console.error(`Failed to unpin file ${file.id}: ${unpinResponse.statusText}`);
				return { success: false, error: `Failed to unpin file ${file.id}: ${unpinResponse.statusText}` };
			}

			console.log(`Successfully unpinned file ${file.id} for CID ${extractedCid}`);
		}

		return { success: true };
	} catch (error) {
		console.error('Error unpinning from Pinata:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Upload a file buffer to Pinata
 * @param buffer - The file buffer to upload
 * @param fileName - The name for the file
 * @param mimeType - The MIME type of the file
 * @param metadata - Optional metadata for the file
 * @returns Upload result with IPFS hash and IPFS URL
 */
export async function uploadToPinata(
	buffer: Buffer,
	fileName: string,
	mimeType: string,
	metadata?: Record<string, any>
): Promise<{
	IpfsHash: string;
	url: string;
	fileType: string;
	dimensions: { width: number; height: number } | null;
} | null> {
	try {
		const jwt = env.PINATA_JWT;
		if (!jwt) {
			throw new Error('Pinata JWT not found in environment variables');
		}

		console.log(`Uploading file to Pinata: ${fileName} (${mimeType})`);

		// Create form data for file upload
		const formData = new FormData();
		const blob = new Blob([buffer], { type: mimeType });
		formData.append('file', blob, fileName);

		// Add metadata if provided
		if (metadata) {
			const pinataMetadata = {
				name: fileName,
				keyvalues: metadata
			};
			formData.append('pinataMetadata', JSON.stringify(pinataMetadata));
		} else {
			formData.append('pinataMetadata', JSON.stringify({ name: fileName }));
		}

		// Add group ID if available
		const groupId = env.PINATA_GROUP;
		if (groupId) {
			const pinataOptions = { groupId };
			formData.append('pinataOptions', JSON.stringify(pinataOptions));
		}

		const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${jwt}`
			},
			body: formData
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Pinata upload error: ${response.status} ${response.statusText}`, errorText);
			return null;
		}

		const result = await response.json();
		const ipfsHash = result.IpfsHash;
		// Return IPFS URL instead of gateway URL for database storage
		const ipfsUrl = `ipfs://${ipfsHash}`;

		console.log(`Successfully uploaded to Pinata: ${ipfsHash}`);

		// Try to get dimensions for images
		let dimensions = null;
		if (mimeType.startsWith('image/')) {
			try {
				// Use dynamic import for better serverless compatibility
				const sharp = await import('sharp');
				const imageInfo = await sharp.default(buffer).metadata();
				if (imageInfo.width && imageInfo.height) {
					dimensions = { width: imageInfo.width, height: imageInfo.height };
				}
			} catch (error) {
				console.warn('Could not extract image dimensions with Sharp:', error);
				// Fallback: try to get dimensions from file-type or other methods
				try {
					// You could add alternative dimension extraction here if needed
					console.log('Sharp not available in this environment, skipping dimension extraction');
				} catch (fallbackError) {
					console.warn('Fallback dimension extraction also failed:', fallbackError);
				}
			}
		}

		return {
			IpfsHash: ipfsHash,
			url: ipfsUrl, // Store as ipfs:// URL in database
			fileType: mimeType,
			dimensions
		};
	} catch (error) {
		console.error('Error uploading to Pinata:', error);
		return null;
	}
}

/**
 * Get a Pinata gateway URL with transformations for image optimization
 * @param cid - The IPFS CID
 * @param options - Transformation options
 * @returns Transformed URL
 */
export function getPinataTransformedUrl(
	cid: string,
	options: {
		width?: number;
		height?: number;
		quality?: number;
		format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
		fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
		gravity?: 'auto' | 'side' | string;
		dpr?: number;
		sharpen?: number;
		animation?: boolean;
		metadata?: 'keep' | 'copyright' | 'none';
	} = {}
): string {
	const gateway = getPinataGateway();
	const baseUrl = `${gateway}${cid}`;

	// Check if we have a custom gateway that supports transformations
	const customGateway = env.PINATA_GATEWAY;
	if (!customGateway || customGateway === 'gateway.pinata.cloud') {
		// Public gateway doesn't support transformations, return base URL
		return baseUrl;
	}

	// Build transformation parameters for custom gateway using correct Pinata naming conventions
	const params = new URLSearchParams();
	
	if (options.width) params.append('img-width', options.width.toString());
	if (options.height) params.append('img-height', options.height.toString());
	if (options.quality) params.append('img-quality', options.quality.toString());
	if (options.format) params.append('img-format', options.format);
	if (options.fit) params.append('img-fit', options.fit);
	if (options.gravity) params.append('img-gravity', options.gravity);
	if (options.dpr) params.append('img-dpr', options.dpr.toString());
	if (options.sharpen) params.append('img-sharpen', options.sharpen.toString());
	if (options.animation !== undefined) params.append('img-anim', options.animation ? 'true' : 'false');
	if (options.metadata) params.append('img-metadata', options.metadata);

	const queryString = params.toString();
	return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Unpin all CIDs associated with an artwork before deletion
 * @param artwork - The artwork object containing URLs to unpin
 * @returns Success status
 */
export async function unpinArtworkCids(artwork: any): Promise<boolean> {
	try {
		console.log(`[UNPIN_DEBUG] Starting unpinning process for artwork: "${artwork.title || 'Unknown'}"`);
		console.log(`[UNPIN_DEBUG] Artwork object:`, JSON.stringify(artwork, null, 2));
		
		const cids = extractCidsFromArtwork(artwork);
		if (cids.length === 0) {
			console.log(`[UNPIN_DEBUG] No CIDs found to unpin for artwork: "${artwork.title || 'Unknown'}"`);
			
			// Check if the artwork has any URLs at all
			const hasAnyUrls = artwork.imageUrl || artwork.animationUrl || artwork.thumbnailUrl || artwork.metadataUrl;
			if (!hasAnyUrls) {
				console.log(`[UNPIN_DEBUG] Artwork has no URLs stored - this is expected for artworks without IPFS content`);
			} else {
				console.log(`[UNPIN_DEBUG] Artwork has URLs but none are IPFS URLs:`);
				if (artwork.imageUrl) console.log(`[UNPIN_DEBUG]   - imageUrl: ${artwork.imageUrl}`);
				if (artwork.animationUrl) console.log(`[UNPIN_DEBUG]   - animationUrl: ${artwork.animationUrl}`);
				if (artwork.thumbnailUrl) console.log(`[UNPIN_DEBUG]   - thumbnailUrl: ${artwork.thumbnailUrl}`);
				if (artwork.metadataUrl) console.log(`[UNPIN_DEBUG]   - metadataUrl: ${artwork.metadataUrl}`);
			}
			
			return true; // Not an error - just no IPFS content to unpin
		}

		console.log(`[UNPIN_DEBUG] Unpinning ${cids.length} CIDs for artwork: ${artwork.title || 'Unknown'}`);
		console.log(`[UNPIN_DEBUG] CIDs to unpin: ${cids.join(', ')}`);

		let allSuccess = true;
		for (const cid of cids) {
			console.log(`[UNPIN_DEBUG] Attempting to unpin CID: ${cid}`);
			const result = await unpinFromPinata(cid);
			if (!result.success) {
				console.error(`[UNPIN_DEBUG] Failed to unpin CID: ${cid}`, result.error);
				allSuccess = false;
			} else if (result.wasNotPinned) {
				console.log(`[UNPIN_DEBUG] CID ${cid} was not pinned (no action needed)`);
			} else {
				console.log(`[UNPIN_DEBUG] Successfully unpinned CID: ${cid}`);
			}
		}

		console.log(`[UNPIN_DEBUG] Unpinning process completed. Success: ${allSuccess}`);
		return allSuccess;
	} catch (error) {
		console.error(`[UNPIN_DEBUG] Error unpinning artwork CIDs for "${artwork.title || 'Unknown'}":`, error);
		return false;
	}
}

/**
 * Convert a Pinata gateway URL to an IPFS URL
 * @param url - The URL to convert (can be gateway URL or already IPFS URL)
 * @returns IPFS URL or the original URL if it's not a Pinata gateway URL
 */
export function convertToIpfsUrl(url: string): string {
	if (!url) return url;
	
	// If it's already an IPFS URL, return as-is
	if (url.startsWith('ipfs://')) {
		return url;
	}
	
	// Check if it's a Pinata gateway URL - preserve full path
	const pinataGatewayRegex = /https?:\/\/[^/]*\.mypinata\.cloud\/ipfs\/(.+)/;
	const publicGatewayRegex = /https?:\/\/gateway\.pinata\.cloud\/ipfs\/(.+)/;
	
	let match = url.match(pinataGatewayRegex) || url.match(publicGatewayRegex);
	
	if (match && match[1]) {
		return `ipfs://${match[1]}`;
	}
	
	// Check for other common IPFS gateway patterns - preserve full path
	const genericGatewayRegex = /https?:\/\/[^/]+\/ipfs\/(.+)/;
	match = url.match(genericGatewayRegex);
	
	if (match && match[1]) {
		return `ipfs://${match[1]}`;
	}
	
	// Return original URL if no IPFS pattern found
	return url;
}
