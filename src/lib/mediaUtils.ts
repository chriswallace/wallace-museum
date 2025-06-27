import crypto from 'crypto';
// Remove the public env import - we'll handle authentication server-side
// import { env } from '$env/dynamic/public';

// Commenting out unused gateway list. Define a specific default gateway.
// const IPFS_GATEWAYS = [
// 	'https://gateway.pinata.cloud/ipfs/',
// 	'https://nftstorage.link/ipfs/',
// 	'https://dweb.link/ipfs/',
// 	'https://ipfs.io/ipfs/'
// ];
// Note: For frontend media (images/videos), use Wallace Museum Pinata proxy
// For HTML/interactive content, prioritize the specialized gateway for code-powered artworks:
// Format: https://{CID}.ipfs.dweb.link/{path}?{queryString}
// Base: bafybeihygfx2eupqe7p2jvxheb6rhzpmnrdk2oxqqsokf3sztva4p3wl2e.ipfs.dweb.link
// For indexing operations, use public IPFS gateways
const DEFAULT_IPFS_GATEWAY = 'https://ipfs.wallacemuseum.com/ipfs/'; // Use Wallace Museum proxy for media
const ONCHFS_GATEWAY = 'https://onchfs.fxhash2.xyz/';
const ARWEAVE_GATEWAY = 'https://arweave.net/';

// For frontend media delivery, use Wallace Museum gateway with Pinata authentication
const IPFS_MICROSERVICE_ENDPOINT = 'https://ipfs.wallacemuseum.com/ipfs/'; // Use Wallace Museum proxy for media
const PINATA_GATEWAY_TOKEN = 'ezmv1YoBrLBuXqWs1CyFxZ2P1SOpOF-X9mgJTP1EmH9d-1F6m6spo1dpD4YoXxw6';

/**
 * IPFS gateways for media content (images/videos) - use Wallace Museum proxy first
 * For HTML content, we'll use ipfs.io gateway to avoid authentication issues
 */
export const IPFS_GATEWAYS = [
	'https://ipfs.wallacemuseum.com/ipfs/',  // Primary: Wallace Museum Pinata proxy for media
	'https://dweb.link/ipfs/',               // Fallback: Protocol Labs gateway
	'https://ipfs.io/ipfs/',                 // Fallback: Public IPFS.io gateway
	'https://nftstorage.link/ipfs/',         // Fallback: NFT.Storage gateway
	'https://gateway.pinata.cloud/ipfs/'     // Fallback: Pinata public gateway
];

export function createHashForString(inputString: string | null | undefined): string {
	if (!inputString) {
		console.warn('createHashForString called with undefined or null string.');
		return '';
	}
	return crypto.createHash('sha256').update(inputString).digest('hex');
}

export function extensionFromMimeType(mimeType: string): string {
	switch (mimeType) {
		case 'image/jpeg':
			return '.jpg';
		case 'image/png':
			return '.png';
		case 'image/gif':
			return '.gif';
		case 'image/webp':
			return '.webp';
		case 'image/svg+xml':
			return '.svg';
		case 'video/mp4':
			return '.mp4';
		case 'video/webm':
			return '.webm';
		case 'video/ogg':
			return '.ogv';
		case 'application/pdf':
			return '.pdf';
		case 'text/html':
			return '.html';
		case 'application/x-directory':
			return '.html';
		default:
			console.error(`Unsupported MIME type for extension: ${mimeType}`);
			return '';
	}
}

export function isValidMimeType(mimeType: string): boolean {
	const validMimeTypes = [
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/svg+xml',
		'video/mp4',
		'video/webm',
		'video/ogg',
		'application/pdf',
		'text/html',
		'text/javascript',
		'application/json',
		'application/x-directory'
	];
	return validMimeTypes.includes(mimeType);
}

export function getMediaType(
	mimeType: string
): 'image' | 'video' | 'document' | 'interactive' | 'unknown' {
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType.startsWith('video/')) return 'video';
	if (mimeType === 'application/pdf') return 'document';
	if (mimeType === 'text/html' || mimeType === 'text/javascript' || mimeType === 'application/json' || mimeType === 'application/x-directory')
		return 'interactive';
	return 'unknown';
}

