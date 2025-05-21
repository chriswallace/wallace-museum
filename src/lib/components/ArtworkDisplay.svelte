<script lang="ts">
	import { getCloudinaryImageUrl } from '$lib/cloudinaryUtils';
	import SkeletonLoader from './SkeletonLoader.svelte';

	interface Artwork {
		animation_url?: string;
		mime?: string;
		image_url: string;
		title: string;
		dimensions?: {
			width: number;
			height: number;
		};
	}

	export let artwork: Artwork;

	let isLoading = true;

	function hasVideo(): boolean {
		return Boolean(artwork.animation_url && artwork.mime?.startsWith('video'));
	}

	function handleLoad(): void {
		isLoading = false;
	}
</script>

<div class="artwork">
	{#if isLoading}
		<SkeletonLoader
			height={artwork.dimensions ? `${artwork.dimensions.height}px` : '100%'}
			width={artwork.dimensions ? `${artwork.dimensions.width}px` : '100%'}
		/>
	{/if}

	{#if hasVideo()}
		<video
			src={artwork.animation_url}
			autoplay
			controls
			playsinline
			muted
			loop
			on:loadeddata={handleLoad}
			class:hidden={isLoading}
		></video>
	{:else if artwork.mime && (artwork.mime.startsWith('application') || artwork.mime.startsWith('html')) && artwork.animation_url}
		<iframe
			src={artwork.animation_url}
			class="live-code"
			on:load={handleLoad}
			class:hidden={isLoading}
		></iframe>
	{:else}
		<img
			src={getCloudinaryImageUrl(artwork.image_url, 740)}
			alt={artwork.title}
			on:load={handleLoad}
			class:hidden={isLoading}
		/>
	{/if}
</div>

<style lang="scss">
	.artwork {
		@apply w-full relative;
	}
	.live-code {
		@apply w-full h-full aspect-square;
	}
	.hidden {
		@apply opacity-0;
	}
</style>
