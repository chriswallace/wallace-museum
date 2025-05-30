<script lang="ts">
	import { nfts, isLoading, walletAddress, isModalOpen } from '$lib/stores';
	import type { Artwork } from '$lib/stores';

	import WalletAddressManager from '$lib/components/WalletAddressManager.svelte';
	import { finalizeImport } from '$lib/importHandler';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { toast } from '@zerodevx/svelte-toast';
	import { extractCidsFromArtwork } from '$lib/pinataClientHelpers';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { writable } from 'svelte/store';
	import { ImagePresets } from '$lib/imageOptimization';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';

	// Extend the Artwork type to match the search API response structure
	type ExtendedArtwork = {
		id: number;
		title: string;
		name?: string;
		description: string;
		image_url?: string | null;
		animation_url?: string | null;
		thumbnailUrl?: string;
		contractAddr?: string;
		contractAlias?: string;
		tokenID?: string;
		blockchain?: string;
		indexed?: boolean;
		ownerAddresses?: string[];
		isCreatedBy?: string | null;
		attributes?: any[];
		tags?: string[];
		artist?: {
			name: string;
			avatarUrl: string | null;
			walletAddress?: string;
		} | null;
		supportsArtistLookup?: boolean;
		isImported?: boolean;
		// Mint date fields
		mintDate?: string | Date;
		mint_date?: string;
		timestamp?: string;
		created_date?: string;
		created_at?: string;
		// Additional fields that might be present on artwork objects
		imageUrl?: string;
		metadata?: {
			displayUri?: string;
			artifactUri?: string;
			thumbnailUri?: string;
			metadataUrl?: string;
			mint_date?: string | null;
			timestamp?: string | null;
			[key: string]: any;
		};
		display_uri?: string;
		artifact_uri?: string;
		thumbnail_uri?: string;
		displayUrl?: string;
		artifactUrl?: string;
		[key: string]: any;
	};

	// Function to handle image loading errors
	function handleImageError(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		img.src = '/images/medici-image.png';
	}

	// Get saved wallet addresses from the page data
	export let data;
	let savedWalletAddresses = data.walletAddresses || [];
	let showAddressManager = false;

	// State for search
	let searchResults: ExtendedArtwork[] = [];
	let currentOffset = 0;
	let hasMore = false;
	let totalResults = 0;
	let isSearching = false;
	let isIndexing = false;
	let isPinning = false;
	let searchTerm = '';
	let viewMode: 'grid' | 'list' = 'grid'; // 'grid' or 'list'
	let selectAll = false;

	// Debug mode for skeleton loading
	let debugSkeletonMode = false;
	let showDebugControls = true;

	// Use reactive stores for selection
	const selectedIdsStore = writable<number[]>([]);
	const selectedArtworksStore = writable<ExtendedArtwork[]>([]);

	// Local variables for easier access - make them reactive
	$: selectedIds = $selectedIdsStore;
	$: selectedArtworks = $selectedArtworksStore;

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
		}

		isSearching = true;

		try {
			// Build the URL with query parameters - always use 'all' filter since tabs are removed
			let url = `/api/admin/search?offset=${currentOffset}&limit=48&fields=title,description,contractAlias,contractAddr&filter=all`;

			// Only add search term if it's not empty
			if (searchTerm) {
				// No need to modify search term for quotes - the backend should handle quoted phrases
				url += `&q=${encodeURIComponent(searchTerm)}`;
			}

			const response = await fetch(url);
			
			// Check if the response status is OK
			if (!response.ok) {
				throw new Error(`Search API returned ${response.status}: ${response.statusText}`);
			}
			
			const data = await response.json();

			// Add validation
			if (!data.results || !Array.isArray(data.results)) {
				throw new Error('Invalid search response format: missing or non-array results');
			}

			// Process results and handle pagination
			if (resetOffset) {
				searchResults = data.results;
			} else {
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
			}

			// Calculate hasMore based on whether we got fewer results than requested
			hasMore = data.results.length === 48; // If we got the full limit, there might be more
			currentOffset = currentOffset + data.results.length;
			totalResults = data.total || 0;
			
			// Artist data is now included in the search results from indexing
		} catch (error) {
			console.error('Error searching artworks:', error);
			toast.push(`Search error: ${error instanceof Error ? error.message : String(error)}`, {
				theme: { '--toastBackground': 'var(--color-error)', '--toastColor': 'white' }
			});
			// Reset UI state on error
			hasMore = false;
			if (resetOffset) {
				searchResults = [];
				totalResults = 0;
			}
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
	function toggleSelection(artwork: ExtendedArtwork) {
		// Prevent selection of already imported artworks
		if (artwork.isImported) {
			return;
		}

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
	}

	function toggleSelectAll() {
		// Only select artworks that are not imported
		const selectableArtworks = searchResults.filter((artwork) => !artwork.isImported);

		if (selectedIds.length === selectableArtworks.length) {
			// Deselect all
			selectedIdsStore.set([]);
			selectedArtworksStore.set([]);
		} else {
			// Select all selectable artworks
			selectedIdsStore.set(selectableArtworks.map((a) => a.id));
			selectedArtworksStore.set([...selectableArtworks]);
		}
	}

	function isSelected(artwork: ExtendedArtwork) {
		return $selectedIdsStore.includes(artwork.id);
	}

	// Helper function to check if artwork can be selected
	function canSelect(artwork: ExtendedArtwork) {
		return !artwork.isImported;
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

			if (result.type === 'success' && result.data) {
				const data = result.data;
				if (data.success && data.summary) {
					const { successful = 0, duplicates = 0, failed = 0 } = data.summary;
					toast.push(
						`Pinning complete: ${successful} new, ${duplicates} duplicates, ${failed} failed`
					);
				} else {
					toast.push('Pinning completed with unknown status');
				}
			} else if (result.type === 'failure' && result.data) {
				const errorData = result.data;
				toast.push(`Error: ${errorData.error || 'Unknown error occurred'}`);
			} else {
				toast.push('Pinning completed with unknown status');
			}
		} catch (error) {
			console.error('Error pinning selected NFTs:', error);
			toast.push(`Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
		} finally {
			isPinning = false;
			// Clear selection after pinning attempt
			selectedIdsStore.set([]);
			selectedArtworksStore.set([]);
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

	// Artist data is now included in search results from indexing - no need to fetch separately

	// Function to run the indexer
	async function runIndexer(forceRefresh: boolean) {
		try {
			isIndexing = true;
			const toastId = toast.push('Indexing artworks...', { initial: 0 });

			// Use the new endpoint
			const url = `/api/admin/index-wallets${forceRefresh ? '?force=true' : ''}`;
			const response = await fetch(url);
			const result = await response.json();

			if (result.success) {
				let totalIndexed = 0;
				let totalCached = 0;
				let totalNew = 0;

				result.results?.forEach((wallet: any) => {
					totalIndexed += wallet.indexed || 0;
					totalCached += wallet.cached || 0;
					totalNew += wallet.new || 0;
				});

				// Show success toast (fix argument count for toast.set)
				toast.set(toastId, {
					msg: `Indexed ${totalIndexed} NFTs (${totalNew} new, ${totalCached} cached)`,
					theme: { '--toastBackground': 'var(--color-success)', '--toastColor': 'white' }
				});
				toast.push('✔ Indexing complete!', {
					theme: { '--toastBackground': 'var(--color-success)', '--toastColor': 'white' }
				});

				// Refresh the search results
				await searchArtworks(true);
			} else {
				// Show error toast (fix argument count for toast.set)
				toast.set(toastId, {
					msg: `Error: ${result.error || 'Unknown error'}`,
					theme: { '--toastBackground': 'var(--color-error)', '--toastColor': 'white' }
				});
			}
		} catch (error) {
			console.error('Error running indexer:', error);
			toast.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			isIndexing = false;
		}
	}

	// Check if an artwork has IPFS content
	function hasIpfsContent(artwork: ExtendedArtwork): boolean {
		// Use existing extractCidsFromArtwork function first
		const cids = extractCidsFromArtwork(artwork);
		
		// Check main image URLs from search results
		if (artwork.image_url && artwork.image_url.includes('ipfs')) {
			return true;
		}
		
		// Check animation URL from search results
		if (artwork.animation_url && artwork.animation_url.includes('ipfs')) {
			return true;
		}
		
		// Check main image URLs from search results
		if (artwork.image_url && artwork.image_url.includes('ipfs')) {
			return true;
		}
		
		// Check animation URL from search results
		if (artwork.animation_url && artwork.animation_url.includes('ipfs')) {
			return true;
		}
		
		// Check metadata fields if available
		if (artwork.metadata) {
			const metadata = artwork.metadata;
			const ipfsFields = ['displayUri', 'artifactUri', 'thumbnailUri', 'metadataUrl'];
			
			for (const field of ipfsFields) {
				if (metadata[field] && metadata[field].includes('ipfs')) {
					return true;
				}
			}
		}
		
		return cids.length > 0;
	}

	// Helper function to get artist info for an artwork
	function getArtistInfo(artwork: ExtendedArtwork) {
		// Artist data is now included directly in the search results from indexing
		return artwork.artist || null;
	}

	// Helper function to get collection info for an artwork  
	function getCollectionInfo(artwork: ExtendedArtwork) {
		// Collection info is available in contractAlias from search results
		return artwork.contractAlias ? { title: artwork.contractAlias } : null;
	}

	// Simplified function to get artwork image URL
	// Uses only thumbnail-related fields to avoid display, animation, artifact, and generator URIs
	function getArtworkImageUrl(artwork: ExtendedArtwork): string {
		// Primary: Use thumbnailUrl field from search API response
		if (artwork.thumbnailUrl) {
			return artwork.thumbnailUrl; // Return raw URL for OptimizedImage to handle
		}

		// Secondary: Use image_url from search API (which now prioritizes thumbnailUrl)
		if (artwork.image_url) {
			return artwork.image_url; // Return raw URL for OptimizedImage to handle
		}

		// Check thumbnail_uri field
		if (artwork.thumbnail_uri) {
			return artwork.thumbnail_uri; // Return raw URL for OptimizedImage to handle
		}

		// Check metadata.thumbnailUri if available
		if (artwork.metadata?.thumbnailUri) {
			return artwork.metadata.thumbnailUri; // Return raw URL for OptimizedImage to handle
		}

		// Return fallback image if no valid thumbnail URL found
		return '/images/medici-image.png';
	}

	// Reactive variable for select all button text
	$: selectableArtworks = searchResults.filter((artwork) => !artwork.isImported);
	$: selectAllText =
		selectedIds.length === selectableArtworks.length ? 'Deselect All' : 'Select All';
	$: selectAllChecked =
		selectableArtworks.length > 0 && selectedIds.length === selectableArtworks.length;

	// Helper to get the title of an artwork
	function getArtworkTitle(artwork: ExtendedArtwork): string {
		// The search endpoint returns title directly
		if (artwork.title) {
			return artwork.title;
		}
		
		// Check for name as fallback
		if (artwork.name) {
			return artwork.name;
		}
		
		// If we have a token ID, use that as last resort
		const tokenId = artwork.tokenID || artwork.token_id;
		
		console.log(artwork);

		return 'Unnamed Artwork';
	}
	
	// Contract name mappings for well-known contracts
	const CONTRACT_NAMES: Record<string, string> = {
		// Art Blocks Ethereum contracts
		'0x059edd72cd353df5106d2b9cc5ab83a52287ac3a': 'Art Blocks Curated',
		'0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270': 'Art Blocks Factory',
		'0x99a9b7c1116f9ceeb1652de04d5969cce509b069': 'Art Blocks Playground',
		'0x0e6a21cf97d6a9d9d8f794d26dfb3e3baa49f3ac': 'Art Blocks Presents Flex',

		// Shared platforms Ethereum
		'0x495f947276749ce646f68ac8c248420045cb7b5e': 'OpenSea Shared Storefront',
		'0xa5409ec958c83c3f309868babaca7c86dcb077c1': 'OpenSea Collections',
		'0x2953399124f0cbb46d2cbacd8a89cf0599974963': 'OpenSea Collections v2',
		'0xd07dc4262bcdbf85190c01c996b4c06a461d2430': 'Rarible ERC-721',
		'0xb66a603f4cfe17e3d27b87a8bfcad319856518b8': 'Rarible ERC-1155',
		'0xb932a70a57673d89f4acffbe830e8ed7f75fb9e0': 'SuperRare',
		'0x3b3ee1931dc30c1957379fac9aba94d1c48a5405': 'Foundation',
		'0xabefbc9fd2f806065b4f3c237d4b59d9a97bcac7': 'Zora Media',
		'0x7c2668bd0d3c050703cecc956c11bd520c26f7d4': 'Zora Editions'
	};

	// Helper to get contract or collection name
	function getContractName(artwork: ExtendedArtwork): string {
		// First check the contractAlias field returned by the search API (this contains the collection title)
		if (artwork.contractAlias && artwork.contractAlias.trim() !== '') {
			return artwork.contractAlias;
		}
		
		// Check the contractAddr field from search results
		if (artwork.contractAddr) {
			// Check if it's a well-known contract
			const knownName = CONTRACT_NAMES[artwork.contractAddr.toLowerCase()];
			if (knownName) {
				return knownName;
			}
			return `Contract ${artwork.contractAddr.substring(0, 10)}...`;
		}
		
		// Check contractAddress property
		if (artwork.contractAddress) {
			// Check if it's a well-known contract
			const knownName = CONTRACT_NAMES[artwork.contractAddress.toLowerCase()];
			if (knownName) {
				return knownName;
			}
			return `Contract ${artwork.contractAddress.substring(0, 10)}...`;
		}
		
		// Check collection object - also check for title first, then name
		if (artwork.collection) {
			if (artwork.collection.title) {
				return artwork.collection.title;
			}
			if (artwork.collection.name) {
				return artwork.collection.name;
			}
		}
		
		return 'Unknown Collection';
	}
	
	// Helper to get blockchain name
	function getBlockchain(artwork: ExtendedArtwork): string | null {
		// Check direct property from search results first
		if (artwork.blockchain) {
			return artwork.blockchain;
		}
		
		// No additional fallbacks needed - blockchain should be in the search results
		
		return null;
	}
	
	// Helper to get token ID
	function getTokenId(artwork: ExtendedArtwork): string {
		// Check direct properties from search results first
		if (artwork.tokenID) {
			return artwork.tokenID;
		}
		
		if (artwork.token_id) {
			return artwork.token_id;
		}
		
		// Check tokenId property
		if (artwork.tokenId) {
			return artwork.tokenId;
		}
		
		return 'Unknown ID';
	}
</script>

<!-- Redesigned Import NFTs Screen -->
<div class="import-nfts-wrapper mx-auto">
	<!-- Header -->
	<div
		class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b border-gray-200 dark:border-gray-700 pb-4"
	>
		<div>
			<h1 class="text-3xl font-medium mb-1">Import NFTs</h1>
			<p class="text-gray-600 dark:text-gray-400 text-base">
				Import NFTs from indexed wallets into your Compendium.
			</p>
		</div>
		<button
			class="secondary button flex items-center gap-2 py-2 px-4 mt-2 md:mt-0"
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
				class="inline-block"
				><circle cx="12" cy="12" r="3"></circle><path
					d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
				></path></svg
			>
			Settings
		</button>
	</div>

	<!-- Settings Panel -->
	{#if showSettingsPanel}
		<div
			class="bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm mb-6 border border-gray-200 dark:border-gray-700"
		>
			<div class="mb-4">
				<h3 class="font-medium text-lg mb-2">Indexer Controls</h3>
				<div class="flex gap-3 flex-wrap">
					<button
						class="secondary button py-2 px-4"
						on:click={() => runIndexer(false)}
						disabled={isIndexing}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5 mr-1 inline-block"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/></svg
						>
						Normal Refresh
					</button>
					<button
						class="secondary button py-2 px-4"
						on:click={() => runIndexer(true)}
						disabled={isIndexing}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5 mr-1 inline-block"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/></svg
						>
						Force Refresh All
					</button>
					<!-- New Index All Artworks Button -->
					<button
						class="primary button py-2 px-4"
						on:click={() => runIndexer(false)}
						disabled={isIndexing}
					>
						{#if isIndexing}
							<svg
								class="animate-spin h-5 w-5 mr-1 inline-block"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								><circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"
								></path></svg
							>
							Indexing...
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5 mr-1 inline-block"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4v16m8-8H4"
								/></svg
							>
							Index All Artworks
						{/if}
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
						/></svg
					>
					Edit Wallet Addresses
					<span class="ml-1 text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
						{savedWalletAddresses.length}
					</span>
				</button>
			</div>

			{#if showDebugControls}
				<div>
					<h3 class="font-medium text-lg mb-2">Debug Controls</h3>
					<div class="flex gap-3 flex-wrap">
						<button
							class="secondary button py-2 px-4 {debugSkeletonMode ? 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900 dark:border-orange-700 dark:text-orange-200' : ''}"
							on:click={() => (debugSkeletonMode = !debugSkeletonMode)}
						>
							{debugSkeletonMode ? '🔍 Disable' : '🔍 Enable'} Skeleton Debug Mode
						</button>
						{#if debugSkeletonMode}
							<span class="text-sm text-orange-600 dark:text-orange-400 flex items-center">
								⚠️ Debug active - all images show skeleton loaders
							</span>
						{/if}
					</div>
					<div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
						<strong>Skeleton Debug Mode:</strong> Forces all images to show skeleton loaders by setting empty src URLs. 
						This lets you see exactly how the skeleton loading will look during real loading states.
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Search & Controls -->
	<div
		class="bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm mb-6 flex flex-col md:flex-row md:items-end gap-4 border border-gray-200 dark:border-gray-700"
	>
		<div class="flex-1 flex flex-col">
			<label for="search" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
				>Search</label
			>
			<div class="relative flex items-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/></svg
				>
				<input
					id="search"
					type="text"
					class="w-full h-11 !pl-11 pr-3 mb-0 border dark:border-gray-700 rounded-md dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
					placeholder="Search by title, description, or contract name. Use quotes for exact phrases."
					bind:value={searchTerm}
					on:keydown={(e) => e.key === 'Enter' && searchArtworks()}
				/>
			</div>
		</div>
		<div class="flex gap-2 md:gap-4 items-end">
			<button
				class="primary button py-2 px-6 h-11"
				on:click={() => searchArtworks()}
				disabled={isSearching}>{isSearching ? 'Searching...' : 'Search'}</button
			>
		</div>
	</div>

	<!-- Results Card -->
	<div
		class=""
	>
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
					<button class="secondary button py-2 px-4 h-11" on:click={toggleSelectAll}>
						{selectAllText}
					</button>
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
				<div class="masonry-grid">
					{#each searchResults as artwork (artwork.id)}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<div
							class="masonry-item group bg-white dark:bg-gray-800 rounded-sm shadow-sm overflow-hidden transition-all duration-200"
							class:opacity-50={artwork.isImported}
							class:cursor-not-allowed={artwork.isImported}
							class:cursor-pointer={!artwork.isImported}
							class:hover:shadow-lg={!artwork.isImported}
							class:selected={$selectedIdsStore.includes(artwork.id) && !artwork.isImported}
							on:click={() => canSelect(artwork) && toggleSelection(artwork)}
							role="button"
							tabindex={canSelect(artwork) ? 0 : -1}
						>
							<div class="relative">
								<OptimizedImage
									src={debugSkeletonMode ? '' : getArtworkImageUrl(artwork)}
									alt={getArtworkTitle(artwork)}
									width={300}
									height={artwork.dimensions ? Math.round((300 * artwork.dimensions.height) / artwork.dimensions.width) : 300}
									format="webp"
									quality={80}
									aspectRatio={artwork.dimensions ? `${artwork.dimensions.width}/${artwork.dimensions.height}` : '1/1'}
									showSkeleton={true}
									skeletonBorderRadius="8px"
									className="w-full h-auto object-contain rounded-t-sm"
									fallbackSrc="/images/medici-image.png"
									loading="lazy"
									on:error={handleImageError}
								/>

								<!-- Always show selection indicator when selected -->
								{#if $selectedIdsStore.includes(artwork.id)}
									<div
										class="absolute top-3 right-3 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-xl border-4 border-white dark:border-gray-800 z-20"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="3"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<polyline points="20 6 9 17 4 12"></polyline>
										</svg>
									</div>
								{:else if !artwork.isImported}
									<!-- Unselected state indicator (shows on hover) -->
									<div
										class="absolute top-3 right-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-full w-8 h-8 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-70 transition-all duration-200 z-20"
									>
										<!-- Empty circle for unselected state -->
									</div>
								{/if}

								<!-- Imported indicator (separate from selection) -->
								{#if artwork.isImported}
									<div
										class="absolute top-3 left-3 bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-xl border-2 border-white dark:border-gray-800 z-20"
										title="Already imported"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="3"
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
										class="absolute bottom-3 right-3 bg-purple-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800 z-10"
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
								<h3 class="font-medium text-base truncate dark:text-gray-100" title={getArtworkTitle(artwork)}>
									{getArtworkTitle(artwork)}
								</h3>

								<!-- Enhanced collection/artist info -->
								{#if artwork.supportsArtistLookup}
									{@const collectionInfo = getCollectionInfo(artwork)}
									{@const artistInfo = getArtistInfo(artwork)}

									<div class="space-y-1">
										<!-- Collection name -->
										{#if collectionInfo}
											<div class="font-medium text-sm">
												{collectionInfo.title || 'Unknown Collection'}
											</div>
										{:else}
											<div class="font-medium text-sm">
												{getContractName(artwork)}
											</div>
										{/if}

										<!-- Artist info -->
										{#if artistInfo}
											<div class="flex items-center space-x-2">
												{#if artistInfo.avatarUrl}
													<div class="flex-shrink-0 w-5 h-5">
														<OptimizedImage
															src={debugSkeletonMode ? '' : artistInfo.avatarUrl}
															alt={artistInfo.name}
															width={20}
															height={20}
															fit="cover"
															format="webp"
															quality={85}
															aspectRatio="1/1"
															showSkeleton={true}
															skeletonBorderRadius="50%"
															className="w-full h-full rounded-full object-cover"
															fallbackSrc="/images/medici-image.png"
															on:error={handleImageError}
														/>
													</div>
												{/if}
												<span class="text-xs text-gray-500 dark:text-gray-400">
													by {artistInfo.name}
												</span>
											</div>
										{/if}
									</div>
								{:else}
									<div class="text-xs text-gray-500 dark:text-gray-400 truncate">
										{getContractName(artwork)}
									</div>
								{/if}

								{#if getBlockchain(artwork)}
									<div class="mt-1">
										<span
											class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
										>
											{getBlockchain(artwork)}
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
					<table class="w-full border-collapse bg-white dark:bg-gray-800 rounded-sm shadow-sm">
						<thead>
							<tr class="bg-gray-50 dark:bg-gray-700">
								<th class="p-3 text-left dark:text-gray-300 w-10">
									<input
										type="checkbox"
										checked={selectAllChecked}
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
							{#each searchResults as artwork (artwork.id)}
								<tr
									class="{$selectedIdsStore.includes(artwork.id) && !artwork.isImported
										? 'bg-blue-50 dark:bg-blue-900/30'
										: 'dark:bg-gray-800'} {artwork.isImported
										? 'opacity-50'
										: 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'}"
									on:click={() => canSelect(artwork) && toggleSelection(artwork)}
								>
									<td class="p-3">
										{#if artwork.isImported}
											<div class="flex items-center space-x-2">
												<span class="text-green-600 font-medium text-sm">✓ Imported</span>
											</div>
										{:else}
											<input
												type="checkbox"
												checked={$selectedIdsStore.includes(artwork.id)}
												class="checkbox"
												on:change={(e) => {
													e.stopPropagation();
													toggleSelection(artwork);
												}}
												on:click={(e) => e.stopPropagation()}
											/>
										{/if}
									</td>
									<td class="p-3 w-16">
										<div class="w-12 h-12 overflow-hidden rounded-sm">
											<div class="relative">
												<OptimizedImage
													src={debugSkeletonMode ? '' : getArtworkImageUrl(artwork)}
													alt={getArtworkTitle(artwork)}
													width={48}
													height={48}
													fit="cover"
													format="webp"
													quality={80}
													aspectRatio="1/1"
													showSkeleton={true}
													skeletonBorderRadius="6px"
													className="w-full h-full object-cover"
													fallbackSrc="/images/medici-image.png"
													loading="lazy"
													on:error={handleImageError}
												/>
											</div>
										</div>
									</td>
									<td class="p-3">
										<div class="font-medium dark:text-gray-100">{getArtworkTitle(artwork)}</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">
											ID: {getTokenId(artwork)}
										</div>
									</td>
									<td class="p-3 dark:text-gray-300">
										<!-- Enhanced collection/artist info -->
										{#if artwork.supportsArtistLookup}
											{@const collectionInfo = getCollectionInfo(artwork)}
											{@const artistInfo = getArtistInfo(artwork)}

											<div class="space-y-1">
												<!-- Collection name -->
												{#if collectionInfo}
													<div class="font-medium text-sm">
														{collectionInfo.title || 'Unknown Collection'}
													</div>
												{:else}
													<div class="font-medium text-sm">
														{getContractName(artwork)}
													</div>
												{/if}

												<!-- Artist info -->
												{#if artistInfo}
													<div class="flex items-center space-x-2">
														{#if artistInfo.avatarUrl}
															<div class="flex-shrink-0 w-5 h-5">
																<OptimizedImage
																	src={debugSkeletonMode ? '' : artistInfo.avatarUrl}
																	alt={artistInfo.name}
																	width={20}
																	height={20}
																	fit="cover"
																	format="webp"
																	quality={85}
																	aspectRatio="1/1"
																	showSkeleton={true}
																	skeletonBorderRadius="50%"
																	className="w-full h-full rounded-full object-cover"
																	fallbackSrc="/images/medici-image.png"
																	on:error={handleImageError}
																/>
															</div>
														{/if}
														<span class="text-xs text-gray-500 dark:text-gray-400">
															by {artistInfo.name}
														</span>
													</div>
												{/if}
											</div>
										{:else}
											{getContractName(artwork)}
										{/if}
									</td>
									<td class="p-3">
										{#if getBlockchain(artwork)}
											<span
												class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
											>
												{getBlockchain(artwork)}
											</span>
										{/if}
									</td>
									<td class="p-3">
										{#if hasIpfsContent(artwork)}
											<span
												class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-sm bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
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
	.import-nfts-wrapper {
		/* Center and constrain the main content */
	}
	.blockchain-badge {
		display: inline-block;
	}

	.checkbox {
		@apply w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-md checked:bg-blue-500 checked:border-blue-500;
	}

	/* Masonry Grid Styles - Stable Layout */
	.masonry-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		align-items: start;
	}

	@media (min-width: 640px) {
		.masonry-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (min-width: 768px) {
		.masonry-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.masonry-grid {
			grid-template-columns: repeat(5, 1fr);
		}
	}

	@media (min-width: 1280px) {
		.masonry-grid {
			grid-template-columns: repeat(6, 1fr);
		}
	}

	.masonry-item {
		width: 100%;
		transition: all 0.2s ease;
		position: relative;
	}

	/* Hover effect for selectable items */
	.masonry-item:not(.opacity-50):hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	/* Active state for click feedback */
	.masonry-item:not(.opacity-50):active {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	/* Selection indicator hover effect */
	.masonry-item:not(.opacity-50):hover .selection-indicator {
		transform: scale(1.1);
	}

	/* Prevent layout shifts during loading */
	.masonry-item img {
		width: 100%;
		height: auto;
		display: block;
	}

	/* Ensure skeleton loaders are visible during loading */
	.masonry-item .optimized-image-container {
		min-height: 200px; /* Minimum height to show skeleton */
		background: #f8fafc;
		border-radius: 8px;
	}

	.masonry-item .optimized-image-container.dark {
		background: #1e293b;
	}

	/* List view image containers */
	.masonry-item td .optimized-image-container {
		min-height: 48px;
		width: 48px;
		height: 48px;
	}

	/* Selection states */
	.masonry-item.selected {
		box-shadow: 0 0 0 4px rgb(59 130 246), 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
		border: 2px solid rgb(59 130 246);
	}

	.masonry-item:not(.selected):not(.opacity-50):hover {
		box-shadow: 0 0 0 2px rgb(147 197 253 / 0.5), 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
	}

	.masonry-item.ring-4 {
		box-shadow: 0 0 0 4px rgb(59 130 246 / 0.5), 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
	}

	/* Ensure selection indicators are always visible */
	.selection-indicator {
		pointer-events: none;
	}

	/* Make sure the selected state is very obvious */
	.masonry-item.ring-4 .selection-indicator {
		box-shadow: 0 4px 14px 0 rgb(0 0 0 / 0.25);
	}
</style>
