/**
 * Image optimization utilities using Wallace Museum Pinata proxy
 * Uses ipfs.wallacemuseum.com for reliable IPFS access with Pinata authentication
 */

import { ipfsToHttpUrl } from './mediaUtils';

// Use Wallace Museum Pinata proxy for images and videos
const IPFS_DIRECT_ENDPOINT = 'https://ipfs.wallacemuseum.com/ipfs';
const PINATA_GATEWAY_TOKEN = 'ezmv1YoBrLBuXqWs1CyFxZ2P1SOpOF-X9mgJTP1EmH9d-1F6m6spo1dpD4YoXxw6';

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
	mimeType?: string | null; // Optional MIME type for better format detection
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
 * Detect if a URL points to a GIF file
 */
function isGifUrl(url: string): boolean {
	if (!url) return false;
	
	// Check for .gif extension (case insensitive) as fallback
	if (url.toLowerCase().includes('.gif')) {
		return true;
	}
	
	// Check for GIF MIME type in data URLs
	if (url.startsWith('data:image/gif')) {
		return true;
	}
	
	return false;
}

/**
 * Detect if this is a GIF file based on URL or MIME type (more comprehensive)
 */
function isGifFile(url: string, mimeType?: string | null): boolean {
	if (!url) return false;
	
	// Check MIME type first (most reliable)
	if (mimeType === 'image/gif') {
		return true;
	}
	
	// Fall back to URL-based detection
	return isGifUrl(url);
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

	// Clean and sanitize input - remove any @ symbol that might have gotten prepended
	let cleanImageUrl = imageUrl.trim();
	if (cleanImageUrl.startsWith('@')) {
		cleanImageUrl = cleanImageUrl.substring(1);
		console.log(`[buildOptimizedImageUrl] Removed @ symbol from URL: ${imageUrl} -> ${cleanImageUrl}`);
	}

	// For SVG files, bypass optimization and serve directly to preserve vector format
	if (isSvgUrl(cleanImageUrl)) {
		// If it's an IPFS SVG, use direct IPFS URL, otherwise use the original URL
		return isIpfsUrl(cleanImageUrl) ? buildDirectImageUrl(cleanImageUrl) : cleanImageUrl;
	}

	// For GIF files, bypass optimization and serve directly to preserve animation
	if (isGifFile(cleanImageUrl, options.mimeType)) {
		console.log(`[buildOptimizedImageUrl] GIF detected, serving directly: ${cleanImageUrl}`);
		// If it's an IPFS GIF, use direct URL to preserve animation
		return isIpfsUrl(cleanImageUrl) ? buildDirectImageUrl(cleanImageUrl) : cleanImageUrl;
	}

	// For non-IPFS URLs (like Arweave, HTTP, etc.), serve them directly
	if (!isIpfsUrl(cleanImageUrl)) {
		return cleanImageUrl;
	}

	// Check if the IPFS URL has a path component (e.g., ipfs://QmXXX/image.jpg)
	// If it does, we can't perform transformations and should serve directly
	if (hasIpfsPath(cleanImageUrl)) {
		console.log(`[buildOptimizedImageUrl] IPFS URL has path, serving directly: ${cleanImageUrl}`);
		return buildDirectImageUrl(cleanImageUrl);
	}

	// Extract CID from the IPFS image URL
	const cid = extractCidFromUrl(cleanImageUrl);
	
	if (!cid) {
		// If we can't extract a CID from what should be an IPFS URL, fall back to conversion
		return ipfsToHttpUrl(cleanImageUrl);
	}

	// Build optimized URL using the Wallace Museum IPFS service
	const url = new URL(`${IPFS_DIRECT_ENDPOINT}/${cid}`);
	
	// Add the gateway token for authentication
	url.searchParams.set('pinataGatewayToken', PINATA_GATEWAY_TOKEN);
	
	// Add image optimization parameters using Pinata's naming conventions
	if (options.width) url.searchParams.set('img-width', options.width.toString());
	if (options.height) url.searchParams.set('img-height', options.height.toString());
	if (options.dpr) url.searchParams.set('img-dpr', options.dpr.toString());
	if (options.fit) url.searchParams.set('img-fit', options.fit);
	if (options.gravity) {
		// Handle face detection specifically
		if (options.gravity === 'face' || options.gravity === 'faces') {
			url.searchParams.set('img-gravity', 'face');
		} else {
			url.searchParams.set('img-gravity', options.gravity);
		}
	}
	if (options.quality) url.searchParams.set('img-quality', options.quality.toString());
	if (options.format) url.searchParams.set('img-format', options.format);
	if (options.animation !== undefined) url.searchParams.set('img-anim', options.animation.toString());
	if (options.sharpen) url.searchParams.set('img-sharpen', options.sharpen.toString());
	if (options.metadata) url.searchParams.set('img-metadata', options.metadata);

	return url.toString();
}

