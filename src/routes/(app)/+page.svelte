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
	let loadingStates: Record<string, boolean> = {};
	let isLargeScreen = false;

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

	// Compute safe position for the floating preview
	$: safeLeft = Math.min(
		mouseX + 24,
		(typeof window !== 'undefined' ? window.innerWidth : 10000) - previewWidth - 24
	);
	$: safeTop = mouseY + 24;
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
			style="left: {safeLeft}px; top: {safeTop}px; width: {previewWidth}px;"
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

		@media (min-width: 1024px) {
			@apply grid grid-cols-[40vw_1fr] min-h-screen;
		}
	}

	.homepage-intro {
		@apply relative w-full p-4 bg-black;

		@media (min-width: 1024px) {
			@apply fixed top-0 left-0 bottom-0 w-[40vw] flex flex-col justify-center overflow-y-auto;
		}
	}

	.intro-content {
		@apply py-10;

		@media (min-width: 1024px) {
			@apply px-8 max-w-xl mx-auto w-full;
		}
	}

	.artists-section {
		@apply w-full p-4;

		@media (min-width: 1024px) {
			@apply ml-[40vw] p-12 pt-16 w-full;
		}
	}

	.collection-title {
		@apply text-2xl font-bold text-yellow-500 inline-block tracking-tight;

		@media (min-width: 1024px) {
			@apply text-3xl;
		}
	}

	.collection-description {
		@apply mt-8 mb-8 pb-8 border-b border-gray-800 text-xl max-w-full text-gray-100 font-semibold m-0 leading-normal tracking-tight;
		overflow-wrap: break-word;
		word-wrap: break-word;

		@media (min-width: 768px) {
			@apply text-[1.3rem] mt-12 mb-10 pb-10;
		}

		@media (min-width: 1024px) {
			@apply border-b-0 pb-0 mb-0;
		}
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
		@apply fixed pointer-events-none z-[9999] p-0 flex gap-0 items-center overflow-hidden bg-none border-none shadow-xl rounded-lg;
		max-width: 320px;
	}

	.preview-loader {
		@apply w-full h-full overflow-hidden;
	}

	.preview-image {
		@apply h-auto w-auto max-w-full rounded-lg bg-black object-contain shadow-lg m-0;
	}

	@media (max-width: 600px) {
		.floating-artwork-preview {
			max-width: 250px;
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
		}
	}

	.hidden {
		@apply opacity-0;
	}
</style>
