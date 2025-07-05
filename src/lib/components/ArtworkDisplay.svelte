<script lang="ts">
	import { onMount } from 'svelte';
	import { ipfsToHttpUrl, ipfsToHttpUrlForHtml, IPFS_GATEWAYS } from '$lib/mediaUtils';
	import { getBestMediaUrl, getMediaDisplayType } from '$lib/utils/mediaHelpers';
	import { buildOptimizedImageUrl, buildDirectImageUrl } from '$lib/imageOptimization';
	import MediaChromeVideoPlayer from './MediaChromeVideoPlayer.svelte';

	interface Artwork {
		generatorUrl?: string | null;
		animationUrl?: string | null;
		imageUrl?: string | null;
		thumbnailUrl?: string | null;
		mime?: string | null;
		title: string;
		dimensions?: {
			width: number;
			height: number;
		} | null;
		fullscreen?: boolean;
	}

	export let artwork: Artwork;
	export let isInFullscreenMode: boolean = false;

	let mediaContainer: HTMLElement;
	let constrainWidth = true; // true = constrain width, false = constrain height
	let isMediaLoaded = false;
	let hasImageError = false;
	let currentImageUrl = '';
	let loadTimeout: ReturnType<typeof setTimeout> | null = null;
	let previousUrl = ''; // Track URL changes

	// Calculate aspect ratio from artwork dimensions
	$: aspectRatio = artwork.dimensions 
		? `${artwork.dimensions.width} / ${artwork.dimensions.height}`
		: '1 / 1'; // Square fallback

	// Get the best media URL and display type
	$: mediaUrls = {
		generatorUrl: artwork.generatorUrl,
		animationUrl: artwork.animationUrl,
		imageUrl: artwork.imageUrl,
		thumbnailUrl: artwork.thumbnailUrl
	};

	$: bestMedia = getBestMediaUrl(mediaUrls, 'fullscreen', artwork.mime);
	$: displayUrl = bestMedia?.url || '';
	$: mediaType = getMediaDisplayType(bestMedia, artwork.mime);

	// Transform URLs - use different functions based on media type
	$: transformedUrl = displayUrl 
		? (mediaType === 'iframe' 
			? ipfsToHttpUrlForHtml(displayUrl, artwork.mime || undefined)
			: ipfsToHttpUrl(displayUrl, IPFS_GATEWAYS[0], true, artwork.mime || undefined))
		: '';
	
	$: optimizedImageUrl = mediaType === 'image' && displayUrl 
		? buildOptimizedImageUrl(displayUrl, { width: 1200, fit: 'contain', format: 'auto', quality: 85, mimeType: artwork.mime })
		: transformedUrl;
	
	// Create fallback URL for IPFS images - this will be the direct IPFS URL without transformations
	$: fallbackImageUrl = mediaType === 'image' && displayUrl 
		? buildDirectImageUrl(displayUrl) || transformedUrl
		: transformedUrl;

	// Determine which URL to use based on error state
	$: {
		if (mediaType === 'image') {
			if (hasImageError && optimizedImageUrl !== fallbackImageUrl) {
				// Use fallback URL if optimized version failed
				currentImageUrl = fallbackImageUrl;
			} else {
				// Use optimized URL by default
				currentImageUrl = optimizedImageUrl;
			}
		} else {
			// For non-image media, always use transformed URL
			currentImageUrl = transformedUrl;
		}
	}

	// Simple loading state management - reset when URL actually changes
	$: {
		const urlToCheck = mediaType === 'image' ? currentImageUrl : transformedUrl;
		if (urlToCheck && urlToCheck !== previousUrl) {
			// Clear any existing timeout
			if (loadTimeout) {
				clearTimeout(loadTimeout);
			}
			
			// Reset state
			isMediaLoaded = false;
			previousUrl = urlToCheck;
			
			// Set fallback timeout
			loadTimeout = setTimeout(() => {
				isMediaLoaded = true;
				loadTimeout = null;
			}, 3000);
		}
	}

	// Reset error state when base display URL changes
	$: if (displayUrl) {
		hasImageError = false;
	}

	function calculateConstraint() {
		if (!artwork.dimensions) {
			// Default to constraining width when no dimensions available
			constrainWidth = true;
			return;
		}

		const artworkWidth = artwork.dimensions.width;
		const artworkHeight = artwork.dimensions.height;
		
		// For square artworks, we need to check which container dimension is smaller
		// and constrain based on that to prevent overflow
		if (artworkWidth === artworkHeight) {
			// Square artwork - constrain based on container aspect ratio
			if (mediaContainer) {
				const containerRect = mediaContainer.getBoundingClientRect();
				const containerAspectRatio = containerRect.width / containerRect.height;
				
				// If container is wider than tall, constrain height (set height to 100%, width to auto)
				// If container is taller than wide, constrain width (set width to 100%, height to auto)
				constrainWidth = containerAspectRatio <= 1;
			} else {
				// Fallback: default to constraining width for squares
				constrainWidth = true;
			}
		} else {
			// Non-square artwork - constrain the longest dimension of the artwork
			// If artwork is wider than it is tall, constrain width (set width to 100%, height to auto)
			// If artwork is taller than it is wide, constrain height (set height to 100%, width to auto)
			constrainWidth = artworkWidth >= artworkHeight;
		}
	}



	function handleMediaLoad() {
		isMediaLoaded = true;
		if (loadTimeout) {
			clearTimeout(loadTimeout);
			loadTimeout = null;
		}
	}

	function handleImageError() {
		console.warn(`[ArtworkDisplay] Image failed to load: ${currentImageUrl}`);
		
		// If we're currently showing the optimized URL and it failed, try the fallback
		if (!hasImageError && mediaType === 'image' && optimizedImageUrl !== fallbackImageUrl) {
			console.log(`[ArtworkDisplay] Trying fallback URL: ${fallbackImageUrl}`);
			hasImageError = true;
			isMediaLoaded = false;
		} else {
			// If fallback also failed, just show as loaded to prevent infinite retry
			console.warn(`[ArtworkDisplay] All image URLs failed for artwork: ${artwork.title}`);
			isMediaLoaded = true;
		}
	}

	onMount(() => {
		// Log missing media for troubleshooting
		if (!displayUrl) {
			console.warn(`[ArtworkDisplay] No display URL found for artwork: ${artwork.title}`);
		}
		
		calculateConstraint();
		
		// Set up resize observer to recalculate constraints when container size changes
		let resizeObserver: ResizeObserver | null = null;
		if (mediaContainer && typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				calculateConstraint();
			});
			resizeObserver.observe(mediaContainer);
		}
		
		return () => {
			// Clear timeout on component cleanup
			if (loadTimeout) {
				clearTimeout(loadTimeout);
				loadTimeout = null;
			}
			// Clean up resize observer
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
		};
	});

	// Recalculate when artwork changes
	$: if (artwork.dimensions) {
		calculateConstraint();
	}

	// Dynamic style based on constraint - fullscreen behavior only applies in browser fullscreen
	$: mediaStyle = (isInFullscreenMode && artwork.fullscreen)
		? 'width: 100%; height: 100%; object-fit: cover;'
		: constrainWidth 
		? 'width: 100%; height: auto; max-height: 100%;' 
		: 'width: auto; height: 100%; max-width: 100%;';

	// Special handling for iframe aspect ratio - ensure proper sizing within container
	$: iframeStyle = (isInFullscreenMode && artwork.fullscreen)
		? 'width: 100%; height: 100%; border: none;'
		: mediaType === 'iframe' && artwork.dimensions
		? (constrainWidth 
			? `width: 100%; height: auto; max-height: 100%; aspect-ratio: ${artwork.dimensions.width} / ${artwork.dimensions.height};`
			: `width: auto; height: 100%; max-width: 100%; aspect-ratio: ${artwork.dimensions.width} / ${artwork.dimensions.height};`)
		: mediaType === 'iframe' 
		? (constrainWidth 
			? 'width: 100%; height: auto; max-height: 100%; aspect-ratio: 1 / 1;'
			: 'width: auto; height: 100%; max-width: 100%; aspect-ratio: 1 / 1;')
		: mediaStyle;
