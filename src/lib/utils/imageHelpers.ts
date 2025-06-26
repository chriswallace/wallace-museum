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

/**
 * Responsive image configurations for different use cases
 */
export const ResponsiveImageConfigs = {
	// Artwork thumbnails in grids
	artworkThumbnail: {
		sizes: '(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw',
		responsiveSizes: [200, 300, 400, 500],
		defaultWidth: 300,
		quality: 80,
		fit: 'cover' as const,
		format: 'webp' as const
	},

	// Artwork display (main viewing)
	artworkDisplay: {
		sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px',
		responsiveSizes: [400, 800, 1200, 1600],
		defaultWidth: 1200,
		quality: 90,
		fit: 'contain' as const,
		format: 'webp' as const
	},

	// Artist avatars
	avatar: {
		sizes: '(max-width: 640px) 32px, (max-width: 1024px) 48px, 64px',
		responsiveSizes: [32, 48, 64, 96],
		defaultWidth: 64,
		quality: 85,
		fit: 'cover' as const,
		format: 'webp' as const
	},

	// Collection banners/headers
	collectionBanner: {
		sizes: '100vw',
		responsiveSizes: [400, 800, 1200, 1920],
		defaultWidth: 1200,
		quality: 85,
		fit: 'cover' as const,
		format: 'webp' as const
	},

	// Featured artwork on homepage
	featuredArtwork: {
		sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px',
		responsiveSizes: [400, 600, 800, 1200],
		defaultWidth: 600,
		quality: 85,
		fit: 'contain' as const,
		format: 'webp' as const
	}
};

/**
 * Generate responsive image props for OptimizedImage component
 */
export function getResponsiveImageProps(
	imageUrl: string | null | undefined,
	config: keyof typeof ResponsiveImageConfigs,
	overrides: {
		width?: number;
		height?: number;
		quality?: number;
		fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
		format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
		mimeType?: string | null;
	} = {}
) {
	if (!imageUrl) return {};

	const imageConfig = ResponsiveImageConfigs[config];
	
	return {
		src: imageUrl,
		width: overrides.width || imageConfig.defaultWidth,
		height: overrides.height,
		sizes: imageConfig.sizes,
		responsive: true,
		responsiveSizes: imageConfig.responsiveSizes,
		quality: overrides.quality || imageConfig.quality,
		fit: overrides.fit || imageConfig.fit,
		format: overrides.format || imageConfig.format,
		loading: 'lazy' as const,
		mimeType: overrides.mimeType
	};
}

/**
 * Generate optimized URL with viewport-aware sizing
 */
export function getViewportOptimizedUrl(
	imageUrl: string | null | undefined,
	context: 'thumbnail' | 'display' | 'avatar' | 'banner' | 'featured',
	options: {
		width?: number;
		height?: number;
		quality?: number;
		mimeType?: string | null;
	} = {}
): string {
	if (!imageUrl) return '';

	const configs = {
		thumbnail: { width: 300, quality: 80, fit: 'cover' as const },
		display: { width: 1200, quality: 90, fit: 'contain' as const },
		avatar: { width: 64, quality: 85, fit: 'cover' as const },
		banner: { width: 1200, quality: 85, fit: 'cover' as const },
		featured: { width: 600, quality: 85, fit: 'contain' as const }
	};

	const config = configs[context];
	
	return buildOptimizedImageUrl(imageUrl, {
		width: options.width || config.width,
		height: options.height,
		quality: options.quality || config.quality,
		fit: config.fit,
		format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
		mimeType: options.mimeType
	});
}

/**
 * Check if image should use lazy loading based on viewport position
 */
export function shouldUseLazyLoading(index: number, isAboveFold: boolean = false): 'lazy' | 'eager' {
	// Load first few images eagerly, especially if they're above the fold
	if (isAboveFold || index < 3) {
		return 'eager';
	}
	return 'lazy';
}

/**
 * Intersection Observer utility for progressive image loading
 */
export function createImageObserver() {
	if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
		return null;
	}

	return new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					const img = entry.target as HTMLImageElement;
					if (img.dataset.src) {
						img.src = img.dataset.src;
						img.removeAttribute('data-src');
					}
					if (img.dataset.srcset) {
						img.srcset = img.dataset.srcset;
						img.removeAttribute('data-srcset');
					}
				}
			});
		},
		{
			rootMargin: '50px 0px', // Start loading 50px before the image enters viewport
			threshold: 0.1
		}
	);
}

/**
 * Enhanced responsive image configuration with better defaults
 */
export function getEnhancedResponsiveProps(
	imageUrl: string | null | undefined,
	context: 'grid' | 'hero' | 'detail' | 'thumbnail' | 'avatar',
	options: {
		aspectRatio?: string;
		priority?: boolean; // For LCP images
		mimeType?: string | null;
		customSizes?: string;
		customWidths?: number[];
	} = {}
) {
	if (!imageUrl) return {};

	const configs = {
		grid: {
			sizes: options.customSizes || '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
			widths: options.customWidths || [200, 300, 400, 500],
			defaultWidth: 300,
			quality: 80
		},
		hero: {
			sizes: options.customSizes || '100vw',
			widths: options.customWidths || [640, 1024, 1280, 1920],
			defaultWidth: 1280,
			quality: 90
		},
		detail: {
			sizes: options.customSizes || '(max-width: 1024px) 100vw, 1200px',
			widths: options.customWidths || [400, 800, 1200, 1600],
			defaultWidth: 1200,
			quality: 90
		},
		thumbnail: {
			sizes: options.customSizes || '(max-width: 640px) 150px, 200px',
			widths: options.customWidths || [150, 200, 300, 400],
			defaultWidth: 200,
			quality: 85
		},
		avatar: {
			sizes: options.customSizes || '(max-width: 640px) 32px, 64px',
			widths: options.customWidths || [32, 48, 64, 96],
			defaultWidth: 64,
			quality: 85
		}
	};

	const config = configs[context];

	return {
		src: imageUrl,
		width: config.defaultWidth,
		sizes: config.sizes,
		responsive: true,
		responsiveSizes: config.widths,
		quality: config.quality,
		fit: context === 'avatar' || context === 'thumbnail' ? 'cover' : 'contain',
		format: isSvgUrl(imageUrl) ? 'auto' : 'webp',
		loading: options.priority ? 'eager' : 'lazy',
		aspectRatio: options.aspectRatio,
		mimeType: options.mimeType
	};
} 