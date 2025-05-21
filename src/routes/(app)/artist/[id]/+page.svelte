<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { fade } from 'svelte/transition';
import { getCloudinaryTransformedUrl } from '$lib/cloudinaryUtils';

export let data: { artist?: any; error?: string };

interface Attribute {
	trait_type?: string;
	value: string;
}

let currentIndex = 0;
let iframeEl: HTMLIFrameElement | null = null;

function closeOverlay() {
	document.body.style.overflow = ''; // Restore body scrolling
	goto('/');
}

function nextArtwork() {
	if (!data.artist) return;
	currentIndex = (currentIndex + 1) % data.artist.artworks.length;
}

function prevArtwork() {
	if (!data.artist) return;
	currentIndex = (currentIndex - 1 + data.artist.artworks.length) % data.artist.artworks.length;
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape') closeOverlay();
	if (event.key === 'ArrowRight') nextArtwork();
	if (event.key === 'ArrowLeft') prevArtwork();
}

function handleIframeLoad() {
	// Try to remove scrollbars from iframe content if possible
	if (iframeEl && iframeEl.contentWindow) {
		try {
			// Try to append CSS to the iframe content to hide scrollbars
			const styleElement = iframeEl.contentDocument?.createElement('style');
			if (styleElement) {
				styleElement.textContent = `
					html, body {
						overflow: hidden !important;
						margin: 0 !important;
						padding: 0 !important;
						height: 100% !important;
						width: 100% !important;
					}
					::-webkit-scrollbar {
						display: none !important;
					}
					* {
						scrollbar-width: none !important;
					}
				`;
				iframeEl.contentDocument?.head?.appendChild(styleElement);
			}
		} catch (e) {
			// Cross-origin restrictions might prevent this
			console.log('Could not modify iframe content due to cross-origin restrictions');
		}
	}
}

onMount(() => {
	document.body.style.overflow = 'hidden'; // Prevent body scrolling when modal is open
	const modal = document.getElementById('artist-overlay-modal');
	if (modal) modal.focus();
	
	return () => {
		document.body.style.overflow = ''; // Restore body scrolling on unmount
	};
});

$: currentArtwork = data.artist?.artworks?.[currentIndex];
$: currentDimensions = currentArtwork?.dimensions;
$: dimensionsObj = currentDimensions ? 
   (typeof currentDimensions === 'string' ? JSON.parse(currentDimensions) : currentDimensions) : 
   { width: 16, height: 9 };
$: aspectRatio = `${dimensionsObj.width} / ${dimensionsObj.height}`;

$: currentAttributes = (
	data.artist &&
	data.artist.artworks[currentIndex] &&
	data.artist.artworks[currentIndex].attributes
)
	? data.artist.artworks[currentIndex].attributes
		.map((a: Attribute) => a.trait_type ? `${a.trait_type}: ${a.value}` : a.value)
		.join(', ')
	: '';
</script>

