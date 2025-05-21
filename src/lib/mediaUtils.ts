import crypto from 'crypto';

// Commenting out unused gateway list. Define a specific default gateway.
// const IPFS_GATEWAYS = [
// 	'https://gateway.pinata.cloud/ipfs/',
// 	'https://nftstorage.link/ipfs/',
// 	'https://dweb.link/ipfs/',
// 	'https://ipfs.io/ipfs/'
// ];
const DEFAULT_IPFS_GATEWAY = 'https://w3s.link/ipfs/';

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
		case 'video/mp4':
			return '.mp4';
		default:
			console.error(`Unsupported MIME type for extension: ${mimeType}`);
			return '';
	}
}

export function generateFileName(name: string, mimeType: string): string {
	if (!name) {
		console.warn('generateFileName called with empty name, using "untitled".');
		name = 'untitled';
	}
	// Revert: Replace spaces with underscores first, then remove other invalid chars
	let baseName = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.]/g, '');

	const extension = extensionFromMimeType(mimeType);
	if (!extension) {
		console.warn(`Could not determine extension for mimeType: ${mimeType}. Using default.`);
		return `${baseName}_${Date.now()}`;
	}
	return `${baseName}${extension}`;
}

export function generateTags(baseName: string, mimeType: string, contractAddr?: string, tokenID?: string | number): string {
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
 * Converts any IPFS-style URI to a full HTTP(S) URL using the default gateway.
 * - Accepts ipfs://[cid]/foo or ipfs:/[cid]/foo and returns gateway + [cid]/foo
 * - Leaves HTTP(S) and data URIs untouched.
 * - Optionally allows overriding the gateway.
 * @param uri - The IPFS URI or existing HTTP/S URL.
 * @param gateway - Optional gateway to use (default: DEFAULT_IPFS_GATEWAY)
 * @returns A full HTTPS URL for the IPFS content, or the original HTTP/S/data URI.
 */
export function ipfsToHttpUrl(uri: string | null | undefined, gateway: string = DEFAULT_IPFS_GATEWAY): string {
	if (!uri || typeof uri !== 'string') return '';
	if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:')) {
		return uri;
	}
	// Remove ipfs:// or ipfs:/ prefix
	let cleaned = uri.replace(/^ipfs:\/\//, '');
	return gateway + cleaned;
}

/**
 * @deprecated Use ipfsToHttpUrl instead.
 */
export const convertIpfsToHttpsUrl = ipfsToHttpUrl; 