export function sanitizePinataFileName(name: string): string {
	// Remove special characters and replace spaces with underscores
	return name
		.replace(/[#?&]/g, '') // Remove #, ?, and & characters
		.replace(/[^a-zA-Z0-9\-_]/g, '_') // Replace other special chars with underscore
		.replace(/_{2,}/g, '_') // Replace multiple consecutive underscores with single
		.replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

export function generateFileName(baseName: string, mimeType: string): string {
	const sanitizedName = sanitizePinataFileName(baseName);
	const hash = createHashForString(baseName).substring(0, 8);
	return `${sanitizedName}_${hash}`;
}

export function generateTags(
	baseName: string,
	mimeType: string,
	contractAddr?: string,
	tokenID?: string | number
): string {
	let tags: string[] = [];

	// Combine base name and mime type for a unique identifier string
	const uniqueMediaString = `${baseName}::${mimeType}`;
	const mediaHash = createHashForString(uniqueMediaString);

	if (mediaHash) {
		// Use a single tag 'mediaHash' for the unique identifier
		tags.push(`mediaHash:${mediaHash}`);
	}

	// Optionally, still add contract/token info for broader categorization if needed,
	// but the primary check will be the mediaHash.
	if (contractAddr) {
		tags.push(`contractAddr:${contractAddr}`);
	}
	if (tokenID !== undefined) {
		tags.push(`tokenID:${String(tokenID)}`);
	}
	if (contractAddr && tokenID !== undefined) {
		tags.push(`tezos:${contractAddr}_${String(tokenID)}`);
	}

	// Ensure max 6 tags
	return tags.slice(0, 6).join(',');
}

export function removeQueryString(url: string | null | undefined): string {
	if (!url) return '';
	try {
		const parsedUrl = new URL(url);
		parsedUrl.search = ''; // Remove the query string
		const result = parsedUrl.toString();
		// Prevent adding trailing slash if original URL didn't have a path and no query string existed
		if (result.endsWith('/') && !url.includes('?') && !url.endsWith('/')) {
			return result.slice(0, -1);
		}
		return result;
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Invalid URL: ${url}`, message);
		return url;
	}
}

/**
 * Converts IPFS URIs to HTTP URLs specifically for HTML content
 * Uses dweb.link path format for all HTML/interactive content: https://dweb.link/ipfs/{CID}/{path}?{queryString}
 * This format preserves case-sensitive CIDs unlike subdomain format which gets lowercased by browsers
 * @param uri - The URI to convert (IPFS URI)
 * @param mimeType - Optional MIME type to determine if this is HTML content
 * @returns A full HTTPS URL using the dweb.link gateway path format for HTML content
 */
export function ipfsToHttpUrlForHtml(
	uri: string | null | undefined,
	mimeType?: string
): string {
	if (!uri || typeof uri !== 'string') return '';

	// Clean and sanitize input
	let cleanUri = uri.trim();

	// Remove any @ symbol that might have gotten prepended
	if (cleanUri.startsWith('@')) {
		cleanUri = cleanUri.substring(1);
	}

	// Handle data URIs
	if (cleanUri.startsWith('data:')) {
		return cleanUri;
	}

	/**
	 * Build dweb.link URL with CID in path
	 * Format: https://dweb.link/ipfs/{CID}/{path}?{queryString}
	 * This format preserves case-sensitive CIDs unlike subdomain format
	 * which gets lowercased by browsers
	 */
	function buildDwebUrl(cidAndPath: string, preserveQuery: string = ''): string {
		// Build dweb.link URL with CID in path to preserve case
		let url = `https://dweb.link/ipfs/${cidAndPath}`;
		if (preserveQuery) {
			url += preserveQuery;
		}
		
		return url;
	}

	// Handle existing IPFS gateway URLs - extract CID and route through selected gateway
	if (cleanUri.startsWith('http://') || cleanUri.startsWith('https://')) {
		const ipfsGatewayPatterns = [
			/https?:\/\/w3s\.link\/ipfs\/(.+?)(\?.*)?$/,
			/https?:\/\/dweb\.link\/ipfs\/(.+?)(\?.*)?$/,
			/https?:\/\/.*\.ipfs\.w3s\.link\/(.+?)(\?.*)?$/,
			/https?:\/\/.*\.ipfs\.dweb\.link\/(.+?)(\?.*)?$/,
			/https?:\/\/gateway\.pinata\.cloud\/ipfs\/(.+?)(\?.*)?$/,
			/https?:\/\/.*\.mypinata\.cloud\/ipfs\/(.+?)(\?.*)?$/,
			/https?:\/\/nftstorage\.link\/ipfs\/(.+?)(\?.*)?$/,
			/https?:\/\/ipfs\.io\/ipfs\/(.+?)(\?.*)?$/,
			/https?:\/\/ipfs\.wallacemuseum\.com\/ipfs\/(.+?)(\?.*)?$/,
			/https?:\/\/.*\/ipfs\/(.+?)(\?.*)?$/
		];

		for (const pattern of ipfsGatewayPatterns) {
			const match = cleanUri.match(pattern);
			if (match && match[1]) {
				const cidAndPath = match[1];
				const queryString = match[2] || '';
				
				// Always use dweb.link path format for HTML/interactive content
				return buildDwebUrl(cidAndPath, queryString);
			}
		}

		// If it's already an HTTP/HTTPS URL but not an IPFS gateway, return as-is
		return cleanUri;
	}

	// Handle IPFS URIs
	if (cleanUri.startsWith('ipfs://') || cleanUri.startsWith('ipfs:/')) {
		// Remove ipfs:// or ipfs:/ prefix and extract query parameters
		let cleaned = cleanUri.replace(/^ipfs:\/\//, '').replace(/^ipfs:\//, '');
		const [pathPart, ...queryParts] = cleaned.split('?');
		const queryString = queryParts.length > 0 ? '?' + queryParts.join('?') : '';
		
		// Always use dweb.link path format for HTML/interactive content
		return buildDwebUrl(pathPart, queryString);
	}

	// Handle IPFS paths without protocol (raw CIDs or CID/path)
	if (cleanUri.startsWith('Qm') || cleanUri.startsWith('bafy')) {
		// Check if there are query parameters
		const [pathPart, ...queryParts] = cleanUri.split('?');
		const queryString = queryParts.length > 0 ? '?' + queryParts.join('?') : '';
		
		// Always use dweb.link path format for HTML/interactive content
		return buildDwebUrl(pathPart, queryString);
	}

	// If nothing matched, return as is
	return cleanUri;
}

/**
 * Converts IPFS URIs to HTTP URLs for HTML content
 * Since we now exclusively use dweb.link path format, this returns the same URL for both primary and fallback
 * @param uri - The URI to convert (IPFS URI)
 * @param mimeType - Optional MIME type to determine if this is HTML content
 * @returns Object with primaryUrl (dweb.link path format) and fallbackUrl (same as primary)
 */
export function ipfsToHttpUrlForHtmlWithFallback(
	uri: string | null | undefined,
	mimeType?: string
): { primaryUrl: string; fallbackUrl: string } {
	const url = ipfsToHttpUrlForHtml(uri, mimeType);
	
	return { primaryUrl: url, fallbackUrl: url };
}

/**
 * Converts any IPFS or Arweave style URI to a full HTTP(S) URL using the appropriate gateway.
 * - Accepts ipfs://[cid]/foo or ipfs:/[cid]/foo and returns gateway + [cid]/foo
 * - Accepts onchfs://[cid]/foo and returns onchfs gateway + [cid]/foo
 * - Accepts ar://[tx] or raw Arweave transaction IDs and returns Arweave gateway URL
 * - Converts existing IPFS gateway URLs (w3s.link, dweb.link, etc.) to use IPFS proxy
 * - Leaves other HTTP(S) and data URIs untouched.
 * - Optionally allows overriding the gateway.
 * @param uri - The URI to convert (IPFS, Arweave, or existing HTTP/S URL)
 * @param gateway - Optional gateway to use for IPFS (default: fallback gateway)
 * @param useProxy - Whether to use the IPFS microservice for IPFS (default: true)
 * @param mimeType - Optional MIME type to determine special handling (e.g., HTML content)
 * @returns A full HTTPS URL for the content, or the original HTTP/S/data URI.
 */
export function ipfsToHttpUrl(
	uri: string | null | undefined,
	gateway: string = IPFS_GATEWAYS[0],
	useProxy: boolean = true,
	mimeType?: string
): string {
	if (!uri || typeof uri !== 'string') return '';

	// For HTML/interactive content, use specialized gateway to ensure proper loading
	if (mimeType === 'text/html' || mimeType === 'text/javascript' || mimeType === 'application/javascript' || mimeType === 'application/x-directory') {
		return ipfsToHttpUrlForHtml(uri, mimeType);
	}

	// Clean and sanitize input - remove any leading/trailing whitespace and special characters
	let cleanUri = uri.trim();

	// Remove any @ symbol that might have gotten prepended
	if (cleanUri.startsWith('@')) {
		cleanUri = cleanUri.substring(1);
		console.warn(`[ipfsToHttpUrl] Removed @ symbol from URI: ${uri}`);
	}

	// If this URL is already our microservice endpoint, return as-is to prevent double processing
	if (cleanUri.startsWith(IPFS_MICROSERVICE_ENDPOINT)) {
		return cleanUri;
	}

	// Handle data URIs
	if (cleanUri.startsWith('data:')) {
		return cleanUri;
	}

	// Handle onchfs:// protocol (fxhash)
	if (cleanUri.startsWith('onchfs://')) {
		const cleaned = cleanUri.replace(/^onchfs:\/\//, '');
		return ONCHFS_GATEWAY + cleaned;
	}

	// Handle Arweave
	if (cleanUri.startsWith('ar://')) {
		const txId = cleanUri.replace(/^ar:\/\//, '');
		return ARWEAVE_GATEWAY + txId;
	}

	// Handle raw Arweave transaction ID (43 characters)
	if (cleanUri.match(/^[a-zA-Z0-9_-]{43}$/)) {
		return ARWEAVE_GATEWAY + cleanUri;
	}

	// Handle existing IPFS gateway URLs - extract CID and route through our microservice
	if (cleanUri.startsWith('http://') || cleanUri.startsWith('https://')) {
		// Common IPFS gateway patterns to detect and convert
		const ipfsGatewayPatterns = [
			/https?:\/\/w3s\.link\/ipfs\/(.+)/,
			/https?:\/\/dweb\.link\/ipfs\/(.+)/,
			/https?:\/\/.*\.ipfs\.w3s\.link\/(.+)/,
			/https?:\/\/.*\.ipfs\.dweb\.link\/(.+)/,
			/https?:\/\/gateway\.pinata\.cloud\/ipfs\/(.+)/,
			/https?:\/\/.*\.mypinata\.cloud\/ipfs\/(.+)/,
			/https?:\/\/nftstorage\.link\/ipfs\/(.+)/,
			/https?:\/\/ipfs\.io\/ipfs\/(.+)/,
			/https?:\/\/.*\/ipfs\/(.+)/
		];

		for (const pattern of ipfsGatewayPatterns) {
			const match = cleanUri.match(pattern);
			if (match && match[1]) {
				const cidAndPath = match[1];

				// Use Wallace Museum IPFS proxy for media access
				if (useProxy) {
					const pathParts = cidAndPath.split('/');
					const cid = pathParts[0];
					const path = pathParts.slice(1).join('/');

					// Validate CID format (basic check for IPFS CID patterns)
					if (!cid || (!cid.startsWith('Qm') && !cid.startsWith('bafy'))) {
						console.warn(`[ipfsToHttpUrl] Invalid CID extracted: ${cid} from ${cleanUri}`);
						return cleanUri; // Return original if CID is invalid
					}

					// Build Wallace Museum gateway URL with Pinata authentication
					const url = new URL(`${IPFS_MICROSERVICE_ENDPOINT}${cid}${path ? `/${path}` : ''}`);
					if (PINATA_GATEWAY_TOKEN) {
						url.searchParams.set('pinataGatewayToken', PINATA_GATEWAY_TOKEN);
					}
					return url.toString();
				}

				return gateway + cidAndPath;
			}
		}

		// If it's already an HTTP/HTTPS URL but not an IPFS gateway, return as-is
		return cleanUri;
	}

	// Handle IPFS URIs - use IPFS microservice for authenticated access
	if (cleanUri.startsWith('ipfs://') || cleanUri.startsWith('ipfs:/')) {
		// Remove ipfs:// or ipfs:/ prefix
		let cleaned = cleanUri.replace(/^ipfs:\/\//, '').replace(/^ipfs:\//, '');

		// Use Wallace Museum IPFS proxy for media operations
		if (useProxy) {
			const pathParts = cleaned.split('/');
			const cid = pathParts[0];
			const path = pathParts.slice(1).join('/');

			// Validate CID format
			if (!cid || (!cid.startsWith('Qm') && !cid.startsWith('bafy'))) {
				console.warn(
					`[ipfsToHttpUrl] Invalid CID extracted from IPFS URI: ${cid} from ${cleanUri}`
				);
				return ''; // Return empty for invalid IPFS URIs
			}

			// Build Wallace Museum gateway URL with Pinata authentication
			const url = new URL(`${IPFS_MICROSERVICE_ENDPOINT}${cid}${path ? `/${path}` : ''}`);
			if (PINATA_GATEWAY_TOKEN) {
				url.searchParams.set('pinataGatewayToken', PINATA_GATEWAY_TOKEN);
			}
			return url.toString();
		}

		return gateway + cleaned;
	}

	// Handle IPFS paths without protocol (raw CIDs or CID/path)
	if (cleanUri.startsWith('Qm') || cleanUri.startsWith('bafy')) {
		// Use Wallace Museum IPFS proxy for media operations
		if (useProxy) {
			const pathParts = cleanUri.split('/');
			const cid = pathParts[0];
			const path = pathParts.slice(1).join('/');

			// Build Wallace Museum gateway URL with Pinata authentication
			const url = new URL(`${IPFS_MICROSERVICE_ENDPOINT}${cid}${path ? `/${path}` : ''}`);
			if (PINATA_GATEWAY_TOKEN) {
				url.searchParams.set('pinataGatewayToken', PINATA_GATEWAY_TOKEN);
			}
			return url.toString();
		}

		return gateway + cleanUri;
	}

	// If nothing matched, return as is - might be a relative URL or something else
	console.warn(`[ipfsToHttpUrl] Unrecognized URI format: ${cleanUri}`);
	return cleanUri;
}

/**
 * @deprecated Use ipfsToHttpUrl instead.
 */
export const convertIpfsToHttpsUrl = ipfsToHttpUrl;
