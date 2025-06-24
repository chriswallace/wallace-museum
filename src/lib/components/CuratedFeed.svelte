<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { goto } from '$app/navigation';
	import OptimizedImage from './OptimizedImage.svelte';
	import LoaderWrapper from './LoaderWrapper.svelte';
	import type { CollectionGroup } from '../../routes/api/artworks/collections/+server';

	let collections: CollectionGroup[] = [];
	let loading = false;
	let hasMore = true;
	let feedContainer: HTMLElement;
	let intersectionTarget: HTMLElement;
	let currentObserver: IntersectionObserver | null = null;

	// Format mint date for display
	function formatMintDate(mintDate: Date | null): string | null {
		if (!mintDate) return null;
		
		const date = new Date(mintDate);
		if (isNaN(date.getTime())) return null;
		
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Check if all artworks in a collection are by the same artist
	function isSingleArtistCollection(collection: CollectionGroup) {
		if (!collection.artworks.length) return false;
		
		const firstArtistId = collection.artworks[0]?.artists?.[0]?.id;
		if (!firstArtistId) return false;
		
		return collection.artworks.every(artwork => 
			artwork.artists.length === 1 && artwork.artists[0].id === firstArtistId
		);
	}

	// Get the artist for single-artist collections
	function getCollectionArtist(collection: CollectionGroup) {
		if (isSingleArtistCollection(collection)) {
			return collection.artworks[0]?.artists?.[0];
		}
		return null;
	}

	// Determine layout based on collection characteristics and artwork count
	function getCollectionLayout(collection: CollectionGroup) {
		const artworkCount = collection.artworks.length;
		
		// Single artwork collections get featured treatment
		if (artworkCount === 1) {
			return { type: 'single-featured', displayCount: 1 };
		}
		
		// Small collections (2-3 works) get dual layout
		if (artworkCount <= 3) {
			return { type: 'dual-showcase', displayCount: Math.min(2, artworkCount) };
		}
		
		// Medium collections (4-6 works) get grid treatment
		if (artworkCount <= 6) {
			return { type: 'collection-grid', displayCount: Math.min(4, artworkCount) };
		}
		
		// Large collections get expanded grid (max 4 to match grid columns)
		return { type: 'expanded-grid', displayCount: Math.min(4, artworkCount) };
	}

	async function loadCollections(reset = false) {
		if (loading || (!hasMore && !reset)) return;

		loading = true;

		try {
			const excludeIds = reset ? [] : collections.map(c => c.id);
			const params = new URLSearchParams({
				limit: '4', // Fewer collections for more meaningful curation
				...(excludeIds.length > 0 && { excludeCollections: excludeIds.join(',') })
			});

			const response = await fetch(`/api/artworks/collections?${params}`, {
				cache: 'no-cache'
			});
			const data = await response.json();

			if (response.ok) {
				if (reset) {
					collections = data.collections;
				} else {
					collections = [...collections, ...data.collections];
				}
				hasMore = data.hasMore;
			} else {
				console.error('Failed to load collections:', data.error);
			}
		} catch (error) {
			console.error('Error loading collections:', error);
		} finally {
			loading = false;
		}
	}

	function handleArtworkClick(artwork: CollectionGroup['artworks'][0]) {
		if (artwork.artists && artwork.artists.length > 0) {
			goto(`/artist/${artwork.artists[0].id}/${artwork.id}`);
		}
	}

	function handleArtistClick(event: Event, artistId: number) {
		event.stopPropagation();
		goto(`/artist/${artistId}`);
	}

	function handleCollectionClick(event: Event, collection: CollectionGroup) {
		event.stopPropagation();
		goto(`/collection/${collection.slug}`);
	}

	function setupIntersectionObserver() {
		if (!intersectionTarget) return;

		const options = {
			root: null,
			rootMargin: '400px',
			threshold: 0.1
		};

		currentObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting && hasMore && !loading) {
					loadCollections();
				}
			});
		}, options);

		currentObserver.observe(intersectionTarget);
	}

	onMount(() => {
		loadCollections(true);
		
		return () => {
			if (currentObserver) {
				currentObserver.disconnect();
			}
		};
	});

	afterUpdate(() => {
		if (intersectionTarget && !currentObserver) {
			setupIntersectionObserver();
		}
	});
