<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { navigateWithDebounce } from '$lib/utils/navigationHelpers';
	import LazyArtwork from './LazyArtwork.svelte';
	import type { CollectionGroup } from '../../routes/api/artworks/collections/+server';

	let collections: CollectionGroup[] = [];
	let loading = false;
	let hasMore = true;
	let loadMoreTrigger: HTMLElement;

	// Pagination
	let page = 1;
	const limit = 12;

	// Get display artworks for each collection (limit to 4 for grid display)
	function getDisplayArtworks(collection: CollectionGroup) {
		return collection.artworks.slice(0, 4);
	}

	// Truncate description at 255 characters with ellipsis
	function truncateDescription(description: string | null): string {
		if (!description) return '';
		if (description.length <= 255) return description;
		return description.substring(0, 255) + '...';
	}

	// Check if collection is tied to a specific artist (single artist collection)
	function isCollectionBySpecificArtist(collection: CollectionGroup): boolean {
		return collection.artists && collection.artists.length === 1;
	}

	// Trim collection name from artwork title if it appears at the beginning
	function trimArtworkTitle(artworkTitle: string, collectionTitle: string): string {
		// Handle cases like "Collection Name #123" -> "#123"
		const regex = new RegExp(`^${escapeRegExp(collectionTitle)}\\s*`, 'i');
		return artworkTitle.replace(regex, '').trim() || artworkTitle;
	}

	// Escape special regex characters
	function escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	// Get grid columns for artworks within a collection
	function getArtworkGridCols(artworkCount: number): string {
		if (artworkCount === 1) return 'md:grid-cols-1';
		if (artworkCount === 2) return 'md:grid-cols-2';
		if (artworkCount === 3) return 'md:grid-cols-3';
		// For 4 artworks, use 3 columns on larger screens
		return 'md:grid-cols-2 lg:grid-cols-3';
	}

	function handleArtworkClick(artwork: any) {
		if (artwork.artists && artwork.artists.length > 0) {
			navigateWithDebounce(`/artist/${artwork.artists[0].id}/${artwork.id}`);
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

	// Setup intersection observer for lazy loading
	function setupIntersectionObserver() {
		if (!loadMoreTrigger) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry.isIntersecting && hasMore && !loading) {
					loadCollections();
				}
			},
			{
				rootMargin: '200px' // Trigger 200px before the element comes into view
			}
		);

		observer.observe(loadMoreTrigger);

		// Return cleanup function
		return () => observer.disconnect();
	}

	// Set up intersection observer when trigger element becomes available
	let observerCleanup: (() => void) | undefined;
	$: if (loadMoreTrigger) {
		// Clean up previous observer if it exists
		if (observerCleanup) {
			observerCleanup();
		}
		observerCleanup = setupIntersectionObserver();
	}

	async function loadCollections() {
		if (loading || !hasMore) return;

		loading = true;

		try {
			const excludeIds = collections.map(c => c.id);
			const params = new URLSearchParams();
			params.set('limit', '6');
			if (excludeIds.length > 0) {
				params.set('excludeCollections', excludeIds.join(','));
			}

			const response = await fetch(`/api/artworks/collections?${params}`);
			const data = await response.json();

			if (response.ok) {
				collections = [...collections, ...data.collections];
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

	onMount(() => {
		loadCollections();
		
		// Cleanup on component destroy
		return () => {
			if (observerCleanup) {
				observerCleanup();
			}
		};
	});
</script>

<div class="curated-feed">
	<div class="feed-header">
		<h2>Collections</h2>
	</div>

	<!-- Collections Section -->
	<div class="collections-section">
		{#if loading && collections.length === 0}
			<div class="loading-container">
				<div class="loading-indicator">
					<div class="loading-spinner"></div>
					<span class="loading-text">Loading collections...</span>
				</div>
			</div>
		{:else if collections.length === 0}
			<div class="end-message">
				<p>No collections available</p>
			</div>
		{:else}
			{#each collections as collection}
				{@const displayArtworks = getDisplayArtworks(collection)}
				<div class="collection-group">
					<div class="collection-header">
						<button 
							class="collection-header-button"
							on:click={() => goto(`/collection/${collection.slug}`)}
						>
							<h2 class="collection-title">
								{collection.title}
								{#if isCollectionBySpecificArtist(collection)}
									<span class="collection-artist">by {collection.artists[0].name}</span>
								{/if}
								<span class="collection-count">({collection.artworkCount})</span>
							</h2>
							{#if collection.description}
								<p class="collection-description">{truncateDescription(collection.description)}</p>
							{/if}
						</button>
					</div>

					<div class="collection-artworks">
						<!-- Mobile Swiper -->
						<div class="mobile-swiper md:hidden">
							<div class="swiper-track">
								{#each displayArtworks as artwork}
									<div class="artwork-slide">
										<LazyArtwork
											artwork={{
												id: artwork.id,
												title: artwork.title,
												imageUrl: artwork.imageUrl,
												animationUrl: artwork.animationUrl,
												mime: artwork.mime,
												dimensions: artwork.dimensions
											}}
											aspectRatio="square"
											onClick={() => handleArtworkClick(artwork)}
											className="artwork-thumbnail"
											priority={collections.indexOf(collection) < 2}
											sizes="(max-width: 768px) 50vw, 25vw"
											responsiveSizes={[150, 200, 300, 400]}
										/>
										<div class="artwork-info">
											<div class="artwork-title">{trimArtworkTitle(artwork.title, collection.title)}</div>
											{#if artwork.artists && artwork.artists.length > 0 && !isCollectionBySpecificArtist(collection)}
												<div class="artist-name">{artwork.artists[0].name}</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Desktop Grid -->
						<div class="desktop-grid hidden md:grid {getArtworkGridCols(displayArtworks.length)}">
							{#each displayArtworks as artwork}
								<div class="artwork-item">
									<LazyArtwork
										artwork={{
											id: artwork.id,
											title: artwork.title,
											imageUrl: artwork.imageUrl,
											animationUrl: artwork.animationUrl,
											mime: artwork.mime,
											dimensions: artwork.dimensions
										}}
										aspectRatio="square"
										onClick={() => handleArtworkClick(artwork)}
										className="artwork-thumbnail"
										priority={collections.indexOf(collection) < 2}
										sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
										responsiveSizes={[200, 300, 400, 500]}
									/>
									<div class="artwork-info">
										<div class="artwork-title">{trimArtworkTitle(artwork.title, collection.title)}</div>
										{#if artwork.artists && artwork.artists.length > 0 && !isCollectionBySpecificArtist(collection)}
											<div class="artist-name">{artwork.artists[0].name}</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}

			{#if hasMore}
				<div class="lazy-load-container">
					{#if loading}
						<div class="loading-indicator">
							<div class="loading-spinner"></div>
							<span class="loading-text">Loading more collections...</span>
						</div>
					{/if}
					<div class="load-trigger" bind:this={loadMoreTrigger}></div>
				</div>
			{:else if collections.length > 0}
				<div class="end-message">
					<p>You've seen all available collections</p>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style lang="scss">
	.curated-feed {
		@apply w-full mx-auto px-4 pb-16;
	}

	.feed-header {
		@apply mb-16;
	}

	.feed-header h2 {
		@apply text-3xl font-bold mb-4 text-gray-900 dark:text-gray-50;
	}

	.feed-header p {
		@apply text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto;
	}

	.collections-section {
		@apply flex flex-col gap-20;
	}

	@media (min-width: 768px) {
		.collections-section {
			@apply gap-24;
		}
	}

	@media (min-width: 1024px) {
		.collections-section {
			@apply gap-28;
		}
	}

	.collection-header {
		@apply mb-6 max-w-prose;
	}

	.collection-header-button {
		@apply w-full text-left bg-transparent border-none p-0 cursor-pointer;
		@apply hover:opacity-80 transition-opacity duration-200;
	}

	.collection-title {
		@apply text-2xl font-bold mb-2 text-gray-900 dark:text-gray-50;
	}

	.collection-count {
		@apply text-gray-500 dark:text-gray-400 text-lg font-normal ml-2;
	}

	.collection-artist {
		@apply text-gray-600 dark:text-gray-400 text-lg font-normal ml-2;
	}

	.collection-description {
		@apply text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4;
	}

	.collection-artworks {
	}

	/* Mobile Swiper */
	.mobile-swiper {
		@apply overflow-hidden;
	}

	.mobile-swiper {
		@apply md:hidden;
	}

	.swiper-track {
		@apply flex gap-2 overflow-x-auto pb-4;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	@media (min-width: 640px) {
		.swiper-track {
			@apply gap-3;
		}
	}

	.swiper-track::-webkit-scrollbar {
		@apply hidden;
	}

	.artwork-slide {
		@apply flex-shrink-0 w-64;
		scroll-snap-align: start;
	}

	/* Desktop Grid */
	.desktop-grid {
		@apply hidden md:grid gap-2;
	}

	.desktop-grid.md\\:grid-cols-1 {
		@media (min-width: 768px) {
			grid-template-columns: 1fr;
		}
	}

	.desktop-grid.md\\:grid-cols-2 {
		@media (min-width: 768px) {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.desktop-grid.md\\:grid-cols-3 {
		@media (min-width: 768px) {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.desktop-grid.md\\:grid-cols-2.lg\\:grid-cols-3 {
		@media (min-width: 768px) {
			grid-template-columns: repeat(2, 1fr);
		}
		@media (min-width: 1024px) {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.artwork-item {
		@apply w-full bg-transparent border-none cursor-pointer text-left;
	}

	.artwork-thumbnail {
		@apply overflow-hidden w-full mb-2;
		@apply flex items-center justify-center mx-auto my-0;
	}

	.artwork-info {
		@apply flex flex-col gap-0.5;
	}

	.artwork-title {
		@apply font-normal text-gray-800 dark:text-gray-200 text-base font-semibold leading-tight mt-3 mb-1.5;
	}

	.artist-name {
		@apply text-xs text-gray-700 dark:text-gray-300;
	}

	.loading-container {
		@apply fixed inset-0 flex items-center justify-center z-50 bg-white/80 dark:bg-black/80 backdrop-blur-sm;
	}

	.loading-indicator {
		@apply flex flex-col items-center justify-center gap-4 py-8;
	}

	.loading-spinner {
		@apply w-6 h-6 border-2 border-gray-300 dark:border-gray-600 rounded-full animate-spin;
		border-top-color: #374151;
	}

	.dark .loading-spinner {
		border-top-color: #d1d5db;
	}

	.loading-text {
		@apply text-gray-600 dark:text-gray-400;
	}

	.load-trigger {
		@apply h-1 w-full;
	}

	.end-message {
		@apply text-center mt-12;
	}

	.end-message p {
		@apply text-gray-600 dark:text-gray-400;
	}

	.lazy-load-container {
		@apply flex flex-col items-center justify-center mt-12;
	}



	@media (min-width: 1024px) {
		.desktop-grid {
			@apply gap-3;
		}
	}

	@media (min-width: 1280px) {
		.desktop-grid {
			@apply gap-4;
		}
	}
</style> 