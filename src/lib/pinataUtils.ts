/**
 * Server-side Pinata utilities that use private environment variables
 * 
 * WARNING: This file imports from pinataHelpers which uses $env/dynamic/private
 * and therefore CANNOT be imported in client-side code.
 * 
 * For client-side usage, use $lib/pinataUtils.client instead.
 */
import { getPinataTransformedUrl, extractCidFromUrl } from './pinataHelpers';

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
 * Legacy function name for backward compatibility
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