</script>

<div class="curated-feed" bind:this={feedContainer}>
	<div class="feed-header">
		<h2>Collections</h2>
		<p>Exploring cohesive bodies of work and artistic progressions</p>
	</div>

	<div class="collections-container">
		{#each collections as collection (collection.id)}
			{@const layout = getCollectionLayout(collection)}
			{@const displayArtworks = collection.artworks.slice(0, layout.displayCount)}
			{@const singleArtist = getCollectionArtist(collection)}
			
			<section class="collection-section {layout.type}">
				<!-- Collection Header -->
				<div class="collection-header">
					<button 
						class="collection-title-button"
						on:click={(e) => handleCollectionClick(e, collection)}
						aria-label="View {collection.title} collection"
					>
						<h3 class="collection-title">
							{collection.title}
							{#if singleArtist}
								<span class="by-artist">by 
									<button 
										class="artist-name-link"
										on:click={(e) => handleArtistClick(e, singleArtist.id)}
									>
										{singleArtist.name}
									</button>
								</span>
							{/if}
						</h3>
						<div class="collection-meta">
							<span class="artwork-count">
								{#if layout.displayCount < collection.artworkCount}
									{layout.displayCount} of {collection.artworkCount} work{collection.artworkCount !== 1 ? 's' : ''}
								{:else}
									{collection.artworkCount} work{collection.artworkCount !== 1 ? 's' : ''}
								{/if}
							</span>
							{#if collection.description}
								<span class="collection-description">{collection.description}</span>
							{/if}
						</div>
					</button>
				</div>

				<!-- Collection Artworks -->
				<div class="artworks-display {layout.type}">
					{#if layout.type === 'single-featured'}
						<div class="single-featured-layout">
							{#each displayArtworks as artwork}
								<article class="artwork-item featured">
									<button 
										class="artwork-container" 
										on:click={() => handleArtworkClick(artwork)}
										aria-label="View {artwork.title}"
									>
										<div class="artwork-stage">
											<div class="stage featured">
												{#if artwork.imageUrl}
													<OptimizedImage
														src={artwork.imageUrl}
														alt={artwork.title}
														fit="contain"
														format="auto"
														quality={85}
														className="artwork-image"
														fallbackSrc="/images/medici-image.png"
														mimeType={artwork.mime}
														loading="eager"
													/>
												{:else}
													<div class="image-placeholder">
														<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
															<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
														</svg>
													</div>
												{/if}
											</div>
										</div>
										<div class="artwork-info">
											<h4 class="artwork-title">{artwork.title}</h4>
											{#if formatMintDate(artwork.mintDate)}
												<div class="mint-date">{formatMintDate(artwork.mintDate)}</div>
											{/if}
											{#if !singleArtist}
												<div class="artists">
													{#each artwork.artists as artist, index}
														<button 
															class="artist-link"
															on:click={(e) => handleArtistClick(e, artist.id)}
														>
															{artist.name}
														</button>
														{#if index < artwork.artists.length - 1}<span class="separator">, </span>{/if}
													{/each}
												</div>
											{/if}
										</div>
									</button>
								</article>
							{/each}
						</div>

					{:else if layout.type === 'dual-showcase'}
						<div class="dual-showcase-layout">
							{#each displayArtworks as artwork}
								<article class="artwork-item medium">
									<button 
										class="artwork-container" 
										on:click={() => handleArtworkClick(artwork)}
										aria-label="View {artwork.title}"
									>
										<div class="artwork-stage">
											<div class="stage medium">
												{#if artwork.imageUrl}
													<OptimizedImage
														src={artwork.imageUrl}
														alt={artwork.title}
														fit="contain"
														format="auto"
														quality={80}
														className="artwork-image"
														fallbackSrc="/images/medici-image.png"
														mimeType={artwork.mime}
														loading="lazy"
													/>
												{:else}
													<div class="image-placeholder">
														<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
															<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
														</svg>
													</div>
												{/if}
											</div>
										</div>
										<div class="artwork-info compact">
											<h4 class="artwork-title">{artwork.title}</h4>
											{#if !singleArtist}
												<div class="artists">
													{#each artwork.artists as artist, index}
														<button 
															class="artist-link"
															on:click={(e) => handleArtistClick(e, artist.id)}
														>
															{artist.name}
														</button>
														{#if index < artwork.artists.length - 1}<span class="separator">, </span>{/if}
													{/each}
												</div>
											{/if}
										</div>
									</button>
								</article>
							{/each}
						</div>

					{:else}
						<!-- Grid layouts for collections with multiple works -->
						<div class="grid-layout {layout.type}">
							{#each displayArtworks as artwork}
								<article class="artwork-item small">
									<button 
										class="artwork-container" 
										on:click={() => handleArtworkClick(artwork)}
										aria-label="View {artwork.title}"
									>
										<div class="artwork-stage">
											<div class="stage small">
												{#if artwork.imageUrl}
													<OptimizedImage
														src={artwork.imageUrl}
														alt={artwork.title}
														fit="contain"
														format="auto"
														quality={75}
														className="artwork-image"
														fallbackSrc="/images/medici-image.png"
														mimeType={artwork.mime}
														loading="lazy"
													/>
												{:else}
													<div class="image-placeholder">
														<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
															<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
														</svg>
													</div>
												{/if}
											</div>
										</div>
										<div class="artwork-info compact">
											<h4 class="artwork-title">{artwork.title}</h4>
											{#if !singleArtist}
												<div class="artists">
													{#each artwork.artists as artist, index}
														<button 
															class="artist-link"
															on:click={(e) => handleArtistClick(e, artist.id)}
														>
															{artist.name}
														</button>
														{#if index < artwork.artists.length - 1}<span class="separator">, </span>{/if}
													{/each}
												</div>
											{/if}
										</div>
									</button>
								</article>
							{/each}
						</div>
					{/if}

					<!-- Show more indicator if collection has additional works -->
					{#if collection.artworkCount > layout.displayCount}
						<div class="more-works-indicator">
							<button 
								class="more-works-button"
								on:click={(e) => handleCollectionClick(e, collection)}
							>
								<span class="plus-icon">+</span>
								<span class="more-count">{collection.artworkCount - layout.displayCount} more</span>
							</button>
						</div>
					{/if}
				</div>
			</section>
		{/each}
	</div>

	<!-- Intersection target for infinite scroll -->
	{#if hasMore}
		<div bind:this={intersectionTarget} class="intersection-target">
			{#if loading}
				<div class="loading-indicator">
					<LoaderWrapper width="100%" height="60px" />
					<p class="loading-text">Discovering more collections...</p>
				</div>
			{:else}
				<div class="load-more-placeholder"></div>
			{/if}
		</div>
	{:else if collections.length > 0}
		<div class="end-message">
			<p>You've explored all our curated collections</p>
		</div>
	{/if}
</div>

<style lang="scss">
	.curated-feed {
		@apply w-full max-w-7xl mx-auto pb-20;
	}

	.feed-header {
		@apply text-center mb-20 px-4 relative;
		
		&::after {
			content: '';
			@apply absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-px bg-gray-300 dark:bg-gray-600;
		}
		
		h2 {
			@apply text-3xl md:text-4xl font-bold mb-3;
		}
		
		p {
			@apply text-gray-600 dark:text-gray-400 text-base md:text-lg mb-8;
			@apply max-w-2xl mx-auto;
		}
	}

	.collections-container {
		@apply space-y-24 md:space-y-32;
	}

	.collection-section {
		@apply px-4;
	}

	.collection-header {
		@apply mb-8;
	}

	.collection-title-button {
		@apply w-full text-left bg-transparent border-none p-0 cursor-pointer;
		@apply transition-colors duration-200 hover:text-gray-600 dark:hover:text-gray-300;
	}

	.collection-title {
		@apply text-2xl md:text-3xl font-bold mb-2;
	}

	.by-artist {
		@apply font-normal text-gray-600 dark:text-gray-400 ml-2;
	}

	.artist-name-link {
		@apply text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100;
		@apply transition-colors duration-200 underline decoration-transparent hover:decoration-current;
		@apply bg-transparent border-none p-0 cursor-pointer;
	}

	.collection-meta {
		@apply flex flex-wrap items-center gap-3 text-gray-600 dark:text-gray-400;
	}

	.artwork-count {
		@apply text-sm font-medium uppercase tracking-wide;
	}

	.total-collection-size {
		@apply font-normal text-xs text-gray-500 dark:text-gray-500 ml-1;
	}

	.collection-description {
		@apply text-sm leading-relaxed;
	}

	/* Layout Grids */
	.single-featured-layout {
		@apply max-w-3xl mx-auto;
	}

	.dual-showcase-layout {
		@apply grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8;
		@apply max-w-5xl mx-auto;
	}

	.grid-layout {
		@apply grid gap-3 md:gap-4;
		
		&.collection-grid {
			@apply grid-cols-2 md:grid-cols-4;
		}
		
		&.expanded-grid {
			@apply grid-cols-2 md:grid-cols-3 lg:grid-cols-4;
		}
	}

	/* Artwork Items */
	.artwork-item {
		@apply relative;
	}

	.artwork-container {
		@apply w-full bg-transparent border-none p-0 cursor-pointer block text-left;
		@apply transition-transform duration-300 hover:scale-[1.02] focus:outline-none focus:scale-[1.02];
	}

	.artwork-stage {
		@apply mb-4;
	}

	.stage {
		@apply bg-gray-100 dark:bg-gray-950/70 overflow-hidden flex items-center justify-center;
		@apply aspect-square;
		
		&.featured {
			@apply aspect-[4/3];
		}
		
		&.medium {
			@apply aspect-square;
		}
		
		&.small {
			@apply aspect-square;
		}
	}

	:global(.artwork-image) {
		@apply w-full h-full object-contain;
	}

	.image-placeholder {
		@apply w-full h-full flex items-center justify-center text-gray-500;
	}

	.placeholder-icon {
		@apply w-16 h-16;
		
		.artwork-item.small & {
			@apply w-8 h-8;
		}
	}

	.artwork-info {
		@apply space-y-2;
		
		&.compact {
			@apply space-y-1;
		}
	}

	.artwork-title {
		@apply font-semibold text-gray-900 dark:text-gray-100 leading-tight;
		@apply text-lg;
		word-break: break-word;
		
		.artwork-item.small & {
			@apply text-sm mb-0;
		}
	}

	.mint-date {
		@apply text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide;
	}

	.artists {
		@apply flex flex-wrap items-center gap-1;
	}

	.artist-link {
		@apply text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100;
		@apply transition-colors duration-200 underline decoration-transparent hover:decoration-current;
		@apply text-sm bg-transparent border-none p-0 cursor-pointer;
		
		.artwork-item.small & {
			@apply text-xs;
		}
	}

	.separator {
		@apply text-gray-400;
	}

	/* More Works Indicator */
	.more-works-indicator {
		@apply mt-6 flex justify-center;
	}

	.more-works-button {
		@apply flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full;
		@apply hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200;
		@apply text-gray-700 dark:text-gray-300 text-sm font-medium;
		@apply border-none cursor-pointer;
	}

	.plus-icon {
		@apply w-4 h-4 flex items-center justify-center bg-gray-300 dark:bg-gray-600 rounded-full text-xs;
	}

	/* Loading and End States */
	.intersection-target {
		@apply mt-24 px-4;
	}

	.loading-indicator {
		@apply flex flex-col items-center gap-4 py-16;
	}

	.loading-text {
		@apply text-gray-500 dark:text-gray-400 text-sm;
	}

	.load-more-placeholder {
		@apply h-4;
	}

	.end-message {
		@apply text-center py-16;
		
		p {
			@apply text-gray-500 dark:text-gray-400 text-sm;
		}
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.collections-container {
			@apply space-y-16;
		}
		
		.collection-header {
			@apply mb-6;
		}
		
		.collection-title {
			@apply text-xl;
		}
		
		.dual-showcase-layout {
			@apply grid-cols-1 gap-4;
		}
		
		.grid-layout {
			@apply gap-2;
			
			&.collection-grid {
				@apply grid-cols-2;
			}
			
			&.expanded-grid {
				@apply grid-cols-2;
			}
		}
	}
</style> 