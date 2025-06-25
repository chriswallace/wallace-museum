<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import OptimizedImage from './OptimizedImage.svelte';
	import LoaderWrapper from './LoaderWrapper.svelte';
	import ArtworkDisplay from './ArtworkDisplay.svelte';

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
	let loading = true;
	let error = false;
	let sectionElement: HTMLElement;
	let isVisible = false;

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

	function handleArtworkClick() {
		if (featuredArtwork && featuredArtwork.artists && featuredArtwork.artists.length > 0) {
			goto(`/artist/${featuredArtwork.artists[0].id}/${featuredArtwork.id}`);
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
		
		return cleanup;
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
			<div class="artwork-display">
				<button 
					class="artwork-stage" 
					on:click={handleArtworkClick}
					aria-label="View {featuredArtwork.title}"
				>
					<div class="stage">
						{#if featuredArtwork.animationUrl || featuredArtwork.imageUrl || featuredArtwork.generatorUrl}
							{@const displayUrl = featuredArtwork.imageUrl || featuredArtwork.animationUrl || featuredArtwork.generatorUrl}
							{@const isVideo = featuredArtwork.mime?.startsWith('video/') || featuredArtwork.animationUrl?.match(/\.(mp4|webm|mov|avi)$/i)}
							{@const forcedMimeType = isVideo ? featuredArtwork.mime : 'image/png'}
							
							{#if isVideo && featuredArtwork.animationUrl}
								<video
									src={featuredArtwork.animationUrl}
									class="featured-video"
									muted
									autoplay
									loop
									playsinline
									preload="metadata"
								>
									<!-- Fallback to image if video fails -->
									{#if featuredArtwork.imageUrl}
										<OptimizedImage
											src={featuredArtwork.imageUrl}
											alt={featuredArtwork.title}
											fit="contain"
											format="auto"
											quality={85}
											className="featured-image"
											fallbackSrc="/images/medici-image.png"
											loading="eager"
											mimeType={forcedMimeType}
										/>
									{/if}
								</video>
							{:else if displayUrl}
								<OptimizedImage
									src={displayUrl}
									alt={featuredArtwork.title}
									fit="contain"
									format="auto"
									quality={85}
									className="featured-image"
									fallbackSrc="/images/medici-image.png"
									loading="eager"
									mimeType={forcedMimeType}
								/>
							{/if}
						{:else}
							<div class="image-placeholder">
								<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
									<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
								</svg>
							</div>
						{/if}
					</div>
				</button>
			</div>

			<!-- Artwork Information -->
			<div class="artwork-details">
				<div class="featured-label">
					<span>Featured</span>
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
								{#if artist.avatarUrl}
									<div class="artist-avatar">
										<OptimizedImage
											src={artist.avatarUrl}
											alt="{artist.name} avatar"
											width={48}
											height={48}
											fit="cover"
											format="auto"
											quality={85}
											className="avatar-image"
											fallbackSrc="/images/medici-image.png"
											loading="eager"
										/>
									</div>
								{:else}
									<div class="artist-avatar-placeholder">
										<svg viewBox="0 0 24 24" fill="currentColor" class="avatar-icon">
											<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
										</svg>
									</div>
								{/if}
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
										src={featuredArtwork.collection.imageUrl}
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
		@apply w-full max-w-7xl mx-auto px-4;
		@apply relative;
		
		/* Increased spacing for better pacing */
		margin-bottom: 8rem;
		
		/* Mobile-first approach */
		@media (max-width: 768px) {
			min-height: auto;
			margin-bottom: 4rem;
			padding-left: 1rem;
			padding-right: 1rem;
		}
		
		/* Tablet and up */
		@media (min-width: 769px) {
			margin-bottom: 10rem;
		}
		
		/* Desktop */
		@media (min-width: 1024px) {
			margin-bottom: 12rem;
		}
		
		/* Fade-in animation */
		opacity: 0;
		transform: translateY(40px);
		transition: opacity 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94),
		           transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		
		&.visible {
			opacity: 1;
			transform: translateY(0);
		}
		
		&::before {
			content: '';
			@apply absolute -inset-x-4 -inset-y-8 bg-gradient-to-b from-transparent via-gray-50/20 to-transparent dark:via-gray-900/20;
			@apply pointer-events-none;
			border-radius: 2rem;
			
			/* Hide gradient on mobile for cleaner look */
			@media (max-width: 768px) {
				display: none;
			}
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
		@apply grid grid-cols-1 gap-6 items-center;
		
		/* Mobile-first: single column with smaller gaps */
		@media (max-width: 768px) {
			gap: 1.5rem;
			min-height: auto;
		}
		
		/* Tablet: still single column but larger gaps */
		@media (min-width: 769px) and (max-width: 1023px) {
			gap: 2rem;
			min-height: calc(100vh - var(--navbar-height) - 6rem);
		}
		
		/* Desktop: two columns */
		@media (min-width: 1024px) {
			@apply lg:grid-cols-2 lg:gap-16;
			min-height: calc(100vh - var(--navbar-height) - 6rem);
		}
	}

	.artwork-display {
		@apply w-full flex items-center justify-center;
		
		/* Mobile: ensure proper order and sizing */
		@media (max-width: 1023px) {
			order: 1;
		}
	}

	.artwork-stage {
		@apply w-full bg-transparent border-none p-0 cursor-pointer block;
		@apply transition-transform duration-300 hover:scale-[1.01] focus:outline-none focus:scale-[1.01];
	}

	.stage {
		@apply bg-gray-100 dark:bg-gray-950/70 w-full overflow-hidden flex items-center justify-center;
		@apply shadow-2xl;
		
		/* Set to 1:1 square aspect ratio and fill available width */
		aspect-ratio: 1 / 1;
		width: 100%;
	}

	.featured-video {
		@apply w-full h-full object-contain;
	}

	:global(.featured-image) {
		@apply w-full h-full object-contain;
	}

	.image-placeholder {
		@apply w-full h-full flex items-center justify-center text-gray-500;
	}

	.placeholder-icon {
		@apply w-24 h-24;
	}

	.artwork-details {
		@apply space-y-4 flex flex-col justify-center overflow-y-auto;
		padding: 1rem 0;
		
		/* Mobile: ensure proper spacing and order */
		@media (max-width: 1023px) {
			order: 2;
			space-y: 1rem;
			padding: 0.5rem 0;
			height: auto;
			max-height: none;
		}
		
		/* Desktop */
		@media (min-width: 1024px) {
			@apply space-y-6;
			height: 100%;
			max-height: 100%;
		}
	}

	.featured-label {
		@apply text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider;
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
		word-break: break-word;
		
		/* Mobile-first typography */
		font-size: 1.5rem; /* 24px */
		line-height: 1.2;
		
		@media (min-width: 480px) {
			font-size: 1.75rem; /* 28px */
		}
		
		@media (min-width: 768px) {
			font-size: 2rem; /* 32px */
		}
		
		@media (min-width: 1024px) {
			font-size: 2.25rem; /* 36px */
		}
		
		@media (min-width: 1280px) {
			font-size: 2.5rem; /* 40px */
		}
	}

	.artwork-description {
		@apply text-gray-700 dark:text-gray-300 leading-relaxed;
	}

	.section-label {
		@apply text-lg font-semibold mb-3;
	}

	.artists-list {
		@apply space-y-3;
	}

	.artist-card {
		@apply w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors cursor-pointer border-none;
	}

	.artist-avatar {
		@apply w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0;
	}

	.artist-avatar-placeholder {
		@apply w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0;
	}

	:global(.avatar-image) {
		@apply w-full h-full object-cover;
	}

	.avatar-icon {
		@apply w-6 h-6 text-gray-400;
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
		@apply w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors cursor-pointer border-none;
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

	/* Responsive adjustments using Tailwind prefixes */
	.featured-section {
		/* Remove these conflicting rules */
		/* @apply lg:min-h-[calc(100svh-var(--navbar-height))] lg:max-h-[calc(100svh-var(--navbar-height))]; */
	}

	.featured-content {
		/* Remove this conflicting rule */
		/* @apply lg:min-h-[calc(100svh-var(--navbar-height))]; */
	}

	.artwork-display {
		/* Remove this conflicting rule */
		/* @apply lg:order-none order-1; */
	}

	.artwork-details {
		/* Remove these conflicting rules */
		/* @apply lg:order-none lg:h-full lg:max-h-full order-2 h-auto max-h-none; */
	}

	.stage {
		/* Remove these conflicting rules that were causing mobile issues */
		/* @apply lg:h-[calc(100vh-var(--navbar-height)-8rem)] lg:max-h-[80vh] lg:min-h-[500px] 
			   md:h-[60vh] md:min-h-[400px] md:max-h-[600px]
			   sm:h-[50vh] sm:min-h-[300px] sm:max-h-[500px]; */
	}

	.artwork-title {
		@apply sm:text-2xl md:text-3xl lg:text-4xl;
	}

	.featured-label {
		@apply sm:text-sm;
	}

	.artist-name, .collection-name {
		@apply lg:text-base lg:font-medium;
	}

	.artist-stats, .collection-stats {
		@apply lg:text-sm;
	}

	.artist-avatar, .artist-avatar-placeholder,
	.collection-image, .collection-image-placeholder {
		@apply lg:w-12 lg:h-12;
	}

	.avatar-icon, .collection-icon {
		@apply lg:w-6 lg:h-6;
	}

	.artist-card, .collection-card {
		@apply lg:gap-3 lg:p-3 lg:rounded-lg;
	}
</style> 