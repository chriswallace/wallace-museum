<script lang="ts">
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { ImagePresets, buildOptimizedImageUrl } from '$lib/imageOptimization';
	import OptimizedImage from './OptimizedImage.svelte';
	import SkeletonLoader from './SkeletonLoader.svelte';

	interface Artwork {
		animationUrl?: string | null;
		mime?: string | null;
		imageUrl?: string | null;
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

	function hasVideo(): boolean {
		return Boolean(getAnimationUrl() && artwork.mime?.startsWith('video'));
	}

	function hasApplicationMime(): boolean {
		return Boolean(getAnimationUrl() && artwork.mime && artwork.mime.startsWith('application'));
	}

	function handleLoad(): void {
		isLoading = false;
	}

	// Helper functions to prioritize display URLs
	function getImageUrl(): string {
		// Priority: imageUrl > displayUri
		if (artwork.imageUrl) return artwork.imageUrl;
		return '';
	}

	function getAnimationUrl(): string | null {
		// Priority: animationUrl
		if (artwork.animationUrl) return artwork.animationUrl;
		return null;
	}

	// Transform URLs for display - use optimization for images, direct for videos/apps
	$: displayImageUrl = getImageUrl() ? getImageUrl() : ''; // Keep as IPFS URL for OptimizedImage component
	$: displayAnimationUrl = getAnimationUrl() ? ipfsToHttpUrl(getAnimationUrl()) : null; // Direct for videos/apps

	// Get appropriate dimensions based on size
	$: maxWidth = {
		small: 400,
		medium: 800,
		large: 1200,
		fullscreen: 1920
	}[size];

	// Calculate responsive sizes
	$: responsiveSizes = [
		Math.floor(maxWidth * 0.5),
		maxWidth,
		Math.floor(maxWidth * 1.5)
	];

	// Calculate aspect ratio for skeleton
	$: aspectRatio = artwork.dimensions ? `${artwork.dimensions.width}/${artwork.dimensions.height}` : '1/1';
</script>

<div class="artwork-display">
	{#if hasVideo()}
		{#if showLoader && isLoading}
			<div class="media-skeleton" style="aspect-ratio: {aspectRatio};">
				<SkeletonLoader 
					width="100%" 
					height="100%" 
					borderRadius="4px"
				/>
			</div>
		{/if}
		<video
			autoplay
			loop
			muted
			on:loadeddata={handleLoad}
			class:hidden={showLoader && isLoading}
			style="aspect-ratio: {aspectRatio};"
		>
			<source
				src={displayAnimationUrl}
				type="video/mp4"
				height={artwork.dimensions?.height}
				width={artwork.dimensions?.width}
			/>
			Your browser does not support the video tag.
		</video>
	{:else if hasApplicationMime()}
		{#if showLoader && isLoading}
			<div class="media-skeleton" style="aspect-ratio: {aspectRatio};">
				<SkeletonLoader 
					width="100%" 
					height="100%" 
					borderRadius="4px"
				/>
			</div>
		{/if}
		<iframe
			src={displayAnimationUrl}
			class="live-code"
			title="Artwork Animation"
			on:load={handleLoad}
			class:hidden={showLoader && isLoading}
			style="aspect-ratio: {aspectRatio};"
		></iframe>
	{:else if getImageUrl()}
		<OptimizedImage
			src={getImageUrl()}
			alt={artwork.title}
			width={maxWidth}
			responsive={true}
			responsiveSizes={responsiveSizes}
			sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
			fit="contain"
			quality={size === 'fullscreen' ? 95 : 90}
			format="webp"
			aspectRatio={aspectRatio}
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
	}

	.media-skeleton {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
	}

	video, iframe, :global(.artwork-image) {
		width: 100%;
		height: 100%;
		object-fit: contain;
		position: relative;
		z-index: 2;
	}

	.live-code {
		border: none;
		background: transparent;
	}

	.hidden {
		opacity: 0;
		position: absolute;
		pointer-events: none;
	}
</style>