</script>

<div class="media-container" class:isMediaLoaded style="transform: scale(1) translateY(0%);" bind:this={mediaContainer}>
	{#if !displayUrl}
		<div class="no-media">
			<div class="no-media-icon">
				<svg viewBox="0 0 24 24" fill="currentColor" class="icon">
					<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
				</svg>
			</div>
			<p class="no-media-text">Media not available</p>
			<p class="no-media-subtitle">This artwork's media files could not be loaded</p>
		</div>
	{:else if mediaType === 'video'}
		<MediaChromeVideoPlayer
			src={transformedUrl}
			title={artwork.title}
			aspectRatio={aspectRatio}
			autoplay={true}
			loop={true}
			muted={true}
			width="100%"
			height="100%"
			style="object-fit: contain; {mediaStyle}"
			on:loadeddata={handleMediaLoad}
		/>
	{:else if mediaType === 'iframe'}
		<iframe
			src={transformedUrl}
			title="Interactive Artwork"
			style="border: none; {iframeStyle}"
			allowfullscreen
			on:load={handleMediaLoad}
		></iframe>
	{:else if mediaType === 'image'}
		<img
			src={currentImageUrl}
			alt={artwork.title}
			style="object-fit: contain; {mediaStyle}"
			loading="eager"
			on:load={handleMediaLoad}
			on:error={handleImageError}
		/>
	{/if}
</div>
<style lang="scss">
	.media-container {
		@apply relative w-full h-full overflow-hidden box-border flex items-center justify-center;
		/* Ensure the container has proper dimensions and can shrink */
		min-width: 0;
		min-height: 0;
		/* Prevent overflow by ensuring flex behavior */
		flex-shrink: 1;
		/* Ensure container maintains its bounds */
		max-width: 100%;
		max-height: 100%;
	}

	.media-container img,
	.media-container video,
	.media-container iframe {
		@apply max-w-full max-h-full object-contain box-border opacity-100 scale-100;
		transition: opacity 1000ms cubic-bezier(0.23, 1, 0.32, 1), transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
		/* Ensure media elements respect container bounds */
		flex-shrink: 1;
		/* Force elements to fit within container - defensive sizing */
		max-width: 100% !important;
		max-height: 100% !important;
		width: auto;
		height: auto;
	}

	/* Special handling for iframes since they don't support object-fit */
	.media-container iframe {
		object-fit: unset; /* Remove object-fit for iframes as it doesn't apply */
		/* Aspect ratio and sizing will be handled via inline styles */
	}

	/* Only apply loading state when media is not loaded */
	.media-container:not(.isMediaLoaded) img,
	.media-container:not(.isMediaLoaded) video,
	.media-container:not(.isMediaLoaded) iframe {
		@apply opacity-0 scale-[0.8];
	}

	.no-media {
		@apply flex items-center justify-center text-gray-600 dark:text-gray-400 text-sm w-full h-full;
	}
</style>
