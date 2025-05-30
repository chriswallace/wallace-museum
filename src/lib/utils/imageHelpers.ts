/**
 * Helper functions for common image optimization patterns
 */

import { buildOptimizedImageUrl, createResponsiveSrcSet, type ImageOptimizationOptions } from '$lib/imageOptimization';

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
 * Common image sizes used throughout the application
 */
export const ImageSizes = {
	avatar: {
		small: 32,
		medium: 64,
		large: 128
	},
	thumbnail: {
		small: 200,
		medium: 300,
		large: 400
	},
	artwork: {
		small: 400,
		medium: 800,
		large: 1200,
		fullscreen: 1920
	},
	grid: {
		small: 250,
		medium: 350
	},
	preview: {
		width: 320,
		height: 220
	}
} as const;

/**
 * Responsive breakpoints for different image contexts
 */
export const ResponsiveBreakpoints = {
	avatar: [32, 64, 128],
	thumbnail: [200, 300, 400],
	artwork: [400, 800, 1200, 1920],
	grid: [250, 350, 500]
};

/**
 * Generate optimized avatar URL
 */
export function getOptimizedAvatarUrl(
	imageUrl: string | null | undefined,
	size: keyof typeof ImageSizes.avatar = 'medium'
): string {
	if (!imageUrl) return '';
	
	const dimension = ImageSizes.avatar[size];
	return buildOptimizedImageUrl(imageUrl, {
		width: dimension,
		height: dimension,
		fit: 'cover',
		format: isSvgUrl(imageUrl) ? 'auto' : 'webp', // Preserve SVG format
		quality: 85
	});
}

/**
 * Generate optimized artwork thumbnail URL
 */
export function getOptimizedThumbnailUrl(
	imageUrl: string | null | undefined,
	size: keyof typeof ImageSizes.thumbnail = 'medium'
): string {
	if (!imageUrl) return '';
	
	const dimension = ImageSizes.thumbnail[size];
	return buildOptimizedImageUrl(imageUrl, {
		width: dimension,
		height: dimension,
		fit: 'cover',
		format: isSvgUrl(imageUrl) ? 'auto' : 'webp', // Preserve SVG format
		quality: 80
	});
}

/**
 * Generate optimized artwork display URL
 */
export function getOptimizedArtworkUrl(
	imageUrl: string | null | undefined,
	size: keyof typeof ImageSizes.artwork = 'medium'
): string {
	if (!imageUrl) return '';
	
	const width = ImageSizes.artwork[size];
	return buildOptimizedImageUrl(imageUrl, {
		width,
		fit: 'contain',
		format: isSvgUrl(imageUrl) ? 'auto' : 'webp', // Preserve SVG format
		quality: size === 'fullscreen' ? 95 : 90
	});
}

/**
 * Generate responsive srcset for artwork images
 */
export function getArtworkResponsiveSrcSet(
	imageUrl: string | null | undefined,
	options: Omit<ImageOptimizationOptions, 'width'> = {}
): string {
	if (!imageUrl) return '';
	
	// Skip responsive srcset for SVGs as they scale naturally
	if (isSvgUrl(imageUrl)) {
		return '';
	}
	
	return createResponsiveSrcSet(imageUrl, ResponsiveBreakpoints.artwork, {
		fit: 'contain',
		format: 'webp',
		quality: 90,
		...options
	});
}

/**
 * Generate responsive srcset for thumbnail images
 */
export function getThumbnailResponsiveSrcSet(
	imageUrl: string | null | undefined,
	options: Omit<ImageOptimizationOptions, 'width'> = {}
): string {
	if (!imageUrl) return '';
	
	// Skip responsive srcset for SVGs as they scale naturally
	if (isSvgUrl(imageUrl)) {
		return '';
	}
	
	return createResponsiveSrcSet(imageUrl, ResponsiveBreakpoints.thumbnail, {
		fit: 'cover',
		format: 'webp',
		quality: 80,
		...options
	});
}

/**
 * Get appropriate sizes attribute for responsive images
 */
export function getResponsiveSizes(context: 'artwork' | 'thumbnail' | 'grid' | 'avatar'): string {
	switch (context) {
		case 'artwork':
			return '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw';
		case 'thumbnail':
			return '(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw';
		case 'grid':
			return '(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw';
		case 'avatar':
			return '64px';
		default:
			return '100vw';
	}
}

/**
 * Common image optimization configurations
 */
export const ImageConfigs = {
	avatar: {
		fit: 'cover' as const,
		format: 'webp' as const,
		quality: 85
	},
	thumbnail: {
		fit: 'cover' as const,
		format: 'webp' as const,
		quality: 80
	},
	artwork: {
		fit: 'contain' as const,
		format: 'webp' as const,
		quality: 90
	},
	artworkFullscreen: {
		fit: 'contain' as const,
		format: 'webp' as const,
		quality: 95
	},
	preview: {
		fit: 'cover' as const,
		format: 'webp' as const,
		quality: 80
	}
} as const; 