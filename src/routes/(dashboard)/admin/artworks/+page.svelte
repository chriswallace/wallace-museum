<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from '@zerodevx/svelte-toast';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import type { Artist } from '$lib/stores';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtistTableCell from '$lib/components/ArtistTableCell.svelte';

	interface Artwork {
		id: number | string;
		title: string;
		imageUrl?: string;
		image_url?: string;
		animationUrl?: string;
		animation_url?: string;
		mime?: string;
		artists?: Artist[];
		collection?: { id: number | string; title: string };
		// Add other fields as needed
		displayImageUrl?: string;
	}

	interface Collection {
		id: number;
		title: string;
	}

	let artworks: Artwork[] = [];
	let page: number = 1;
	let totalPages: number = 0;
	let totalCount: number = 0;
	let sortColumn: string = 'id';  // Changed default from 'title' to 'id' to match API
	let sortOrder: 'asc' | 'desc' = 'desc'; // 'asc' for ascending, 'desc' for descending
	let searchQuery: string = '';
	let loading: boolean = false;  // Renamed from isLoading to match collections
	let hasMore: boolean = true; // Renamed from hasMoreData to match collections
	let error: string = '';  // Added error state
	let searchTimeout: NodeJS.Timeout;
	let intersectionObserver: IntersectionObserver;
	let loadMoreElement: HTMLElement;
	
	// Bulk actions state
	let selectedArtworks = new Set<number | string>();
	let showBulkActions = false;
	let allArtists: Artist[] = [];
	let allCollections: Collection[] = [];
	let bulkEditArtistIds: number[] = [];
	let bulkEditCollectionId: number | null = null;
	let bulkEditMimeType: string = '';
	let lastSelectedIndex: number | null = null; // Track last selected index for shift+click

	// Common MIME types for artworks
	const commonMimeTypes = [
		{ value: '', label: '-- No Change --' },
		{ value: 'image/jpeg', label: 'JPEG Image (image/jpeg)' },
		{ value: 'image/png', label: 'PNG Image (image/png)' },
		{ value: 'image/gif', label: 'GIF Image (image/gif)' },
		{ value: 'image/webp', label: 'WebP Image (image/webp)' },
		{ value: 'image/svg+xml', label: 'SVG Image (image/svg+xml)' },
		{ value: 'video/mp4', label: 'MP4 Video (video/mp4)' },
		{ value: 'video/webm', label: 'WebM Video (video/webm)' },
		{ value: 'video/quicktime', label: 'QuickTime Video (video/quicktime)' },
		{ value: 'video/ogg', label: 'OGG Video (video/ogg)' },
		{ value: 'text/html', label: 'HTML Document (text/html)' },
		{ value: 'application/javascript', label: 'JavaScript (application/javascript)' },
		{ value: 'model/gltf+json', label: 'glTF Model (model/gltf+json)' },
		{ value: 'model/gltf-binary', label: 'glTF Binary (model/gltf-binary)' },
		{ value: 'application/pdf', label: 'PDF Document (application/pdf)' },
		{ value: 'audio/mpeg', label: 'MP3 Audio (audio/mpeg)' },
		{ value: 'audio/wav', label: 'WAV Audio (audio/wav)' },
		{ value: 'audio/ogg', label: 'OGG Audio (audio/ogg)' }
	];

	// Bulk refetch state
	let isRefetching = false;
	let refetchProgress = { current: 0, total: 0 };
	let refetchResults = { success: 0, failed: 0, errors: [] as string[] };

	// Reactive variables for bulk actions
	$: selectedCount = selectedArtworks.size;
	$: allSelected = artworks.length > 0 && selectedArtworks.size === artworks.length;
	$: someSelected = selectedArtworks.size > 0 && selectedArtworks.size < artworks.length;

	async function fetchArtworks(pageNum: number = 1, append: boolean = false) {
		if (loading) return;
		
		loading = true;
		if (!append) {
			artworks = []; // Clear existing artworks for new search/sort
		}
		error = '';
		
		try {
			// Fixed parameter names to match API expectations
			let url = `/api/admin/artworks/?page=${pageNum}&limit=50`;
			if (sortColumn && sortOrder) {
				url += `&sortBy=${sortColumn}&sortOrder=${sortOrder}`;
			}
			if (searchQuery) {
				url += `&search=${encodeURIComponent(searchQuery)}`;
			}

			const response = await fetch(url);
			if (response.ok) {
				const data = await response.json();
				// Normalize image URLs to handle both imageUrl and image_url, and prioritize thumbnail
				const normalizedArtworks = data.artworks.map((artwork: any) => ({
					...artwork,
					displayImageUrl:
						artwork.thumbnailUrl ||
						artwork.thumbnail_url ||
						artwork.imageUrl ||
						artwork.image_url ||
						'',
				}));

				if (append) {
					// Append new artworks to existing ones
					artworks = [...artworks, ...normalizedArtworks];
				} else {
					// Replace artworks with new data
					artworks = normalizedArtworks;
				}

				totalPages = data.totalPages;
				totalCount = data.totalCount;
				page = data.page;
				hasMore = page < totalPages;
			} else {
				error = 'Failed to fetch artworks';
				if (!append) {
					artworks = [];
				}
			}
		} catch (e) {
			error = (e as Error).message || 'An error occurred while fetching artworks';
			if (!append) {
				artworks = [];
			}
		} finally {
			loading = false;
		}
	}

	async function fetchArtistsAndCollections() {
		try {
			const [artistsRes, collectionsRes] = await Promise.all([
				fetch('/api/admin/artists'),
				fetch('/api/admin/collections/all')
			]);

			if (artistsRes.ok) {
				allArtists = await artistsRes.json();
			}

			if (collectionsRes.ok) {
				const collectionsData = await collectionsRes.json();
				allCollections = collectionsData.collections;
			}
		} catch (error) {
			console.error('Error fetching artists and collections:', error);
		}
	}

	function toggleArtworkSelection(artworkId: number | string, event?: MouseEvent, currentIndex?: number) {
		// Handle shift+click for range selection
		if (event?.shiftKey && lastSelectedIndex !== null && currentIndex !== undefined) {
			const startIndex = Math.min(lastSelectedIndex, currentIndex);
			const endIndex = Math.max(lastSelectedIndex, currentIndex);
			
			// Select all artworks in the range
			for (let i = startIndex; i <= endIndex; i++) {
				if (i < artworks.length) {
					selectedArtworks.add(artworks[i].id);
				}
			}
			selectedArtworks = new Set(selectedArtworks); // Trigger reactivity
		} else {
			// Normal toggle behavior
			if (selectedArtworks.has(artworkId)) {
				selectedArtworks.delete(artworkId);
			} else {
				selectedArtworks.add(artworkId);
			}
			selectedArtworks = new Set(selectedArtworks); // Trigger reactivity
			
			// Update last selected index for future shift+click operations
			if (currentIndex !== undefined) {
				lastSelectedIndex = currentIndex;
			}
		}
	}

	function toggleSelectAll() {
		if (allSelected) {
			selectedArtworks.clear();
			lastSelectedIndex = null; // Clear last selected index when deselecting all
		} else {
			selectedArtworks = new Set(artworks.map(artwork => artwork.id));
		}
		selectedArtworks = new Set(selectedArtworks); // Trigger reactivity
	}

	function openBulkActions() {
		if (selectedCount === 0) {
			toast.push('Please select at least one artwork');
			return;
		}
		showBulkActions = true;
	}

	function closeBulkActions() {
		showBulkActions = false;
		bulkEditArtistIds = [];
		bulkEditCollectionId = null;
		bulkEditMimeType = '';
	}

	async function handleBulkDelete() {
		if (selectedCount === 0) {
			toast.push('Please select at least one artwork');
			return;
		}

		if (!confirm(`Are you sure you want to delete ${selectedCount} artwork(s)? This action cannot be undone.`)) {
			return;
		}

		try {
			const response = await fetch('/api/admin/artworks/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete',
					artworkIds: Array.from(selectedArtworks)
				})
			});

			if (response.ok) {
				const result = await response.json();
				toast.push(result.message || 'Artworks deleted successfully');
				selectedArtworks.clear();
				selectedArtworks = new Set(selectedArtworks); // Trigger reactivity
				// If we're on a page that now has no artworks, go to previous page
				if (artworks.length <= selectedCount && page > 1) {
					changePage(page - 1);
				} else {
				fetchArtworks(page);
				}
			} else {
				const error = await response.json();
				toast.push(`Failed to delete artworks: ${error.error}`);
			}
		} catch (error) {
			console.error('Error deleting artworks:', error);
			toast.push('Error deleting artworks');
		}
	}

	async function handleBulkEdit() {
		if (selectedCount === 0) {
			toast.push('Please select at least one artwork');
			return;
		}

		if (bulkEditArtistIds.length === 0 && bulkEditCollectionId === null && !bulkEditMimeType) {
			toast.push('Please select at least one field to update (artists, collection, or MIME type)');
			return;
		}

		try {
			const editData: any = {};
			
			if (bulkEditArtistIds.length > 0) {
				editData.artistIds = bulkEditArtistIds;
			}
			
			if (bulkEditCollectionId !== null) {
				editData.collectionId = bulkEditCollectionId;
			}

			if (bulkEditMimeType) {
				editData.mimeType = bulkEditMimeType;
			}

			const response = await fetch('/api/admin/artworks/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'edit',
					artworkIds: Array.from(selectedArtworks),
					data: editData
				})
			});

			if (response.ok) {
				const result = await response.json();
				toast.push(result.message || 'Artworks updated successfully');
				selectedArtworks.clear();
				selectedArtworks = new Set(selectedArtworks); // Trigger reactivity
				closeBulkActions();
				fetchArtworks(page);
			} else {
				const error = await response.json();
				toast.push(`Failed to update artworks: ${error.error}`);
			}
		} catch (error) {
			console.error('Error updating artworks:', error);
			toast.push('Error updating artworks');
		}
	}

	async function handleBulkRefetch() {
		if (selectedCount === 0) {
			toast.push('Please select at least one artwork');
			return;
		}

		if (!confirm(`Are you sure you want to refetch data for ${selectedCount} artwork(s)? This will update metadata from external APIs.`)) {
			return;
		}

		isRefetching = true;
		const artworkIds = Array.from(selectedArtworks);
		refetchProgress = { current: 0, total: artworkIds.length };
		refetchResults = { success: 0, failed: 0, errors: [] };

		// Stagger requests to avoid rate limits
		const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay between requests
		const BATCH_SIZE = 3; // Process 3 artworks at a time

		try {
			for (let i = 0; i < artworkIds.length; i += BATCH_SIZE) {
				const batch = artworkIds.slice(i, i + BATCH_SIZE);
				
				// Process batch in parallel
				const batchPromises = batch.map(async (artworkId) => {
					try {
						const response = await fetch(`/api/admin/artworks/${artworkId}/refetch`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' }
						});

						if (response.ok) {
							const result = await response.json();
							refetchResults.success++;
							return { success: true, artworkId, result };
						} else {
							const errorData = await response.json();
							const errorMsg = `Artwork ${artworkId}: ${errorData.error || 'Unknown error'}`;
							refetchResults.errors.push(errorMsg);
							refetchResults.failed++;
							return { success: false, artworkId, error: errorMsg };
						}
					} catch (error) {
						const errorMsg = `Artwork ${artworkId}: Network error`;
						refetchResults.errors.push(errorMsg);
						refetchResults.failed++;
						return { success: false, artworkId, error: errorMsg };
					} finally {
						refetchProgress.current++;
						refetchProgress = { ...refetchProgress }; // Trigger reactivity
					}
				});

				// Wait for batch to complete
				await Promise.all(batchPromises);

				// Add delay between batches (except for the last batch)
				if (i + BATCH_SIZE < artworkIds.length) {
					await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
				}
			}

			// Show results
			const successMsg = `Refetch completed: ${refetchResults.success} successful, ${refetchResults.failed} failed`;
			if (refetchResults.failed === 0) {
				toast.push(successMsg);
			} else {
				toast.push(successMsg);
				// Log errors to console for debugging
				console.warn('Refetch errors:', refetchResults.errors);
			}

			// Refresh the artworks list to show updated data
			await fetchArtworks(page);
			
			// Clear selection
			selectedArtworks.clear();
			selectedArtworks = new Set(selectedArtworks);

		} catch (error) {
			console.error('Bulk refetch error:', error);
			toast.push('Bulk refetch failed: Network error');
		} finally {
			isRefetching = false;
			refetchProgress = { current: 0, total: 0 };
			refetchResults = { success: 0, failed: 0, errors: [] };
		}
	}

	onMount(() => {
		fetchArtworks(1);
		fetchArtistsAndCollections();
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

	function editArtwork(id: number | string) {
		goto(`/admin/artworks/edit/${id}`);
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
			selectedArtworks.clear(); // Clear selections when searching
			selectedArtworks = new Set(selectedArtworks); // Trigger reactivity
			fetchArtworks(1, false);
		}, 300);
	}

	function changeSorting(column: string) {
		if (sortColumn === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortOrder = 'asc';
		}
		page = 1; // Reset to first page when sorting
		hasMore = true;
		selectedArtworks.clear(); // Clear selections when sorting
		selectedArtworks = new Set(selectedArtworks); // Trigger reactivity
		fetchArtworks(1, false);
	}

	function changePage(newPage: number) {
		page = newPage;
		fetchArtworks(newPage);

		// This will scroll the window to the top of the page
		window.scrollTo(0, 0);
	}

	function loadMore() {
		if (hasMore && !loading) {
			fetchArtworks(page + 1, true);
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

	function addNew() {
		goto(`/admin/artworks/new`);
	}
</script>

<svelte:head>
	<title>Artworks | Wallace Museum Admin</title>
</svelte:head>

<div class="admin-header !mb-2">
	<h1>
		Artworks
		{#if totalCount > 0}
			<span class="count-badge">
				{#if artworks.length < totalCount}
					{artworks.length} of {totalCount}
				{:else}
					{totalCount}
				{/if}
			</span>
		{/if}
	</h1>
	<div class="header-actions">
		<button class="ghost" on:click={() => addNew()}>+ Add new</button>
	</div>
</div>

<div class="sticky-controls">
	<div class="admin-search">
		<input
			type="text"
			placeholder="Search by Title, Artist, or Collection"
			class="search"
			bind:value={searchQuery}
			on:input={handleSearchInput}
		/>
	</div>

	<!-- Bulk Actions Bar -->
	{#if selectedCount > 0}
		<div class="bulk-actions-bar">
			<span class="selected-count">
				{selectedCount} artwork(s) selected
				{#if isRefetching}
					<span class="refetch-progress">
						- Refetching {refetchProgress.current}/{refetchProgress.total}...
					</span>
				{/if}
			</span>
			<div class="bulk-actions-buttons">
				<button 
					class="secondary" 
					on:click={handleBulkRefetch}
					disabled={isRefetching}
				>
					{#if isRefetching}
						<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Refetching...
					{:else}
						<svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
						</svg>
						Refetch Data
					{/if}
				</button>
				<button class="secondary" on:click={openBulkActions}>
					Bulk Edit
				</button>
				<button class="destructive" on:click={handleBulkDelete}>
					Delete Selected
				</button>
			</div>
		</div>
	{/if}
</div>

{#if loading && artworks.length === 0}
	<div class="loading">
		<p>Loading artworks...</p>
	</div>
{:else if error}
	<div class="error">
		<p>Error: {error}</p>
		<button class="primary" on:click={() => fetchArtworks(page)}>Retry</button>
	</div>
{:else if artworks.length === 0}
	<div class="empty">
		<p>No artworks found.</p>
		{#if searchQuery}
			<p>Try adjusting your search or <button class="link" on:click={() => { searchQuery = ''; fetchArtworks(1); }}>clear the search</button>.</p>
		{/if}
	</div>
{:else}
	<div class="table-container">
		<table>
			<thead>
				<tr>
					<th class="select">
						<input
							type="checkbox"
							checked={allSelected}
							indeterminate={someSelected}
							on:change={toggleSelectAll}
						/>
					</th>
					<th class="artwork"></th>
					<th class="title sortable" on:click={() => changeSorting('title')}>
						Title
						{sortColumn === 'title' && sortOrder === 'asc' ? ' ↑' : ''}
						{sortColumn === 'title' && sortOrder === 'desc' ? ' ↓' : ''}
					</th>
					<th class="artist sortable" on:click={() => changeSorting('artist')}>
						Artist
						{sortColumn === 'artist' && sortOrder === 'asc' ? ' ↑' : ''}
						{sortColumn === 'artist' && sortOrder === 'desc' ? ' ↓' : ''}
					</th>
					<th class="collection sortable" on:click={() => changeSorting('collection')}>
						Collection(s)
						{sortColumn === 'collection' && sortOrder === 'asc' ? ' ↑' : ''}
						{sortColumn === 'collection' && sortOrder === 'desc' ? ' ↓' : ''}
					</th>
					<th class="actions">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each artworks as artwork, index}
					<tr>
						<td>
							<input
								type="checkbox"
								checked={selectedArtworks.has(artwork.id)}
								on:click={(event) => toggleArtworkSelection(artwork.id, event, index)}
							/>
						</td>
						<td>
							<button class="image" on:click={() => editArtwork(artwork.id)}>
								<OptimizedImage
									src={artwork.displayImageUrl}
									alt={artwork.title}
									width={80}
									height={80}
									fit="cover"
									format="auto"
									quality={80}
									aspectRatio="1/1"
									showSkeleton={true}
									skeletonBorderRadius="4px"
									className="w-full h-full object-cover"
									mimeType={artwork.mime}
								/>
							</button>
						</td>
						<td>
							<a 
								class="title-link" 
								href="/admin/artworks/edit/{artwork.id}"
								on:click|preventDefault={() => editArtwork(artwork.id)}
								title="Click to edit: {artwork.title}"
							>
								{artwork.title}
							</a>
						</td>
						<td class="table-cell-wrap">
							<ArtistTableCell 
								artists={artwork.artists}
								size="xs"
								showAvatars={true}
								linkToArtist={false}
								maxDisplay={3}
							/>
						</td>
											<td class="collection">
						{#if artwork.collection}
							<a
								href="/admin/collections/{artwork.collection?.id}"
								on:click|preventDefault={() =>
									goto(`/admin/collections/${artwork.collection?.id}`)}
								title={artwork.collection?.title ?? 'Untitled'}
								>{artwork.collection?.title ?? 'Untitled'}</a
							>
						{:else}
							<span class="text-gray-500 dark:text-gray-400">None</span>
						{/if}
					</td>
						<td class="text-center">
							<button 
								class="icon-edit-button" 
								on:click={() => editArtwork(artwork.id)}
								title="Edit artwork"
								aria-label="Edit artwork"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
								</svg>
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Loading indicator and intersection observer target -->
	{#if hasMore}
		<div bind:this={loadMoreElement} class="load-more-trigger">
			{#if loading}
				<div class="loading-indicator">
					<div class="loading-spinner"></div>
					<p>Loading more artworks...</p>
				</div>
			{/if}
		</div>
	{:else if artworks.length > 0}
		<div class="end-message">
			<p>You've reached the end! Showing all {totalCount} artworks.</p>
		</div>
	{/if}
{/if}

<!-- Traditional pagination removed in favor of infinite scroll -->

<!-- Bulk Edit Modal -->
{#if showBulkActions}
	<div class="modal-overlay" on:click={closeBulkActions}>
		<div class="modal" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Bulk Edit {selectedCount} Artwork(s)</h2>
				<button class="close-button" on:click={closeBulkActions}>&times;</button>
			</div>
			<div class="modal-content">
				<div class="form-group">
					<label for="bulk-artists">Assign Artists</label>
					<select id="bulk-artists" multiple bind:value={bulkEditArtistIds} class="multi-select">
						{#each allArtists as artist}
							<option value={artist.id}>{artist.name}</option>
						{/each}
					</select>
					<small class="help-text">Hold Command/Ctrl to select multiple artists. This will replace existing artist assignments.</small>
				</div>
				
				<div class="form-group">
					<label for="bulk-collection">Assign Collection</label>
					<select id="bulk-collection" bind:value={bulkEditCollectionId}>
						<option value={null}>-- No Collection --</option>
						{#each allCollections as collection}
							<option value={collection.id}>{collection.title}</option>
						{/each}
					</select>
					<small class="help-text">This will replace existing collection assignments.</small>
				</div>

				<div class="form-group">
					<label for="bulk-mime-type">MIME Type</label>
					<select id="bulk-mime-type" bind:value={bulkEditMimeType}>
						{#each commonMimeTypes as mimeType}
							<option value={mimeType.value}>{mimeType.label}</option>
						{/each}
					</select>
					<small class="help-text">This will update the MIME type for all selected artworks.</small>
				</div>
			</div>
			<div class="modal-actions">
				<button class="secondary" on:click={closeBulkActions}>Cancel</button>
				<button class="save" on:click={handleBulkEdit}>Update Artworks</button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.count-badge {
		@apply inline-block ml-3 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full font-normal;
	}

	.sticky-controls {
		@apply sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 pt-4 pb-4 mb-4;
		
		.search {
			@apply mb-0;
		}
	}

	/* Table container to ensure proper width containment */
	.table-container {
		@apply w-full overflow-x-auto;
		max-width: 100%;
	}

	/* Table styling with proper column sizing */
	table {
		@apply w-full table-fixed border-collapse;
		min-width: 800px; /* Minimum width for proper column display */
	}

	/* Column width specifications */
	.select {
		@apply w-12; /* Fixed width for checkbox column */
	}

	.artwork {
		@apply w-20; /* Fixed width for image column */
	}

	.title {
		@apply w-auto; /* Flexible width for title */
		min-width: 200px;
	}

	.artist {
		@apply w-48; /* Fixed width for artist column */
	}

	.collection {
		@apply w-48; /* Fixed width for collection column */
		
		a {
			@apply inline-block w-full text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 underline decoration-1 underline-offset-2 no-underline hover:underline;
			text-decoration: underline !important;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.actions {
		@apply w-16; /* Fixed width for actions column */
	}

	/* Table cell content control */
	th, td {
		@apply px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700;
		overflow: hidden;
	}

	/* Ensure table content doesn't overflow */
	.table-cell-wrap {
		@apply w-full overflow-hidden;
	}

	/* Responsive table handling */
	@media (max-width: 768px) {
		table {
			min-width: 600px; /* Smaller minimum width on mobile */
		}
		
		.title {
			min-width: 150px;
		}
		
		.artist,
		.collection {
			@apply w-32;
		}
	}

	/* Infinite scroll components - matching collections style */
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

	.bulk-actions-bar {
		@apply flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 gap-3 sm:gap-0;
		
		.selected-count {
			color: rgb(149, 149, 149);
			@apply font-medium text-sm md:text-base;
			
			.refetch-progress {
				@apply text-xs md:text-sm font-normal text-gray-600 dark:text-gray-400;
			}
		}
		
		.bulk-actions-buttons {
			@apply flex flex-wrap gap-2;
			
			button {
				@apply text-xs md:text-sm px-2 md:px-3 py-1 md:py-2;
			}
		}
	}

	.modal-overlay {
		@apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4;
	}

	.modal {
		@apply bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto;
	}

	.modal-header {
		@apply flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700;
		
		h2 {
			@apply text-lg font-semibold text-gray-900 dark:text-white;
		}
		
		.close-button {
			@apply text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold bg-transparent border-none cursor-pointer min-h-[44px] min-w-[44px] dark:text-gray-500 dark:hover:text-yellow-400;
		}
	}

	.modal-content {
		@apply p-4 md:p-6 space-y-4;
	}

	.form-group {
		@apply space-y-2;
		
		label {
			@apply block text-sm font-medium text-gray-700 dark:text-gray-300;
		}
		
		.multi-select {
			@apply min-h-[120px];
		}
		
		.help-text {
			@apply text-xs text-gray-500 dark:text-gray-400;
		}
	}

	.modal-actions {
		@apply flex flex-col sm:flex-row sm:justify-end gap-3 p-4 md:p-6 border-t border-gray-200 dark:border-gray-700;
		
		button {
			@apply w-full sm:w-auto;
		}
	}

	.loading {
		@apply py-12;
		
		p {
			@apply text-gray-600 dark:text-gray-400 text-lg text-center;
		}
	}

	.error {
		@apply flex flex-col items-center justify-center py-12 space-y-4;
		
		p {
			@apply text-red-600 dark:text-red-400 text-lg text-center;
		}
		
		button {
			@apply mt-4;
		}
	}

	.empty {
		@apply text-center py-12;
		
		p {
			@apply text-gray-600 dark:text-gray-400 mb-4;
		}
		
		.link {
			@apply text-primary hover:text-primary/80 underline cursor-pointer;
		}
	}

	.help-text {
		@apply text-xs text-gray-500 dark:text-gray-400;
	}

	.help-row {
		@apply border-b border-gray-200 dark:border-gray-700;
		
		td {
			@apply py-2 px-3 text-center;
			background-color: rgba(0, 0, 0, 0.02);
		}
	}

	@media (prefers-color-scheme: dark) {
		.help-row td {
			background-color: rgba(255, 255, 255, 0.02);
		}
	}
</style>