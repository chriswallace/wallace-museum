<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { navigateWithDebounce } from '$lib/utils/navigationHelpers';
	import LazyArtwork from './LazyArtwork.svelte';
	import SkeletonLoader from './SkeletonLoader.svelte';
	import {
		processArtworksForEntangled,
		isEntangledPair,
		getEntangledPageUrl,
		isEntangledArtwork,
		getEntangledPageUrlFromArtwork
	} from '$lib/utils/entangledHelpers';
	import type { CollectionGroup } from '../../routes/api/artworks/collections/+server';

	let collections: CollectionGroup[] = [];
	let loading = false;
	let hasMore = true;
	let loadMoreTrigger: HTMLElement;

	// Pagination
	let page = 1;
	const limit = 12;

	// Get display artworks for each collection (show all artworks)
	function getDisplayArtworks(collection: CollectionGroup) {
		return processArtworksForEntangled(collection.artworks); // Process for Entangled pairing
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
		// For 4 artworks, use 4 columns
		return 'md:grid-cols-4';
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
			const excludeIds = collections.map((c) => c.id);
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

	// Swiper navigation functions
	function scrollSwiper(swiperTrack: HTMLElement, direction: 'left' | 'right') {
		// Calculate scroll amount based on viewport width to match artwork slide widths
		let scrollAmount = 320; // Default for small screens

		if (window.innerWidth >= 1280) {
			scrollAmount = 520;
		} else if (window.innerWidth >= 1024) {
			scrollAmount = 480;
		} else if (window.innerWidth >= 768) {
			scrollAmount = 400;
		} else if (window.innerWidth >= 640) {
			scrollAmount = 320;
		} else {
			scrollAmount = 280;
		}

		const currentScroll = swiperTrack.scrollLeft;
		const targetScroll =
			direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount;

		swiperTrack.scrollTo({
			left: targetScroll,
			behavior: 'smooth'
		});
	}

	function canScrollLeft(swiperTrack: HTMLElement): boolean {
		return swiperTrack.scrollLeft > 0;
	}

	function canScrollRight(swiperTrack: HTMLElement): boolean {
		return swiperTrack.scrollLeft < swiperTrack.scrollWidth - swiperTrack.clientWidth;
	}
</script>

<div class="curated-feed">
	<div class="feed-header mb-16 border-b border-gray-200 dark:border-gray-800">
		<h2>Browse Collections</h2>
	</div>

	<!-- Collections Section -->
	<div class="collections-section">
		{#if loading && collections.length === 0}
			<!-- Collection Skeleton Loaders -->
			{#each Array(3) as _, i}
				<div class="collection-group">
					<div class="collection-header">
						<div class="collection-card">
							<div class="collection-main-info">
								<SkeletonLoader width="200px" height="32px" borderRadius="4px" />
								<div class="mt-2">
									<SkeletonLoader width="120px" height="16px" borderRadius="4px" />
								</div>
								<div class="mt-1">
									<SkeletonLoader width="80px" height="14px" borderRadius="4px" />
								</div>
							</div>
						</div>
					</div>
					<div class="collection-artworks">
						<div class="artworks-swiper">
							<!-- Navigation Buttons (hidden during loading) -->
							<button
								class="swiper-nav-button swiper-nav-left"
								style="display: none;"
								aria-label="Previous artworks"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M15 18l-6-6 6-6" />
								</svg>
							</button>

							<button
								class="swiper-nav-button swiper-nav-right"
								style="display: none;"
								aria-label="Next artworks"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M9 18l6-6-6-6" />
								</svg>
							</button>

							<div class="swiper-track">
								{#each Array(4) as _, j}
									<div class="artwork-slide">
										<SkeletonLoader width="100%" height="280px" borderRadius="8px" />
										<div class="artwork-info">
											<div class="artwork-title">
												<SkeletonLoader width="80%" height="16px" borderRadius="4px" />
											</div>
											<div class="artist-name mt-1">
												<SkeletonLoader width="60%" height="14px" borderRadius="4px" />
											</div>
										</div>
									</div>
								{/each}
								<div class="artwork-slide view-collection-slide">
									<SkeletonLoader width="100%" height="280px" borderRadius="8px" />
								</div>
							</div>
						</div>
					</div>
				</div>
			{/each}
		{:else if collections.length === 0}
			<div class="end-message">
				<p>No collections available</p>
			</div>
		{:else}
			{#each collections as collection}
				{@const displayArtworks = getDisplayArtworks(collection)}
				<div class="collection-group">
					<div class="collection-header">
						<div class="collection-card">
							<div class="collection-main-info">
								<button
									class="collection-title-button"
									on:click={() => goto(`/collection/${collection.slug}`)}
								>
									<h2 class="collection-title">{collection.title}</h2>
								</button>
								{#if isCollectionBySpecificArtist(collection)}
									<div class="collection-artist">by {collection.artists[0].name}</div>
								{/if}
								<div class="collection-count">
									{collection.artworkCount} artwork{collection.artworkCount !== 1 ? 's' : ''}
								</div>
							</div>
						</div>
					</div>

					<div class="collection-artworks">
						<div class="artworks-swiper" class:hoverable={displayArtworks.length > 3}>
							<!-- Navigation Buttons -->
							<button
								class="swiper-nav-button swiper-nav-left"
								on:click={(e) => {
									e.preventDefault();
									const swiperTrack = e.currentTarget.parentElement?.querySelector('.swiper-track');
									if (swiperTrack) scrollSwiper(swiperTrack, 'left');
								}}
								aria-label="Previous artworks"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M15 18l-6-6 6-6" />
								</svg>
							</button>

							<button
								class="swiper-nav-button swiper-nav-right"
								on:click={(e) => {
									e.preventDefault();
									const swiperTrack = e.currentTarget.parentElement?.querySelector('.swiper-track');
									if (swiperTrack) scrollSwiper(swiperTrack, 'right');
								}}
								aria-label="Next artworks"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M9 18l6-6-6-6" />
								</svg>
							</button>

							<div class="swiper-track">
								{#each displayArtworks as item}
									{#if isEntangledPair(item)}
										<!-- Entangled pair link -->
										<div class="artwork-slide entangled-slide">
											<a
												href={getEntangledPageUrl(item.ethereum.tokenId, item.tezos.tokenId)}
												class="entangled-link"
											>
												<div class="entangled-preview-mini">
													<div class="entangled-preview-images-mini">
														<div class="chain-preview-mini ethereum">
															<LazyArtwork
																artwork={{
																	id: item.ethereum.id,
																	title: item.ethereum.title,
																	imageUrl: item.ethereum.imageUrl,
																	animationUrl: item.ethereum.animationUrl,
																	mime: item.ethereum.mime,
																	dimensions: item.ethereum.dimensions
																}}
																aspectRatio="square"
																className="chain-artwork-mini"
																priority={collections.indexOf(collection) < 2}
																sizes="200px"
																responsiveSizes={[200]}
																quality={85}
															/>
														</div>
														<div class="chain-preview-mini tezos">
															<LazyArtwork
																artwork={{
																	id: item.tezos.id,
																	title: item.tezos.title,
																	imageUrl: item.tezos.imageUrl,
																	animationUrl: item.tezos.animationUrl,
																	mime: item.tezos.mime,
																	dimensions: item.tezos.dimensions
																}}
																aspectRatio="square"
																className="chain-artwork-mini"
																priority={collections.indexOf(collection) < 2}
																sizes="200px"
																responsiveSizes={[200]}
																quality={85}
															/>
														</div>
													</div>
													<div class="entangled-overlay-mini">
														<div class="entangled-title-mini">ENTANGLED</div>
													</div>
												</div>
											</a>
											<div class="artwork-info">
												<div class="artwork-title">
													Entangled #{item.ethereum.tokenId || item.ethereum.tokenID || '1'}
												</div>
												{#if item.ethereum.artists && item.ethereum.artists.length > 0 && !isCollectionBySpecificArtist(collection)}
													<div class="artist-name">{item.ethereum.artists[0].name}</div>
												{/if}
											</div>
										</div>
									{:else if isEntangledArtwork(item)}
										<!-- Individual Entangled artwork link -->
										<div class="artwork-slide">
											<a href={getEntangledPageUrlFromArtwork(item)} class="entangled-single-link">
												<LazyArtwork
													artwork={{
														id: item.id,
														title: item.title,
														imageUrl: item.imageUrl,
														animationUrl: item.animationUrl,
														mime: item.mime,
														dimensions: item.dimensions
													}}
													aspectRatio="square"
													className="artwork-thumbnail"
													priority={collections.indexOf(collection) < 2}
													sizes="(max-width: 640px) 280px, (max-width: 768px) 320px, (max-width: 1024px) 400px, (max-width: 1280px) 480px, 520px"
													responsiveSizes={[280, 320, 400, 480, 520]}
													quality={85}
												/>
												<div class="entangled-badge-mini">ENTANGLED</div>
											</a>
											<div class="artwork-info">
												<div class="artwork-title">
													{trimArtworkTitle(item.title, collection.title)}
												</div>
												{#if item.artists && item.artists.length > 0 && !isCollectionBySpecificArtist(collection)}
													<div class="artist-name">{item.artists[0].name}</div>
												{/if}
											</div>
										</div>
									{:else}
										<!-- Regular artwork display -->
										<div class="artwork-slide">
											<LazyArtwork
												artwork={{
													id: item.id,
													title: item.title,
													imageUrl: item.imageUrl,
													animationUrl: item.animationUrl,
													mime: item.mime,
													dimensions: item.dimensions
												}}
												aspectRatio="square"
												onClick={() => handleArtworkClick(item)}
												className="artwork-thumbnail"
												priority={collections.indexOf(collection) < 2}
												sizes="(max-width: 640px) 280px, (max-width: 768px) 320px, (max-width: 1024px) 400px, (max-width: 1280px) 480px, 520px"
												responsiveSizes={[280, 320, 400, 480, 520]}
												quality={85}
											/>
											<div class="artwork-info">
												<div class="artwork-title">
													{trimArtworkTitle(item.title, collection.title)}
												</div>
												{#if item.artists && item.artists.length > 0 && !isCollectionBySpecificArtist(collection)}
													<div class="artist-name">{item.artists[0].name}</div>
												{/if}
											</div>
										</div>
									{/if}
								{/each}

								<!-- View Collection Card -->
								<div class="artwork-slide view-collection-slide">
									<button
										class="view-collection-card"
										on:click={() => goto(`/collection/${collection.slug}`)}
									>
										<div class="view-collection-content">
											<div class="view-collection-text">
												<div class="view-collection-label">View Collection</div>
												<div class="view-collection-count">
													{collection.artworkCount} artwork{collection.artworkCount !== 1
														? 's'
														: ''}
												</div>
											</div>
										</div>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			{/each}

			{#if hasMore}
				<div class="lazy-load-container">
					{#if loading}
						<!-- Subtle skeleton loader for additional collections -->
						<div class="collection-group">
							<div class="collection-header">
								<div class="collection-card">
									<div class="collection-main-info">
										<SkeletonLoader width="200px" height="32px" borderRadius="4px" />
										<div class="mt-2">
											<SkeletonLoader width="120px" height="16px" borderRadius="4px" />
										</div>
										<div class="mt-1">
											<SkeletonLoader width="80px" height="14px" borderRadius="4px" />
										</div>
									</div>
								</div>
							</div>
							<div class="collection-artworks">
								<div class="artworks-swiper">
									<!-- Navigation Buttons (hidden during loading) -->
									<button
										class="swiper-nav-button swiper-nav-left"
										style="display: none;"
										aria-label="Previous artworks"
									>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M15 18l-6-6 6-6" />
										</svg>
									</button>

									<button
										class="swiper-nav-button swiper-nav-right"
										style="display: none;"
										aria-label="Next artworks"
									>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M9 18l6-6-6-6" />
										</svg>
									</button>

									<div class="swiper-track">
										{#each Array(4) as _, j}
											<div class="artwork-slide">
												<SkeletonLoader width="100%" height="280px" borderRadius="8px" />
												<div class="artwork-info">
													<div class="artwork-title">
														<SkeletonLoader width="80%" height="16px" borderRadius="4px" />
													</div>
													<div class="artist-name mt-1">
														<SkeletonLoader width="60%" height="14px" borderRadius="4px" />
													</div>
												</div>
											</div>
										{/each}
										<div class="artwork-slide view-collection-slide">
											<SkeletonLoader width="100%" height="280px" borderRadius="8px" />
										</div>
									</div>
								</div>
							</div>
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

	@media (min-width: 768px) {
		.curated-feed {
			@apply px-0;
		}
	}

	.feed-header {
		@apply mb-8 sm:mb-12 lg:mb-16 lg:mx-4;
	}

	.feed-header h2 {
		@apply text-3xl font-bold mb-4 text-gray-900 dark:text-gray-50;
	}

	.feed-header p {
		@apply text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto;
	}

	.collections-section {
		@apply flex flex-col gap-16;
	}

	@media (min-width: 640px) {
		.collections-section {
			@apply gap-24;
		}
	}

	@media (min-width: 768px) {
		.collections-section {
			@apply gap-32;
		}
	}

	@media (min-width: 1024px) {
		.collections-section {
			@apply gap-40;
		}
	}

	.collection-header {
		@apply max-w-prose;
	}

	@media (min-width: 768px) {
		.collection-group {
			@apply flex items-stretch gap-8;
		}

		.collection-header {
			@apply flex-shrink-0 flex;
			width: 25%; /* Reduced from 33.333% to make it less wide */
			max-width: none;
		}

		.collection-artworks {
			@apply flex-1 overflow-hidden;
		}
	}

	@media (min-width: 1024px) {
		.collection-group {
			@apply gap-6;
		}
	}

	.collection-card {
		@apply flex flex-col items-start justify-start text-left flex-1;
		@apply transition-colors duration-200;
	}

	@media (max-width: 767px) {
		.collection-card {
			@apply gap-4 mb-4;
		}
	}

	@media (min-width: 768px) {
		.collection-card {
			@apply flex-col items-center justify-center text-center;
		}
	}

	.collection-main-info {
		@apply flex flex-col gap-1;
	}

	@media (min-width: 768px) {
		.collection-main-info {
			@apply items-center text-center gap-2;
		}
	}

	.collection-title-button {
		@apply bg-transparent border-none p-0 cursor-pointer;
		@apply transition-colors duration-200;
	}

	.collection-title-button:hover .collection-title {
		@apply text-gray-600 dark:text-gray-300;
	}

	.collection-title {
		@apply text-lg font-bold mb-1 text-gray-900 dark:text-gray-50;
		@apply leading-tight transition-colors duration-200;
	}

	@media (min-width: 640px) {
		.collection-title {
			@apply text-xl;
		}
	}

	@media (min-width: 768px) {
		.collection-title {
			@apply text-2xl mb-3;
		}
	}

	.view-all-button {
		@apply mt-2 px-4 py-2 bg-transparent border border-gray-300 dark:border-gray-600;
		@apply text-gray-600 dark:text-gray-400 text-sm font-medium rounded-md;
		@apply hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200;
		@apply transition-all duration-200 cursor-pointer flex-shrink-0;
		@apply h-fit self-start;
	}

	@media (min-width: 768px) {
		.view-all-button {
			@apply mt-4 px-4 py-2 text-sm self-center;
		}
	}

	.collection-artist {
		@apply text-gray-600 dark:text-gray-400 text-sm font-medium mb-1;
		@apply block;
	}

	@media (min-width: 768px) {
		.collection-artist {
			@apply text-lg mb-2;
		}
	}

	.collection-count {
		@apply text-gray-500 dark:text-gray-400 text-xs font-normal mb-0;
	}

	@media (min-width: 768px) {
		.collection-count {
			@apply text-sm;
		}
	}

	.collection-description {
		@apply text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4;
		word-break: break-word;
		white-space: normal;
		overflow-wrap: break-word;
		hyphens: auto;
	}

	.collection-artworks {
		@apply mt-4 -mx-4;
	}

	@media (min-width: 640px) {
		.collection-artworks {
			@apply mt-6;
		}
	}

	@media (min-width: 768px) {
		.collection-artworks {
			@apply mt-0 mx-0;
		}
	}

	/* Artworks Swiper */
	.artworks-swiper {
		@apply overflow-hidden;
	}

	.artworks-swiper.hoverable {
		@apply relative;
	}

	.swiper-nav-button {
		@apply absolute top-1/2 transform -translate-y-1/2 z-10;
		@apply w-12 h-12 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm;
		@apply flex items-center justify-center cursor-pointer border-0;
		@apply text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white;
		@apply shadow-lg hover:shadow-xl transition-all duration-200;
		@apply opacity-0 pointer-events-none;
		@apply hover:bg-white dark:hover:bg-gray-700;
	}

	.artworks-swiper.hoverable:hover .swiper-nav-button {
		@apply opacity-100 pointer-events-auto;
	}

	.swiper-nav-left {
		@apply left-2;
	}

	.swiper-nav-right {
		@apply right-2;
	}

	.swiper-nav-button svg {
		@apply w-5 h-5;
	}

	.swiper-nav-button:hover {
		transform: translateY(-50%) scale(1.05);
	}

	/* Hide navigation on mobile */
	@media (max-width: 767px) {
		.swiper-nav-button {
			@apply hidden;
		}
	}

	.swiper-track {
		@apply flex overflow-x-auto pb-4;
		gap: 12px;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		-ms-overflow-style: none;
		padding-left: 1rem;
		padding-right: 1rem;
	}

	.swiper-track::-webkit-scrollbar {
		@apply hidden;
	}

	.artwork-slide {
		@apply flex-shrink-0 px-0;
		width: 280px; /* Optimized mobile size */
		scroll-snap-align: 16px;
	}

	.entangled-slide {
		width: 560px; /* Double width for Entangled pairs */
	}

	@media (min-width: 640px) {
		.artwork-slide {
			width: 320px;
		}

		.entangled-slide {
			width: 640px;
		}
	}

	@media (min-width: 768px) {
		.artwork-slide {
			width: 400px; /* Larger desktop size */
		}

		.entangled-slide {
			width: 800px; /* Double width for Entangled pairs */
		}
	}

	@media (min-width: 1024px) {
		.artwork-slide {
			width: 480px; /* Even larger on big screens */
		}

		.entangled-slide {
			width: 960px; /* Double width for Entangled pairs */
		}
	}

	@media (min-width: 1280px) {
		.artwork-slide {
			width: 520px; /* Maximum size for very large screens */
		}

		.entangled-slide {
			width: 1040px; /* Double width for Entangled pairs */
		}
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

	/* Entangled Mini Styles */
	.entangled-link {
		@apply block no-underline;
	}

	.entangled-preview-mini {
		@apply relative bg-gradient-to-br from-gray-900 to-black rounded-lg overflow-hidden aspect-video mb-2;
		transition: all 0.3s ease;
	}

	.entangled-preview-mini:hover {
		transform: scale(1.02);
		box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
	}

	.entangled-preview-images-mini {
		@apply absolute inset-0 flex;
	}

	.chain-preview-mini {
		@apply flex-1 relative overflow-hidden;
	}

	.chain-preview-mini.ethereum {
		@apply border-r border-blue-500/30;
	}

	.chain-preview-mini.tezos {
		@apply border-l border-blue-400/30;
	}

	.entangled-overlay-mini {
		@apply absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-white text-center;
		background: linear-gradient(45deg, rgba(98, 126, 234, 0.8), rgba(45, 156, 219, 0.8));
	}

	.entangled-title-mini {
		@apply text-lg md:text-xl font-bold tracking-wide;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.entangled-single-link {
		@apply relative block no-underline;
	}

	.entangled-badge-mini {
		@apply absolute top-2 right-2 px-2 py-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold rounded-full tracking-wide;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	.view-collection-slide {
		@apply flex-shrink-0 px-0 aspect-square;
	}

	.view-collection-card {
		@apply bg-transparent border-none p-0 cursor-pointer w-full;
		@apply transition-all duration-200 hover:scale-[1.01];
	}

	.view-collection-content {
		@apply w-full aspect-square bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center gap-3;
		@apply hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800;
		@apply transition-all duration-200;
	}

	.view-collection-text {
		@apply flex flex-col items-center justify-center text-center gap-1;
	}

	.view-collection-label {
		@apply text-xl font-semibold text-gray-800 dark:text-gray-200;
	}

	.view-collection-count {
		@apply text-xs text-gray-500 dark:text-gray-400;
	}

	.collection-icon {
		@apply w-full h-full;
	}
</style>
