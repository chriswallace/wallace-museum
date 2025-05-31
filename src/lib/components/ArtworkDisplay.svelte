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
	}

	export let artwork: Artwork;
	export let size: 'small' | 'medium' | 'large' | 'fullscreen' = 'medium';
	export let showLoader: boolean = true;

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
</script>

<div class="artwork-display">
	{#if !displayUrl}
		<!-- No media available -->
		<div class="no-media">
			<div class="no-media-content">
				<p>No media available</p>
			</div>
		</div>
	{:else if mediaType === 'video'}
		{#if showLoader && isLoading}
			<div class="media-skeleton">
				<SkeletonLoader 
					width="100%" 
					height="100%" 
					borderRadius="4px"
				/>
			</div>
		{/if}
		<VideoPlayer
			src={transformedUrl}
			autoplay={true}
			loop={true}
			muted={true}
			width={artwork.dimensions?.width}
			height={artwork.dimensions?.height}
			className="video-player-artwork"
			on:loadeddata={handleLoad}
		/>
	{:else if mediaType === 'iframe'}
		{#if showLoader && isLoading}
			<div class="media-skeleton">
				<SkeletonLoader 
					width="100%" 
					height="100%" 
					borderRadius="4px"
				/>
			</div>
		{/if}
		<iframe
			src={transformedUrl}
			class="interactive-content"
			title="Interactive Artwork"
			on:load={handleLoad}
			class:hidden={showLoader && isLoading}
			allowfullscreen
		></iframe>
	{:else if mediaType === 'image'}
		<OptimizedImage
			src={displayUrl}
			alt={artwork.title}
			showSkeleton={showLoader}
			skeletonBorderRadius="4px"
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

	.media-skeleton {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
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
		height: 100%;
		max-width: 100%;
		max-height: 100%;
	}

	.hidden {
		opacity: 0;
		position: absolute;
		pointer-events: none;
	}
</style>
