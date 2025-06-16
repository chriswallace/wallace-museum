<script lang="ts">
	import OptimizedImage from './OptimizedImage.svelte';
	import VideoPlayer from './VideoPlayer.svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { getBestMediaUrl, getMediaDisplayType, VideoPresets } from '$lib/utils/mediaHelpers';
	import type { MediaUrls } from '$lib/utils/mediaHelpers';

	export let artwork: {
		id: number | string;
		title?: string;
		imageUrl?: string;
		animationUrl?: string;
		generatorUrl?: string;
		thumbnailUrl?: string;
		mime?: string;
		dimensions?: {
			width: number;
			height: number;
		};
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
					{@const videoAttrs = VideoPresets.thumbnail(cardImageUrl)}
					<video 
						src={videoAttrs.src}
						width={videoAttrs.width} 
						height={videoAttrs.height}
						style={videoAttrs.style}
						autoplay={videoAttrs.autoplay}
						loop={videoAttrs.loop} 
						muted={videoAttrs.muted} 
						playsinline={videoAttrs.playsinline}
						preload={videoAttrs.preload}
					>
						<track kind="captions" />
						Your browser does not support the video tag.
					</video>
				{:else}
					<OptimizedImage
						src={cardImageUrl}
						alt={artwork.title || 'Artwork thumbnail'}
						width={artwork.dimensions?.width || 300}
						height={artwork.dimensions?.height || 300}
						aspectRatio={artwork.dimensions ? `${artwork.dimensions.width}/${artwork.dimensions.height}` : '1/1'}
						fit="contain"
						format="auto"
						quality={85}
						className="w-full aspect-square object-contain rounded-md mb-3"
						fallbackSrc="/images/medici-image.png"
						mimeType={artwork.mime}
					/>
				{/if}
				<p class="artwork-title">{artwork.title}</p>
				{#if isSelected}
					<div class="selected-indicator">Selected</div>
				{/if}
			</div>
		</button>
	{:else}
		<div class="artwork-content rounded-md bg-gray-500/10 py-5">
			{#if displayAsVideo}
				{@const videoAttrs = VideoPresets.thumbnail(cardImageUrl)}
				<video 
					src={videoAttrs.src}
					width={videoAttrs.width} 
					height={videoAttrs.height}
					style={videoAttrs.style}
					autoplay={videoAttrs.autoplay}
					loop={videoAttrs.loop} 
					muted={videoAttrs.muted} 
					playsinline={videoAttrs.playsinline}
					preload={videoAttrs.preload}
				>
					<track kind="captions" />
					Your browser does not support the video tag.
				</video>
			{:else}
				<OptimizedImage
					src={cardImageUrl}
					alt={artwork.title || 'Artwork thumbnail'}
					width={artwork.dimensions?.width || 300}
					height={artwork.dimensions?.height || 300}
					aspectRatio={artwork.dimensions ? `${artwork.dimensions.width}/${artwork.dimensions.height}` : '1/1'}
					fit="contain"
					format="auto"
					quality={85}
					className="w-full aspect-square object-contain rounded-md mb-3"
					fallbackSrc="/images/medici-image.png"
					mimeType={artwork.mime}
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
		@apply relative mb-0;

		&.selectable {
			@apply mb-0;
		}
	}

	.card-button {
		@apply p-0 rounded-[8px] w-full;

		&.active {
			@apply border-2 border-primary dark:border-primary-dark relative;

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
		@apply text-base text-center font-normal mb-3;
		word-break: break-word;
		white-space: normal;
		overflow-wrap: break-word;
		hyphens: auto;

		.selectable & {
			@apply py-3 text-base font-normal mb-0;
			word-break: break-word;
			white-space: normal;
			overflow-wrap: break-word;
			hyphens: auto;
		}
	}

	.selected-indicator {
		@apply absolute top-2 right-2 bg-primary dark:bg-primary-dark text-white dark:text-black px-2 py-1 rounded-md text-sm;
	}

	.artwork-card .remove-button {
		@apply absolute top-2 -right-2 bg-red-600 hover:bg-red-700 rounded-full z-20 transition-colors w-[34px] h-[34px] p-0 min-h-0;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		cursor: pointer;
		font-size: inherit;
		line-height: 1;

		svg {
			@apply w-6 h-6;
		}

		path {
			@apply fill-white;
		}
	}
</style> 