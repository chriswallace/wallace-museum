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
	import { buildOptimizedImageUrl } from '$lib/imageOptimization';
	import { VideoPresets } from '$lib/utils/mediaHelpers';

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

	// Group artists by first letter
	$: artistsByLetter = (() => {
		const grouped: Record<string, Artist[]> = {};
		
		data.artists.forEach(artist => {
			const firstLetter = artist.name.charAt(0).toUpperCase();
			if (!grouped[firstLetter]) {
				grouped[firstLetter] = [];
			}
			grouped[firstLetter].push(artist);
		});

		// Sort each group by name
		Object.keys(grouped).forEach(letter => {
			grouped[letter].sort((a, b) => a.name.localeCompare(b.name));
		});

		// Return sorted letters with their artists
		return Object.keys(grouped)
			.sort()
			.map(letter => ({
				letter,
				artists: grouped[letter]
			}));
	})();

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
						format: 'auto', // Let the optimizer decide format (preserves GIFs)
						quality: 80,
						mimeType: artwork.mime // Pass MIME type for proper GIF detection
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
		if (typeof window === 'undefined') return mouseX;
		
		const offset = 24;
		const windowWidth = window.innerWidth;
		
		// Center on cursor
		let left = mouseX - previewDimensions.width / 2;
		
		// Ensure it doesn't go off the right edge
		if (left + previewDimensions.width > windowWidth - offset) {
			left = windowWidth - previewDimensions.width - offset;
		}
		
		// Ensure it doesn't go off the left edge
		if (left < offset) {
			left = offset;
		}
		
		return Math.max(0, left);
	})();

	$: safeTop = (() => {
		if (typeof window === 'undefined') return mouseY;
		
		const offset = 24;
		const windowHeight = window.innerHeight;
		
		// Center on cursor
		let top = mouseY - previewDimensions.height / 2;
		
		// Ensure it doesn't go off the bottom edge
		if (top + previewDimensions.height > windowHeight - offset) {
			top = windowHeight - previewDimensions.height - offset;
		}
		
		// Ensure it doesn't go off the top edge
		if (top < offset) {
			top = offset;
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
	<title>Artists | Wallace Museum</title>
	<meta
		name="description"
		content="Explore the pioneering artists in the Wallace Museum collection, pushing the boundaries of computational aesthetics and algorithmic expression."
	/>
</svelte:head>

<div class="artists-container" on:mousemove={handleMouseMove}>
	<div class="content">

		<div class="alphabetical-grid">
			{#if artistsByLetter && artistsByLetter.length > 0}
				{#each artistsByLetter as { letter, artists }, index (letter)}
					<div class="letter-section" class:has-border={index > 0}>
						<div class="letter-column">
							<div class="letter-display">{letter}</div>
						</div>
						<div class="artists-column">
							{#each artists as artist (artist.id)}
								<button
									type="button"
									class="artist-item"
									on:mouseenter={() => handleArtistHover(artist)}
									on:mouseleave={clearArtistHover}
									on:focus={() => handleArtistHover(artist)}
									on:blur={clearArtistHover}
									on:click={() => goto(`/artist/${artist.id}`)}
									aria-label={`View artworks by ${artist.name}`}
									in:fade={{ delay: 100 + index * 50 }}
								>
									<div class="artist-name">{artist.name}</div>
									<div class="artwork-count">
										{artist.artworks.length} artwork{artist.artworks.length !== 1 ? 's' : ''}
									</div>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			{:else}
				<div class="no-artists">
					<p>No artists currently in the collection.</p>
				</div>
			{/if}
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
					src={previewMedia.url}
					alt={hoveredArtist.artworks[0].title || ''}
					width={previewDimensions?.width || 320}
					height={previewDimensions?.height || 240}
					fit="contain"
					format="auto"
					quality={80}
					mimeType={hoveredArtist.artworks[0].mime}
					className={loadingStates[previewMedia.url] ? 'hidden preview-image' : 'preview-image'}
					on:load={() => {
						if (previewMedia?.url) {
							loadingStates[previewMedia.url] = false;
							loadingStates = loadingStates;
						}
					}}
				/>
			{:else if previewMedia.type === 'video'}
				{@const videoAttrs = VideoPresets.preview(previewMedia.url)}
				<video
					src={videoAttrs.src}
					autoplay={videoAttrs.autoplay}
					loop={videoAttrs.loop}
					muted={videoAttrs.muted}
					playsinline={videoAttrs.playsinline}
					preload={videoAttrs.preload}
					class="preview-video"
					width={videoAttrs.width}
					height={videoAttrs.height}
					style={videoAttrs.style}
				>
					<track kind="captions" />
					Your browser does not support the video tag.
				</video>
			{/if}
		</div>
	{/if}
</div>

<style lang="scss">
	.artists-container {
		@apply w-full min-h-screen bg-black text-white;
	}

	.content {
		@apply max-w-6xl mx-auto px-8 py-16;
	}

	.header {
		@apply mb-12;
	}

	.title {
		@apply text-4xl md:text-5xl 2xl:text-6xl font-bold text-yellow-500 tracking-tight mb-6;
	}

	.description {
		@apply text-lg md:text-xl 2xl:text-2xl text-gray-100 font-medium leading-relaxed tracking-tight max-w-4xl;
	}

	.alphabetical-grid {
		@apply space-y-0;
	}

	.letter-section {
		@apply grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-8 py-8;
		
		&.has-border {
			@apply border-t border-gray-800;
		}
	}

	.letter-column {
		@apply flex items-start justify-center pt-2;
	}

	.letter-display {
		@apply text-4xl md:text-5xl font-bold text-yellow-500 tracking-tight;
	}

	.artists-column {
		@apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3;
	}

	.artist-item {
		@apply w-full text-left cursor-pointer transition-all duration-200 p-4 md:p-6 rounded-lg border border-transparent hover:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:bg-gray-900/50;
	}

	.artist-name {
		@apply text-lg md:text-xl font-semibold text-yellow-500 mb-1;
	}

	.artwork-count {
		@apply text-sm text-gray-400;
	}

	.no-artists {
		@apply text-center py-12;
	}

	.no-artists p {
		@apply text-gray-400 text-lg;
	}

	.floating-artwork-preview {
		@apply fixed pointer-events-none z-[9999] p-0 flex gap-0 items-center justify-center overflow-hidden bg-black border-none shadow-xl rounded-sm;
		transition: opacity 0.2s ease-in-out;
		border: 1px solid rgba(255, 255, 255, 0.15);
		mix-blend-mode: screen;
		opacity: 0.75;
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
			display: none;
		}
	}

	@media (max-width: 768px) {
		.content {
			@apply px-4 py-8;
		}

		.title {
			@apply text-3xl mb-4;
		}

		.description {
			@apply text-base mb-8;
		}

		.letter-section {
			@apply grid-cols-[60px_1fr] gap-4 py-6;
		}

		.letter-display {
			@apply text-3xl;
		}

		.artist-item {
			@apply p-4;
		}

		.artist-name {
			@apply text-lg;
		}

		.artists-column {
			@apply gap-2;
		}
	}

	@media (max-width: 480px) {
		.letter-section {
			@apply grid-cols-[50px_1fr] gap-3;
		}

		.letter-display {
			@apply text-2xl;
		}
	}

	.hidden {
		@apply opacity-0;
	}
</style> 