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