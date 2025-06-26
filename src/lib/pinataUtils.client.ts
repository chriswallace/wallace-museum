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
 * Get a Pinata transformed URL (client-safe version using Wallace Museum gateway)
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
	// Use Wallace Museum Pinata proxy for media transformations
	const gatewayToken = 'ezmv1YoBrLBuXqWs1CyFxZ2P1SOpOF-X9mgJTP1EmH9d-1F6m6spo1dpD4YoXxw6';
	const baseUrl = `https://ipfs.wallacemuseum.com/ipfs/${cid}`; // Use Wallace Museum proxy
	
	// Build query parameters for transformations using correct Pinata naming conventions
	const params = new URLSearchParams();
	
	// Add the gateway token first
	params.append('pinataGatewayToken', gatewayToken);
	
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
	return `${baseUrl}?${queryString}`;
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
		format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
		fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
		gravity?: 'auto' | 'side' | string;
		dpr?: number;
		sharpen?: number;
		animation?: boolean;
		metadata?: 'keep' | 'copyright' | 'none';
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
		fit: 'contain',
		format: 'webp',
		quality: 85
	}),
	
	medium: (url: string) => getPinataTransformedImageUrl(url, {
		width: 800,
		height: 800,
		fit: 'contain',
		format: 'webp',
		quality: 85
	}),
	
	large: (url: string) => getPinataTransformedImageUrl(url, {
		width: 1200,
		height: 1200,
		fit: 'contain',
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
		format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
		fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
		gravity?: 'auto' | 'side' | string;
		dpr?: number;
		sharpen?: number;
		animation?: boolean;
		metadata?: 'keep' | 'copyright' | 'none';
	} = {}
): string {
	console.warn('getCloudinaryTransformedUrl is deprecated. Use getPinataTransformedImageUrl instead.');
	return getPinataTransformedImageUrl(url, options);
} 