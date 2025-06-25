<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import OptimizedImage from './OptimizedImage.svelte';
	import type { CollectionGroup } from '../../routes/api/artworks/collections/+server';

	let collections: CollectionGroup[] = [];
	let loading = false;
	let hasMore = true;

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

	// Determine grid layout based on artwork count
	function getGridColumns(artworkCount: number): string {
		if (artworkCount === 1) return 'grid-cols-1';
		if (artworkCount === 2) return 'grid-cols-2';
		if (artworkCount === 3) return 'grid-cols-3';
		return 'grid-cols-2 lg:grid-cols-4'; // 4 on desktop, 2 on mobile
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

	onMount(() => {
		loadCollections();
	});
</script>

<div class="curated-feed">
	<div class="feed-header">
		<h2>Collections</h2>
		<p>Discover curated collections of digital artworks from pioneering artists</p>
	</div>

	<div class="collections-grid">
		{#each collections as collection (collection.id)}
			{@const singleArtist = getCollectionArtist(collection)}
			{@const displayArtworks = collection.artworks.slice(0, 4)}
			{@const gridCols = getGridColumns(displayArtworks.length)}
			
			<div class="collection-card">
				<!-- Collection Header -->
				<div class="collection-header">
					<button 
						class="collection-title-btn"
						on:click={(e) => handleCollectionClick(e, collection)}
					>
						<h3 class="collection-title">
							{collection.title}
							{#if singleArtist}
								<span class="by-artist">by 
									<button 
										class="artist-link"
										on:click={(e) => handleArtistClick(e, singleArtist.id)}
									>
										{singleArtist.name}
									</button>
								</span>
							{/if}
						</h3>
					</button>
					
					<div class="collection-meta">
						<span class="artwork-count">
							{collection.artworkCount} artwork{collection.artworkCount !== 1 ? 's' : ''}
						</span>
						{#if collection.description}
							<p class="collection-description">{collection.description}</p>
						{/if}
					</div>
				</div>

				<!-- Artworks Grid (Desktop) / Swiper (Mobile) -->
				<div class="artworks-container">
					<!-- Mobile Swiper -->
					<div class="mobile-swiper md:hidden">
						<div class="swiper-track">
							{#each displayArtworks as artwork}
								<div class="artwork-slide">
									<button 
										class="artwork-btn"
										on:click={() => handleArtworkClick(artwork)}
									>
										<div class="artwork-image-container">
											{#if artwork.imageUrl}
												<OptimizedImage
													src={artwork.imageUrl}
													alt={artwork.title}
													className="artwork-image"
													fit="cover"
													quality={80}
													loading="lazy"
													mimeType={artwork.mime}
												/>
											{:else}
												<div class="image-placeholder">
													<svg viewBox="0 0 24 24" fill="currentColor">
														<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
													</svg>
												</div>
											{/if}
										</div>
										<div class="artwork-info">
											<h4 class="artwork-title">{artwork.title}</h4>
											{#if formatMintDate(artwork.mintDate)}
												<span class="mint-date">{formatMintDate(artwork.mintDate)}</span>
											{/if}
											{#if !singleArtist && artwork.artists.length > 0}
												<span class="artist-name">{artwork.artists[0].name}</span>
											{/if}
										</div>
									</button>
								</div>
							{/each}
						</div>
					</div>

					<!-- Desktop Grid -->
					<div class="desktop-grid hidden md:grid {gridCols}">
						{#each displayArtworks as artwork}
							<button 
								class="artwork-btn"
								on:click={() => handleArtworkClick(artwork)}
							>
								<div class="artwork-image-container">
									{#if artwork.imageUrl}
										<OptimizedImage
											src={artwork.imageUrl}
											alt={artwork.title}
											className="artwork-image"
											fit="cover"
											quality={80}
											loading="lazy"
											mimeType={artwork.mime}
										/>
									{:else}
										<div class="image-placeholder">
											<svg viewBox="0 0 24 24" fill="currentColor">
												<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
											</svg>
										</div>
									{/if}
								</div>
								<div class="artwork-info">
									<h4 class="artwork-title">{artwork.title}</h4>
									{#if formatMintDate(artwork.mintDate)}
										<span class="mint-date">{formatMintDate(artwork.mintDate)}</span>
									{/if}
									{#if !singleArtist && artwork.artists.length > 0}
										<span class="artist-name">{artwork.artists[0].name}</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>

					<!-- Show More Button -->
					{#if collection.artworkCount > 4}
						<button 
							class="show-more-btn"
							on:click={(e) => handleCollectionClick(e, collection)}
						>
							+{collection.artworkCount - 4} more
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Load More Button -->
	{#if hasMore}
		<div class="load-more-container">
			{#if loading}
				<div class="loading-spinner">Loading more collections...</div>
			{:else}
				<button class="load-more-btn" on:click={loadCollections}>
					Load More Collections
				</button>
			{/if}
		</div>
	{:else if collections.length > 0}
		<div class="end-message">
			<p>You've explored all our curated collections</p>
		</div>
	{/if}
</div>

<style>
	.curated-feed {
		width: 100%;
		max-width: 80rem;
		margin: 0 auto;
		padding: 0 1rem 4rem;
	}

	.feed-header {
		margin-bottom: 3rem;
		text-align: center;
	}

	.feed-header h2 {
		font-size: 1.875rem;
		font-weight: 700;
		margin-bottom: 1rem;
		color: #111827;
	}

	@media (min-width: 768px) {
		.feed-header h2 {
			font-size: 2.25rem;
		}
	}

	.feed-header p {
		color: #6b7280;
		font-size: 1.125rem;
		max-width: 42rem;
		margin: 0 auto;
	}

	.collections-grid {
		display: flex;
		flex-direction: column;
		gap: 4rem;
	}

	.collection-card {
		background-color: white;
		border-radius: 0.75rem;
		padding: 1.5rem;
		border: 1px solid #e5e7eb;
	}

	.collection-header {
		margin-bottom: 1.5rem;
	}

	.collection-title-btn {
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.collection-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
		color: #111827;
	}

	.by-artist {
		color: #6b7280;
		font-weight: 400;
		margin-left: 0.5rem;
	}

	.artist-link {
		color: #374151;
		text-decoration: underline;
		background: transparent;
		border: none;
		cursor: pointer;
	}

	.artist-link:hover {
		color: #111827;
	}

	.collection-meta {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.artwork-count {
		font-size: 0.875rem;
		font-weight: 500;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.collection-description {
		color: #6b7280;
		font-size: 0.875rem;
		line-height: 1.625;
	}

	.artworks-container {
		position: relative;
	}

	/* Mobile Swiper */
	.mobile-swiper {
		overflow: hidden;
	}

	@media (min-width: 768px) {
		.mobile-swiper {
			display: none;
		}
	}

	.swiper-track {
		display: flex;
		gap: 1rem;
		overflow-x: auto;
		padding-bottom: 1rem;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.swiper-track::-webkit-scrollbar {
		display: none;
	}

	.artwork-slide {
		flex-shrink: 0;
		width: 16rem;
		scroll-snap-align: start;
	}

	/* Desktop Grid */
	.desktop-grid {
		display: none;
		gap: 1rem;
	}

	@media (min-width: 768px) {
		.desktop-grid {
			display: grid;
		}

		.desktop-grid.grid-cols-1 {
			grid-template-columns: 1fr;
		}

		.desktop-grid.grid-cols-2 {
			grid-template-columns: repeat(2, 1fr);
		}

		.desktop-grid.grid-cols-3 {
			grid-template-columns: repeat(3, 1fr);
		}

		.desktop-grid.grid-cols-2.lg\\:grid-cols-4 {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.desktop-grid.grid-cols-2.lg\\:grid-cols-4 {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.artwork-btn {
		width: 100%;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.artwork-image-container {
		aspect-ratio: 1;
		border-radius: 0.5rem;
		overflow: hidden;
		margin-bottom: 0.75rem;
		background-color: #f3f4f6;
		transition: transform 0.2s;
	}

	.artwork-btn:hover .artwork-image-container {
		transform: scale(1.05);
	}

	.artwork-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.image-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #9ca3af;
	}

	.image-placeholder svg {
		width: 3rem;
		height: 3rem;
	}

	.artwork-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.artwork-title {
		font-weight: 500;
		color: #111827;
		font-size: 0.875rem;
		line-height: 1.25;
	}

	.mint-date {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.artist-name {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.show-more-btn {
		position: absolute;
		bottom: -0.5rem;
		right: 0;
		background-color: #f3f4f6;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
		transition: background-color 0.2s;
		border: none;
		cursor: pointer;
	}

	.show-more-btn:hover {
		background-color: #e5e7eb;
	}

	.load-more-container {
		display: flex;
		justify-content: center;
		margin-top: 3rem;
	}

	.load-more-btn {
		background-color: #111827;
		color: white;
		padding: 0.75rem 2rem;
		border-radius: 0.5rem;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.load-more-btn:hover {
		background-color: #1f2937;
	}

	.loading-spinner {
		color: #6b7280;
	}

	.end-message {
		text-align: center;
		margin-top: 3rem;
	}

	.end-message p {
		color: #6b7280;
	}

	/* Dark mode styles */
	@media (prefers-color-scheme: dark) {
		.feed-header h2 {
			color: #f9fafb;
		}

		.feed-header p {
			color: #9ca3af;
		}

		.collection-card {
			background-color: #111827;
			border-color: #1f2937;
		}

		.collection-title {
			color: #f9fafb;
		}

		.by-artist {
			color: #9ca3af;
		}

		.artist-link {
			color: #d1d5db;
		}

		.artist-link:hover {
			color: #f9fafb;
		}

		.artwork-count {
			color: #9ca3af;
		}

		.collection-description {
			color: #9ca3af;
		}

		.artwork-image-container {
			background-color: #1f2937;
		}

		.artwork-title {
			color: #f9fafb;
		}

		.mint-date {
			color: #9ca3af;
		}

		.artist-name {
			color: #9ca3af;
		}

		.show-more-btn {
			background-color: #1f2937;
		}

		.show-more-btn:hover {
			background-color: #374151;
		}

		.load-more-btn {
			background-color: #f9fafb;
			color: #111827;
		}

		.load-more-btn:hover {
			background-color: #e5e7eb;
		}

		.loading-spinner {
			color: #9ca3af;
		}

		.end-message p {
			color: #9ca3af;
		}
	}
</style> 