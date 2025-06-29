<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { navigateWithDebounce } from '$lib/utils/navigationHelpers';
	import LazyArtwork from './LazyArtwork.svelte';
	import LoaderWrapper from './LoaderWrapper.svelte';
	import ArtistAvatar from './ArtistAvatar.svelte';
	import type { FeedArtwork } from '../../routes/api/artworks/random/+server';

	let artworks: FeedArtwork[] = [];
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

	async function loadArtworks(reset = false) {
		if (loading || (!hasMore && !reset)) return;

		loading = true;

		try {
			const excludeIds = reset ? [] : artworks.map(a => a.id);
			const params = new URLSearchParams({
				limit: '12',
				t: Date.now().toString(), // Add timestamp to prevent caching
				...(excludeIds.length > 0 && { exclude: excludeIds.join(',') })
			});

			const response = await fetch(`/api/artworks/random?${params}`, {
				cache: 'no-cache' // Explicitly disable caching
			});
			const data = await response.json();

			if (response.ok) {
				if (reset) {
					artworks = data.artworks;
				} else {
					artworks = [...artworks, ...data.artworks];
				}
				hasMore = data.hasMore;
			} else {
				console.error('Failed to load artworks:', data.error);
			}
		} catch (error) {
			console.error('Error loading artworks:', error);
		} finally {
			loading = false;
		}
	}

	function handleArtworkClick(artwork: FeedArtwork) {
		if (artwork.artists && artwork.artists.length > 0) {
			navigateWithDebounce(`/artist/${artwork.artists[0].id}/${artwork.id}`);
		}
	}

	function setupIntersectionObserver() {
		if (!intersectionTarget) return;

		const options = {
			root: null,
			rootMargin: '300px',
			threshold: 0.1
		};

		currentObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting && hasMore && !loading) {
					loadArtworks();
				}
			});
		}, options);

		currentObserver.observe(intersectionTarget);
	}

	onMount(() => {
		loadArtworks(true);
		
		return () => {
			if (currentObserver) {
				currentObserver.disconnect();
			}
		};
	});

	// Set up intersection observer after DOM updates
	afterUpdate(() => {
		if (intersectionTarget && !currentObserver) {
			setupIntersectionObserver();
		}
	});
</script>

<div class="artwork-feed" bind:this={feedContainer}>
	
	<div class="artworks-stack">
		{#each artworks as artwork (artwork.id)}
			<div class="artwork-card">
				<button 
					class="artwork-container" 
					on:click={() => handleArtworkClick(artwork)}
					aria-label="View {artwork.title} by {artwork.artists.map(a => a.name).join(', ')}"
				>
					<div class="artwork-thumbnail">
						<LazyArtwork
							artwork={{
								id: artwork.id,
								title: artwork.title,
								imageUrl: artwork.imageUrl,
								animationUrl: artwork.animationUrl,
								mime: artwork.mime,
								dimensions: artwork.dimensions
							}}
							aspectRatio="auto"
							quality={70}
							fit="contain"
							sizes="(max-width: 640px) 100vw, 560px"
							responsiveSizes={[300, 400, 560, 800]}
							priority={artworks.indexOf(artwork) < 2}
							className="feed-artwork"
						/>
					</div>
					
					<div class="artwork-info-container">
						<div class="artwork-info">
							{#if formatMintDate(artwork.mintDate)}
								<div class="artwork-mint-date">
									{formatMintDate(artwork.mintDate)}
								</div>
							{/if}
							<h3 class="artwork-title">{artwork.title}</h3>
							<div class="artwork-artists">
								{#each artwork.artists as artist, index}
									<div class="artist-info">
										<div class="artist-avatar">
											<ArtistAvatar 
												artist={artist} 
												size="md" 
												className="avatar-image"
											/>
										</div>
										<span class="artist-name">{artist.name}</span>
									</div>
									{#if index < artwork.artists.length - 1}
										<span class="artist-separator"> </span>
									{/if}
								{/each}
							</div>
						</div>
					</div>
				</button>
			</div>
		{/each}
	</div>

	<!-- Intersection target for infinite scroll -->
	{#if hasMore}
		<div bind:this={intersectionTarget} class="intersection-target">
			{#if loading}
				<div class="loading-indicator">
					<LoaderWrapper width="100%" height="60px" />
					<p class="loading-text">Loading more artworks...</p>
				</div>
			{:else}
				<div class="load-more-placeholder">
					<!-- This element triggers loading when it comes into view -->
				</div>
			{/if}
		</div>
	{:else if artworks.length > 0}
		<div class="end-message">
			<p>You've seen all available artworks</p>
		</div>
	{/if}
</div>

<style lang="scss">
	.artwork-feed {
		@apply w-full max-w-[560px] mx-auto pb-8 md:pt-8;
	}

	.artworks-stack {
		@apply space-y-12;
	}

	.artwork-card {
		@apply relative w-full;
	}

	.artwork-container {
		@apply bg-transparent border-none p-0 cursor-pointer w-full;
		@apply transition-transform duration-200 focus:outline-none;
		@apply block text-left;
	}

	.artwork-thumbnail {
		@apply overflow-hidden w-full;
		@apply flex items-center justify-center mx-auto my-0;
	}

	:global(.feed-artwork) {
		@apply w-full h-full;
	}

	.artwork-info-container {
		@apply relative mx-auto px-4;
	}

	.artwork-info {
		@apply py-4;
	}

	.artwork-title {
		@apply text-lg font-semibold mb-3;
		word-break: break-word;
		white-space: normal;
		overflow-wrap: break-word;
		hyphens: auto;
	}

	.artwork-mint-date {
		@apply text-gray-400 text-sm;
	}

	.artwork-artists {
		@apply flex flex-wrap items-center gap-3;
	}

	.artist-info {
		@apply flex items-center gap-2;
	}

	.artist-avatar {
		@apply w-8 h-8 rounded-full overflow-hidden bg-gray-700 flex-shrink-0;
	}

	:global(.avatar-image) {
		@apply w-full h-full object-cover;
	}

	.artist-name {
		@apply text-sm font-medium text-gray-700 dark:text-gray-300;
	}

	.artist-separator {
		@apply text-gray-200 dark:text-gray-500;
	}

	.intersection-target {
		@apply mt-8 px-4;
	}

	.loading-indicator {
		@apply flex flex-col items-center gap-4 py-8;
	}

	.loading-text {
		@apply text-gray-400 text-sm;
	}

	.load-more-placeholder {
		@apply h-4;
	}

	.end-message {
		@apply text-center py-8;
	}

	.end-message p {
		@apply text-gray-400 text-sm;
	}
</style> 