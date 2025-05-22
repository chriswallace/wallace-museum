import crypto from 'crypto';

// Commenting out unused gateway list. Define a specific default gateway.
// const IPFS_GATEWAYS = [
// 	'https://gateway.pinata.cloud/ipfs/',
// 	'https://nftstorage.link/ipfs/',
// 	'https://dweb.link/ipfs/',
// 	'https://ipfs.io/ipfs/'
// ];
const DEFAULT_IPFS_GATEWAY = 'https://w3s.link/ipfs/';
const ONCHFS_GATEWAY = 'https://onchfs.fxhash2.xyz/';
const ARWEAVE_GATEWAY = 'https://arweave.net/';

/**
 * A set of reliable IPFS gateways to try in sequence
 */
export const IPFS_GATEWAYS = [
	'https://w3s.link/ipfs/',
	'https://nftstorage.link/ipfs/',
	'https://cloudflare-ipfs.com/ipfs/',
	'https://ipfs.io/ipfs/'
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
		'application/json'
	];
	return validMimeTypes.includes(mimeType);
}

export function getMediaType(
	mimeType: string
): 'image' | 'video' | 'document' | 'interactive' | 'unknown' {
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType.startsWith('video/')) return 'video';
	if (mimeType === 'application/pdf') return 'document';
	if (mimeType === 'text/html' || mimeType === 'text/javascript' || mimeType === 'application/json')
		return 'interactive';
	return 'unknown';
}

export function sanitizeCloudinaryPublicId(name: string): string {
	// Remove special characters and replace spaces with underscores
	return name
		.replace(/[#?&]/g, '') // Remove #, ?, and & characters
		.replace(/[^a-zA-Z0-9\-_]/g, '_') // Replace other special chars with underscore
		.replace(/_{2,}/g, '_') // Replace multiple consecutive underscores with single
		.replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

export function generateFileName(baseName: string, mimeType: string): string {
	const sanitizedName = sanitizeCloudinaryPublicId(baseName);
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
 * Converts any IPFS or Arweave style URI to a full HTTP(S) URL using the appropriate gateway.
 * - Accepts ipfs://[cid]/foo or ipfs:/[cid]/foo and returns gateway + [cid]/foo
 * - Accepts onchfs://[cid]/foo and returns onchfs gateway + [cid]/foo
 * - Accepts ar://[tx] or raw Arweave transaction IDs and returns Arweave gateway URL
 * - Leaves HTTP(S) and data URIs untouched.
 * - Optionally allows overriding the gateway.
 * @param uri - The URI to convert (IPFS, Arweave, or existing HTTP/S URL)
 * @param gateway - Optional gateway to use for IPFS (default: DEFAULT_IPFS_GATEWAY)
 * @returns A full HTTPS URL for the content, or the original HTTP/S/data URI.
 */
export function ipfsToHttpUrl(
	uri: string | null | undefined,
	gateway: string = DEFAULT_IPFS_GATEWAY
): string {
	if (!uri || typeof uri !== 'string') return '';
	
	// Already HTTP(S) or data URI
	if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:')) {
		return uri;
	}
	
	// Handle onchfs:// protocol (fxhash)
	if (uri.startsWith('onchfs://')) {
		let cleaned = uri.replace(/^onchfs:\/\//, '');
		return ONCHFS_GATEWAY + cleaned;
	}
	
	// Handle Arweave
	if (uri.startsWith('ar://')) {
		let txId = uri.replace(/^ar:\/\//, '');
		return ARWEAVE_GATEWAY + txId;
	}
	
	// Handle raw Arweave transaction ID (43 characters)
	if (uri.match(/^[a-zA-Z0-9_-]{43}$/)) {
		return ARWEAVE_GATEWAY + uri;
	}
	
	// Handle IPFS URIs
	if (uri.startsWith('ipfs://') || uri.startsWith('ipfs:/')) {
		// Remove ipfs:// or ipfs:/ prefix
		let cleaned = uri.replace(/^ipfs:\/\//, '').replace(/^ipfs:\//, '');
		return gateway + cleaned;
	}
	
	// Handle IPFS paths without protocol
	if (uri.startsWith('Qm') || uri.startsWith('bafy')) {
		return gateway + uri;
	}
	
	// If nothing matched, return as is - might be a relative URL or something else
	console.warn(`[ipfsToHttpUrl] Unrecognized URI format: ${uri}`);
	return uri;
}

/**
 * @deprecated Use ipfsToHttpUrl instead.
 */
export const convertIpfsToHttpsUrl = ipfsToHttpUrl;
