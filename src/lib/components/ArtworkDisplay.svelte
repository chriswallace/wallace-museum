<script lang="ts">
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { getBestMediaUrl, getMediaDisplayType } from '$lib/utils/mediaHelpers';
	import OptimizedImage from './OptimizedImage.svelte';
	import SkeletonLoader from './SkeletonLoader.svelte';
	import VideoPlayer from './VideoPlayer.svelte';

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
	export let size: 'small' | 'medium' | 'large' | 'fullscreen' = 'medium';
	export let showLoader: boolean = true;
	export let style: string = '';

	let isLoading = true;

	function handleLoad(): void {
		isLoading = false;
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

	// Calculate aspect ratio for consistent sizing
	$: aspectRatio = artwork.dimensions ? `${artwork.dimensions.width}/${artwork.dimensions.height}` : '1/1';
	
	// Check if artwork should be displayed in fullscreen mode or use exact dimensions
	$: isFullscreen = artwork.fullscreen || false;
	$: hasValidDimensions = artwork.dimensions && artwork.dimensions.width > 0 && artwork.dimensions.height > 0;
	$: useExactDimensions = hasValidDimensions && !isFullscreen;
	
	// Calculate exact dimensions for display
	$: exactWidth = useExactDimensions ? artwork.dimensions!.width : undefined;
	$: exactHeight = useExactDimensions ? artwork.dimensions!.height : undefined;
</script>

<div class="artwork-display" class:fullscreen={isFullscreen} class:exact-dimensions={useExactDimensions} {style}>
	{#if !displayUrl}
		<!-- No media available -->
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
			width={exactWidth}
			height={exactHeight}
			className="video-player-artwork"
			on:loadeddata={handleLoad}
		/>
	{:else if mediaType === 'iframe'}

		<iframe
			src={transformedUrl}
			class="interactive-content"
			title="Interactive Artwork"
			on:load={handleLoad}
			class:hidden={showLoader && isLoading}
			style="aspect-ratio: {aspectRatio}; {useExactDimensions ? `width: ${exactWidth}px; height: ${exactHeight}px;` : ''}"
			allowfullscreen
		></iframe>
	{:else if mediaType === 'image'}
		<OptimizedImage
			src={displayUrl}
			alt={artwork.title}
			width={exactWidth}
			height={exactHeight}
			aspectRatio={aspectRatio}
			showSkeleton={showLoader}
			skeletonBorderRadius="0px"
			className="artwork-image"
			on:load={handleLoad}
		/>
	{/if}
</div>

<style>
	.artwork-display {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.artwork-display.exact-dimensions {
		width: auto;
		height: auto;
		max-width: 100%;
		max-height: 100%;
	}

	.artwork-display.fullscreen {
		width: 100%;
		height: 100%;
	}

	.artwork-display.fullscreen :global(.video-player-artwork),
	.artwork-display.fullscreen iframe,
	.artwork-display.fullscreen :global(.artwork-image) {
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		object-fit: cover;
	}

	.artwork-display.exact-dimensions :global(.video-player-artwork),
	.artwork-display.exact-dimensions iframe,
	.artwork-display.exact-dimensions :global(.artwork-image) {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
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

	:global(.video-player-artwork), iframe, :global(.artwork-image) {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		position: relative;
		z-index: 2;
		display: block;
		margin: 0 auto;
	}

	.interactive-content {
		border: none;
		background: transparent;
		width: 100%;
		height: auto;
		max-width: 100%;
		max-height: 100%;
	}

	.hidden {
		opacity: 0;
		position: absolute;
		pointer-events: none;
	}
</style>
