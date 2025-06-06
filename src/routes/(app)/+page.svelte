<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;

	import type { ArtistWithPreview as Artist } from './+page.server';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import LoaderWrapper from '$lib/components/LoaderWrapper.svelte';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { buildOptimizedImageUrl } from '$lib/imageOptimization';

	let hoveredArtist: Artist | null = null;
	let mouseX = 0;
	let mouseY = 0;
	let preloadedImages: Record<string, HTMLImageElement> = {};
	let loadingStates: Record<string, boolean> = {};
	let isLargeScreen = false;

	// Helper function to detect if content is a video based on MIME type
	function isVideoMime(mime: string | null): boolean {
		if (!mime) return false;
		return mime.startsWith('video/');
	}

	// Calculate preview dimensions based on artwork dimensions
	$: previewDimensions = (() => {
		if (!hoveredArtist?.artworks?.[0]?.dimensions) {
			return { width: 320, height: 240 };
		}

		const artwork = hoveredArtist.artworks[0];
		const dimensions = artwork.dimensions;
		
		// Add null check for dimensions
		if (!dimensions) {
			return { width: 320, height: 240 };
		}
		
		const originalWidth = dimensions.width;
		const originalHeight = dimensions.height;

		// Use the artwork's natural dimensions, but scale down if too large
		const maxSize = isLargeScreen ? 300 : 250;
		
		let previewWidth = originalWidth;
		let previewHeight = originalHeight;

		// Only scale down if the artwork is larger than our max size
		if (previewWidth > maxSize || previewHeight > maxSize) {
			const aspectRatio = originalWidth / originalHeight;
			
			if (previewWidth > previewHeight) {
				// Landscape: constrain by width
				previewWidth = maxSize;
				previewHeight = previewWidth / aspectRatio;
			} else {
				// Portrait or square: constrain by height
				previewHeight = maxSize;
				previewWidth = previewHeight * aspectRatio;
			}
		}

		return {
			width: Math.round(previewWidth),
			height: Math.round(previewHeight)
		};
	})();

	onMount(() => {
		updateScreenSize();
		window.addEventListener('resize', updateScreenSize);
		return () => window.removeEventListener('resize', updateScreenSize);
	});

	function updateScreenSize() {
		isLargeScreen = window.innerWidth >= 1024;
	}

	// Preload all artwork images for all artists
	function preloadAllArtworkImages() {
		data.artists.forEach((artist) => {
			artist.artworks.forEach((artwork) => {
				if (artwork.image_url && !preloadedImages[artwork.image_url]) {
					const img = new window.Image();
					// Use optimized image URL for preloading - same as what will be displayed
					img.src = buildOptimizedImageUrl(artwork.image_url, {
						width: 340, // Use max size for preloading
						fit: 'contain',
						format: 'webp',
						quality: 80
					});
					preloadedImages[artwork.image_url] = img;
				}
			});
		});
	}

	if (typeof window !== 'undefined') {
		preloadAllArtworkImages();
	}

	function handleArtistHover(artist: Artist) {
		hoveredArtist = artist;
	}

	function clearArtistHover() {
		hoveredArtist = null;
	}

	function handleMouseMove(event: MouseEvent) {
		mouseX = event.clientX;
		mouseY = event.clientY;
	}

	// Compute safe position for the floating preview with full viewport boundary checking
	$: safeLeft = (() => {
		if (typeof window === 'undefined') return mouseX + 24;
		
		const offset = 24;
		const windowWidth = window.innerWidth;
		
		// Try positioning to the right of cursor first
		let left = mouseX + offset;
		
		// If it would overflow on the right, position to the left of cursor
		if (left + previewDimensions.width > windowWidth - offset) {
			left = mouseX - previewDimensions.width - offset;
		}
		
		// Ensure it doesn't go off the left edge
		if (left < offset) {
			// If it still doesn't fit, center it with some margin
			left = Math.max(offset, (windowWidth - previewDimensions.width) / 2);
		}
		
		return Math.max(0, left);
	})();

	$: safeTop = (() => {
		if (typeof window === 'undefined') return mouseY + 24;
		
		const offset = 24;
		const windowHeight = window.innerHeight;
		
		// Try positioning below cursor first
		let top = mouseY + offset;
		
		// If it would overflow at the bottom, position above cursor
		if (top + previewDimensions.height > windowHeight - offset) {
			top = mouseY - previewDimensions.height - offset;
		}
		
		// Ensure it doesn't go off the top edge
		if (top < offset) {
			// If it still doesn't fit, position it with some margin from top
			top = Math.max(offset, Math.min(mouseY - previewDimensions.height / 2, windowHeight - previewDimensions.height - offset));
		}
		
		return Math.max(0, top);
	})();

	// Determine what media to show in the preview
	$: previewMedia = (() => {
		if (!hoveredArtist?.artworks?.[0]) return null;
		
		const artwork = hoveredArtist.artworks[0];
		
		// If we have an image, use it
		if (artwork.image_url) {
			return {
				type: 'image',
				url: artwork.image_url
			};
		}
		
		// If no image but we have animation URL and it's a video (based on MIME type), use it
		if (artwork.animation_url && isVideoMime(artwork.mime)) {
			return {
				type: 'video',
				url: artwork.animation_url
			};
		}
		
		return null;
	})();