/**
 * Build a direct CID URL using the authenticated Pinata gateway
 */
export function buildDirectImageUrl(imageUrl: string | null | undefined): string {
	if (!imageUrl) return '';

	// Clean and sanitize input - remove any @ symbol that might have gotten prepended
	let cleanImageUrl = imageUrl.trim();
	if (cleanImageUrl.startsWith('@')) {
		cleanImageUrl = cleanImageUrl.substring(1);
		console.log(`[buildDirectImageUrl] Removed @ symbol from URL: ${imageUrl} -> ${cleanImageUrl}`);
	}

	// For non-IPFS URLs, return them directly
	if (!isIpfsUrl(cleanImageUrl)) {
		return cleanImageUrl;
	}

	// Try to extract CID and path to preserve the full path
	const cidAndPath = extractCidAndPath(cleanImageUrl);
	if (cidAndPath) {
		const { cid, path } = cidAndPath;
		// Use Wallace Museum IPFS service with authentication
		const url = new URL(`${IPFS_DIRECT_ENDPOINT}/${cid}${path ? `/${path}` : ''}`);
		url.searchParams.set('pinataGatewayToken', PINATA_GATEWAY_TOKEN);
		return url.toString();
	}

	// Fallback: extract just the CID (for backwards compatibility)
	const cid = extractCidFromUrl(cleanImageUrl);
	if (!cid) {
		return ipfsToHttpUrl(cleanImageUrl);
	}

	// Use Wallace Museum IPFS service with authentication
	const url = new URL(`${IPFS_DIRECT_ENDPOINT}/${cid}`);
	url.searchParams.set('pinataGatewayToken', PINATA_GATEWAY_TOKEN);
	return url.toString();
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

	// Clean and sanitize input - remove any @ symbol that might have gotten prepended
	let cleanImageUrl = imageUrl.trim();
	if (cleanImageUrl.startsWith('@')) {
		cleanImageUrl = cleanImageUrl.substring(1);
	}

	// For non-IPFS URLs, we can't create responsive variants, so return empty srcset
	// The browser will use the main src attribute
	if (!isIpfsUrl(cleanImageUrl)) {
		return '';
	}

	// For GIFs, don't create responsive variants to preserve animation
	// The browser will use the main src attribute
	if (isGifFile(cleanImageUrl, options.mimeType)) {
		return '';
	}

	const srcsetEntries = sizes.map(size => {
		const optimizedUrl = buildOptimizedImageUrl(cleanImageUrl, {
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

	// Clean and sanitize input - remove any @ symbol that might have gotten prepended
	let cleanImageUrl = imageUrl.trim();
	if (cleanImageUrl.startsWith('@')) {
		cleanImageUrl = cleanImageUrl.substring(1);
	}

	// For non-IPFS URLs, we can't create retina variants, so return the original URL for both
	if (!isIpfsUrl(cleanImageUrl)) {
		return { src1x: cleanImageUrl, src2x: cleanImageUrl };
	}

	// For GIFs, don't create retina variants to preserve animation
	// Return the original URL for both
	if (isGifFile(cleanImageUrl, options.mimeType)) {
		const directUrl = buildDirectImageUrl(cleanImageUrl);
		return { src1x: directUrl, src2x: directUrl };
	}

	const src1x = buildOptimizedImageUrl(cleanImageUrl, {
		...options,
		width,
		dpr: 1
	});

	const src2x = buildOptimizedImageUrl(cleanImageUrl, {
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
		small: (imageUrl: string) => buildAvatarOptimizedImageUrl(imageUrl, 'sm'),
		medium: (imageUrl: string) => buildAvatarOptimizedImageUrl(imageUrl, 'md'),
		large: (imageUrl: string) => buildAvatarOptimizedImageUrl(imageUrl, 'lg')
	},

	// Artwork thumbnails
	thumbnail: {
		small: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 200,
			height: 200,
			fit: 'cover',
			format: (isSvgUrl(imageUrl) || isGifUrl(imageUrl)) ? 'auto' : 'webp',
			quality: 80
		}),
		medium: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 300,
			height: 300,
			fit: 'cover',
			format: (isSvgUrl(imageUrl) || isGifUrl(imageUrl)) ? 'auto' : 'webp',
			quality: 85
		}),
		large: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 400,
			height: 400,
			fit: 'cover',
			format: (isSvgUrl(imageUrl) || isGifUrl(imageUrl)) ? 'auto' : 'webp',
			quality: 85
		})
	},

	// Artwork display (maintaining aspect ratio)
	artwork: {
		small: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 400,
			fit: 'contain',
			format: (isSvgUrl(imageUrl) || isGifUrl(imageUrl)) ? 'auto' : 'webp',
			quality: 85
		}),
		medium: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 800,
			fit: 'contain',
			format: (isSvgUrl(imageUrl) || isGifUrl(imageUrl)) ? 'auto' : 'webp',
			quality: 90
		}),
		large: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 1200,
			fit: 'contain',
			format: (isSvgUrl(imageUrl) || isGifUrl(imageUrl)) ? 'auto' : 'webp',
			quality: 90
		}),
		fullscreen: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
			width: 1920,
			fit: 'contain',
			format: (isSvgUrl(imageUrl) || isGifUrl(imageUrl)) ? 'auto' : 'webp',
			quality: 95
		})
	},

	// Grid/collection views
	grid: {
		small: (imageUrl: string) => buildGridOptimizedImageUrl(imageUrl, { size: 'small', aspectRatio: 'square' }),
		medium: (imageUrl: string) => buildGridOptimizedImageUrl(imageUrl, { size: 'medium', aspectRatio: 'square' })
	},

	// Preview/hover images
	preview: (imageUrl: string) => buildOptimizedImageUrl(imageUrl, {
		width: 320,
		height: 220,
		fit: 'cover',
		format: (isSvgUrl(imageUrl) || isGifUrl(imageUrl)) ? 'auto' : 'webp',
		quality: 80
	})
};

