/**
 * Image optimization utilities for the Wallace Museum IPFS reverse proxy
 * Leverages the image transformation capabilities of https://ipfs.wallacemuseum.com
 */

import { ipfsToHttpUrl } from './mediaUtils';

// The Wallace Museum IPFS microservice endpoint with image optimization
const IPFS_IMAGE_ENDPOINT = 'https://ipfs.wallacemuseum.com/api/image';
const IPFS_DIRECT_ENDPOINT = 'https://ipfs.wallacemuseum.com';

export interface ImageOptimizationOptions {
	width?: number;
	height?: number;
	dpr?: 1 | 2 | 3; // Device pixel ratio
	fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
	gravity?: 'auto' | 'side' | string; // 'side' includes left, right, top, bottom, or coordinates like '0x1'
	quality?: number; // 1-100
	format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
	animation?: boolean; // Preserve animations
	sharpen?: number; // 0-10
	metadata?: 'keep' | 'copyright' | 'none';
}

/**
 * Extract CID from various IPFS URL formats
 */
function extractCidFromUrl(url: string): string | null {
	if (!url) return null;

	// If it's already just a CID (starts with Qm or bafy)
	if (url.startsWith('Qm') || url.startsWith('bafy')) {
		return url;
	}

	// Handle ipfs:// protocol
	if (url.startsWith('ipfs://')) {
		const cleaned = url.replace('ipfs://', '');
		// Split by '/' and take the first part (the CID)
		const cidPart = cleaned.split('/')[0];
		return cidPart;
	}

	// Handle various gateway URLs including Pinata
	const gatewayPatterns = [
		// Standard IPFS gateway pattern: https://gateway.pinata.cloud/ipfs/QmXXX
		/https?:\/\/[^/]+\/ipfs\/([^/?#]+)/,
		// Direct gateway pattern: https://gateway.pinata.cloud/QmXXX
		/https?:\/\/gateway\.pinata\.cloud\/([^/?#]+)/,
		// Other gateway patterns
		/https?:\/\/[^/]+\/([^/?#]+)/
	];

	for (const pattern of gatewayPatterns) {
		const match = url.match(pattern);
		if (match && match[1]) {
			const potentialCid = match[1];
			// Validate that it looks like a CID (starts with Qm or bafy)
			if (potentialCid.startsWith('Qm') || potentialCid.startsWith('bafy')) {
				return potentialCid;
			}
		}
	}

	return null;
}

/**
 * Check if an IPFS URL has a path component (e.g., ipfs://QmXXX/image.jpg)
 */
function hasIpfsPath(url: string): boolean {
	if (!url) return false;

	// Handle ipfs:// protocol
	if (url.startsWith('ipfs://')) {
		const cleaned = url.replace('ipfs://', '');
		// Check if there's a path after the CID
		const parts = cleaned.split('/');
		return parts.length > 1 && parts[1] !== '';
	}

	// Handle gateway URLs - need to capture the full path after /ipfs/
	const gatewayPatterns = [
		/https?:\/\/[^/]+\/ipfs\/(.+)/,
		/https?:\/\/gateway\.pinata\.cloud\/(.+)/
	];

	for (const pattern of gatewayPatterns) {
		const match = url.match(pattern);
		if (match && match[1]) {
			const cidAndPath = match[1];
			const parts = cidAndPath.split('/');
			// Check if there's a path after the CID
			return parts.length > 1 && parts[1] !== '';
		}
	}

	return false;
}

/**
 * Extract the full CID and path from an IPFS URL
 */
function extractCidAndPath(url: string): { cid: string; path: string } | null {
	if (!url) return null;

	// Handle ipfs:// protocol
	if (url.startsWith('ipfs://')) {
		const cleaned = url.replace('ipfs://', '');
		const parts = cleaned.split('/');
		const cid = parts[0];
		const path = parts.slice(1).join('/');
		
		// Validate CID format
		if (cid && (cid.startsWith('Qm') || cid.startsWith('bafy'))) {
			return { cid, path };
		}
	}

	// Handle gateway URLs
	const gatewayPatterns = [
		/https?:\/\/[^/]+\/ipfs\/(.+)/,
		/https?:\/\/gateway\.pinata\.cloud\/(.+)/
	];

	for (const pattern of gatewayPatterns) {
		const match = url.match(pattern);
		if (match && match[1]) {
			const cidAndPath = match[1];
			const parts = cidAndPath.split('/');
			const cid = parts[0];
			const path = parts.slice(1).join('/');
			
			// Validate CID format
			if (cid && (cid.startsWith('Qm') || cid.startsWith('bafy'))) {
				return { cid, path };
			}
		}
	}

	return null;
}

/**
 * Detect if a URL points to an SVG file
 */
function isSvgUrl(url: string): boolean {
	if (!url) return false;
	
	// Check for .svg extension (case insensitive)
	if (url.toLowerCase().includes('.svg')) {
		return true;
	}
	
	// Check for SVG MIME type in data URLs
	if (url.startsWith('data:image/svg+xml')) {
		return true;
	}
	
	return false;
}

/**
 * Check if a URL is an IPFS URL that can be optimized
 */
function isIpfsUrl(url: string): boolean {
	if (!url) return false;
	
	// Check for IPFS protocol URLs
	if (url.startsWith('ipfs://')) {
		return true;
	}
	
	// Check for IPFS gateway URLs that contain CIDs
	const cid = extractCidFromUrl(url);
	return cid !== null;
}

/**
 * Build an optimized image URL using the Wallace Museum IPFS reverse proxy
 */
export function buildOptimizedImageUrl(
	imageUrl: string | null | undefined,
	options: ImageOptimizationOptions = {}
): string {
	if (!imageUrl) return '';

	// For SVG files, bypass optimization and serve directly to preserve vector format
	if (isSvgUrl(imageUrl)) {
		// If it's an IPFS SVG, use direct IPFS URL, otherwise use the original URL
		return isIpfsUrl(imageUrl) ? buildDirectImageUrl(imageUrl) : imageUrl;
	}

	// For non-IPFS URLs (like Arweave, HTTP, etc.), serve them directly
	if (!isIpfsUrl(imageUrl)) {
		return imageUrl;
	}

	// Check if the IPFS URL has a path component (e.g., ipfs://QmXXX/image.jpg)
	// If it does, we can't perform transformations and should serve directly
	if (hasIpfsPath(imageUrl)) {
		console.log(`[buildOptimizedImageUrl] IPFS URL has path, serving directly: ${imageUrl}`);
		return buildDirectImageUrl(imageUrl);
	}

	// Extract CID from the IPFS image URL
	const cid = extractCidFromUrl(imageUrl);
	
	if (!cid) {
		// If we can't extract a CID from what should be an IPFS URL, fall back to conversion
		return ipfsToHttpUrl(imageUrl);
	}

	// Build query parameters for image optimization
	const params = new URLSearchParams();
	params.append('hash', cid);

	if (options.width) params.append('width', options.width.toString());
	if (options.height) params.append('height', options.height.toString());
	if (options.dpr) params.append('dpr', options.dpr.toString());
	if (options.fit) params.append('fit', options.fit);
	if (options.gravity) params.append('gravity', options.gravity);
	if (options.quality) params.append('quality', options.quality.toString());
	if (options.format) params.append('format', options.format);
	if (options.animation !== undefined) params.append('animation', options.animation.toString());
	if (options.sharpen) params.append('sharpen', options.sharpen.toString());
	if (options.metadata) params.append('metadata', options.metadata);

	return `${IPFS_IMAGE_ENDPOINT}?${params.toString()}`;
}

/**
 * Build a direct CID URL using the Wallace Museum IPFS reverse proxy
 */
export function buildDirectImageUrl(imageUrl: string | null | undefined): string {
	if (!imageUrl) return '';

	// For non-IPFS URLs, return them directly
	if (!isIpfsUrl(imageUrl)) {
		return imageUrl;
	}

	// Try to extract CID and path to preserve the full path
	const cidAndPath = extractCidAndPath(imageUrl);
	if (cidAndPath) {
		const { cid, path } = cidAndPath;
		return `${IPFS_DIRECT_ENDPOINT}/${cid}${path ? `/${path}` : ''}`;
	}

	// Fallback: extract just the CID (for backwards compatibility)
	const cid = extractCidFromUrl(imageUrl);
	if (!cid) {
		return ipfsToHttpUrl(imageUrl);
	}

	return `${IPFS_DIRECT_ENDPOINT}/${cid}`;
}

/**
 * Create responsive srcset for different screen sizes
 */
export function createResponsiveSrcSet(
	imageUrl: string | null | undefined,
	sizes: number[],
	options: Omit<ImageOptimizationOptions, 'width'> = {}
): string {
	if (!imageUrl) return '';

	// For non-IPFS URLs, we can't create responsive variants, so return empty srcset
	// The browser will use the main src attribute
	if (!isIpfsUrl(imageUrl)) {
		return '';
	}

	const srcsetEntries = sizes.map(size => {
		const optimizedUrl = buildOptimizedImageUrl(imageUrl, {
			...options,
			width: size
		});
		return `${optimizedUrl} ${size}w`;
	});

	return srcsetEntries.join(', ');
}

/**
 * Create retina-ready URLs (1x and 2x)
 */
export function createRetinaUrls(
	imageUrl: string | null | undefined,
	width: number,
	options: Omit<ImageOptimizationOptions, 'width' | 'dpr'> = {}
): { src1x: string; src2x: string } {
	if (!imageUrl) return { src1x: '', src2x: '' };

	// For non-IPFS URLs, we can't create retina variants, so return the original URL for both
	if (!isIpfsUrl(imageUrl)) {
		return { src1x: imageUrl, src2x: imageUrl };
	}

	const src1x = buildOptimizedImageUrl(imageUrl, {
		...options,
		width,
		dpr: 1
	});

	const src2x = buildOptimizedImageUrl(imageUrl, {
		...options,
		width,
		dpr: 2
	});

	return { src1x, src2x };
}

/**
 * Predefined image optimization presets for common use cases
 */
export const ImagePresets = {
	// Avatar images
	avatar: {
		small: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 32,
			height: 32,
			fit: 'cover',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 85
		}),
		medium: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 64,
			height: 64,
			fit: 'cover',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 85
		}),
		large: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 128,
			height: 128,
			fit: 'cover',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 85
		})
	},

	// Artwork thumbnails
	thumbnail: {
		small: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 200,
			height: 200,
			fit: 'cover',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 80
		}),
		medium: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 300,
			height: 300,
			fit: 'cover',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 85
		}),
		large: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 400,
			height: 400,
			fit: 'cover',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 85
		})
	},

	// Artwork display (maintaining aspect ratio)
	artwork: {
		small: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 400,
			fit: 'contain',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 85
		}),
		medium: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 800,
			fit: 'contain',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 90
		}),
		large: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 1200,
			fit: 'contain',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 90
		}),
		fullscreen: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 1920,
			fit: 'contain',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 95
		})
	},

	// Grid/collection views
	grid: {
		small: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 250,
			height: 250,
			fit: 'cover',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 80
		}),
		medium: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 350,
			height: 350,
			fit: 'cover',
			format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
			quality: 85
		})
	},

	// Preview/hover images
	preview: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
		width: 320,
		height: 220,
		fit: 'cover',
		format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
		quality: 80
	})
};

