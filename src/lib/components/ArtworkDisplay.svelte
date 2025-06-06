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
	$: canFullscreen = browser && mediaType === 'image' && typeof document !== 'undefined' && 'requestFullscreen' in document.documentElement;

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
		<div class="iframe-container">
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

<style>
	.artwork-display {
		position: relative;
		overflow: hidden;
		height: 100%;
		/* Remove flexbox for iframe compatibility */
	}

	.artwork-display.fullscreen {
		width: 100vw;
		height: 80svh;
		aspect-ratio: unset;
	}

	.artwork-display.fullscreen :global(.artwork-image),
	.artwork-display.fullscreen .interactive-content {
		width: 100vw;
		height: 80svh;
		object-fit: contain;
	}

	.artwork-display.fullscreen :global(.video-player-artwork) {
		width: 100vw !important;
		height: 80svh !important;
		object-fit: contain !important;
	}

	.no-media {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface-secondary, #f5f5f5);
		border-radius: 4px;
		width: 100%;
		height: 100%;
	}

	.no-media-content {
		text-align: center;
		color: var(--color-text-secondary, #666);
		font-size: 0.875rem;
	}

	.iframe-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	/* Ensure iframe container maintains aspect ratio on small screens when parent doesn't */
	@media (max-width: 767px) {
		.iframe-container {
			aspect-ratio: var(--artwork-aspect-ratio, 1/1);
		}
	}

	.interactive-content {
		position: relative;
		border: none;
		background: transparent;
		display: block;
		width: 100%;
		height: 100%;
		transition: opacity 0.2s ease-in-out;
		/* Positioned above the loader */
	}

	.interactive-content.hidden {
		opacity: 0;
		pointer-events: none;
	}

	.image-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.fullscreen-button {
		position: absolute;
		top: 12px;
		right: 12px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		border: none;
		border-radius: 6px;
		padding: 8px;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.2s ease;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.fullscreen-button:hover {
		background: rgba(0, 0, 0, 0.9);
	}

	.image-container:hover .fullscreen-button {
		opacity: 1;
	}

	:global(.video-player-artwork) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	/* Fullscreen styles */
	:global(.image-container:fullscreen) {
		background: black;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.image-container:fullscreen .artwork-image) {
		max-width: 100vw;
		max-height: 100vh;
		width: auto;
		height: auto;
		object-fit: contain;
	}
</style>
