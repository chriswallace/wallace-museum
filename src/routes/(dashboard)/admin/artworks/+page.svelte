<script lang="ts">
	import { onMount } from 'svelte';
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
		artists?: Artist[];
		collection?: { id: number | string; title: string };
		// Add other fields as needed
	}

	interface Collection {
		id: number;
		title: string;
	}

	let artworks: Artwork[] = [];
	let page: number = 1;
	let totalPages: number = 0;
	let sortColumn: string = 'title';
	let sortOrder: 'asc' | 'desc' = 'asc'; // 'asc' for ascending, 'desc' for descending
	let searchQuery: string = '';
	let isLoading: boolean = true;
	let error: string = '';
	let searchTimeout: NodeJS.Timeout;
	let lastFetchParams: string = '';
	
	// Bulk actions state
	let selectedArtworks = new Set<number | string>();
	let showBulkActions = false;
	let allArtists: Artist[] = [];
	let allCollections: Collection[] = [];
	let bulkEditArtistIds: number[] = [];
	let bulkEditCollectionId: number | null = null;

	// Reactive variables for bulk actions
	$: selectedCount = selectedArtworks.size;
	$: allSelected = artworks.length > 0 && selectedArtworks.size === artworks.length;
	$: someSelected = selectedArtworks.size > 0 && selectedArtworks.size < artworks.length;

	async function fetchArtworks(page: number = 1) {
		// Create a cache key from current parameters
		const cacheKey = `${page}-${sortColumn}-${sortOrder}-${searchQuery}`;
		
		// Skip if we're already loading the same data
		if (isLoading && lastFetchParams === cacheKey) {
			return;
		}
		
		lastFetchParams = cacheKey;
		isLoading = true;
		error = '';
		
		try {
			let url = `/api/admin/artworks/?page=${page}`;
			if (sortColumn && sortOrder) {
				// Fix parameter names to match API endpoint
				url += `&sortBy=${sortColumn}&sortOrder=${sortOrder}`;
			}
			if (searchQuery) {
				url += `&search=${encodeURIComponent(searchQuery)}`;
			}

			const response = await fetch(url);
			if (response.ok) {
				const data = await response.json();
				artworks = data.artworks || [];
				totalPages = data.totalPages || 0;
				page = data.page || 1;
				
				// Log query time for debugging
				if (data.queryTime && data.queryTime > 500) {
					console.warn(`Slow query took ${data.queryTime}ms`);
				}
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to fetch artworks';
				artworks = [];
			}
		} catch (e) {
			error = (e as Error).message || 'Network error occurred';
			artworks = [];
		} finally {
			isLoading = false;
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

	function toggleArtworkSelection(artworkId: number | string) {
		if (selectedArtworks.has(artworkId)) {
			selectedArtworks.delete(artworkId);
		} else {
			selectedArtworks.add(artworkId);
		}
		selectedArtworks = new Set(selectedArtworks); // Trigger reactivity
	}

	function toggleSelectAll() {
		if (allSelected) {
			selectedArtworks.clear();
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
				fetchArtworks(page);
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

		if (bulkEditArtistIds.length === 0 && bulkEditCollectionId === null) {
			toast.push('Please select at least one artist or collection to assign');
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

	onMount(() => {
		fetchArtworks(page);
		fetchArtistsAndCollections();
		
		// Cleanup function
		return () => {
			if (searchTimeout) {
				clearTimeout(searchTimeout);
			}
		};
	});

	function editArtwork(id: number | string) {
		goto(`/admin/artworks/edit/${id}`);
	}

	function handleSearchInput(event: Event) {
		const newSearchQuery = (event.target as HTMLInputElement).value;
		
		// Clear existing timeout
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
		
		// Update search query immediately for UI responsiveness
		searchQuery = newSearchQuery;
		
		// Debounce the actual search
		searchTimeout = setTimeout(() => {
			// Reset to page 1 when searching
			page = 1;
			fetchArtworks(1);
		}, 300); // 300ms delay
	}

	function changeSorting(column: string) {
		if (sortColumn === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortOrder = 'asc';
		}
		fetchArtworks(page);
	}

	function changePage(newPage: number) {
		page = newPage;
		fetchArtworks(page);

		// This will scroll the window to the top of the page
		window.scrollTo(0, 0);
	}

	function addNew() {
		goto(`/admin/artworks/new`);
	}
</script>

<svelte:head>
	<title>Artworks | Wallace Museum Admin</title>
</svelte:head>

<h1>Artworks <button class="ghost" on:click={() => addNew()}>+ Add new</button></h1>

{#if isLoading}
	<div class="loading">
		<div class="loading-spinner"></div>
		<p>Loading artworks...</p>
	</div>
{:else if error}
	<div class="error">
		<p>Error: {error}</p>
		<button class="secondary" on:click={() => fetchArtworks(page)}>Retry</button>
	</div>
{:else if artworks.length === 0}
	<div class="empty">
		<p>No artworks found.</p>
		{#if searchQuery}
			<p class="text-sm text-gray-600">Try adjusting your search terms.</p>
		{/if}
	</div>
{:else}
	<input
		type="text"
		placeholder="Search by Title, Artist, or Collection"
		class="search"
		on:input={handleSearchInput}
	/>

	<!-- Bulk Actions Bar -->
	{#if selectedCount > 0}
		<div class="bulk-actions-bar">
			<span class="selected-count">{selectedCount} artwork(s) selected</span>
			<div class="bulk-actions-buttons">
				<button class="secondary" on:click={openBulkActions}>
					Bulk Edit
				</button>
				<button class="delete" on:click={handleBulkDelete}>
					Delete Selected
				</button>
			</div>
		</div>
	{/if}

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
			{#each artworks as artwork}
				<tr>
					<td>
						<input
							type="checkbox"
							checked={selectedArtworks.has(artwork.id)}
							on:change={() => toggleArtworkSelection(artwork.id)}
						/>
					</td>
					<td>
						<button class="image" on:click={() => editArtwork(artwork.id)}>
							<OptimizedImage
								src={artwork.imageUrl}
								alt=""
								width={80}
								height={80}
								fit="cover"
								format="webp"
								quality={85}
								showSkeleton={true}
								skeletonBorderRadius="4px"
								className="aspect-square"
							/>
						</button>
					</td>
					<td><div>{artwork.title}</div></td>
					<td>
						<ArtistTableCell 
							artists={artwork.artists}
							size="xs"
							showAvatars={true}
							linkToArtist={false}
							maxDisplay={3}
						/>
					</td>
					<td
						><div>
							{#if artwork.collection}
								<a
									href="/admin/collections/{artwork.collection?.id}"
									on:click|preventDefault={() =>
										goto(`/admin/collections/${artwork.collection?.id}`)}
									>{artwork.collection?.title ?? 'Untitled'}</a
								>
							{:else}
								None
							{/if}
						</div></td
					>
					<td class="text-center"
						><button class="edit button" on:click={() => editArtwork(artwork.id)}>Edit</button></td
					>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

{#if totalPages > 1}
	<nav class="pagination">
		{#each Array(totalPages) as _, i}
			<button on:click={() => changePage(i + 1)} class:selected={page === i + 1}>
				{i + 1}
			</button>
		{/each}
	</nav>
{/if}

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
			</div>
			<div class="modal-actions">
				<button class="secondary" on:click={closeBulkActions}>Cancel</button>
				<button class="primary" on:click={handleBulkEdit}>Update Artworks</button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.select {
		@apply w-12;
	}

	.artwork {
		@apply w-32;
	}

	.title {
		@apply w-[400px];
	}

	.artist {
		@apply w-[400px];
	}

	.collection {
		@apply w-[400px];
	}

	.actions {
		@apply w-12;
	}

	.bulk-actions-bar {
		@apply flex items-center justify-between border rounded-md p-4 mb-4;
		background-color: rgba(184, 92, 40, 0.1);
		border-color: rgba(184, 92, 40, 0.3);
		
		.selected-count {
			color: rgb(138 69 30);
			@apply font-medium;
		}
		
		.bulk-actions-buttons {
			@apply flex gap-2;
		}
	}

	.modal-overlay {
		@apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50;
	}

	.modal {
		@apply bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4;
	}

	.modal-header {
		@apply flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700;
		
		h2 {
			@apply text-lg font-semibold text-gray-900 dark:text-white;
		}
		
		.close-button {
			@apply text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold bg-transparent border-none cursor-pointer;
		}
	}

	.modal-content {
		@apply p-6 space-y-4;
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
		@apply flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700;
	}

	.loading {
		@apply flex flex-col items-center justify-center py-12;
		
		.loading-spinner {
			@apply w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4;
		}
		
		p {
			@apply text-gray-600 dark:text-gray-400;
		}
	}

	.error {
		@apply flex flex-col items-center justify-center py-12 text-center;
		
		p {
			@apply text-red-600 dark:text-red-400 mb-4;
		}
	}

	.empty {
		@apply text-center py-12;
		
		p {
			@apply text-gray-600 dark:text-gray-400;
		}
	}
</style>