/**
 * Helper class for building complex image optimization URLs
 */
export class ImageOptimizer {
	private baseUrl: string;
	private defaultOptions: ImageOptimizationOptions;

	constructor(baseUrl: string = IPFS_IMAGE_ENDPOINT, defaultOptions: ImageOptimizationOptions = {}) {
		this.baseUrl = baseUrl;
		this.defaultOptions = defaultOptions;
	}

	/**
	 * Build an optimized URL with merged options
	 */
	buildUrl(imageUrl: string, options: ImageOptimizationOptions = {}): string {
		const mergedOptions = { ...this.defaultOptions, ...options };
		return buildOptimizedImageUrl(imageUrl, mergedOptions);
	}

	/**
	 * Create responsive srcset
	 */
	createSrcSet(imageUrl: string, sizes: number[], options: Omit<ImageOptimizationOptions, 'width'> = {}): string {
		const mergedOptions = { ...this.defaultOptions, ...options };
		return createResponsiveSrcSet(imageUrl, sizes, mergedOptions);
	}

	/**
	 * Create retina URLs
	 */
	createRetinaUrls(imageUrl: string, width: number, options: Omit<ImageOptimizationOptions, 'width' | 'dpr'> = {}): { src1x: string; src2x: string } {
		const mergedOptions = { ...this.defaultOptions, ...options };
		return createRetinaUrls(imageUrl, width, mergedOptions);
	}
}

/**
 * Default image optimizer instance
 */
export const defaultImageOptimizer = new ImageOptimizer(IPFS_IMAGE_ENDPOINT, {
	format: 'webp',
	quality: 85,
	metadata: 'copyright'
}); 