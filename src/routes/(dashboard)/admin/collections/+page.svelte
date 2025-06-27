<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCloudinaryTransformedUrl } from '$lib/pinataUtils.client';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtistList from '$lib/components/ArtistList.svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';

	interface Artist {
		id: number;
		name: string;
		avatarUrl?: string;
	}

	interface Collection {
		id: number;
		title: string;
		coverImages: string[];
		artists?: Artist[];
	}

	let collections: Collection[] = [];
	let page = 1;
	let hasMore = true;
	let loading = false;
	let searchQuery = '';
	let searchTimeout: NodeJS.Timeout;
	let intersectionObserver: IntersectionObserver;
	let loadMoreElement: HTMLElement;

	// Video detection function consistent with media helpers
	function isVideoUrl(url: string): boolean {
		if (!url) return false;
		
		// Check for video file extensions (case insensitive)
		const videoExtensions = /\.(mp4|webm|mov|avi|ogv|m4v|3gp|flv|wmv|mkv|gif)$/i;
		return videoExtensions.test(url);
	}

	async function fetchCollections(pageNum = 1, append = false) {
		if (loading) return;
		
		loading = true;
		let url = `/api/admin/collections/?page=${pageNum}`;
		if (searchQuery) {
			url += `&search=${encodeURIComponent(searchQuery)}`;
		}

		try {
			const response = await fetch(url);
			if (response.ok) {
				const data = await response.json();
				
				if (append) {
					collections = [...collections, ...data.collections];
				} else {
					collections = data.collections;
				}
				
				hasMore = data.page < data.totalPages;
				page = data.page;
			}
		} catch (error) {
			console.error('Error fetching collections:', error);
		} finally {
			loading = false;
		}
	}

	function loadMore() {
		if (hasMore && !loading) {
			fetchCollections(page + 1, true);
		}
	}

	function setupIntersectionObserver() {
		if (intersectionObserver) {
			intersectionObserver.disconnect();
		}

		intersectionObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && hasMore && !loading) {
						loadMore();
					}
				});
			},
			{
				rootMargin: '100px'
			}
		);

		if (loadMoreElement) {
			intersectionObserver.observe(loadMoreElement);
		}
	}

	onMount(() => {
		fetchCollections(1);
	});

	onDestroy(() => {
		if (intersectionObserver) {
			intersectionObserver.disconnect();
		}
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
	});

	$: if (loadMoreElement) {
		setupIntersectionObserver();
	}

	function editCollection(id: number) {
		goto(`/admin/collections/${id}`);
	}

	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;
		
		// Clear existing timeout
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
		
		// Debounce search
		searchTimeout = setTimeout(() => {
			page = 1;
			hasMore = true;
			fetchCollections(1, false);
		}, 300);
	}

	function addNew() {
		goto(`/admin/collections/new`);
	}
</script>

<svelte:head>
	<title>Collections | Wallace Museum Admin</title>
</svelte:head>

<div class="admin-header">
	<h1>Collections</h1>
	<div class="header-actions">
		<button class="ghost" on:click={addNew}>+ Add new</button>
	</div>
</div>

<div class="admin-search">
	<input
		type="text"
		placeholder="Search by Collection Title"
		class="search"
		on:input={handleSearchInput}
	/>
</div>

{#if collections.length === 0}
	<div class="empty">
		<p>No collections found.</p>
	</div>
{:else}
	<div class="collection-grid">
		{#each collections as collection}
			<button class="collection-card" on:click={() => editCollection(collection.id)}>
				{#if collection.coverImages.length > 0}
					<div 
						class="media"
						style="background-image: url('{ipfsToHttpUrl(collection.coverImages[0])}');"
					></div>
				{:else}
					<div class="media placeholder">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
							<circle cx="9" cy="9" r="2"/>
							<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
						</svg>
					</div>
				{/if}
				
				<!-- Overlay content -->
				<div class="card-overlay">
					<div class="card-content">
						<h3 class="card-title">{collection.title}</h3>
						{#if collection.artists && collection.artists.length > 0}
							<div class="card-artists">
								{#each collection.artists.slice(0, 2) as artist}
									<span class="artist-badge">{artist.name}</span>
								{/each}
								{#if collection.artists.length > 2}
									<span class="artist-count">+{collection.artists.length - 2} more</span>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</button>
		{/each}
	</div>
	
	<!-- Loading indicator and intersection observer target -->
	{#if hasMore}
		<div bind:this={loadMoreElement} class="load-more-trigger">
			{#if loading}
				<div class="loading-indicator">
					<div class="loading-spinner"></div>
					<p>Loading more collections...</p>
				</div>
			{/if}
		</div>
	{:else if collections.length > 0}
		<div class="end-message">
			<p>You've reached the end of the collections.</p>
		</div>
	{/if}
{/if}

<style lang="postcss">
	.collection-grid {
		@apply grid gap-4 grid-cols-[repeat(auto-fill,minmax(240px,1fr))] mt-8;
	}
	
	.collection-card {
		@apply bg-white dark:bg-gray-800 rounded-lg overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] text-left p-0 cursor-pointer shadow-sm relative aspect-[3/4];
	}
	
	.collection-card:hover {
		@apply -translate-y-0.5 shadow-xl;
	}
	
	.media {
		@apply absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out rounded-lg;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		transform: scale(1.1);
	}
	
	.collection-card:hover .media {
		@apply scale-[1.02];
	}
	
	.placeholder {
		@apply absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg;
	}
	
	.card-overlay {
		@apply absolute bottom-0 left-0 right-0 top-0 flex items-end p-6 z-10 pointer-events-none;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 40%, transparent 70%), rgba(0, 0, 0, 0.2);
	}
	
	.card-content {
		@apply relative z-10 w-full;
	}
	
	.card-title {
		@apply text-lg font-semibold text-white mb-3 leading-snug tracking-tight;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
		word-wrap: break-word;
		hyphens: auto;
	}
	
	.card-artists {
		@apply flex flex-wrap gap-2 items-center;
	}
	
	.artist-badge {
		@apply text-white px-3 py-1 rounded-full text-xs font-medium tracking-wide border;
		background: rgba(255, 255, 255, 0.25);
		backdrop-filter: blur(8px);
		border-color: rgba(255, 255, 255, 0.2);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
	}
	
	.artist-count {
		@apply text-xs font-medium;
		color: rgba(255, 255, 255, 0.9);
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
	}
	
	.load-more-trigger {
		@apply mt-12 mb-8;
	}
	
	.loading-indicator {
		@apply flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400;
	}
	
	.loading-indicator p {
		@apply mt-4 text-sm font-medium;
	}
	
	.loading-spinner {
		@apply w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin;
	}
	
	.end-message {
		@apply flex justify-center py-8 mt-12 text-gray-500 dark:text-gray-400;
	}
	
	.end-message p {
		@apply text-sm font-medium;
	}
</style>




