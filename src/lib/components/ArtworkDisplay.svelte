<script lang="ts">
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
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

	// Debug logging
	$: if (actualDimensions) {
		console.log('ArtworkDisplay dimensions:', {
			actualDimensions,
			aspectRatio,
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
	$: transformedUrl = displayUrl ? ipfsToHttpUrl(displayUrl) : '';

	// Calculate optimal display size for images (max 1200px width for performance)
	$: displayWidth = actualDimensions ? Math.min(actualDimensions.width, 1200) : 1200;
	$: displayHeight = actualDimensions && actualDimensions.width > 1200 
		? Math.round((displayWidth * actualDimensions.height) / actualDimensions.width)
		: actualDimensions?.height;

	// Get optimized image URL for display
	$: optimizedImageUrl = mediaType === 'image' && displayUrl 
		? buildOptimizedImageUrl(displayUrl, {
			width: displayWidth,
			height: displayHeight,
			quality: 90,
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

<div class="artwork-display" class:fullscreen style="aspect-ratio: {aspectRatio}; --artwork-aspect-ratio: {aspectRatio}">
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
			width={dimensions?.width}
			aspectRatio={aspectRatio}
			showSkeleton={shouldShowSkeleton}
			{style}
		/>
	{:else if mediaType === 'iframe'}
		<div class="iframe-container" bind:this={fullscreenElement}>
			{#if shouldShowSkeleton && isIframeLoading}
				<IframeSkeleton
					width={dimensions?.width}
					height={dimensions?.height}
					aspectRatio={aspectRatio}
					className="iframe-skeleton-overlay"
				/>
			{/if}
			<iframe
				src={transformedUrl}
				class="interactive-content"
				class:hidden={shouldShowSkeleton && isIframeLoading}
				title="Interactive Artwork"
				width={dimensions?.width}
				{style}
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
		<div class="image-container" bind:this={fullscreenElement}>
			<OptimizedImage
				src={isInFullscreen ? fullSizeImageUrl : optimizedImageUrl}
				alt={artwork.title}
				width={dimensions?.width}
				height={dimensions?.height}
				aspectRatio={aspectRatio}
				showSkeleton={shouldShowSkeleton}
				className="artwork-image"
				style={isInFullscreen ? 'width: 100vw !important; height: 100vh !important; object-fit: contain !important; background: black;' : style}
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
		@apply relative overflow-hidden h-full flex items-center justify-center;
		/* Remove flexbox for iframe compatibility */
	}

	.artwork-display:not(.fullscreen) {
		@apply xl:max-h-[90%] flex;
	}

	.artwork-display.fullscreen {
		@apply w-screen min-h-[340px];
		height: 82svh;
		aspect-ratio: unset;
	}

	.artwork-display.fullscreen :global(.artwork-image) {
		@apply w-screen min-h-[340px] object-contain;
		height: 82svh;
	}

	.artwork-display.fullscreen .interactive-content {
		/* Keep iframe at its original size and center it */
		@apply w-auto h-auto max-w-full min-h-[340px];
		max-height: 82svh;
	}

	.artwork-display.fullscreen :global(.video-player-artwork) {
		@apply w-screen object-contain min-h-[340px];
		height: 82svh;
	}

	.no-media {
		@apply flex items-center justify-center bg-gray-100 rounded-sm w-full h-full;
	}

	.no-media-content {
		@apply text-center text-gray-600 text-sm;
	}

	.iframe-container {
		@apply relative w-full h-full flex items-center justify-center;
	}

	/* Ensure iframe container maintains aspect ratio on small screens when parent doesn't */
	@media (max-width: 767px) {
		.iframe-container {
			aspect-ratio: var(--artwork-aspect-ratio, 1/1);
		}
	}

	.interactive-content {
		@apply relative border-none bg-transparent block w-full h-full transition-opacity duration-200 ease-in-out;
		/* Positioned above the loader */
	}

	.interactive-content.hidden {
		@apply opacity-0 pointer-events-none;
	}

	.image-container {
		@apply relative w-full h-full flex;
	}

	.fullscreen-button {
		@apply absolute top-3 right-3 bg-black bg-opacity-70 text-white border-none rounded-md p-2 cursor-pointer opacity-0 transition-opacity duration-200 ease-linear z-10 flex items-center justify-center;
	}

	.fullscreen-button:hover {
		@apply bg-black bg-opacity-90;
	}

	.image-container:hover .fullscreen-button {
		@apply opacity-100;
	}

	.iframe-container:hover .fullscreen-button {
		@apply opacity-100;
	}

	/* Global styles for artwork images */
	:global(.artwork-image) {
		@apply block max-w-full max-h-full w-auto h-auto object-contain mx-auto;
	}

	/* Global styles for video players */
	:global(.video-player-artwork) {
		@apply block max-w-full max-h-full w-auto h-auto object-contain mx-auto;
	}

	/* Fullscreen styles */
	:global(.image-container:fullscreen) {
		@apply bg-black flex items-center justify-center;
	}

	:global(.iframe-container:fullscreen) {
		@apply bg-black flex items-center justify-center;
	}

	:global(.image-container:fullscreen .artwork-image) {
		@apply w-auto h-auto object-contain;
		max-width: 100vw;
		max-height: 100svh;
	}

	:global(.iframe-container:fullscreen .interactive-content) {
		/* Keep iframe at its original dimensions when in fullscreen */
		max-width: 100vw;
		max-height: 100svh;
	}
</style>
