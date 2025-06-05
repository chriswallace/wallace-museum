<script lang="ts">
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { getBestMediaUrl, getMediaDisplayType } from '$lib/utils/mediaHelpers';
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
	export let dimensions: { width: number; height: number } | null = null;
	export let style: string = 'width: 100%; height: 100%;';

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
</script>

<div class="artwork-display" style="aspect-ratio: {aspectRatio}">
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
			{style}
		/>
	{:else if mediaType === 'iframe'}
		<iframe
			src={transformedUrl}
			class="interactive-content"
			title="Interactive Artwork"
			width={dimensions?.width}
			{style}
			allowfullscreen
		></iframe>
	{:else if mediaType === 'image'}
		<img
			src={transformedUrl}
			alt={artwork.title}
			class="artwork-image"
			width={dimensions?.width}
			{style}
		/>
	{/if}
</div>

<style>
	.artwork-display {
		position: relative;
		overflow: hidden;
		height: 100%;
		/* Remove flexbox for iframe compatibility */
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

	.interactive-content {
		border: none;
		background: transparent;
		display: block;
		width: 100%;
		height: 100%;
	}

	.artwork-image {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	:global(.video-player-artwork) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
