/**
 * Server-side Pinata utilities that use private environment variables
 * 
 * WARNING: This file imports from pinataHelpers which uses $env/dynamic/private
 * and therefore CANNOT be imported in client-side code.
 * 
 * For client-side usage, use $lib/pinataUtils.client instead.
 */
import { extractCidFromUrl, getPinataGateway } from './pinataHelpers';

/**
 * Get a Pinata transformed URL (server-side version)
 * @param cid - The IPFS CID
 * @param options - Transformation options
 * @returns Transformed URL
 */
function getPinataTransformedUrl(
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
	// Get the base gateway URL with token
	const baseUrl = getPinataGateway(true); // This already includes the token
	
	// Build query parameters for transformations using correct Pinata naming conventions
	const params = new URLSearchParams();
	
	// Extract existing query params from baseUrl if any
	const urlParts = baseUrl.split('?');
	if (urlParts.length > 1) {
		const existingParams = new URLSearchParams(urlParts[1]);
		existingParams.forEach((value, key) => {
			params.append(key, value);
		});
	}
	
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
	return `${urlParts[0]}${cid}?${queryString}`;
}

/**
 * Get a Pinata transformed URL equivalent to Cloudinary transformations
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
 * Common image transformation presets
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
 * Legacy function name for backward compatibility
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