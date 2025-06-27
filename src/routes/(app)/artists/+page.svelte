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
			// Trim whitespace and normalize the name to handle Unicode characters properly
			const trimmedName = artist.name.trim();
			const normalizedName = trimmedName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
			const firstLetter = normalizedName.charAt(0).toUpperCase();
			
			// Ensure we only use ASCII letters for grouping
			const groupKey = /^[A-Z]$/.test(firstLetter) ? firstLetter : '#';
			
			if (!grouped[groupKey]) {
				grouped[groupKey] = [];
			}
			grouped[groupKey].push(artist);
		});

		// Sort each group by name
		Object.keys(grouped).forEach(letter => {
			grouped[letter].sort((a, b) => a.name.localeCompare(b.name));
		});

		// Return sorted letters with their artists
		// Sort letters properly, with # (non-alphabetic) coming last
		return Object.keys(grouped)
			.sort((a, b) => {
				if (a === '#' && b !== '#') return 1;
				if (b === '#' && a !== '#') return -1;
				return a.localeCompare(b);
			})
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
	<!-- Primary Meta Tags -->
	<title>Artists | Wallace Museum</title>
	<meta name="title" content="Artists | Wallace Museum" />
	<meta name="description" content="Explore the pioneering artists in the Wallace Museum collection, pushing the boundaries of computational aesthetics and algorithmic expression. Discover innovative digital artists creating generative art, algorithmic art, and blockchain-connected artworks." />
	<meta name="keywords" content="digital artists, generative artists, computational artists, algorithmic artists, NFT artists, blockchain artists, contemporary artists, Wallace Museum, art collection" />
	<meta name="author" content="Chris Wallace" />
	<meta name="robots" content="index, follow" />
	<link rel="canonical" href="https://wallace-collection.vercel.app/artists" />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://wallace-collection.vercel.app/artists" />
	<meta property="og:title" content="Artists | Wallace Museum" />
	<meta property="og:description" content="Explore the pioneering artists in the Wallace Museum collection, pushing the boundaries of computational aesthetics and algorithmic expression." />
	<meta property="og:image" content="https://wallace-collection.vercel.app/images/wallace-museum.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Wallace Museum Artists Collection" />
	<meta property="og:site_name" content="Wallace Museum" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:url" content="https://wallace-collection.vercel.app/artists" />
	<meta property="twitter:title" content="Artists | Wallace Museum" />
	<meta property="twitter:description" content="Explore the pioneering artists in the Wallace Museum collection, pushing the boundaries of computational aesthetics and algorithmic expression." />
	<meta property="twitter:image" content="https://wallace-collection.vercel.app/images/wallace-museum.png" />
	<meta property="twitter:image:alt" content="Wallace Museum Artists Collection" />
	<meta property="twitter:site" content="@chriswallace" />
	<meta property="twitter:creator" content="@chriswallace" />

	<!-- Structured Data (JSON-LD) -->
	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "CollectionPage",
			"name": "Artists - Wallace Museum",
			"description": "Explore the pioneering artists in the Wallace Museum collection, pushing the boundaries of computational aesthetics and algorithmic expression.",
			"url": "https://wallace-collection.vercel.app/artists",
			"mainEntity": {
				"@type": "ItemList",
				"name": "Digital Artists Collection",
				"description": "A curated collection of pioneering digital artists",
				"numberOfItems": {data.artists?.length || 0}
			},
			"isPartOf": {
				"@type": "Museum",
				"name": "Wallace Museum",
				"url": "https://wallace-collection.vercel.app"
			},
			"breadcrumb": {
				"@type": "BreadcrumbList",
				"itemListElement": [
					{
						"@type": "ListItem",
						"position": 1,
						"name": "Home",
						"item": "https://wallace-collection.vercel.app"
					},
					{
						"@type": "ListItem",
						"position": 2,
						"name": "Artists",
						"item": "https://wallace-collection.vercel.app/artists"
					}
				]
			}
		}
	</script>
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
										{artist.artworkCount} artwork{artist.artworkCount !== 1 ? 's' : ''}
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
		@apply w-full min-h-screen bg-white text-gray-900;
	}

	.content {
		@apply max-w-6xl mx-auto px-8 py-16;
	}

	.header {
		@apply mb-12;
	}

	.title {
		@apply text-4xl md:text-5xl 2xl:text-6xl font-bold text-primary tracking-tight mb-6;
	}

	.description {
		@apply text-lg md:text-xl 2xl:text-2xl text-gray-700 font-medium leading-relaxed tracking-tight max-w-4xl;
	}

	.alphabetical-grid {
		@apply space-y-0;
	}

	.letter-section {
		@apply grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-8 py-8;
		
		&.has-border {
			@apply border-t border-gray-200;
		}
	}

	.letter-column {
		@apply flex items-start justify-center pt-2;
	}

	.letter-display {
		@apply text-4xl md:text-5xl font-bold text-primary tracking-tight;
	}

	.artists-column {
		@apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3;
	}

	.artist-item {
		@apply w-full text-left cursor-pointer transition-all duration-200 p-4 md:p-6 rounded-lg border border-transparent hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-gray-50;
	}

	.artist-name {
		@apply text-lg md:text-xl font-semibold text-primary mb-1;
	}

	.artwork-count {
		@apply text-sm text-gray-500;
	}

	.no-artists {
		@apply text-center py-12;
	}

	.no-artists p {
		@apply text-gray-500 text-lg;
	}

	.floating-artwork-preview {
		@apply fixed pointer-events-none z-[9999] p-0 flex gap-0 items-center justify-center overflow-hidden bg-white border-none shadow-xl rounded-sm;
		transition: opacity 0.2s ease-in-out;
		border: 1px solid rgba(0, 0, 0, 0.15);
		opacity: 0.75;
	}

	.preview-loader {
		@apply w-full h-full overflow-hidden flex items-center justify-center;
	}

	.preview-image {
		@apply w-full h-full rounded-lg bg-white object-contain shadow-lg m-0;
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

	.featured-title {
		@apply text-4xl md:text-5xl font-bold text-primary-dark tracking-tight;
	}

	.search-input {
		@apply w-full px-6 py-4 text-lg bg-black/60 backdrop-blur-sm border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-dark/50 focus:bg-gray-900/50;
	}

	/* Dark mode styles */
	@media (prefers-color-scheme: dark) {
		.artists-container {
			@apply bg-black text-white;
		}

		.title {
			@apply text-primary-dark;
		}

		.description {
			@apply text-gray-100;
		}

		.letter-section.has-border {
			@apply border-gray-800;
		}

		.letter-display {
			@apply text-primary-dark;
		}

		.artist-item {
			@apply hover:bg-gray-900/50 focus:ring-primary-dark/50 focus:bg-gray-900/50;
		}

		.artist-name {
			@apply text-primary-dark;
		}

		.artwork-count {
			@apply text-gray-400;
		}

		.no-artists p {
			@apply text-gray-400;
		}

		.floating-artwork-preview {
			@apply bg-black;
			border: 1px solid rgba(255, 255, 255, 0.15);
			mix-blend-mode: screen;
		}

		.preview-image {
			@apply bg-black;
		}
	}
</style> 