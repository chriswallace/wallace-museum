import { env } from '$env/dynamic/private';
import { Readable } from 'stream';
// Use the older @pinata/sdk that doesn't require React
import PinataClient from '@pinata/sdk';

/**
 * Interface for Pinata API pin response (legacy format)
 */
interface PinataResponse {
	IpfsHash?: string;
	PinSize?: number;
	Timestamp?: string;
	isDuplicate?: boolean;
	error?: string;
	status?: string;
	// V3 compatibility fields
	id?: string;
	cid: string;
	name: string;
	size: number;
	created_at: string;
	mime_type?: string;
	network?: 'public' | 'private';
}

/**
 * Interface for Pinata API pin list response (legacy format)
 */
interface PinataPinListResponse {
	count: number;
	rows: Array<{
		id: string;
		ipfs_pin_hash: string;
		size: number;
		user_id: string;
		date_pinned: string;
		date_unpinned?: string | null;
		metadata?: {
			name: string;
			keyvalues: Record<string, string>;
		};
		// V3 compatibility fields
		cid?: string;
		created_at?: string;
		mime_type?: string;
		network?: 'public' | 'private';
	}>;
}

/**
 * Initialize Pinata SDK instance
 */
function getPinataSDK(): any {
	const jwt = env.PINATA_JWT;

	if (!jwt) {
		throw new Error('Pinata JWT not found in environment variables');
	}

	return new PinataClient({ pinataJWTKey: jwt });
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
 * Get the Pinata gateway URL from environment variables with authentication token
 * @param includePath - Whether to include the /ipfs/ path (default: true)
 * @returns The configured Pinata gateway URL with authentication token
 */
export function getPinataGateway(includePath: boolean = true): string {
	const gateway = env.PINATA_GATEWAY;
	const gatewayToken = 'ezmv1YoBrLBuXqWs1CyFxZ2P1SOpOF-X9mgJTP1EmH9d-1F6m6spo1dpD4YoXxw6';
	
	let baseUrl: string;
	
	if (gateway) {
		// Support both subdomain format and full URL format
		if (gateway.startsWith('http')) {
			// Full URL provided (e.g., 'https://my-gateway.mypinata.cloud/ipfs/')
			baseUrl = gateway.endsWith('/') ? gateway : `${gateway}/`;
		} else {
			// Subdomain format (e.g., 'my-gateway')
			baseUrl = `https://${gateway}.mypinata.cloud/ipfs/`;
		}
	} else {
		baseUrl = 'https://gateway.pinata.cloud/ipfs/';
	}
	
	// Remove /ipfs/ if includePath is false
	if (!includePath && baseUrl.endsWith('/ipfs/')) {
		baseUrl = baseUrl.replace('/ipfs/', '/');
	}
	
	// Add the gateway token as a query parameter
	const separator = baseUrl.includes('?') ? '&' : '?';
	return `${baseUrl}${separator}pinataGatewayToken=${gatewayToken}`;
}

/**
 * Pin a single CID to Pinata using legacy API
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
		const pinata = getPinataSDK();

		// Extract CID if it's a URL
		const extractedCid = extractCidFromUrl(cid);
		if (!extractedCid) {
			throw new Error(`Invalid CID or IPFS URL: ${cid}`);
		}

		console.log(`[PINATA_PIN] Starting pin for CID: ${extractedCid} with name: ${name || 'unnamed'}`);

		// Create metadata object
		const options: any = {};
		if (name || keyValues) {
			options.pinataMetadata = {};
			if (name) {
				options.pinataMetadata.name = name;
			}
			if (keyValues && Object.keys(keyValues).length > 0) {
				options.pinataMetadata.keyvalues = keyValues;
			}
		}

		// Use legacy API to pin by hash
		const result = await pinata.pinByHash(extractedCid, options);

		console.log(`[PINATA_PIN] Successfully pinned CID ${extractedCid} with ID: ${result.id}`);

		// Return in consistent format
		return {
			id: result.id,
			cid: extractedCid,
			name: name || '',
			size: 0, // Size not available in pin by hash response
			created_at: new Date().toISOString(),
			mime_type: undefined,
			network: 'public',
			// Legacy fields
			IpfsHash: extractedCid,
			PinSize: 0,
			Timestamp: new Date().toISOString(),
			isDuplicate: false,
			status: result.status
		};
	} catch (error) {
		console.error(`[PINATA_PIN] Error pinning CID ${cid}:`, error);
		return {
			error: `Pinata error: ${error instanceof Error ? error.message : 'Unknown error'}`,
			cid: extractCidFromUrl(cid) || cid,
			name: name || '',
			size: 0,
			created_at: new Date().toISOString(),
			network: 'public',
			// Legacy fields
			IpfsHash: extractCidFromUrl(cid) || cid,
			PinSize: 0,
			Timestamp: new Date().toISOString()
		};
	}
}

/**
 * Get a list of pinned files from Pinata using legacy API
 * @param limit - Maximum number of results to return
 * @param offset - Number of results to skip
 * @returns The pin list response
 */
export async function getPinataPins(
	limit: number = 100,
	offset: number = 0
): Promise<PinataPinListResponse> {
	try {
		const pinata = getPinataSDK();

		console.log(`[PINATA_LIST] Getting pins with limit: ${limit}, offset: ${offset}`);

		// Use legacy API to list pins
		const result = await pinata.pinList({
			status: 'pinned',
			pageLimit: limit,
			pageOffset: offset
		});

		console.log(`[PINATA_LIST] Retrieved ${result.rows?.length || 0} pins`);

		// Convert to consistent format
		const rows = (result.rows || []).map((file: any) => ({
			id: file.id || '',
			ipfs_pin_hash: file.ipfs_pin_hash || file.cid || '',
			size: file.size || 0,
			user_id: file.user_id || '',
			date_pinned: file.date_pinned || file.created_at || new Date().toISOString(),
			date_unpinned: file.date_unpinned || null,
			metadata: file.metadata || { name: '', keyvalues: {} },
			// V3 compatibility fields
			cid: file.ipfs_pin_hash || file.cid || '',
			created_at: file.date_pinned || file.created_at || new Date().toISOString(),
			mime_type: file.metadata?.mime_type,
			network: 'public'
		}));

		return {
			count: result.count || rows.length,
			rows
		};
	} catch (error) {
		console.error(`[PINATA_LIST] Error getting pins:`, error);
		return {
			count: 0,
			rows: []
		};
	}
}

/**
 * Check if a CID is pinned on Pinata using legacy API
 * @param cid - The CID to check
 * @returns True if the CID is pinned, false otherwise
 */
export async function isCidPinned(cid: string): Promise<boolean> {
	try {
		const pinata = getPinataSDK();

		// Extract CID if it's a URL
		const extractedCid = extractCidFromUrl(cid);
		if (!extractedCid) {
			return false;
		}

		console.log(`[PINATA_CHECK] Checking if CID is pinned: ${extractedCid}`);

		// Search for the CID in pinned files
		const result = await pinata.pinList({
			status: 'pinned',
			hashContains: extractedCid,
			pageLimit: 1
		});

		return result.rows && result.rows.length > 0;
	} catch (error) {
		console.error(`[PINATA_CHECK] Error checking if CID ${cid} is pinned:`, error);
		return false;
	}
}

/**
 * Unpin a CID from Pinata using legacy API
 * @param cid - The CID to unpin
 * @returns Success status and additional info
 */
export async function unpinFromPinata(cid: string): Promise<{ success: boolean; wasNotPinned?: boolean; error?: string }> {
	try {
		const pinata = getPinataSDK();

		// Extract CID if it's a URL
		const extractedCid = extractCidFromUrl(cid);
		if (!extractedCid) {
			throw new Error(`Invalid CID or IPFS URL: ${cid}`);
		}

		console.log(`[PINATA_UNPIN] Attempting to unpin CID: ${extractedCid}`);

		// First, find the file by CID
		const result = await pinata.pinList({
			status: 'pinned',
			hashContains: extractedCid,
			pageLimit: 1
		});

		if (!result.rows || result.rows.length === 0) {
			console.log(`[PINATA_UNPIN] CID ${extractedCid} was not pinned`);
			return { success: true, wasNotPinned: true };
		}

		// Unpin using the CID directly
		await pinata.unpin(extractedCid);

		console.log(`[PINATA_UNPIN] Successfully unpinned CID: ${extractedCid}`);
		return { success: true };
	} catch (error) {
		console.error(`[PINATA_UNPIN] Error unpinning CID ${cid}:`, error);
		return {
			success: false,
			error: `Pinata error: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Upload a file to Pinata using legacy API
 * @param buffer - The file buffer
 * @param fileName - The name of the file
 * @param mimeType - The MIME type of the file
 * @param metadata - Optional metadata
 * @returns Upload result with IPFS hash and URL
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
		const pinata = getPinataSDK();

		console.log(`[PINATA_UPLOAD] Uploading file: ${fileName} (${mimeType})`);

		// Create a readable stream from buffer
		const stream = new Readable();
		stream.push(buffer);
		stream.push(null);

		// Set filename on the stream
		(stream as any).path = fileName;

		// Create options object with required metadata
		const options: any = {
			pinataMetadata: {
				name: fileName,
				keyvalues: metadata || {}
			}
		};

		// Upload using legacy API
		const result = await pinata.pinFileToIPFS(stream, options);

		console.log(`[PINATA_UPLOAD] Successfully uploaded file: ${result.IpfsHash}`);

		const gateway = getPinataGateway();
		const url = `${gateway}${result.IpfsHash}`;

		return {
			IpfsHash: result.IpfsHash,
			url,
			fileType: mimeType,
			dimensions: null // Would need additional processing to get dimensions
		};
	} catch (error) {
		console.error(`[PINATA_UPLOAD] Error uploading file ${fileName}:`, error);
		return null;
	}
}

/**
 * Extract CIDs from artwork object
 * @param artwork - The artwork object to extract CIDs from
 * @returns Array of unique CIDs found in the artwork
 */
export function extractCidsFromArtwork(artwork: any): string[] {
	const cids: string[] = [];

	const extractAndLog = (url: string, source: string) => {
		const cid = extractCidFromUrl(url);
		if (cid && !cids.includes(cid)) {
			console.log(`[EXTRACT_CIDS] Found CID from ${source}: ${cid}`);
			cids.push(cid);
		}
	};

	// Check main fields
	if (artwork.image_url) extractAndLog(artwork.image_url, 'image_url');
	if (artwork.animation_url) extractAndLog(artwork.animation_url, 'animation_url');
	if (artwork.token_uri) extractAndLog(artwork.token_uri, 'token_uri');

	// Check display media fields
	if (artwork.display_image_url) extractAndLog(artwork.display_image_url, 'display_image_url');
	if (artwork.display_animation_url) extractAndLog(artwork.display_animation_url, 'display_animation_url');

	// Check metadata if it exists
	if (artwork.metadata) {
		if (typeof artwork.metadata === 'string') {
			try {
				const parsed = JSON.parse(artwork.metadata);
				const checkForIpfsUrls = (obj: any, prefix: string = '') => {
					for (const [key, value] of Object.entries(obj)) {
						if (typeof value === 'string' && (value.includes('ipfs://') || value.includes('/ipfs/'))) {
							extractAndLog(value, `${prefix}metadata.${key}`);
						} else if (typeof value === 'object' && value !== null) {
							checkForIpfsUrls(value, `${prefix}${key}.`);
						}
					}
				};
				checkForIpfsUrls(parsed);
			} catch (e) {
				// Ignore JSON parse errors
			}
		} else if (typeof artwork.metadata === 'object') {
			// Handle already parsed metadata
			const checkForIpfsUrls = (obj: any, prefix: string = '') => {
				for (const [key, value] of Object.entries(obj)) {
					if (typeof value === 'string' && (value.includes('ipfs://') || value.includes('/ipfs/'))) {
						extractAndLog(value, `${prefix}metadata.${key}`);
					} else if (typeof value === 'object' && value !== null) {
						checkForIpfsUrls(value, `${prefix}${key}.`);
					}
				}
			};
			checkForIpfsUrls(artwork.metadata);
		}
	}

	console.log(`[EXTRACT_CIDS] Found ${cids.length} unique CIDs in artwork`);
	return cids;
}

/**
 * Unpin all CIDs associated with an artwork
 * @param artwork - The artwork object
 * @returns True if all CIDs were successfully unpinned
 */
export async function unpinArtworkCids(artwork: any): Promise<boolean> {
	const cids = extractCidsFromArtwork(artwork);

	if (cids.length === 0) {
		console.log('[UNPIN_ARTWORK] No CIDs found in artwork');
		return true;
	}

	console.log(`[UNPIN_ARTWORK] Unpinning ${cids.length} CIDs for artwork`);

	let allSuccess = true;
	for (const cid of cids) {
		const result = await unpinFromPinata(cid);
		if (!result.success && !result.wasNotPinned) {
			console.error(`[UNPIN_ARTWORK] Failed to unpin CID: ${cid}`);
			allSuccess = false;
		}
	}

	console.log(`[UNPIN_ARTWORK] Unpinning completed. All successful: ${allSuccess}`);
	return allSuccess;
}

/**
 * Convert various URL formats to IPFS URL
 * @param url - The URL to convert
 * @returns IPFS URL or original URL if not convertible
 */
export function convertToIpfsUrl(url: string): string {
	const cid = extractCidFromUrl(url);
	if (cid) {
		return `ipfs://${cid}`;
	}
	return url;
}
