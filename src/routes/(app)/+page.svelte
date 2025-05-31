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
	let previewWidth = 320;
	let previewHeight = 240; // Estimated height for positioning calculations
	let loadingStates: Record<string, boolean> = {};
	let isLargeScreen = false;

	onMount(() => {
		updateScreenSize();
		window.addEventListener('resize', updateScreenSize);
		return () => window.removeEventListener('resize', updateScreenSize);
	});

	function updateScreenSize() {
		isLargeScreen = window.innerWidth >= 1024;
		// Update preview dimensions based on screen size
		if (typeof window !== 'undefined') {
			if (window.innerWidth <= 480) {
				previewWidth = 200;
				previewHeight = 150;
			} else if (window.innerWidth <= 600) {
				previewWidth = 250;
				previewHeight = 188;
			} else {
				previewWidth = 320;
				previewHeight = 240;
			}
		}
	}

	// Preload all artwork images for all artists
	function preloadAllArtworkImages() {
		data.artists.forEach((artist) => {
			artist.artworks.forEach((artwork) => {
				if (artwork.image_url && !preloadedImages[artwork.image_url]) {
					const img = new window.Image();
					// Use optimized image URL for preloading - same as what will be displayed
					img.src = buildOptimizedImageUrl(artwork.image_url, {
						width: 320,
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
		if (left + previewWidth > windowWidth - offset) {
			left = mouseX - previewWidth - offset;
		}
		
		// Ensure it doesn't go off the left edge
		if (left < offset) {
			// If it still doesn't fit, center it with some margin
			left = Math.max(offset, (windowWidth - previewWidth) / 2);
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
		if (top + previewHeight > windowHeight - offset) {
			top = mouseY - previewHeight - offset;
		}
		
		// Ensure it doesn't go off the top edge
		if (top < offset) {
			// If it still doesn't fit, position it with some margin from top
			top = Math.max(offset, Math.min(mouseY - previewHeight / 2, windowHeight - previewHeight - offset));
		}
		
		return Math.max(0, top);
	})();
</script>

<svelte:head>
	<title>Wallace Museum | Digital Art Collection</title>
	<meta
		name="description"
		content="The Wallace Museum showcases pioneering works from bleeding-edge artists pushing the boundaries of computational aesthetics and algorithmic expression."
	/>
</svelte:head>

<div class="homepage-container">
	<div class="homepage-intro">
		<div class="intro-content">
			<h1 class="collection-title">Wallace Museum</h1>
			<p class="collection-description">
				The Wallace Museum showcases pioneering works from bleeding-edge artists pushing the
				boundaries of computational aesthetics and algorithmic expression. Each piece in the
				collection represents an evolving dialogue between human imagination and digital
				innovation—where mathematics becomes poetry and algorithms transform into art.
			</p>
		</div>
	</div>

	<div class="artists-section">
		<h2 class="artist-title">Featuring</h2>
		{#if data.artists && data.artists.length > 0}
			<ul class="artist-list" on:mousemove={handleMouseMove}>
				{#each data.artists as artist (artist.id)}
					<li>
						<button
							type="button"
							tabindex="0"
							class="artist-row"
							on:mouseenter={() => handleArtistHover(artist)}
							on:mouseleave={clearArtistHover}
							on:focus={() => handleArtistHover(artist)}
							on:blur={clearArtistHover}
							on:click={() => goto(`/artist/${artist.id}`)}
							aria-label={`View artworks by ${artist.name}`}
						>
							<span class="artist-name">{artist.name}</span>
							<span class="artwork-count"
								>{artist.artworks.length}
								{artist.artworks.length === 1 ? 'artwork' : 'artworks'}</span
							>
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p>No artists found.</p>
		{/if}
	</div>

	{#if hoveredArtist && hoveredArtist.artworks.length > 0 && hoveredArtist.artworks[0]?.image_url}
		<div
			class="floating-artwork-preview"
			style="left: {safeLeft}px; top: {safeTop}px; width: {previewWidth}px; height: {previewHeight}px;"
		>
			{#if hoveredArtist.artworks[0].image_url && loadingStates[hoveredArtist.artworks[0].image_url]}
				<div class="preview-loader">
					<LoaderWrapper width="100%" height="200px" />
				</div>
			{/if}
			<OptimizedImage
				src={hoveredArtist.artworks[0].image_url}
				alt={hoveredArtist.artworks[0].title || ''}
				width={320}
				fit="contain"
				format="webp"
				quality={80}
				className={hoveredArtist.artworks[0].image_url && loadingStates[hoveredArtist.artworks[0].image_url] ? 'hidden preview-image' : 'preview-image'}
				on:load={() => {
					const imageUrl = hoveredArtist?.artworks[0]?.image_url;
					if (imageUrl) {
						loadingStates[imageUrl] = false;
						loadingStates = loadingStates;
					}
				}}
			/>
		</div>
	{/if}
</div>

<style lang="scss">
	:global(body) {
		@apply overflow-x-hidden;
	}

	.homepage-container {
		@apply w-full min-h-screen;
	}

	.homepage-intro {
		@apply relative w-full p-4 bg-black;
	}

	.intro-content {
		@apply py-10;
	}

	.artists-section {
		@apply w-full p-4;
	}

	.collection-title {
		@apply text-2xl font-bold text-yellow-500 tracking-tight;
	}

	.collection-description {
		@apply mb-8 pb-8 max-w-prose text-base text-gray-100 font-semibold m-0 leading-normal tracking-tight;
		overflow-wrap: break-word;
		word-wrap: break-word;
	}

	.artist-title {
		@apply text-sm font-normal uppercase tracking-widest mb-10 text-gray-100;
	}

	.artist-list {
		@apply list-none p-0 flex flex-col items-stretch gap-2 m-0 pb-24 w-full;
		max-width: min(800px, 55vw);
	}

	.artist-list > li {
		@apply m-0 p-0 w-full;
	}

	.artist-row {
		@apply w-full text-xl text-white font-semibold no-underline bg-none border-none p-0 cursor-pointer outline-none leading-[1.4] hover:text-white opacity-100 rounded-md flex justify-between items-center;
		overflow: hidden;

		@media (min-width: 768px) {
			@apply text-[1.75rem];
		}
	}

	.artist-row:focus-visible {
		@apply outline-none;
	}

	.artist-list .artist-row {
		@apply duration-300 text-gray-600;
	}

	.artist-list:hover .artist-row:hover {
		@apply text-yellow-500;
	}

	.artist-name {
		@apply text-left overflow-hidden text-ellipsis whitespace-nowrap;
		max-width: calc(100% - 120px);
	}

	.artwork-count {
		@apply text-base font-medium whitespace-nowrap text-right;

		@media (min-width: 768px) {
			@apply text-base;
		}
	}

	.floating-artwork-preview {
		@apply fixed pointer-events-none z-[9999] p-0 flex gap-0 items-center justify-center overflow-hidden bg-black border-none shadow-xl rounded-sm;
		max-width: 320px;
		max-height: 240px;
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

	@media (max-width: 600px) {
		.floating-artwork-preview {
			max-width: 250px;
			max-height: 188px;
		}
	}

	@media (max-width: 480px) {
		.homepage-container {
			@apply pt-0;
		}

		.homepage-intro {
			@apply p-0;
		}

		.intro-content {
			@apply py-5 px-4;
		}

		.artists-section {
			@apply px-4;
		}

		.collection-title {
			@apply text-xl;
		}

		.collection-description {
			@apply text-lg mt-6 mb-6 pb-6;
		}

		.artist-row {
			@apply text-lg;
		}

		.floating-artwork-preview {
			max-width: 200px;
			max-height: 150px;
		}
	}

	.hidden {
		@apply opacity-0;
	}
</style>
