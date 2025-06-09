<script lang="ts">
	import { ipfsToHttpUrl, IPFS_GATEWAYS } from '$lib/mediaUtils';
	import { getBestMediaUrl, getMediaDisplayType } from '$lib/utils/mediaHelpers';
	import { buildOptimizedImageUrl, buildDirectImageUrl } from '$lib/imageOptimization';
	import VideoPlayer from './VideoPlayer.svelte';
	import IframeSkeleton from './IframeSkeleton.svelte';
	import OptimizedImage from './OptimizedImage.svelte';
	import { browser } from '$app/environment';

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
	}

	export let artwork: Artwork;
	export let dimensions: { width: number; height: number } | null = null;
	export let style: string = 'width: 100%; height: 100%;';
	export let fullscreen: boolean = false;
	export let showSkeleton: boolean = true;

	// State for fullscreen functionality
	let isInFullscreen = false;
	let fullscreenElement: HTMLElement | null = null;

	// State for iframe loading
	let isIframeLoading = true;

	// Use provided dimensions or fall back to artwork dimensions
	$: actualDimensions = dimensions || artwork.dimensions;

	// Calculate aspect ratio for CSS
	$: aspectRatio = actualDimensions 
		? `${actualDimensions.width} / ${actualDimensions.height}`
		: '1 / 1'; // Square fallback

	// Calculate artwork orientation and sizing
	$: artworkOrientation = actualDimensions 
		? actualDimensions.width > actualDimensions.height 
			? 'landscape' 
			: actualDimensions.width < actualDimensions.height 
				? 'portrait' 
				: 'square'
		: 'square';

	// Debug logging
	$: if (actualDimensions) {
		console.log('ArtworkDisplay dimensions:', {
			actualDimensions,
			aspectRatio,
			artworkOrientation,
			mediaType
		});
	}

	// Get the best media URL and display type
	$: artworkMediaUrls = {
		generatorUrl: artwork.generatorUrl,
		animationUrl: artwork.animationUrl,
		imageUrl: artwork.imageUrl,
		thumbnailUrl: artwork.thumbnailUrl
	};

	$: bestMedia = getBestMediaUrl(artworkMediaUrls, 'fullscreen', artwork.mime);
	$: mediaType = getMediaDisplayType(bestMedia, artwork.mime);
	$: displayUrl = bestMedia?.url || '';
	$: transformedUrl = displayUrl ? ipfsToHttpUrl(displayUrl, IPFS_GATEWAYS[0], true, artwork.mime || undefined) : '';

	// Get optimized image URL for display
	$: optimizedImageUrl = mediaType === 'image' && displayUrl 
		? buildOptimizedImageUrl(displayUrl, {
			width: actualDimensions?.width,
			height: actualDimensions?.height,
			quality: 70,
			format: 'webp',
			fit: 'contain'
		})
		: transformedUrl;

	// Get full-size image URL for fullscreen (no optimizations)
	$: fullSizeImageUrl = mediaType === 'image' && displayUrl 
		? buildDirectImageUrl(displayUrl)
		: transformedUrl;

	// Handle iframe load
	function handleIframeLoad() {
		isIframeLoading = false;
	}

	// Reset iframe loading state when URL changes
	$: if (transformedUrl && mediaType === 'iframe') {
		isIframeLoading = true;
	}

	// Handle fullscreen functionality
	function toggleFullscreen() {
		if (!browser || !fullscreenElement) return;

		if (!document.fullscreenElement) {
			fullscreenElement.requestFullscreen().then(() => {
				isInFullscreen = true;
			}).catch(err => {
				console.error('Error attempting to enable fullscreen:', err);
			});
		} else {
			document.exitFullscreen().then(() => {
				isInFullscreen = false;
			}).catch(err => {
				console.error('Error attempting to exit fullscreen:', err);
			});
		}
	}

	// Listen for fullscreen changes
	function handleFullscreenChange() {
		if (!browser) return;
		isInFullscreen = !!document.fullscreenElement;
	}

	// Check if fullscreen is supported and if this is an image (only in browser)
	$: canFullscreen = browser && (mediaType === 'image' || mediaType === 'iframe') && typeof document !== 'undefined' && 'requestFullscreen' in document.documentElement;

	// Disable skeleton loaders in fullscreen mode
	$: shouldShowSkeleton = showSkeleton && !isInFullscreen;
