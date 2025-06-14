<svelte:head>
	<title>Import NFTs | Wallace Museum Admin</title>
</svelte:head>

<script lang="ts">
	import { nfts, isLoading, walletAddress, isModalOpen } from '$lib/stores';
	import type { Artwork } from '$lib/stores';

	import WalletAddressManager from '$lib/components/WalletAddressManager.svelte';
	import ImportArtworkCard from '$lib/components/ImportArtworkCard.svelte';
	import ImportArtworkGrid from '$lib/components/ImportArtworkGrid.svelte';
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
		// Add MIME type for proper media detection
		mime?: string | null;
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
	// Add tab state for filtering
	let activeTab: 'owned' | 'created' = 'owned'; // Changed from 'all' to default to 'owned'

	// Debug mode for skeleton loading
	let debugSkeletonMode = false;
	let showDebugControls = true;

	// Debounced search functionality
	let searchTimeout: NodeJS.Timeout;
	const SEARCH_DEBOUNCE_MS = 300; // 300ms debounce delay
	let isMounted = false;

	// Reactive statement for typeahead search
	$: if (isMounted && searchTerm !== undefined) {
		// Clear existing timeout
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
		
		// Set new timeout for debounced search
		searchTimeout = setTimeout(() => {
			searchArtworks(true);
		}, SEARCH_DEBOUNCE_MS);
	}

	// Reactive statement for tab changes (immediate search, no debounce needed)
	let previousActiveTab: 'owned' | 'created' = activeTab;
	$: if (isMounted && activeTab !== previousActiveTab) {
		previousActiveTab = activeTab;
		// Clear any pending search timeout since tab change should be immediate
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
		// Trigger immediate search when tab changes
		searchArtworks(true);
	}

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
	async function searchArtworks(reset = false) {
		// Don't clear results immediately on reset to prevent interface flashing
		if (reset) {
			currentOffset = 0;
			// Only clear results after new ones are loaded
		}

		isSearching = true;

		try {
			const params = new URLSearchParams({
				q: searchTerm,
				limit: '48',
				offset: reset ? '0' : currentOffset.toString(),
				type: activeTab // Use the new type parameter
			});

			const response = await fetch(`/api/admin/search?${params}`);
			const data = await response.json();

			if (data.error) {
				console.error('Search error:', data.error);
				return;
			}

			const newResults = data.results || [];
			
			// Detect MIME types for the new results to properly display videos vs images
			if (newResults.length > 0) {
				try {
					const mimeResponse = await fetch('/api/admin/detect-mime', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							artworks: newResults.map((artwork: ExtendedArtwork) => ({
								id: artwork.id,
								image_url: artwork.image_url,
								animation_url: artwork.animation_url,
								thumbnailUrl: artwork.thumbnailUrl
							}))
						})
					});

					if (mimeResponse.ok) {
						const mimeData = await mimeResponse.json();
						const mimeMap = new Map(mimeData.results.map((result: any) => [result.id, result.mime]));
						
						// Update the results with detected MIME types by creating new objects
						for (let i = 0; i < newResults.length; i++) {
							const artwork = newResults[i];
							const detectedMime = mimeMap.get(artwork.id);
							if (detectedMime) {
								newResults[i] = { ...artwork, mime: detectedMime };
							}
						}
					}
				} catch (mimeError) {
					console.warn('Failed to detect MIME types:', mimeError);
					// Continue without MIME types - the UI will fall back to URL-based detection
				}
			}

			if (reset) {
				searchResults = newResults;
			} else {
				searchResults = [...searchResults, ...newResults];
			}

			totalResults = data.total || 0;
			hasMore = searchResults.length < totalResults;
			currentOffset = reset ? newResults.length : currentOffset + newResults.length;
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

	// Helper function to create unique key from contract address and token ID
	function createUniqueKey(artwork: ExtendedArtwork): string {
		return `${artwork.contractAddr || 'unknown'}-${artwork.tokenID || artwork.id}`;
	}

	// Helper function to deduplicate artworks by contract address + token ID
	function deduplicateArtworks(artworks: ExtendedArtwork[]): ExtendedArtwork[] {
		const seen = new Set<string>();
		return artworks.filter(artwork => {
			const key = createUniqueKey(artwork);
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
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

			await finalizeImport(selectedArtworks as Artwork[]);

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
		// Initial search on page load
		searchArtworks(true);
		
		// Set up intersection observer for infinite scroll
		if (loadMoreTrigger) {
			observer = new IntersectionObserver(
				(entries) => {
					if (entries[0].isIntersecting && hasMore && !isSearching) {
						searchArtworks(false); // Load more without reset
					}
				},
				{ threshold: 0.1 }
			);
			observer.observe(loadMoreTrigger);
		}

		// Enable reactive statements after initial mount
		isMounted = true;

		return () => {
			if (observer) {
				observer.disconnect();
			}
			// Clean up search timeout
			if (searchTimeout) {
				clearTimeout(searchTimeout);
			}
		};
	});

	// Update observer when results or hasMore changes
	$: if (loadMoreTrigger && hasMore) {
		setupIntersectionObserver();
	}

	// Update selectAll status when selection changes
	$: selectAll = searchResults.length > 0 && selectedIds.length === searchResults.length;

	// Artist data is now included in search results from indexing - no need to fetch separately

	// Handle tab change
	function handleTabChange(newTab: 'owned' | 'created') {
		if (newTab !== activeTab) {
			activeTab = newTab;
			// Search is now handled by reactive statement
		}
	}

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
						class="save button py-2 px-4"
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
					on:keydown={(e) => e.key === 'Enter' && searchArtworks(true)}
				/>
			</div>
		</div>
		<div class="flex gap-2 md:gap-4 items-end">
			<button
				class="primary button py-2 px-6 h-11"
				on:click={() => searchArtworks(true)}
				disabled={isSearching}>{isSearching ? 'Searching...' : 'Search'}</button
			>
		</div>
	</div>

	<!-- Filter Tabs -->
	<div class="bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
		<div class="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
			<button
				class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors {activeTab === 'owned'
					? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
					: 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}"
				on:click={() => handleTabChange('owned')}
			>
				Owned by Me
			</button>
			<button
				class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors {activeTab === 'created'
					? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
					: 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}"
				on:click={() => handleTabChange('created')}
			>
				Created by Me
			</button>
		</div>
		<div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			{#if activeTab === 'owned'}
				Showing NFTs owned by your wallet addresses (excluding those you created)
			{:else if activeTab === 'created'}
				Showing NFTs where the creator address matches one of your wallet addresses
			{/if}
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
			<ImportArtworkGrid
				artworks={searchResults}
				selectedIds={$selectedIdsStore}
				onToggleSelection={toggleSelection}
				{canSelect}
				{debugSkeletonMode}
				{viewMode}
				{selectAllChecked}
				onToggleSelectAll={toggleSelectAll}
												/>

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
					class="save button py-2 px-6 text-lg"
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
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid rgb(209 213 219);
		border-radius: 0.375rem;
	}

	@media (prefers-color-scheme: dark) {
		.checkbox {
			border-color: rgb(75 85 99);
		}
	}

	.checkbox:checked {
		background-color: rgb(59 130 246);
		border-color: rgb(59 130 246);
	}
</style>
