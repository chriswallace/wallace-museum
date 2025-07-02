<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { navigateWithDebounce } from '$lib/utils/navigationHelpers';
	import OptimizedImage from './OptimizedImage.svelte';
	import LoaderWrapper from './LoaderWrapper.svelte';
	import ArtworkDisplay from './ArtworkDisplay.svelte';
	import ArtistAvatar from './ArtistAvatar.svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils.js';
	import { getBestMediaUrl, getMediaDisplayType } from '$lib/utils/mediaHelpers';
	import { buildOptimizedImageUrl } from '$lib/imageOptimization';

	interface FeaturedArtworkData {
		id: string;
		title: string;
		description: string | null;
		imageUrl: string | null;
		animationUrl: string | null;
		generatorUrl: string | null;
		mime: string | null;
		dimensions: {
			width: number;
			height: number;
		} | null;
		mintDate: Date | null;
		artists: {
			id: number;
			name: string;
			avatarUrl: string | null;
			artworkCount: number;
		}[];
		collection: {
			id: number;
			title: string;
			slug: string;
			description: string | null;
			imageUrl: string | null;
			artworkCount: number;
		} | null;
	}

	let featuredArtwork: FeaturedArtworkData | null = null;
	let displayedArtwork: FeaturedArtworkData | null = null; // The artwork currently being displayed
	let loading = true;
	let error = false;
	let sectionElement: HTMLElement;
	let isVisible = false;
	let isRefreshing = false;
	let artworkTransitioning = false;
	let artworkContainer: HTMLElement;
	let containerWidth = 0;
	let containerHeight = 0;

	// Calculate responsive image size based on container dimensions
	function calculateResponsiveImageSize(): number {
		if (!containerWidth || !containerHeight) {
			// Fallback sizes based on viewport
			if (typeof window !== 'undefined') {
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				
				// Mobile: use viewport width
				if (vw <= 768) return Math.min(vw * 0.9, 600);
				
				// Desktop: use 70vh as max size (matching CSS)
				const maxSize = Math.min(vh * 0.7, vw * 0.5);
				return Math.min(maxSize, 800);
			}
			return 600; // SSR fallback
		}
		
		// Use actual container dimensions with device pixel ratio for crisp images
		const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
		const targetSize = Math.max(containerWidth, containerHeight);
		
		// Scale up for high-DPI displays but cap at reasonable size
		return Math.min(targetSize * dpr, 1200);
	}

	// Get optimized image URL for the featured artwork
	function getOptimizedFeaturedImageUrl(imageUrl: string): string {
		const size = calculateResponsiveImageSize();
		
		return buildOptimizedImageUrl(imageUrl, {
			width: size,
			height: size,
			fit: 'contain',
			quality: 90,
			format: 'webp'
		});
	}

	// Update container dimensions
	function updateContainerDimensions() {
		if (artworkContainer) {
			const rect = artworkContainer.getBoundingClientRect();
			containerWidth = rect.width;
			containerHeight = rect.height;
		}
	}

	// Handle window resize
	function handleResize() {
		updateContainerDimensions();
	}

	// Update container dimensions when artwork changes
	$: if (displayedArtwork && artworkContainer) {
		// Use requestAnimationFrame to ensure DOM is updated
		requestAnimationFrame(() => {
			updateContainerDimensions();
		});
	}

	// Format mint date for display
	function formatMintDate(mintDate: Date | null): string | null {
		if (!mintDate) return null;
		
		const date = new Date(mintDate);
		if (isNaN(date.getTime())) return null;
		
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	async function loadFeaturedArtwork() {
		loading = true;
		error = false;

		try {
			const response = await fetch('/api/artworks/featured', {
				cache: 'no-cache'
			});
			const data = await response.json();

			if (response.ok) {
				featuredArtwork = data.artwork;
				displayedArtwork = data.artwork; // Set both for initial load
			} else {
				console.error('Failed to load featured artwork:', data.error);
				error = true;
			}
		} catch (err) {
			console.error('Error loading featured artwork:', err);
			error = true;
		} finally {
			loading = false;
		}
	}

	async function refreshFeaturedArtwork() {
		if (isRefreshing) return; // Prevent multiple simultaneous requests
		
		isRefreshing = true;
		artworkTransitioning = true;
		error = false;

		try {
			const response = await fetch('/api/artworks/featured', {
				cache: 'no-cache'
			});
			const data = await response.json();

			if (response.ok) {
				featuredArtwork = data.artwork;
				
				// Wait for the fade-out animation, then update the displayed artwork
				setTimeout(() => {
					displayedArtwork = data.artwork;
					artworkTransitioning = false;
				}, 300);
			} else {
				console.error('Failed to refresh featured artwork:', data.error);
				error = true;
				artworkTransitioning = false;
			}
		} catch (err) {
			console.error('Error refreshing featured artwork:', err);
			error = true;
			artworkTransitioning = false;
		} finally {
			isRefreshing = false;
		}
	}

	function handleArtworkClick() {
		if (featuredArtwork && featuredArtwork.artists && featuredArtwork.artists.length > 0) {
			navigateWithDebounce(`/artist/${featuredArtwork.artists[0].id}/${featuredArtwork.id}`);
		}
	}

	function handleArtistClick(artistId: number) {
		goto(`/artist/${artistId}`);
	}

	function handleCollectionClick() {
		if (featuredArtwork?.collection) {
			goto(`/collection/${featuredArtwork.collection.slug}`);
		}
	}

	function setupIntersectionObserver() {
		if (!sectionElement) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						isVisible = true;
						observer.unobserve(entry.target);
					}
				});
			},
			{
				threshold: 0.1,
				rootMargin: '50px'
			}
		);

		observer.observe(sectionElement);

		return () => observer.disconnect();
	}

	onMount(() => {
		loadFeaturedArtwork();
		const cleanup = setupIntersectionObserver();
		
		// Set up resize observer for responsive sizing
		updateContainerDimensions();
		window.addEventListener('resize', handleResize);
		
		return () => {
			cleanup?.();
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div class="featured-section" class:visible={isVisible} bind:this={sectionElement}>
	{#if loading}
		<div class="loading-container">
			<LoaderWrapper width="100%" height="400px" />
		</div>
	{:else if error || !featuredArtwork}
		<div class="error-container">
			<p>Unable to load featured artwork</p>
			<button on:click={loadFeaturedArtwork} class="retry-button">Try Again</button>
		</div>
	{:else}
		<div class="featured-content">
			<!-- Featured Artwork Display -->
			<div class="artwork-display" class:refreshing={isRefreshing} class:transitioning={artworkTransitioning} bind:this={artworkContainer}>
				<div class="artwork-display-wrapper">
					{#if displayedArtwork}
						{#key displayedArtwork.id}
							{#if displayedArtwork}
								{@const mediaUrls = {
									generatorUrl: displayedArtwork.generatorUrl,
									animationUrl: displayedArtwork.animationUrl,
									imageUrl: displayedArtwork.imageUrl
								}}
								{@const bestMedia = getBestMediaUrl(mediaUrls, 'fullscreen', displayedArtwork.mime)}
								{@const mediaType = getMediaDisplayType(bestMedia, displayedArtwork.mime)}
								{@const displayUrl = bestMedia?.url || ''}
								
								{#if displayUrl}
									{#if mediaType === 'image'}
										<OptimizedImage
											src={getOptimizedFeaturedImageUrl(displayUrl)}
											alt={displayedArtwork.title}
											className="w-full h-full object-contain"
											quality={90}
											loading="eager"
											sizes="(max-width: 768px) 90vw, (max-width: 1024px) 50vw, 70vh"
										/>
									{:else}
										<!-- For videos and iframes, use the regular ArtworkDisplay -->
										<ArtworkDisplay
											artwork={{
												title: displayedArtwork.title,
												imageUrl: displayedArtwork.imageUrl,
												animationUrl: displayedArtwork.animationUrl,
												generatorUrl: displayedArtwork.generatorUrl,
												mime: displayedArtwork.mime,
												dimensions: displayedArtwork.dimensions
											}}
											isInFullscreenMode={false}
										/>
									{/if}
								{:else}
									<div class="image-placeholder">
										<div class="placeholder-icon">
											<svg viewBox="0 0 24 24" fill="currentColor">
												<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
											</svg>
										</div>
										<p>Image not available</p>
									</div>
								{/if}
							{/if}
						{/key}
					{/if}
					
					<!-- Invisible click overlay to prevent video interaction and handle clicks -->
					<div 
						class="click-overlay"
						on:click={handleArtworkClick} 
						on:keydown={(e) => e.key === 'Enter' && handleArtworkClick()} 
						role="button" 
						tabindex="0" 
						aria-label="View {displayedArtwork?.title || featuredArtwork?.title || 'artwork'}"
					></div>
				</div>
			</div>

			<!-- Artwork Information -->
			<div class="artwork-details">
				<div class="featured-label">
					<span>Featured</span>
					<button 
						on:click={refreshFeaturedArtwork}
						class="refresh-button"
						class:refreshing={isRefreshing}
						aria-label="Refresh featured artwork"
						disabled={isRefreshing}
					>
						<svg viewBox="0 0 24 24" fill="currentColor" class="refresh-icon">
							<path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-8 3.58-8 8s3.58 8 8 8c1.1 0 2.12-.2 3.07-.57l-1.42-1.42c-.51.16-1.06.26-1.65.26-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
						</svg>
					</button>
				</div>

				<button 
					class="artwork-title-button"
					on:click={handleArtworkClick}
					aria-label="View {featuredArtwork.title}"
				>
					<h1 class="artwork-title">{featuredArtwork.title}</h1>
				</button>

				<!-- Artist Information -->
				<div class="artist-section">
					<h2 class="section-label">Artist{featuredArtwork.artists.length > 1 ? 's' : ''}</h2>
					<div class="artists-list">
						{#each featuredArtwork.artists as artist}
							<button 
								class="artist-card"
								on:click={() => handleArtistClick(artist.id)}
								aria-label="View {artist.name}'s profile"
							>
								<div class="artist-avatar">
									<ArtistAvatar 
										artist={artist} 
										size="lg" 
										className="avatar-image"
									/>
								</div>
								<div class="artist-info">
									<div class="artist-name">{artist.name}</div>
									<div class="artist-stats">
										{artist.artworkCount} artwork{artist.artworkCount !== 1 ? 's' : ''} in collection
									</div>
								</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- Collection Information -->
				{#if featuredArtwork.collection}
					<div class="collection-section">
						<h2 class="section-label">Collection</h2>
						<button 
							class="collection-card"
							on:click={handleCollectionClick}
							aria-label="View {featuredArtwork.collection.title} collection"
						>
							{#if featuredArtwork.collection.imageUrl}
								<div class="collection-image">
									<OptimizedImage
										src={ipfsToHttpUrl(featuredArtwork.collection.imageUrl)}
										alt="{featuredArtwork.collection.title} collection"
										width={48}
										height={48}
										fit="cover"
										format="auto"
										quality={85}
										className="collection-thumbnail"
										fallbackSrc="/images/medici-image.png"
										loading="eager"
									/>
								</div>
							{:else}
								<div class="collection-image-placeholder">
									<svg viewBox="0 0 24 24" fill="currentColor" class="collection-icon">
										<path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
									</svg>
								</div>
							{/if}
							<div class="collection-info">
								<div class="collection-name">{featuredArtwork.collection.title}</div>
								<div class="collection-stats">
									{featuredArtwork.collection.artworkCount} artwork{featuredArtwork.collection.artworkCount !== 1 ? 's' : ''}
								</div>
							</div>
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.featured-section {
		@apply w-full max-w-7xl mx-auto px-4 md:px-4 relative;
		@apply mb-16 mt-4 md:mt-0 md:mb-40 lg:mb-48;
		
		/* Fade-in animation */
		opacity: 0;
		transform: translateY(40px);
		transition: opacity 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94),
		           transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		
		&.visible {
			opacity: 1;
			transform: translateY(0);
		}
		
		> * {
			@apply relative z-10;
		}
	}

	.loading-container {
		@apply h-96 flex items-center justify-center;
	}

	.error-container {
		@apply text-center py-16;
	}

	.retry-button {
		@apply mt-4 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors;
	}

	.featured-content {
		@apply grid grid-cols-1 gap-2 md:gap-6 lg:gap-8 xl:gap-16 items-center;
		@apply lg:grid-cols-2;
		
		/* Responsive min-height */
		@media (min-width: 769px) {
			min-height: calc(100vh - var(--navbar-height));
		}
	}

	.artwork-display {
		@apply w-full flex items-center justify-center order-1 lg:order-none;
		@apply overflow-hidden;
		/* Make it square */
		aspect-ratio: 1 / 1;
		max-width: min(70vh, 100%);
		max-height: min(70vh, 100%);
		/* Ensure proper centering and constraints */
		position: relative;
		/* Ensure minimum size to prevent collapse */
		min-width: 300px;
		min-height: 300px;
		/* Center the square container */
		margin: 0 auto;
		/* Add transition for refreshing state */
		transition: opacity 0.3s ease-out, transform 0.3s ease-out;
		
		&.refreshing {
			opacity: 0.7;
			transform: scale(0.98);
		}
		
		&.transitioning {
			opacity: 0.5;
			transform: scale(0.95);
		}
	}

	.artwork-display-wrapper {
		@apply w-full h-full relative;
		max-width: 100%;
		max-height: 100%;
		/* Ensure the wrapper respects container bounds */
		display: flex;
		align-items: center;
		justify-content: center;
		/* Prevent overflow and ensure containment */
		overflow: hidden;
		box-sizing: border-box;
		/* Add smooth zoom transition */
		transition: transform 0.3s ease-out;
		
		&:hover {
			transform: scale(1.05);
		}
		
		/* Fade-in animation for new artwork */
		:global(.artwork-container) {
			animation: fadeIn 0.4s ease-out;
		}
	}
	
	.click-overlay {
		@apply absolute inset-0 z-10;
		@apply cursor-pointer;
		@apply bg-transparent;
		
		/* Focus styles for accessibility */
		&:focus {
			outline: 2px solid rgba(59, 130, 246, 0.5);
			outline-offset: 2px;
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.98);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}



	.image-placeholder {
		@apply w-full h-full flex items-center justify-center text-gray-500;
	}

	.placeholder-icon {
		@apply w-24 h-24;
	}

	.artwork-details {
		@apply space-y-4 lg:space-y-6 flex flex-col justify-center overflow-y-auto;
		@apply py-2 lg:py-4 order-2 lg:order-none;
		@apply h-auto max-h-none lg:h-full lg:max-h-full;
	}

	.featured-label {
		@apply text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider;
		@apply flex items-center gap-2;
	}

	.mint-date {
		@apply text-gray-600 dark:text-gray-400 text-sm;
	}

	.artwork-title-button {
		@apply bg-transparent border-none p-0 text-left cursor-pointer;
		@apply transition-colors duration-200 hover:text-gray-700 dark:hover:text-gray-300;
	}

	.artwork-title {
		@apply font-bold leading-tight mb-3;
		@apply text-2xl sm:text-3xl md:text-4xl;
		word-break: break-word;
	}

	.artwork-description {
		@apply text-gray-700 dark:text-gray-300 leading-relaxed;
		word-break: break-word;
		white-space: normal;
		overflow-wrap: break-word;
		hyphens: auto;
	}

	.section-label {
		@apply text-lg font-semibold mb-3;
	}

	.artists-list {
		@apply space-y-3;
	}

	.artist-card {
		@apply w-full flex items-center gap-3 cursor-pointer mb-3;
	}

	.artist-avatar {
		@apply w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0;
	}

	:global(.avatar-image) {
		@apply w-full h-full object-cover;
	}

	.artist-info {
		@apply text-left flex-1;
	}

	.artist-name {
		@apply font-medium text-gray-900 dark:text-gray-100;
	}

	.artist-stats {
		@apply text-sm text-gray-600 dark:text-gray-400;
	}

	.collection-section {
		@apply pt-2;
	}

	.collection-card {
		@apply w-full flex items-center gap-3 cursor-pointer border-none;
	}

	.collection-image {
		@apply w-12 h-12 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0;
	}

	.collection-image-placeholder {
		@apply w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0;
	}

	:global(.collection-thumbnail) {
		@apply w-full h-full object-cover;
	}

	.collection-icon {
		@apply w-6 h-6 text-gray-400;
	}

	.collection-info {
		@apply text-left flex-1;
	}

	.collection-name {
		@apply font-medium text-gray-900 dark:text-gray-100;
	}

	.collection-stats {
		@apply text-sm text-gray-600 dark:text-gray-400;
	}

	.refresh-button {
		@apply bg-transparent border-none p-1 cursor-pointer rounded-md;
		@apply transition-all duration-200;
		@apply hover:bg-gray-100 dark:hover:bg-gray-800;
		@apply focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600;
		@apply text-gray-500 dark:text-gray-400;
		@apply hover:text-gray-700 dark:hover:text-gray-300;
		
		&:disabled {
			@apply cursor-not-allowed opacity-75;
		}
		
		&.refreshing .refresh-icon {
			animation: spin 1s linear infinite;
		}
	}

	.refresh-icon {
		@apply w-4 h-4;
		@apply transition-transform duration-200;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style> 