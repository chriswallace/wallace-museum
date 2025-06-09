<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { goto } from '$app/navigation';
	import OptimizedImage from './OptimizedImage.svelte';
	import LoaderWrapper from './LoaderWrapper.svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { VideoPresets } from '$lib/utils/mediaHelpers';
	import type { FeedArtwork } from '../../routes/api/artworks/random/+server';

	let artworks: FeedArtwork[] = [];
	let loading = false;
	let hasMore = true;
	let feedContainer: HTMLElement;
	let intersectionTarget: HTMLElement;
	let currentObserver: IntersectionObserver | null = null;
	let videoLoadingStates: Record<string, boolean> = {};

	// Helper function to detect if content is a video based on MIME type
	function isVideoMime(mime: string | null): boolean {
		if (!mime) return false;
		return mime.startsWith('video/');
	}

	// Get media to display for artwork
	function getArtworkMedia(artwork: FeedArtwork) {
		// If we have an image, use it
		if (artwork.imageUrl) {
			return {
				type: 'image',
				url: artwork.imageUrl
			};
		}

		// If no image but we have animation URL and it's a video, use it
		if (artwork.animationUrl && isVideoMime(artwork.mime)) {
			return {
				type: 'video',
				url: artwork.animationUrl
			};
		}

		return null;
	}

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
				limit: '6',
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

	// Set up intersection observer for infinite scroll
	function setupIntersectionObserver() {
		if (currentObserver) {
			currentObserver.disconnect();
		}

		if (!intersectionTarget) return;

		currentObserver = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (entry.isIntersecting && hasMore && !loading) {
					loadArtworks();
				}
			},
			{ 
				threshold: 0.1,
				rootMargin: '100px'
			}
		);

		currentObserver.observe(intersectionTarget);
	}

	function handleArtworkClick(artwork: FeedArtwork) {
		// Navigate to the first artist's page with the artwork
		if (artwork.artists.length > 0) {
			goto(`/artist/${artwork.artists[0].id}/${artwork.id}`);
		}
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
			{@const media = getArtworkMedia(artwork)}
			
			{#if media}
				<div class="artwork-card">
					<button 
						class="artwork-container" 
						on:click={() => handleArtworkClick(artwork)}
						aria-label="View {artwork.title} by {artwork.artists.map(a => a.name).join(', ')}"
					>
						<div class="artwork-thumbnail">
							{#if media.type === 'image'}
								<OptimizedImage
									src={ipfsToHttpUrl(media.url)}
									alt={artwork.title}
									width={800}
									height={800}
									fit="contain"
									format="webp"
									quality={70}
									className="thumbnail-image"
									fallbackSrc="/images/medici-image.png"
								/>
							{:else if media.type === 'video'}
								{@const videoAttrs = VideoPresets.feed(ipfsToHttpUrl(media.url))}
								<div class="video-container">
									{#if videoLoadingStates[artwork.id]}
										<div class="video-loading">
											<LoaderWrapper width="100%" height="200px" />
										</div>
									{/if}
									<video
										src={videoAttrs.src}
										autoplay={videoAttrs.autoplay}
										loop={videoAttrs.loop}
										muted={videoAttrs.muted}
										playsinline={videoAttrs.playsinline}
										preload={videoAttrs.preload}
										class="thumbnail-video"
										class:loading={videoLoadingStates[artwork.id]}
										width={videoAttrs.width}
										height={videoAttrs.height}
										style={videoAttrs.style}
										on:loadstart={() => {
											videoLoadingStates[artwork.id] = true;
											videoLoadingStates = videoLoadingStates;
										}}
										on:loadeddata={() => {
											videoLoadingStates[artwork.id] = false;
											videoLoadingStates = videoLoadingStates;
										}}
										on:error={(e) => {
											console.warn('Video failed to load:', media.url);
											videoLoadingStates[artwork.id] = false;
											videoLoadingStates = videoLoadingStates;
										}}
									>
										<track kind="captions" />
										Your browser does not support the video tag.
									</video>
								</div>
							{:else}
								<div class="thumbnail-placeholder">
									<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
										<path d="M21 19V5c0-1.1-.9-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
									</svg>
								</div>
							{/if}
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
											{#if artist.avatarUrl}
												<div class="artist-avatar">
													<OptimizedImage
														src={ipfsToHttpUrl(artist.avatarUrl)}
														alt="{artist.name} avatar"
														width={32}
														height={32}
														fit="cover"
														format="webp"
														quality={85}
														className="avatar-image"
														fallbackSrc="/images/medici-image.png"
													/>
												</div>
											{:else}
												<div class="artist-avatar-placeholder">
													<svg viewBox="0 0 24 24" fill="currentColor" class="avatar-icon">
														<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
													</svg>
												</div>
											{/if}
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
			{/if}
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
		@apply w-full max-w-[560px] mx-auto px-4 py-8;
	}

	.feed-title {
		@apply text-xl font-bold mb-8 tracking-tight;
	}

	.artworks-stack {
		@apply space-y-12;
	}

	.artwork-card {
		@apply relative;
	}

	.artwork-container {
		@apply w-full bg-transparent border-none p-0 cursor-pointer;
		@apply transition-transform duration-200 focus:outline-none;
		@apply block text-left;
	}

	.artwork-thumbnail {
		@apply w-full aspect-square bg-gray-950/70 rounded-t-sm overflow-hidden;
		@apply flex items-center justify-center;
		margin: 0 auto;
	}

	:global(.thumbnail-image) {
		@apply w-full h-full object-contain;
	}

	.thumbnail-video {
		@apply w-full h-full object-contain;
		border-radius: inherit;
		transition: opacity 0.3s ease;
	}

	.thumbnail-video:hover {
		opacity: 0.9;
	}

	.thumbnail-video.loading {
		opacity: 0;
	}

	.video-container {
		@apply relative w-full h-full;
	}

	.video-loading {
		@apply absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg;
		z-index: 10;
	}

	.thumbnail-placeholder {
		@apply w-full h-full flex items-center justify-center text-gray-500;
	}

	.placeholder-icon {
		@apply w-16 h-16;
	}

	.artwork-info-container {
		@apply relative mx-auto;
	}

	.artwork-info {
		@apply bg-gray-950/50 rounded-b-sm px-6 py-4;
	}

	.artwork-title {
		@apply text-lg font-semibold text-white mb-3;
	}

	.artwork-mint-date {
		@apply text-gray-400 text-sm mt-3;
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

	.artist-avatar-placeholder {
		@apply w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0;
	}

	:global(.avatar-image) {
		@apply w-full h-full object-cover;
	}

	.avatar-icon {
		@apply w-4 h-4 text-gray-400;
	}

	.artist-name {
		@apply text-yellow-400 text-sm font-medium;
	}

	.artist-separator {
		@apply text-gray-500 text-sm;
	}

	.intersection-target {
		@apply mt-8;
		min-height: 100px;
	}

	.loading-indicator {
		@apply flex flex-col items-center justify-center py-8;
	}

	.loading-text {
		@apply text-gray-400 text-sm mt-4;
	}

	.load-more-placeholder {
		@apply h-20 w-full;
	}

	.end-message {
		@apply mt-8 text-center py-8;
	}

	.end-message p {
		@apply text-gray-500 text-sm;
	}

	@media (max-width: 640px) {
		.artwork-feed {
			@apply px-4 py-6;
		}

		.feed-title {
			@apply text-xl mb-6;
		}

		.artworks-stack {
			@apply space-y-8;
		}

		.artwork-title {
			@apply text-lg;
		}

		.artwork-info {
			@apply px-4 py-3;
		}

		.artwork-container {
			aspect-ratio: 1 / 1;
		}
	}
</style> 