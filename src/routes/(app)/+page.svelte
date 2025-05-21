<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;

	import type { ArtistWithPreview as Artist } from './+page.server';
	import { getCloudinaryTransformedUrl } from '$lib/cloudinaryUtils';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';

	let hoveredArtist: Artist | null = null;
	let mouseX = 0;
	let mouseY = 0;
	let preloadedImages: Record<string, HTMLImageElement> = {};
	let previewWidth = 320;
	let previewHeight = 220;

	// Preload all artwork images for all artists
	function preloadAllArtworkImages() {
		data.artists.forEach((artist) => {
			artist.artworks.forEach((artwork) => {
				if (artwork.image_url && !preloadedImages[artwork.image_url]) {
					const img = new window.Image();
					img.src = artwork.image_url;
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
	$: safeLeft = Math.min(mouseX + 24, (typeof window !== 'undefined' ? window.innerWidth : 10000) - previewWidth - 24);
	$: safeTop = Math.min(mouseY + 24, (typeof window !== 'undefined' ? window.innerHeight : 10000) - previewHeight - 24);
</script>

<div class="homepage-container">
	<div class="homepage-intro">
		<h1 class="collection-title">The Wallace Collection</h1>
		<p class="collection-description">
			A curated selection of artworks from the personal collection of Chris Wallace featuring some of the world's most innovative artists.
		</p>
	</div>

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
						<span class="artwork-count">{artist.artworks.length} {artist.artworks.length === 1 ? 'artwork' : 'artworks'}</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p>No artists found.</p>
	{/if}

	{#if hoveredArtist && hoveredArtist.artworks.length > 0}
		<div
			class="floating-artwork-preview"
			style="left: {safeLeft}px; top: {safeTop}px; width: {previewWidth}px; height: {previewHeight}px;"
		>
			{#if hoveredArtist.artworks[0]?.image_url}
				<img
					src={getCloudinaryTransformedUrl(hoveredArtist.artworks[0].image_url, 'w_320,h_220,c_fit,q_70,f_auto')}
					alt={hoveredArtist.artworks[0].title}
					class="preview-image"
				/>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
:global(body) {
	@apply overflow-x-hidden;
}

.homepage-container {
	@apply pt-10 text-left max-w-[840px] mx-auto px-4 box-border;
}

.homepage-intro {
	@apply mb-[3.5rem] text-left;
}

.collection-title{
	@apply text-2xl font-bold text-yellow-500 inline-block tracking-tight;
}

.collection-description {
	@apply mt-24 mb-12 pb-12 border-b border-gray-800 text-[2rem] max-w-full text-gray-100 font-semibold m-0 leading-[1.2] tracking-tight;
	overflow-wrap: break-word;
	word-wrap: break-word;
}

.artist-title{
	@apply text-sm font-normal uppercase tracking-widest mb-3 text-gray-100;
}

.artist-list {
	@apply list-none p-0 flex flex-col items-stretch gap-0 m-0 pb-24 w-full;
}

.artist-list > li {
	@apply m-0 p-0 w-full;
}

.artist-row {
	display: grid;
	grid-template-columns: 1fr auto;
	align-items: center;
	@apply w-full text-[2rem] text-white font-semibold no-underline bg-none border-none p-0 py-1.5 cursor-pointer outline-none leading-[1.4] hover:text-white opacity-60 rounded-md;
	overflow: hidden;
}

.artist-row:focus-visible {
	@apply outline-none;
}

.artist-list .artist-row {
	@apply opacity-20 transition-opacity transition-[color] duration-300;
}

.artist-list:hover .artist-row:hover {
	@apply opacity-100 text-yellow-500;
}

.artist-name {
	@apply text-left overflow-hidden text-ellipsis;
}

.artwork-count {
	@apply text-[1.1rem] text-gray-400 font-normal ml-4 whitespace-nowrap;
}

.floating-artwork-preview {
	@apply fixed pointer-events-none z-[9999] p-0 flex gap-0 items-center overflow-hidden bg-none border-none shadow-none;
	max-width: 320px;
	max-height: 220px;
}

.preview-image {
	@apply h-auto w-auto max-h-[220px] max-w-full rounded-none bg-none object-contain shadow-none m-0;
}

@media (max-width: 768px) {
	.collection-description {
		@apply text-xl mt-12 mb-8;
	}
	
	.artist-row {
		@apply text-xl;
	}
	
	.artwork-count {
		@apply text-sm;
	}
}

@media (max-width: 600px) {
	.floating-artwork-preview {
		max-width: 250px;
		max-height: 180px;
	}
	
	.preview-image {
		max-height: 180px;
	}
	
	.collection-description {
		@apply text-lg mt-8 mb-6;
	}
}

@media (max-width: 480px) {
	.homepage-container {
		@apply pt-5;
	}

	.collection-title {
		@apply text-xl;
	}
	
	.collection-description {
		@apply text-base mt-6 mb-4;
	}
	
	.artist-row {
		@apply text-lg;
	}
	
	.floating-artwork-preview {
		max-width: 200px;
		max-height: 150px;
	}
	
	.preview-image {
		max-height: 150px;
	}
}
</style>
