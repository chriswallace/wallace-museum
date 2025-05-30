<script lang="ts">
	import OptimizedImage from './OptimizedImage.svelte';
	import VideoPlayer from './VideoPlayer.svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { getBestMediaUrl, getMediaDisplayType } from '$lib/utils/mediaHelpers';
	import type { MediaUrls } from '$lib/utils/mediaHelpers';

	export let artwork: {
		id: number | string;
		title?: string;
		imageUrl?: string;
		animationUrl?: string;
		generatorUrl?: string;
		thumbnailUrl?: string;
		mime?: string;
	};
	export let showRemoveButton = false;
	export let onRemove: ((artwork: any) => void) | null = null;
	export let isSelected = false;
	export let onSelect: ((artworkId: number | string) => void) | null = null;
	export let selectable = false;

	// Use utility functions for consistent media handling
	$: mediaUrls = {
		generatorUrl: artwork.generatorUrl,
		animationUrl: artwork.animationUrl,
		imageUrl: artwork.imageUrl,
		thumbnailUrl: artwork.thumbnailUrl
	};

	$: bestMedia = getBestMediaUrl(mediaUrls, 'thumbnail', artwork.mime);
	$: cardImageUrl = bestMedia?.url || '';
	$: mediaType = getMediaDisplayType(bestMedia, artwork.mime);
	$: displayAsVideo = mediaType === 'video';
</script>

<div class="artwork-card" class:selectable class:selected={isSelected}>
	{#if selectable}
		<button
			class="card-button"
			class:active={isSelected}
			on:click={() => onSelect?.(artwork.id)}
		>
			<div class="artwork-content">
				{#if displayAsVideo}
					<video width="204" height="204" loop muted playsinline>
						<source src={ipfsToHttpUrl(cardImageUrl)} type="video/mp4" />
					</video>
				{:else}
					<OptimizedImage
						src={cardImageUrl}
						alt={artwork.title || 'Artwork thumbnail'}
						width={300}
						height={300}
						fit="cover"
						format="webp"
						quality={85}
						className="w-full aspect-square object-cover rounded-md mb-3"
						fallbackSrc="/images/medici-image.png"
					/>
				{/if}
				<p class="artwork-title">{artwork.title}</p>
				{#if isSelected}
					<div class="selected-indicator">Selected</div>
				{/if}
			</div>
		</button>
	{:else}
		<div class="artwork-content">
			{#if displayAsVideo}
				<video width="204" height="204" loop muted playsinline>
					<source src={ipfsToHttpUrl(cardImageUrl)} type="video/mp4" />
				</video>
			{:else}
				<OptimizedImage
					src={cardImageUrl}
					alt={artwork.title || 'Artwork thumbnail'}
					width={300}
					height={300}
					fit="cover"
					format="webp"
					quality={85}
					className="w-full aspect-square object-cover rounded-md mb-3"
					fallbackSrc="/images/medici-image.png"
				/>
			{/if}
			<h3 class="artwork-title">{artwork.title}</h3>
		</div>
	{/if}

	{#if showRemoveButton && onRemove}
		<button class="remove-button" on:click={() => onRemove?.(artwork)}>
			<svg
				fill="none"
				height="15"
				viewBox="0 0 15 15"
				width="15"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					clip-rule="evenodd"
					d="M6.79289 7.49998L4.14645 4.85353L4.85355 4.14642L7.5 6.79287L10.1464 4.14642L10.8536 4.85353L8.20711 7.49998L10.8536 10.1464L10.1464 10.8535L7.5 8.20708L4.85355 10.8535L4.14645 10.1464L6.79289 7.49998Z"
					fill="black"
					fill-rule="evenodd"
				/>
			</svg>
		</button>
	{/if}
</div>

<style lang="scss">
	.artwork-card {
		@apply relative mb-8;

		&.selectable {
			@apply mb-0;
		}
	}

	.card-button {
		@apply p-0 rounded-[8px] w-full;

		&.active {
			@apply border-2 border-primary relative;

			.artwork-title {
				@apply p-3;
			}
		}

		video {
			@apply w-full aspect-square object-contain rounded-t-[8px];
		}
	}

	.artwork-content {
		@apply w-full;
	}

	.artwork-title {
		@apply text-lg font-semibold mb-3;

		.selectable & {
			@apply py-3 truncate text-base font-normal mb-0;
		}
	}

	.selected-indicator {
		@apply absolute top-2 right-2 bg-primary text-white px-2 py-1 rounded-md text-sm;
	}

	.remove-button {
		@apply absolute top-[-8px] right-[-8px] bg-red-500 rounded-full p-1 z-20;

		svg {
			@apply w-[20px] h-[20px];
		}

		path {
			@apply fill-white;
		}
	}
</style> 