{#if !data.artist && data.error}
	<div id="artist-overlay-modal" tabindex="-1" class="artist-overlay-modal" on:keydown|self={handleKeyDown} transition:fade>
		<div class="artist-overlay-content">
			<button class="close-overlay" on:click={closeOverlay} aria-label="Close artist gallery">×</button>
			<h2 class="artist-overlay-title">Artist Not Found</h2>
			<p class="text-gray-300 mb-4">{data.error}</p>
		</div>
	</div>
{:else if !data.artist}
	<div id="artist-overlay-modal" tabindex="-1" class="artist-overlay-modal" transition:fade>
		<div class="artist-overlay-content">
			<div class="flex flex-col items-center justify-center min-h-[200px]">
				<div class="loader mb-4"></div>
				<p class="text-gray-300">Loading artist...</p>
			</div>
		</div>
	</div>
{:else}
	<div id="artist-overlay-modal" tabindex="-1" class="artist-overlay-modal" role="dialog" on:keydown|self={handleKeyDown} transition:fade>
		<button class="close-overlay" on:click={closeOverlay} aria-label="Close artist gallery">×</button>
		
		{#if data.artist.artworks.length > 0}
			{#key currentIndex}
				<div class="museum-content">
					<div class="artwork-container">
						{#if currentArtwork.animation_url && currentArtwork.mime && currentArtwork.mime.startsWith('video')}
							<video
								src={currentArtwork.animation_url}
								autoplay
								loop
								muted
								playsinline
								class="artwork-media"
							/>
						{:else if currentArtwork.animation_url && currentArtwork.mime && (currentArtwork.mime.startsWith('application') || currentArtwork.mime.startsWith('text'))}
							<div class="iframe-container" style="aspect-ratio: {aspectRatio}">
								<iframe
									bind:this={iframeEl}
									on:load={handleIframeLoad}
									src={currentArtwork.animation_url}
									width="100%"
									height="100%"
									title="Artwork Animation"
									class="artwork-iframe"
									scrolling="no"
									frameborder="0"
									sandbox="allow-scripts allow-same-origin"
									allowfullscreen
								></iframe>
							</div>
						{:else if currentArtwork.image_url}
							<img
								src={getCloudinaryTransformedUrl(currentArtwork.image_url, 'w_2000,q_90,f_auto')}
								alt={currentArtwork.title}
								class="artwork-media"
							/>
						{/if}
					</div>
					
					<div class="museum-details-wrapper">
						<div class="museum-details-overlay">
							<div class="museum-header">
								<div class="museum-artist-title">
									<div class="museum-artist">{data.artist.name}</div>
									<div class="museum-title">{data.artist.artworks[currentIndex].title}</div>
								</div>
								
								{#if data.artist.artworks.length > 1}
									<div class="artwork-navigation">
										<button class="nav-button" on:click={prevArtwork} aria-label="Previous artwork">←</button>
										<button class="nav-button" on:click={nextArtwork} aria-label="Next artwork">→</button>
									</div>
								{/if}
							</div>
							
							{#if data.artist.artworks[currentIndex].description}
								<div class="museum-description">{data.artist.artworks[currentIndex].description}</div>
							{/if}
							
							<ul class="museum-meta">
								{#if currentDimensions}
									<li><strong>Dimensions:</strong> {dimensionsObj.width} × {dimensionsObj.height}</li>
								{/if}
								{#if data.artist.artworks[currentIndex].contractAddr}
									<li><strong>Contract:</strong> {data.artist.artworks[currentIndex].contractAddr}</li>
								{/if}
								{#if data.artist.artworks[currentIndex].contractAlias}
									<li><strong>Contract Alias:</strong> {data.artist.artworks[currentIndex].contractAlias}</li>
								{/if}
								{#if data.artist.artworks[currentIndex].tokenID}
									<li><strong>Token ID:</strong> {data.artist.artworks[currentIndex].tokenID}</li>
								{/if}
								{#if data.artist.artworks[currentIndex].tokenStandard}
									<li><strong>Token Standard:</strong> {data.artist.artworks[currentIndex].tokenStandard}</li>
								{/if}
								{#if data.artist.artworks[currentIndex].totalSupply}
									<li><strong>Total Supply:</strong> {data.artist.artworks[currentIndex].totalSupply}</li>
								{/if}
								{#if data.artist.artworks[currentIndex].mintDate}
									<li><strong>Mint Date:</strong> {data.artist.artworks[currentIndex].mintDate}</li>
								{/if}
								{#if data.artist.artworks[currentIndex].mime}
									<li><strong>MIME Type:</strong> {data.artist.artworks[currentIndex].mime}</li>
								{/if}
								{#if data.artist.artworks[currentIndex].tags && data.artist.artworks[currentIndex].tags.length}
									<li><strong>Tags:</strong> {data.artist.artworks[currentIndex].tags.join(', ')}</li>
								{/if}
								{#if data.artist.artworks[currentIndex].attributes && data.artist.artworks[currentIndex].attributes.length}
									<li><strong>Attributes:</strong> {currentAttributes}</li>
								{/if}
							</ul>
						</div>
					</div>
				</div>
			{/key}
		{/if}
	</div>
{/if}

<style lang="scss">
.artist-overlay-modal {
	@apply fixed inset-0 z-[10000] bg-black bg-opacity-80 transition-opacity duration-300 overflow-y-scroll;
	outline: none;
}
.close-overlay {
	@apply text-3xl text-gray-400 hover:text-white bg-transparent border-none cursor-pointer fixed top-8 right-8 z-20;
}
.museum-content {
	@apply flex flex-col w-full items-center justify-start;
	padding: 2rem 0;
	min-height: 100vh;
}
.artwork-container {
	@apply flex items-center justify-center bg-black bg-opacity-50 rounded-lg p-4;
	width: 90%;
	max-width: 1400px;
	height: 70vh;
	margin-bottom: 2rem;
	overflow: hidden;
}
.artwork-media {
	@apply object-contain m-auto;
	max-width: 100%;
	max-height: 100%;
}
.iframe-container {
	height: 100%;
	width: auto;
	position: relative;
	overflow: hidden;
}
.artwork-iframe {
	@apply mx-auto;
	border: none;
	display: block;
	overflow: hidden;
}
.museum-details-wrapper {
	@apply w-full px-4 md:px-6 max-w-4xl mx-auto;
	min-height: 300px;
}
.museum-details-overlay {
	@apply flex flex-col gap-2 w-full px-4 py-3 mx-auto bg-black bg-opacity-50 rounded-lg relative z-[2] mt-0;
}
.museum-header {
	@apply flex justify-between items-start mb-2 sticky top-0;
	height: 70px;
}
.museum-artist-title {
	@apply flex-1;
}
.museum-artist {
	@apply text-sm font-medium uppercase tracking-wider text-yellow-500 mb-1;
}
.museum-title {
	@apply text-2xl font-bold text-white leading-tight;
}
.artwork-navigation {
	@apply flex items-center gap-2 ml-4;
	position: sticky;
	top: 0;
}
.nav-button {
	@apply flex items-center justify-center w-10 h-10 text-white bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full border-none cursor-pointer;
}
.museum-description {
	@apply text-base text-gray-600 mb-2;
}
.museum-meta {
	@apply text-sm text-gray-600 list-none p-0 m-0 flex flex-col gap-1;
}
.museum-meta li {
	@apply m-0 p-0;
}
.loader {
	border: 4px solid #444;
	border-top: 4px solid #fff;
	border-radius: 50%;
	width: 36px;
	height: 36px;
	animation: spin 1s linear infinite;
}
@keyframes spin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
}

/* Minimal scrollbar styling */
:global(body) {
	scrollbar-width: thin;
	scrollbar-color: rgba(255, 255, 255, 0.35) rgba(0, 0, 0, 0.1);
}

:global(::-webkit-scrollbar) {
	width: 10px;
	height: 10px;
}

:global(::-webkit-scrollbar-track) {
	background: rgba(0, 0, 0, 0.1);
	border-radius: 4px;
}

:global(::-webkit-scrollbar-thumb) {
	background-color: rgba(255, 255, 255, 0.35);
	border-radius: 4px;
	border: 1px solid rgba(255, 255, 255, 0.1);
}

:global(::-webkit-scrollbar-thumb:hover) {
	background-color: rgba(255, 255, 255, 0.5);
}

/* Hide scrollbar buttons */
:global(::-webkit-scrollbar-button) {
	display: none;
}

@media (max-width: 768px) {
	.artwork-container {
		height: 60vh;
		width: 95%;
	}
}
</style> 