/**
 * Client-safe Pinata utilities that don't depend on private environment variables
 */

/**
 * Extract CID from various IPFS URL formats (client-safe version)
 * @param url - The URL or CID string to extract from
 * @returns The extracted CID or null if not found
 */
export function extractCidFromUrl(url: string): string | null {
	if (!url) return null;

	// If it's already just a CID (starts with Qm or bafy)
	if (url.startsWith('Qm') || url.startsWith('bafy')) {
		return url;
	}

	// Handle ipfs:// protocol
	if (url.startsWith('ipfs://')) {
		return url.replace('ipfs://', '');
	}

	// Handle gateway URLs
	const gatewayRegex = /https?:\/\/[^/]+\/ipfs\/([^/?#]+)/;
	const match = url.match(gatewayRegex);
	if (match && match[1]) {
		return match[1];
	}

	return null;
}

/**
 * Get a Pinata transformed URL (client-safe version using public gateway)
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
		format?: 'webp' | 'jpg' | 'png';
		fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
	} = {}
): string {
	// Use public gateway for client-side transformations
	const baseUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
	
	// Build query parameters for transformations
	const params = new URLSearchParams();
	
	if (options.width) params.append('img-width', options.width.toString());
	if (options.height) params.append('img-height', options.height.toString());
	if (options.quality) params.append('img-quality', options.quality.toString());
	if (options.format) params.append('img-format', options.format);
	if (options.fit) params.append('img-fit', options.fit);
	
	const queryString = params.toString();
	return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Get a Pinata transformed URL equivalent to Cloudinary transformations (client-safe version)
 * @param url - The original image URL (can be Pinata, IPFS, or other)
 * @param options - Transformation options
 * @returns Transformed URL or original URL if transformations not supported
 */
export function getPinataTransformedImageUrl(
	url: string,
	options: {
		width?: number;
		height?: number;
		quality?: number;
		format?: 'webp' | 'jpg' | 'png';
		fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
	} = {}
): string {
	if (!url) return url;

	// Extract CID if it's an IPFS URL
	const cid = extractCidFromUrl(url);
	if (cid) {
		return getPinataTransformedUrl(cid, options);
	}

	// If it's already a Pinata URL, try to extract CID and transform
	if (url.includes('pinata.cloud') || url.includes('mypinata.cloud')) {
		const cidMatch = url.match(/\/ipfs\/([^/?#]+)/);
		if (cidMatch && cidMatch[1]) {
			return getPinataTransformedUrl(cidMatch[1], options);
		}
	}

	// For non-IPFS URLs, return as-is
	return url;
}

/**
 * Common image transformation presets (client-safe version)
 */
export const ImagePresets = {
	thumbnail: (url: string) => getPinataTransformedImageUrl(url, {
		width: 200,
		height: 200,
		fit: 'cover',
		format: 'webp',
		quality: 80
	}),
	
	small: (url: string) => getPinataTransformedImageUrl(url, {
		width: 400,
		height: 400,
		fit: 'inside',
		format: 'webp',
		quality: 85
	}),
	
	medium: (url: string) => getPinataTransformedImageUrl(url, {
		width: 800,
		height: 800,
		fit: 'inside',
		format: 'webp',
		quality: 85
	}),
	
	large: (url: string) => getPinataTransformedImageUrl(url, {
		width: 1200,
		height: 1200,
		fit: 'inside',
		format: 'webp',
		quality: 90
	}),
	
	hero: (url: string) => getPinataTransformedImageUrl(url, {
		width: 1920,
		height: 1080,
		fit: 'cover',
		format: 'webp',
		quality: 90
	})
};

/**
 * Legacy function name for backward compatibility (client-safe version)
 * @deprecated Use getPinataTransformedImageUrl instead
 */
export function getCloudinaryTransformedUrl(
	url: string,
	options: {
		width?: number;
		height?: number;
		quality?: number;
		format?: 'webp' | 'jpg' | 'png';
		fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
	} = {}
): string {
	console.warn('getCloudinaryTransformedUrl is deprecated. Use getPinataTransformedImageUrl instead.');
	return getPinataTransformedImageUrl(url, options);
} 