/**
 * Helper class for building complex image optimization URLs
 */
export class ImageOptimizer {
	private baseUrl: string;
	private defaultOptions: ImageOptimizationOptions;

	constructor(baseUrl: string = IPFS_DIRECT_ENDPOINT, defaultOptions: ImageOptimizationOptions = {}) {
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
export const defaultImageOptimizer = new ImageOptimizer(IPFS_DIRECT_ENDPOINT, {
	format: 'auto',
	quality: 85,
	metadata: 'copyright'
});

/**
 * Build an image URL with a complete fallback strategy for IPFS content
 * This is a higher-level function that provides:
 * 1. Optimized/transformed URL (if IPFS and transformable)
 * 2. Direct IPFS URL fallback (if optimization fails)
 * 3. Basic IPFS gateway URL fallback (if direct fails)
 * 4. Generic fallback image (if all else fails)
 */
export function buildImageUrlWithFallback(
	imageUrl: string | null | undefined,
	options: ImageOptimizationOptions & {
		enableOptimizations?: boolean;
		fallbackImage?: string;
	} = {}
): {
	primaryUrl: string;
	fallbackUrls: string[];
	isIpfs: boolean;
	canOptimize: boolean;
} {
	const { enableOptimizations = true, fallbackImage = '/images/placeholder.webp', ...optimizationOptions } = options;
	
	if (!imageUrl) {
		return {
			primaryUrl: fallbackImage,
			fallbackUrls: [],
			isIpfs: false,
			canOptimize: false
		};
	}

	const isIpfsContent = isIpfsUrl(imageUrl);
	const canOptimizeContent = isIpfsContent && !isSvgUrl(imageUrl) && !isGifFile(imageUrl, optimizationOptions.mimeType);
	const fallbacks: string[] = [];

	let primaryUrl = imageUrl;

	if (isIpfsContent) {
		// For IPFS content, build a chain of fallbacks
		if (enableOptimizations && canOptimizeContent) {
			// Try optimized version first
			primaryUrl = buildOptimizedImageUrl(imageUrl, optimizationOptions);
			
			// Add direct IPFS as first fallback
			const directUrl = buildDirectImageUrl(imageUrl);
			if (directUrl && directUrl !== primaryUrl) {
				fallbacks.push(directUrl);
			}
		} else {
			// If can't optimize, use direct IPFS URL
			primaryUrl = buildDirectImageUrl(imageUrl) || imageUrl;
		}
		
		// Add basic IPFS gateway as fallback
		const basicIpfsUrl = ipfsToHttpUrl(imageUrl);
		if (basicIpfsUrl && !fallbacks.includes(basicIpfsUrl) && basicIpfsUrl !== primaryUrl) {
			fallbacks.push(basicIpfsUrl);
		}
	}

	// Add generic fallback image as final option
	if (fallbackImage && !fallbacks.includes(fallbackImage)) {
		fallbacks.push(fallbackImage);
	}

	return {
		primaryUrl,
		fallbackUrls: fallbacks,
		isIpfs: isIpfsContent,
		canOptimize: canOptimizeContent
	};
}

/**
 * Optimized settings specifically for grid images to maximize Pinata performance
 */
export function buildGridOptimizedImageUrl(
	imageUrl: string | null | undefined,
	options: {
		size?: 'small' | 'medium' | 'large';
		aspectRatio?: 'square' | 'auto';
		quality?: number;
		mimeType?: string | null;
	} = {}
): string {
	if (!imageUrl) return '';

	const { size = 'medium', aspectRatio = 'square', quality, mimeType } = options;

	// Check if this is a GIF - preserve original size and format
	const isGif = mimeType === 'image/gif';
	if (isGif) {
		return buildOptimizedImageUrl(imageUrl, {
			format: 'auto', // Preserve GIF format
			fit: 'contain'
		});
	}

	// Grid-specific size mappings optimized for Pinata
	const gridSizes = {
		small: { width: 250, height: 250 },
		medium: { width: 300, height: 300 },
		large: { width: 400, height: 400 }
	};

	const sizeConfig = gridSizes[size];
	const gridQuality = quality || 50; // Optimized for grid thumbnails
	const gridFit = 'contain'; // Always show full artwork

	return buildOptimizedImageUrl(imageUrl, {
		width: sizeConfig.width,
		height: aspectRatio === 'square' ? sizeConfig.height : undefined,
		quality: gridQuality,
		fit: gridFit,
		format: 'webp'
	});
}

/**
 * Optimized settings specifically for avatar images in grids
 */
export function buildAvatarOptimizedImageUrl(
	imageUrl: string | null | undefined,
	size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md'
): string {
	if (!imageUrl) return '';

	const avatarSizes = {
		xs: 16,
		sm: 20,
		md: 32,
		lg: 48,
		xl: 64
	};

	const avatarSize = avatarSizes[size];

	return buildOptimizedImageUrl(imageUrl, {
		width: avatarSize,
		height: avatarSize,
		fit: 'cover',
		gravity: 'center',
		format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
		quality: 80
	});
} 