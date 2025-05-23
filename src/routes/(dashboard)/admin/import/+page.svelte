<script lang="ts">
	import { nfts, isLoading, walletAddress, isModalOpen, type Artwork } from '$lib/stores';

	import WalletAddressManager from '$lib/components/WalletAddressManager.svelte';
	import { finalizeImport } from '$lib/importHandler';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { toast } from '@zerodevx/svelte-toast';
	import { extractCidsFromArtwork } from '$lib/pinataClientHelpers';
	import { writable } from 'svelte/store';

	// Function to handle image loading errors
	function handleImageError(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		img.src = '/images/wallace-museum.png';
	}

	// Get saved wallet addresses from the page data
	export let data;
	let savedWalletAddresses = data.walletAddresses || [];
	let showAddressManager = false;

	// State for search
	let searchResults: Artwork[] = [];
	let searchTerm = '';
	let isSearching = false;
	let hasMore = false;
	let currentOffset = 0;
	let totalResults = 0;
	let viewMode = 'grid'; // 'grid' or 'list'
	let selectAll = false;
	let isPinning = false;

	// NEW: Use reactive stores for selection
	const selectedIdsStore = writable<number[]>([]);
	const selectedArtworksStore = writable<Artwork[]>([]);

	// Local variables for easier access
	let selectedIds: number[] = [];
	let selectedArtworks: Artwork[] = [];

	// Subscribe to the stores
	selectedIdsStore.subscribe((value) => {
		selectedIds = value;
	});

	selectedArtworksStore.subscribe((value) => {
		selectedArtworks = value;
	});

	// Force a UI update when needed
	let selectionUpdateCounter = 0;

	// Intersection observer
	let loadMoreTrigger: HTMLElement;
	let observer: IntersectionObserver;

	// Add a state for showing settings panel
	let showSettingsPanel = false;

	// Add wallet address using API
	async function handleAddWalletAddress(address: string, alias: string, blockchain: string) {
		try {
			const response = await fetch('/api/admin/wallets', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ address, blockchain, alias })
			});

			const data = await response.json();

			if (data.success) {
				savedWalletAddresses = data.walletAddresses;
				showAddressManager = false;
			} else {
				console.error('Error adding wallet address:', data.error);
			}
		} catch (error) {
			console.error('Error adding wallet address:', error);
		}
	}

	// Remove wallet address using API
	async function handleRemoveWalletAddress(address: string, blockchain: string) {
		try {
			const response = await fetch('/api/admin/wallets', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ address, blockchain })
			});

			const data = await response.json();

			if (data.success) {
				savedWalletAddresses = data.walletAddresses;
			} else {
				console.error('Error removing wallet address:', data.error);
			}
		} catch (error) {
			console.error('Error removing wallet address:', error);
		}
	}

	// Search indexed artworks
	async function searchArtworks(resetOffset = true) {
		if (resetOffset) {
			currentOffset = 0;
			// Clear previous results if starting a new search
			searchResults = [];
			// Clear selection when starting a new search
			selectedIdsStore.set([]);
			selectedArtworksStore.set([]);
			selectionUpdateCounter += 1;
		}

		isSearching = true;

		try {
			// Build the URL with query parameters
			let url = `/api/admin/search?offset=${currentOffset}&limit=48`;

			// Only add search term if it's not empty
			if (searchTerm) {
				url += `&q=${encodeURIComponent(searchTerm)}`;
			}

			const response = await fetch(url);
			const data = await response.json();

			if (data.success) {
				if (resetOffset) {
					searchResults = data.results;
				} else {
					// For pagination, keep existing results and add new ones
					searchResults = [...searchResults, ...data.results];
				}

				// If we already have selected items, filter out any that are no longer in the search results
				if (selectedIds.length > 0) {
					// Get all current result IDs
					const resultIds = searchResults.map((art) => art.id);

					// Filter selected items to only include those still in the results
					selectedIdsStore.update((ids) => ids.filter((id) => resultIds.includes(id)));
					selectedArtworksStore.update((artworks) =>
						artworks.filter((art) => resultIds.includes(art.id))
					);
					selectionUpdateCounter += 1;
				}

				hasMore = data.pagination.hasMore;
				currentOffset = currentOffset + data.results.length;
				totalResults = data.pagination.total;
			} else {
				console.error('Search failed:', data.error);
			}
		} catch (error) {
			console.error('Error searching artworks:', error);
		} finally {
			isSearching = false;
		}
	}

	// Load more results
	function loadMore() {
		if (!isSearching && hasMore) {
			searchArtworks(false);
		}
	}

	// NEW: Simple selection functions
	function toggleSelection(artwork: Artwork) {
		const index = selectedIds.indexOf(artwork.id);
		if (index === -1) {
			// Add to selection
			selectedIdsStore.update((ids) => [...ids, artwork.id]);
			selectedArtworksStore.update((artworks) => [...artworks, artwork]);
		} else {
			// Remove from selection
			selectedIdsStore.update((ids) => ids.filter((id) => id !== artwork.id));
			selectedArtworksStore.update((artworks) => artworks.filter((a) => a.id !== artwork.id));
		}
		// Force UI update
		selectionUpdateCounter += 1;
	}

	function toggleSelectAll() {
		if (selectedIds.length === searchResults.length) {
			// Deselect all
			selectedIdsStore.set([]);
			selectedArtworksStore.set([]);
		} else {
			// Select all
			selectedIdsStore.set(searchResults.map((a) => a.id));
			selectedArtworksStore.set([...searchResults]);
		}
		// Force UI update
		selectionUpdateCounter += 1;
	}

	function isSelected(artwork: Artwork) {
		return selectedIds.includes(artwork.id);
	}

	// Handle import of selected NFTs
	async function handleImportSelected() {
		if (selectedArtworks.length === 0) return;

		try {
			// Store imported IDs to remove from selection later
			const importedIds = selectedArtworks.map((art) => art.id);

			await finalizeImport(selectedArtworks);

			// Clear selection after import
			selectedIdsStore.set([]);
			selectedArtworksStore.set([]);
			selectionUpdateCounter += 1;

			// Refresh the search results to remove imported items
			await searchArtworks(true);
		} catch (error) {
			console.error('Error importing NFTs:', error);
			toast.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// Pin selected NFTs to Pinata
	async function handlePinSelected() {
		if (selectedArtworks.length === 0) return;

		isPinning = true;
		toast.push(`Pinning IPFS content for ${selectedArtworks.length} selected NFTs...`);

		try {
			const formData = new FormData();
			formData.append('artworks', JSON.stringify(selectedArtworks));

			const response = await fetch('?/pinArtworks', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.success) {
				const { total, successful, failed, duplicates } = result.summary;
				toast.push(
					`Successfully processed ${total} CIDs (${successful} pinned, ${duplicates} already pinned, ${failed} failed)`
				);
			} else {
				toast.push(`Error: ${result.error || 'Failed to pin content'}`);
			}
		} catch (error) {
			console.error('Error pinning NFTs:', error);
			toast.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			isPinning = false;
		}
	}

	// Setup intersection observer for infinite scroll
	function setupIntersectionObserver() {
		if (observer) observer.disconnect();

		observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (entry.isIntersecting && hasMore && !isSearching) {
					loadMore();
				}
			},
			{
				root: null,
				rootMargin: '200px', // Load more when within 200px of the bottom
				threshold: 0.1
			}
		);

		if (loadMoreTrigger) {
			observer.observe(loadMoreTrigger);
		}
	}

	// Initial search on mount
	onMount(() => {
		searchArtworks();
		return () => {
			if (observer) observer.disconnect();
		};
	});

	// Update observer when results or hasMore changes
	$: if (loadMoreTrigger && hasMore) {
		setupIntersectionObserver();
	}

	// Update selectAll status when selection changes
	$: selectAll = searchResults.length > 0 && selectedIds.length === searchResults.length;

	// Function to run the indexer
	async function runIndexer(forceRefresh: boolean) {
		try {
			toast.push('Starting indexer...');

			const url = `/api/admin/run-indexer${forceRefresh ? '?force=true' : ''}`;
			const response = await fetch(url);
			const result = await response.json();

			if (result.success) {
				toast.push('Indexer completed successfully!');

				// Calculate summary stats
				let totalIndexed = 0;
				let totalCached = 0;
				let totalNew = 0;

				result.results?.forEach((wallet: any) => {
					totalIndexed += wallet.indexed || 0;
					totalCached += wallet.cached || 0;
					totalNew += wallet.new || 0;
				});

				toast.push(`Indexed ${totalIndexed} NFTs (${totalNew} new, ${totalCached} cached)`);

				// Refresh the search results
				await searchArtworks(true);
			} else {
				toast.push(`Error: ${result.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Error running indexer:', error);
			toast.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// Check if an artwork has IPFS content
	function hasIpfsContent(artwork: Artwork): boolean {
		const cids = extractCidsFromArtwork(artwork);
		return cids.length > 0;
	}
</script>

<div class="px-4 py-6 pb-20">
	<div class="flex justify-between items-center mb-6">
		<div>
			<h1 class="text-2xl font-bold mb-2">Import NFTs</h1>
			<p class="text-gray-600 dark:text-gray-400">
				Import NFTs from indexed wallets into your Compendium.
			</p>
		</div>

		<div class="flex items-center gap-3">
			<!-- Settings button -->
			<button
				class="secondary button py-2 px-3"
				on:click={() => (showSettingsPanel = !showSettingsPanel)}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="inline-block mr-1"
				>
					<circle cx="12" cy="12" r="3"></circle>
					<path
						d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
					></path>
				</svg>
				Settings
			</button>
		</div>
	</div>

	<!-- Settings panel (collapsible) -->
	{#if showSettingsPanel}
		<div
			class="bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm mb-6 transition-all duration-200"
		>
			<div class="mb-4">
				<h3 class="font-medium text-lg mb-2">Indexer Controls</h3>
				<div class="flex gap-3">
					<button class="secondary button py-2 px-4" on:click={() => runIndexer(false)}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5 mr-1 inline-block"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Normal Refresh
					</button>
					<button class="secondary button py-2 px-4" on:click={() => runIndexer(true)}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5 mr-1 inline-block"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Force Refresh All
					</button>
				</div>
			</div>

			<div>
				<h3 class="font-medium text-lg mb-2">Wallet Management</h3>
				<button class="secondary button py-2 px-4" on:click={() => (showAddressManager = true)}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 mr-1 inline-block"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
						/>
					</svg>
					Edit Wallet Addresses
					<span class="ml-1 text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
						{savedWalletAddresses.length}
					</span>
				</button>
			</div>
		</div>
	{/if}

	<!-- Search and Filters -->
	<div class="bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm mb-6">
		<div class="flex gap-4 items-end flex-wrap md:flex-nowrap">
			<!-- Search input -->
			<div class="w-full md:flex-grow">
				<label for="search" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
					>Search</label
				>
				<div class="relative">
					<input
						id="search"
						type="text"
						class="w-full p-2 pl-9 border dark:border-gray-700 rounded-md dark:bg-gray-700 dark:text-gray-100"
						placeholder="Search by name, description, token ID, blockchain..."
						bind:value={searchTerm}
						on:keydown={(e) => e.key === 'Enter' && searchArtworks()}
					/>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 absolute left-2 top-2.5 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				</div>
			</div>

			<!-- Select all button -->
			<div class="flex-shrink-0">
				<button class="secondary button py-2 px-4" on:click={toggleSelectAll}>
					{selectAll ? 'Deselect All' : 'Select All'}
				</button>
			</div>

			<!-- Search button -->
			<div class="flex-shrink-0">
				<button
					class="primary button py-2 px-6"
					on:click={() => searchArtworks()}
					disabled={isSearching}
				>
					{isSearching ? 'Searching...' : 'Search'}
				</button>
			</div>
		</div>
	</div>

	<!-- Results -->
	<div>
		{#if searchResults.length === 0}
			<div class="bg-white dark:bg-gray-800 p-8 rounded-md shadow-sm text-center">
				{#if isSearching}
					<p class="text-gray-600 dark:text-gray-400">Searching...</p>
				{:else}
					<p class="text-gray-600 dark:text-gray-400">No results found. Try a different search.</p>
				{/if}
			</div>
		{:else}
			<!-- Result count and view toggle -->
			<div class="mb-4 flex justify-between items-center">
				<div class="text-gray-600 dark:text-gray-400">
					Found {totalResults} result{totalResults !== 1 ? 's' : ''}
				</div>

				<!-- Radix-inspired view toggle -->
				<div class="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
					<button
						class="flex items-center justify-center px-3 py-1.5 h-9 w-9 transition-colors relative {viewMode ===
						'grid'
							? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
							: 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
						on:click={() => (viewMode = 'grid')}
						title="Grid View"
						aria-label="Grid View"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<rect x="3" y="3" width="7" height="7"></rect>
							<rect x="14" y="3" width="7" height="7"></rect>
							<rect x="14" y="14" width="7" height="7"></rect>
							<rect x="3" y="14" width="7" height="7"></rect>
						</svg>
					</button>
					<button
						class="flex items-center justify-center px-3 py-1.5 h-9 w-9 transition-colors relative {viewMode ===
						'list'
							? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
							: 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
						on:click={() => (viewMode = 'list')}
						title="List View"
						aria-label="List View"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="8" y1="6" x2="21" y2="6"></line>
							<line x1="8" y1="12" x2="21" y2="12"></line>
							<line x1="8" y1="18" x2="21" y2="18"></line>
							<line x1="3" y1="6" x2="3.01" y2="6"></line>
							<line x1="3" y1="12" x2="3.01" y2="12"></line>
							<line x1="3" y1="18" x2="3.01" y2="18"></line>
						</svg>
					</button>
				</div>
			</div>

			<!-- Grid View -->
			{#if viewMode === 'grid'}
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
					{#each searchResults as artwork (artwork.id + '-' + selectionUpdateCounter)}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<div
							class="bg-white dark:bg-gray-800 rounded-md shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow {isSelected(
								artwork
							)
								? 'ring-2 ring-blue-500'
								: ''}"
							on:click={() => toggleSelection(artwork)}
							role="button"
							tabindex="0"
						>
							<div class="relative pb-[100%]">
								<img
									src={artwork.image_url || '/images/wallace-museum.png'}
									alt={artwork.title}
									class="absolute inset-0 w-full h-full object-cover"
									on:error={handleImageError}
								/>

								<!-- Selection indicator -->
								{#if isSelected(artwork)}
									<div
										class="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<polyline points="20 6 9 17 4 12"></polyline>
										</svg>
									</div>
								{/if}

								<!-- IPFS indicator if artwork has IPFS content -->
								{#if hasIpfsContent(artwork)}
									<div
										class="absolute bottom-2 right-2 bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
										title="Contains IPFS content"
									>
										<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
											<path
												d="M12 2L4 6V12C4 15.31 7.58 18.5 12 20C16.42 18.5 20 15.31 20 12V6L12 2Z"
											/>
										</svg>
									</div>
								{/if}
							</div>
							<div class="p-3">
								<h3 class="font-medium truncate dark:text-gray-100" title={artwork.title}>
									{artwork.title}
								</h3>
								<div class="text-xs text-gray-500 dark:text-gray-400 truncate">
									{artwork.contractAlias || artwork.contractAddr?.substring(0, 10) + '...'}
								</div>
								{#if artwork.blockchain}
									<div class="mt-1">
										<span
											class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
										>
											{artwork.blockchain}
										</span>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- List View -->
				<div class="overflow-x-auto">
					<table class="w-full border-collapse bg-white dark:bg-gray-800 rounded-md shadow-sm">
						<thead>
							<tr class="bg-gray-50 dark:bg-gray-700">
								<th class="p-3 text-left dark:text-gray-300 w-10">
									<input
										type="checkbox"
										checked={selectAll}
										on:change={toggleSelectAll}
										class="checkbox"
									/>
								</th>
								<th class="p-3 text-left dark:text-gray-300">Image</th>
								<th class="p-3 text-left dark:text-gray-300">Title</th>
								<th class="p-3 text-left dark:text-gray-300">Contract</th>
								<th class="p-3 text-left dark:text-gray-300">Blockchain</th>
								<th class="p-3 text-left dark:text-gray-300">Storage</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each searchResults as artwork (artwork.id + '-' + selectionUpdateCounter)}
								<tr
									class="{isSelected(artwork)
										? 'bg-blue-50 dark:bg-blue-900/30'
										: 'dark:bg-gray-800'} cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
									on:click={() => toggleSelection(artwork)}
								>
									<td class="p-3">
										<input
											type="checkbox"
											checked={isSelected(artwork)}
											class="checkbox"
											on:change={(e) => {
												e.stopPropagation();
												toggleSelection(artwork);
											}}
											on:click={(e) => e.stopPropagation()}
										/>
									</td>
									<td class="p-3 w-16">
										<div class="w-12 h-12 overflow-hidden rounded-md">
											<img
												src={artwork.image_url || '/images/wallace-museum.png'}
												alt={artwork.title}
												class="w-full h-full object-cover"
												on:error={handleImageError}
											/>
										</div>
									</td>
									<td class="p-3">
										<div class="font-medium dark:text-gray-100">{artwork.title}</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">
											ID: {artwork.tokenID}
										</div>
									</td>
									<td class="p-3 dark:text-gray-300">
										{artwork.contractAlias || artwork.contractAddr?.substring(0, 10) + '...'}
									</td>
									<td class="p-3">
										{#if artwork.blockchain}
											<span
												class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
											>
												{artwork.blockchain}
											</span>
										{/if}
									</td>
									<td class="p-3">
										{#if hasIpfsContent(artwork)}
											<span
												class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-md bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
											>
												IPFS
											</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<!-- Intersection observer trigger element -->
			<div bind:this={loadMoreTrigger} class="h-10 mt-4"></div>

			<!-- Loading indicator (only shown when actively loading more) -->
			{#if isSearching && currentOffset > 0}
				<div class="mt-4 text-center">
					<div
						class="inline-block animate-spin h-6 w-6 border-2 border-gray-500 border-t-transparent rounded-full"
					></div>
					<p class="text-gray-600 dark:text-gray-400 mt-2">Loading more...</p>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Fixed Action Shelf -->
{#if selectedIds.length > 0}
	<div
		class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50 transition-all transform translate-y-0 duration-200 ease-in-out"
	>
		<div class="container mx-auto px-4 py-3 flex items-center justify-between">
			<div class="flex items-center">
				<div class="text-blue-600 dark:text-blue-400 font-semibold">
					{selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
				</div>
			</div>

			<div class="flex items-center gap-4">
				<!-- Pin to IPFS button -->
				<button
					class="secondary button py-2 px-4 flex items-center"
					on:click={handlePinSelected}
					disabled={selectedIds.length === 0 || isPinning}
				>
					{#if isPinning}
						<div
							class="inline-block animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"
						></div>
						Pinning...
					{:else}
						<svg
							class="h-5 w-5 mr-1"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M12 2L4 6V12C4 15.31 7.58 18.5 12 20C16.42 18.5 20 15.31 20 12V6L12 2Z"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						Pin to IPFS
					{/if}
				</button>

				<!-- Import button -->
				<button
					class="primary button py-2 px-6 text-lg"
					on:click={handleImportSelected}
					disabled={selectedIds.length === 0}
				>
					Import Selected ({selectedIds.length})
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal for Wallet Address Management -->
{#if showAddressManager}
	<WalletAddressManager
		addresses={savedWalletAddresses}
		onClose={() => (showAddressManager = false)}
		onAdd={handleAddWalletAddress}
		onRemove={handleRemoveWalletAddress}
	/>
{/if}

<style>
	.icon-button {
		@apply transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-600;
	}

	.blockchain-badge {
		display: inline-block;
	}

	.checkbox {
		@apply w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-md checked:bg-blue-500 checked:border-blue-500;
	}
</style>