</script>

<svelte:window on:fullscreenchange={handleFullscreenChange} />

<div class="artwork-display" class:fullscreen bind:this={fullscreenElement}>
	{#if !displayUrl}
		<div class="no-media">
			<div class="no-media-content">
				<p>No media available</p>
			</div>
		</div>
	{:else if mediaType === 'video'}
		<VideoPlayer
			src={transformedUrl}
			autoplay={true}
			loop={true}
			muted={true}
			className="video-player-artwork"
			aspectRatio={aspectRatio}
			showSkeleton={shouldShowSkeleton}
		/>
	{:else if mediaType === 'iframe'}
		<div class="iframe-container">
			<iframe
				src={transformedUrl}
				class="interactive-content"
				title="Interactive Artwork"
				height={fullscreen ? '100%' : actualDimensions?.height}
				style={fullscreen ? 'height: 100%; width: 100%;' : `aspect-ratio: ${aspectRatio};`}
				allowfullscreen
				on:load={handleIframeLoad}
			></iframe>
			
			{#if canFullscreen && !isInFullscreen}
				<button 
					class="fullscreen-button"
					on:click={toggleFullscreen}
					aria-label="View fullscreen"
					title="View fullscreen"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
					</svg>
				</button>
			{/if}
		</div>
	{:else if mediaType === 'image'}
		<div class="image-container">
			<OptimizedImage
				src={isInFullscreen ? fullSizeImageUrl : optimizedImageUrl}
				alt={artwork.title}
				aspectRatio={aspectRatio}
				showSkeleton={shouldShowSkeleton}
				className="artwork-image {isInFullscreen ? 'fullscreen-image' : 'normal-image'}"
				style="aspect-ratio: {aspectRatio};"
			/>
			
			{#if canFullscreen && !isInFullscreen}
				<button 
					class="fullscreen-button"
					on:click={toggleFullscreen}
					aria-label="View fullscreen"
					title="View fullscreen"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
					</svg>
				</button>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	.artwork-display {
		@apply relative overflow-hidden h-full max-h-[82svh] md:pt-12 w-full flex items-center justify-center;
		/* Use flexbox to center content properly */
	}

	.no-media {
		@apply flex items-center justify-center bg-gray-100 rounded-sm;
	}

	.no-media-content {
		@apply text-center text-gray-600 text-sm;
	}

	.iframe-container {
		@apply relative w-full h-full flex items-center justify-center;
	}

	.interactive-content {
		@apply relative border-none bg-transparent transition-opacity duration-200 ease-in-out max-h-full max-w-full;
		/* Positioned above the loader */
		aspect-ratio: var(--artwork-aspect-ratio);
	}

	.interactive-content.hidden {
		@apply opacity-0 pointer-events-none;
	}

	.image-container {
		@apply relative w-full h-full flex items-center justify-center;
	}

	.fullscreen-button {
		@apply absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white border-none rounded-md p-2 cursor-pointer transition-opacity duration-200 ease-linear z-10 flex items-center justify-center;
		opacity: 0; /* Hidden by default, show on hover */
	}

	.fullscreen-button:hover {
		@apply bg-black bg-opacity-90;
		opacity: 1;
	}

	.image-container:hover .fullscreen-button,
	.iframe-container:hover .fullscreen-button {
		opacity: 1;
	}

	/* Show button on mobile/touch devices */
	@media (hover: none) {
		.fullscreen-button {
			opacity: 0.8;
		}
	}

	/* Ensure video and iframe elements are properly centered */
	:global(.video-player-artwork),
	.interactive-content,
	:global(.artwork-image) {
		display: block;
		margin: 0 auto;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	/* Image styling for normal display */
	:global(.artwork-image.normal-image) {
		max-height: 100% !important;
		max-width: 100% !important;
		width: auto !important;
		height: auto !important;
	}

	/* Image styling for fullscreen display */
	:global(.artwork-image.fullscreen-image) {
		max-width: 100% !important;
		max-height: 100% !important;
		width: auto !important;
		height: auto !important;
	}
</style>