</script>

<svelte:head>
	<title>Wallace Museum | Digital Art Collection</title>
	<meta
		name="description"
		content="The Wallace Museum showcases pioneering works from bleeding-edge artists pushing the boundaries of computational aesthetics and algorithmic expression."
	/>
</svelte:head>

<div class="homepage-container" on:mousemove={handleMouseMove}>
	<div class="content">
		
		<div class="inline-content">
			<h1 class="title inline">The Wallace Museum</h1>
			<p class="description inline">
				showcases pioneering works from bleeding-edge artists pushing the
				boundaries of computational aesthetics and algorithmic expression. Each piece in the
				collection represents an evolving dialogue between human imagination and digital
				innovation—where mathematics becomes poetry and algorithms transform into art.
				{#if data.artists && data.artists.length > 0}
					{#each data.artists as artist, index (artist.id)}<!--
						--><button
							type="button"
							class="artist-link"
							on:mouseenter={() => handleArtistHover(artist)}
							on:mouseleave={clearArtistHover}
							on:focus={() => handleArtistHover(artist)}
							on:blur={clearArtistHover}
							on:click={() => goto(`/artist/${artist.id}`)}
							aria-label={`View artworks by ${artist.name}`}
						>{artist.name}</button> {#if index < data.artists.length - 2} {:else if index === data.artists.length - 2} {/if}
					{/each}
				{:else}
					no artists currently.
				{/if}
			</p>
		</div>
	</div>

	{#if hoveredArtist && hoveredArtist.artworks.length > 0 && previewMedia}
		<div
			class="floating-artwork-preview"
			style="left: {safeLeft}px; top: {safeTop}px; width: {previewDimensions.width}px; height: {previewDimensions.height}px;"
		>
			{#if previewMedia.type === 'image'}
				{#if loadingStates[previewMedia.url]}
					<div class="preview-loader">
						<LoaderWrapper width="100%" height="200px" />
					</div>
				{/if}
				<OptimizedImage
					src={ipfsToHttpUrl(previewMedia.url)}
					alt={hoveredArtist.artworks[0].title || ''}
					width={previewDimensions?.width || 320}
					height={previewDimensions?.height || 240}
					fit="contain"
					format="webp"
					quality={80}
					className={loadingStates[previewMedia.url] ? 'hidden preview-image' : 'preview-image'}
					on:load={() => {
						if (previewMedia?.url) {
							loadingStates[previewMedia.url] = false;
							loadingStates = loadingStates;
						}
					}}
				/>
			{:else if previewMedia.type === 'video'}
				<video
					src={ipfsToHttpUrl(previewMedia.url)}
					autoplay
					loop
					muted
					playsinline
					class="preview-video"
					width={previewDimensions?.width || 320}
					height={previewDimensions?.height || 240}
				>
					Your browser does not support the video tag.
				</video>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	:global(body) {
		@apply overflow-x-hidden;
	}

	.homepage-container {
		@apply w-full min-h-screen bg-black;
	}

	.content {
		@apply w-full p-4 py-10 max-w-[calc(100%-4rem)];
	}

	.title {
		@apply text-base font-bold text-yellow-500 tracking-tight mb-8;
	}

	.inline-content {
		@apply space-y-0;
	}

	.title,
	.inline-content p,
	.inline-content button {
		@apply text-3xl 2xl:text-4xl;
	}

	.description {
		@apply text-sm text-gray-100 font-semibold leading-normal tracking-tight mb-4;
		overflow-wrap: break-word;
		word-wrap: break-word;
	}

	.featuring-text {
		@apply text-sm text-gray-100 font-semibold leading-normal tracking-tight;
		overflow-wrap: break-word;
		word-wrap: break-word;
	}

	.artist-link {
		@apply inline text-sm text-yellow-500 font-semibold bg-none border-none p-0 cursor-pointer outline-none leading-normal tracking-tight;
		@apply hover:text-yellow-400 transition-colors duration-200;
		@apply focus:text-yellow-400 focus:outline-none;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.artist-link:hover {
		text-decoration: none;
	}

	.floating-artwork-preview {
		@apply fixed pointer-events-none z-[9999] p-0 flex gap-0 items-center justify-center overflow-hidden bg-black border-none shadow-xl rounded-sm;
		transition: opacity 0.2s ease-in-out;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.preview-loader {
		@apply w-full h-full overflow-hidden flex items-center justify-center;
	}

	.preview-image {
		@apply w-full h-full rounded-lg bg-black object-contain shadow-lg m-0;
		max-width: 100%;
		max-height: 100%;
	}

	.preview-video {
		@apply w-full h-full rounded-lg bg-black object-contain shadow-lg m-0;
		max-width: 100%;
		max-height: 100%;
	}

	/* Hide artwork previews on touch devices */
	@media (hover: none) and (pointer: coarse) {
		.floating-artwork-preview {
			display: none !important;
		}
	}

	@media (max-width: 480px) {
		.content {
			@apply py-5 px-4;
		}

		.title {
			@apply text-lg mb-6;
		}

		.title,
		.inline-content p,
		.inline-content button {
			@apply text-xl;
		}

		.description,
		.featuring-text,
		.artist-link {
			@apply text-xs;
		}
	}

	.hidden {
		@apply opacity-0;
	}
</style>
