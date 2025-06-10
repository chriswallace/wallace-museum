/**
 * Media URL cascading utilities for artwork display
 */

export interface MediaUrls {
	generatorUrl?: string | null;
	animationUrl?: string | null;
	imageUrl?: string | null;
	thumbnailUrl?: string | null;
}

export interface MediaResult {
	url: string;
	type: 'generator' | 'animation' | 'image';
}

/**
 * Get the best media URL based on priority and context
 * @param urls - Object containing all available media URLs
 * @param context - Display context ('fullscreen' for main display, 'thumbnail' for grids/cards)
 * @param mime - MIME type of the media
 */
export function getBestMediaUrl(
	urls: MediaUrls, 
	context: 'fullscreen' | 'thumbnail' = 'fullscreen',
	mime?: string | null
): MediaResult | null {
	// If we have a video MIME type, prioritize animation URL regardless of context
	if (mime && mime.startsWith('video/')) {
		if (urls.animationUrl) return { url: urls.animationUrl, type: 'animation' };
		if (urls.imageUrl) return { url: urls.imageUrl, type: 'image' }; // imageUrl might be the video
		if (urls.thumbnailUrl) return { url: urls.thumbnailUrl, type: 'image' };
		if (urls.generatorUrl) return { url: urls.generatorUrl, type: 'generator' };
	}
	
	// If we have a GIF MIME type, treat it as animation
	if (mime === 'image/gif') {
		if (urls.animationUrl) return { url: urls.animationUrl, type: 'animation' };
		if (urls.imageUrl) return { url: urls.imageUrl, type: 'image' };
		if (urls.thumbnailUrl) return { url: urls.thumbnailUrl, type: 'image' };
	}
	
	if (context === 'thumbnail') {
		// For thumbnails/grids, prioritize static images (but only if not video content)
		if (urls.thumbnailUrl) return { url: urls.thumbnailUrl, type: 'image' };
		if (urls.imageUrl) return { url: urls.imageUrl, type: 'image' };
		
		// Only use animation URL if it's likely to be a static image or GIF
		if (urls.animationUrl) {
			if (mime === 'image/gif' || urls.animationUrl.match(/\.(gif|jpg|jpeg|png|webp)$/i)) {
				return { url: urls.animationUrl, type: 'animation' };
			}
		}
		
		// Last resort for thumbnails
		if (urls.generatorUrl) return { url: urls.generatorUrl, type: 'generator' };
	} else {
		// For fullscreen display, prioritize interactive content
		if (urls.generatorUrl) return { url: urls.generatorUrl, type: 'generator' };
		if (urls.animationUrl) return { url: urls.animationUrl, type: 'animation' };
		if (urls.imageUrl) return { url: urls.imageUrl, type: 'image' };
		if (urls.thumbnailUrl) return { url: urls.thumbnailUrl, type: 'image' };
	}
	
	return null;
}

/**
 * Determine how media should be displayed based on URL type and MIME type
 */
export function getMediaDisplayType(
	mediaResult: MediaResult | null,
	mime?: string | null
): 'video' | 'iframe' | 'image' | null {
	if (!mediaResult) return null;
	
	const { url, type } = mediaResult;
	
	// Generator URLs are always displayed as iframes
	if (type === 'generator') return 'iframe';
	
	// Check MIME type first
	if (mime) {
		if (mime.startsWith('video/')) return 'video';
		if (mime === 'image/gif') return 'image'; // Display GIFs as video for better control
		if (mime.startsWith('application/') || mime === 'text/html') return 'iframe';
		if (mime.startsWith('image/')) return 'image';
	}
	
	// Fallback to URL-based detection
	if (url.match(/\.(mp4|webm|mov|avi)$/i)) return 'video';
	if (url.match(/\.gif$/i)) return 'video';
	if (url.includes('generator.artblocks.io') || url.includes('fxhash.xyz')) return 'iframe';
	if (url.match(/\.(html|htm)$/i)) return 'iframe';
	
	// Default to image
	return 'image';
}

/**
 * Video optimization options for feed display
 * 
 * Note: Unlike images, we don't currently have a video transformation service,
 * so these utilities focus on applying optimal sizing constraints and playback
 * attributes for different contexts (feed, thumbnail, preview, fullscreen).
 * 
 * The optimization primarily works by:
 * - Setting reasonable max dimensions to prevent oversized videos
 * - Using appropriate preload strategies to balance performance and UX
 * - Configuring autoplay, loop, and muted attributes for feed contexts
 * - Applying CSS constraints for consistent sizing
 */
export interface VideoOptimizationOptions {
	maxWidth?: number;
	maxHeight?: number;
	quality?: 'low' | 'medium' | 'high';
	preload?: 'none' | 'metadata' | 'auto';
	autoplay?: boolean;
	loop?: boolean;
	muted?: boolean;
	playsinline?: boolean;
}

/**
 * Get optimized video attributes for feed display
 */
export function getOptimizedVideoAttributes(
	videoUrl: string,
	options: VideoOptimizationOptions = {}
): {
	src: string;
	width: string;
	height: string;
	style: string;
	preload: string;
	autoplay: boolean;
	loop: boolean;
	muted: boolean;
	playsinline: boolean;
} {
	const {
		maxWidth = 600,
		maxHeight = 600,
		quality = 'medium',
		preload = 'metadata',
		autoplay = true,
		loop = true,
		muted = true,
		playsinline = true
	} = options;

	// For now, we don't have video transformation service, so we use the original URL
	// but apply sizing constraints via CSS
	const style = `max-width: ${maxWidth}px; max-height: ${maxHeight}px; object-fit: contain; background: #000;`;

	return {
		src: videoUrl,
		width: maxWidth.toString(),
		height: maxHeight.toString(),
		style,
		preload,
		autoplay,
		loop,
		muted,
		playsinline
	};
}

/**
 * Video optimization presets for different contexts
 */
export const VideoPresets = {
	feed: (videoUrl: string) => getOptimizedVideoAttributes(videoUrl, {
		maxWidth: 600,
		maxHeight: 600,
		quality: 'medium',
		preload: 'metadata',
		autoplay: true,
		loop: true,
		muted: true,
		playsinline: true
	}),
	
	thumbnail: (videoUrl: string) => getOptimizedVideoAttributes(videoUrl, {
		maxWidth: 300,
		maxHeight: 300,
		quality: 'low',
		preload: 'metadata',
		autoplay: true,
		loop: true,
		muted: true,
		playsinline: true
	}),
	
	preview: (videoUrl: string) => getOptimizedVideoAttributes(videoUrl, {
		maxWidth: 400,
		maxHeight: 400,
		quality: 'medium',
		preload: 'metadata',
		autoplay: true,
		loop: true,
		muted: true,
		playsinline: true
	}),
	
	mobile: (videoUrl: string) => getOptimizedVideoAttributes(videoUrl, {
		maxWidth: 800,
		maxHeight: 800,
		quality: 'medium',
		preload: 'metadata',
		autoplay: true,
		loop: true,
		muted: true,
		playsinline: true
	}),
	
	fullscreen: (videoUrl: string) => getOptimizedVideoAttributes(videoUrl, {
		maxWidth: 1920,
		maxHeight: 1080,
		quality: 'high',
		preload: 'auto',
		autoplay: true,
		loop: true,
		muted: false,
		playsinline: true
	})
}; 