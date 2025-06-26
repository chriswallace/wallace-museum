<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import OptimizedImage from './OptimizedImage.svelte';
	import LoaderWrapper from './LoaderWrapper.svelte';
	import ArtworkStage from './ArtworkStage.svelte';
	import ArtistAvatar from './ArtistAvatar.svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils.js';

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
				<ArtworkStage
					artwork={{
						id: featuredArtwork.id,
						title: featuredArtwork.title,
						imageUrl: featuredArtwork.imageUrl,
						animationUrl: featuredArtwork.animationUrl,
						mime: featuredArtwork.mime,
						dimensions: featuredArtwork.dimensions
					}}
					aspectRatio="auto"
					onClick={handleArtworkClick}
					className="featured-stage"
					loading="eager"
					quality={90}
					showShadow={true}
				/>
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
		@apply mb-16 md:mb-40 lg:mb-48;
		
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
			@apply pointer-events-none hidden md:block;
			border-radius: 2rem;
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
		@apply h-[50vh] lg:h-[70vh] overflow-hidden;
		max-height: calc(100vh - var(--navbar-height, 80px) - 8rem);
	}

	:global(.featured-stage) {
		@apply w-full h-full;
		max-width: 100%;
		max-height: 100%;
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


</style> 