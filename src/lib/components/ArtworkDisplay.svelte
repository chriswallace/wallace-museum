<script lang="ts">
	import { getCloudinaryImageUrl } from '$lib/cloudinaryUtils';
	import LoaderWrapper from './LoaderWrapper.svelte';

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

	function hasApplicationMime(): boolean {
		return Boolean(artwork.animation_url && artwork.mime && artwork.mime.startsWith('application'));
	}

	function handleLoad(): void {
		isLoading = false;
	}
</script>

<div class="artwork">
	{#if isLoading}
		<div class="loader-container">
			<LoaderWrapper
				height={artwork.dimensions ? `${artwork.dimensions.height}px` : '100%'}
				width={artwork.dimensions ? `${artwork.dimensions.width}px` : '100%'}
				aspectRatio={artwork.dimensions
					? `${artwork.dimensions.width} / ${artwork.dimensions.height}`
					: '1 / 1'}
			/>
		</div>
	{/if}

	{#if artwork.animation_url}
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
		{:else if hasApplicationMime()}
			<iframe
				src={artwork.animation_url}
				class="live-code"
				on:load={handleLoad}
				class:hidden={isLoading}
			></iframe>
		{:else}
			<!-- Fall back to image_url for non-application, non-video animation_url types -->
			<img
				src={getCloudinaryImageUrl(artwork.image_url, 740)}
				alt={artwork.title}
				on:load={handleLoad}
				class:hidden={isLoading}
			/>
		{/if}
	{:else if artwork.image_url}
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
	.loader-container {
		@apply w-full max-w-full overflow-hidden;
	}
	.live-code {
		@apply w-full h-full aspect-square;
	}
	.hidden {
		@apply opacity-0;
	}
</style>
