<script lang="ts">
	import {
		nfts,
		isLoading,
		walletAddress,
		nftType,
		selectedNfts,
		updatedNfts,
		reviewData,
		selectAllChecked,
		currentStep,
		isModalOpen,
		type Artwork
	} from '$lib/stores';

	import { closeModal } from '$lib/modal';
	import EditableCollectionTable from '$lib/components/EditableCollectionTable.svelte';
	import FinalImportStep from '$lib/components/FinalImportStep.svelte';

	import {
		finalizeImport,
		nextStep,
		openReviewModal,
		handleCollectionSave
	} from '$lib/importHandler';

	import { intersectionObserver } from '$lib/intersectionObserver';
	import { get } from 'svelte/store';

	// Define a type that's compatible with the Artwork type in the store
	// but has additional properties we need for the NFT importer
	interface ImportNft {
		id: number;
		title: string; // corresponds to name in API response
		description: string;
		image_url?: string; // no null in Artwork
		animation_url?: string; // no null in Artwork
		mime?: string; // no null in Artwork
		// Other Artwork properties...

		// NFT-specific fields not in Artwork
		name?: string; // for backward compatibility
		tokenID?: string;
		platform?: string;
		artist?: {
			address: string;
			username: string;
		};
		tags?: string[];
		website?: string;
		attributes?: any[];
		collection?: {
			name: string;
			contract?: string;
			blockchain: string;
		};
		symbol?: string;
		updated_at?: string;
		is_disabled?: boolean;
		is_nsfw?: boolean;
	}

	let loadingImageUrl = '/images/medici-image.png';

	// Explicitly type nextCursor
	let nextCursor: string | null = null;
	const limit: number = 200;
	let previousWallet: string = '';
	let searchTerm: string = ''; // Add state for search term
	let currentOffset: number = 0; // Add state for Tezos offset
	let hasMorePages: boolean = false; // Track if more pages exist (for Tezos)

	// Add types for handleLazyLoad parameters
	function handleLazyLoad(node: HTMLImageElement, { src }: { src: string }) {
		node.src = loadingImageUrl;

		const onEnter = () => {
			const img = new Image();
			img.src = src;
			img.onload = () => {
				node.src = src;
			};
		};

		// Add empty onLeave function
		intersectionObserver(node, { onEnter, onLeave: () => {} });
	}

	async function fetchNfts(loadMore: boolean = false) {
		isLoading.set(true);
		const wallet = $walletAddress;
		let blockchain = 'opensea';
		const currentSearchTerm = searchTerm; // Capture search term at start of fetch

		if (wallet.length > 0) {
			const type = $nftType;
			if (wallet.startsWith('tz')) {
				blockchain = 'tezos';
			}

			// Reset if not loading more OR if starting a new search
			if (!loadMore) {
				// Reset fully only if not loading more
				nextCursor = null;
				currentOffset = 0;
				hasMorePages = false;
				nfts.set([]);
				selectAllChecked.set(false);
				selectedNfts.set(new Set<number>());
			}

			// Build API endpoint based on blockchain
			let apiEndpoint = `/api/admin/import/${blockchain}/${wallet}/?type=${type}&limit=${limit}`;
			if (blockchain === 'tezos') {
				apiEndpoint += `&offset=${currentOffset}`;
			} else {
				// opensea (or default)
				if (nextCursor && loadMore) {
					apiEndpoint += `&next=${nextCursor}`;
				}
			}
			// Add search term if present
			if (currentSearchTerm) {
				apiEndpoint += `&search=${encodeURIComponent(currentSearchTerm)}`;
			}

			try {
				const response = await fetch(apiEndpoint);
				if (response.ok) {
					// Type the expected API response structure
					const data: {
						success: boolean;
						nfts: any[]; // Use any[] for API response
						next?: string | null; // Optional for OpenSea
						limit?: number; // Optional for Tezos
						offset?: number; // Optional for Tezos
						hasMore?: boolean; // New field from server for Tezos
					} = await response.json();

					// Map API response to compatible Artwork objects
					const mappedNfts = data.nfts.map((nft, idx) => {
						// Create a simpler unique ID using contractAddress_tokenId format
						let uniqueId = '';

						// Get contract address (use fallbacks if not available)
						const contractAddr =
							nft.contract_address ||
							nft.contractAddr ||
							nft.collection?.contract ||
							nft.contract ||
							'unknown';

						// Get token ID (use fallbacks if not available)
						const tokenId = nft.tokenID || nft.token_id || nft.id || idx.toString();

						// Create the unique ID in contractAddress_tokenId format
						uniqueId = `${contractAddr}_${tokenId}`;

						return {
							...nft,
							id: uniqueId,
							title: nft.name || 'Untitled',
							description: nft.description || '',
							image_url: nft.image_url || undefined,
							animation_url: nft.animation_url || undefined
						} as Artwork;
					});

					// Update the store
					nfts.update((current) => {
						const existingIds = new Set(current.map((item) => item.id));
						const newNfts = mappedNfts.filter((nft) => !existingIds.has(nft.id));
						return loadMore ? [...current, ...newNfts] : newNfts;
					});

					// Update pagination state based on blockchain
					if (blockchain === 'tezos') {
						const returnedCount = data.nfts?.length || 0;
						const responseLimit = data.limit || limit; // Use response limit or default

						// Use hasMore flag from server if available, otherwise calculate it
						hasMorePages =
							data.hasMore !== undefined ? data.hasMore : returnedCount >= responseLimit;

						currentOffset = (data.offset ?? currentOffset) + returnedCount;
						nextCursor = null; // Ensure cursor is null for Tezos
					} else {
						// Use nullish coalescing to handle potential undefined
						nextCursor = data.next ?? null;
						hasMorePages = !!nextCursor; // Or simply check if cursor exists
					}
				} else {
					console.error('Failed to fetch NFTs');
					nextCursor = null;
					hasMorePages = false;
				}
			} catch (error) {
				console.error('Error fetching NFTs:', error);
				nextCursor = null;
				hasMorePages = false;
			} finally {
				isLoading.set(false);
			}
		}
	}

	function handleWalletChange() {
		if ($walletAddress !== previousWallet) {
			nfts.set([]);
			nextCursor = null;
			previousWallet = $walletAddress;
			selectAllChecked.set(false);
			selectedNfts.set(new Set<number>());
			searchTerm = ''; // Clear search term on wallet change
			currentOffset = 0; // Reset offset on wallet change
			hasMorePages = false;
		}
	}

	// Add type for toggleSelection index
	function toggleSelection(index: number) {
		selectedNfts.update((current) => {
			const newSet = new Set(current);
			if (newSet.has(index)) {
				newSet.delete(index);
			} else {
				newSet.add(index);
			}
			// Ensure get(nfts) returns Artwork[] before accessing length
			selectAllChecked.set(newSet.size === get(nfts).length);
			return newSet;
		});
	}

	// Add type for toggleSelectAll event
	function toggleSelectAll(event: Event) {
		// Type cast target to HTMLInputElement
		const isChecked = (event.target as HTMLInputElement).checked;
		selectAllChecked.set(isChecked);
		if (isChecked) {
			// Ensure get(nfts) returns Artwork[] before mapping
			selectedNfts.set(new Set(get(nfts).map((_, index) => index)));
		} else {
			selectedNfts.set(new Set<number>()); // Type the Set
		}
	}

	// Separate handler for select change
	function handleTypeChange() {
		searchTerm = ''; // Clear search on type change
		fetchNfts(false);
	}

	function handleFetchClick() {
		// Explicitly trigger fetch, resetting pagination/results
		fetchNfts(false);
	}

	async function handleImportSelected() {
		const allNfts = get(nfts);
		const selectedIndices = Array.from(get(selectedNfts));

		// Map selected NFTs to the format needed for import
		const selectedNftsForImport = selectedIndices.map((index) => {
			const nft = allNfts[index];
			return {
				...nft,
				contractAddr: nft.collection?.contract || nft.contractAddr,
				contractAlias: nft.collection?.name || nft.contractAlias
			};
		});

		// Set the NFTs to be imported
		updatedNfts.set(selectedNftsForImport);

		// Start the import process directly
		await finalizeImport();
	}
</script>

<svelte:head>
	<title>Import NFTs</title>
</svelte:head>

<h1>Import NFTs</h1>

<p class="subheading">Enter your wallet address to fetch and import NFTs into your Compendium.</p>

<div>
	<div class="flex mb-8 gap-2">
		<select class="flex-shrink w-auto mb-0 px-4" bind:value={$nftType} on:change={handleTypeChange}>
			<option value="collected">Collected</option>
			<option value="created">Created</option>
		</select>

		<input
			class="search flex-grow"
			type="text"
			bind:value={$walletAddress}
			placeholder="Wallet Address"
			on:input={handleWalletChange}
		/>
		<input
			class="search flex-grow"
			type="text"
			bind:value={searchTerm}
			placeholder="Search by name..."
		/>
		<button class="primary button flex-shrink mt-0" on:click={handleFetchClick}>Fetch NFTs</button>
	</div>

	<div class="relative">
		{#if $isLoading}
			<img class="loading" src="/images/loading.png" alt="Loading" />
		{:else if $nfts.length > 0}
			<div class="selection-header">
				<div class="number-found">
					<div>
						{$nfts.length} NFTs found
					</div>
					<label>
						<input
							class="inline w-auto"
							type="checkbox"
							bind:checked={$selectAllChecked}
							on:click={toggleSelectAll}
						/>
						Select all
					</label>
				</div>
				<button
					class="primary button"
					on:click={handleImportSelected}
					disabled={$selectedNfts.size === 0}
				>
					Import {$selectedNfts.size} Selected
				</button>
			</div>

			<div class="nft-gallery">
				{#each $nfts as nft, index (nft.id)}
					<button
						class="nft-card {$selectedNfts.has(index) ? 'selected' : ''}"
						on:click={() => toggleSelection(index)}
					>
						{#if nft.image_url && nft.image_url.endsWith('.mp4')}
							<video autoplay playsinline muted loop>
								<source src={nft.image_url} type="video/mp4" />
							</video>
						{:else if nft.animation_url && nft.animation_url.endsWith('mp4')}
							<video autoplay playsinline muted loop>
								<source src={nft.animation_url} type="video/mp4" />
							</video>
						{:else if nft.image_url}
							<img
								use:handleLazyLoad={{ src: nft.image_url }}
								alt={nft.title}
								class="nft-image"
								on:error={(e) => {
									e.target.src = loadingImageUrl;
								}}
							/>
						{:else if nft.animation_url}
							<img
								use:handleLazyLoad={{ src: nft.animation_url }}
								alt={nft.title}
								class="nft-image"
								on:error={(e) => {
									e.target.src = loadingImageUrl;
								}}
							/>
						{:else}
							<div
								class="nft-image bg-gray-200 aspect-square flex items-center text-center justify-center"
							>
								No Image
							</div>
						{/if}
						<div class="inner-container">
							<h3>{nft.title}</h3>
						</div>
					</button>
				{/each}
			</div>

			<div class="load-more-container">
				{#if nextCursor || hasMorePages}
					<button class="secondary button" on:click={() => fetchNfts(true)} disabled={$isLoading}>
						{#if $isLoading}Loading...{:else}Load More{/if}
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if $isModalOpen}
		{#if $currentStep === 1}
			<EditableCollectionTable
				title="Review/edit {$reviewData.collections.length} collections to be imported"
				items={$reviewData.collections}
				onSave={handleCollectionSave}
				onNext={nextStep}
				onClose={closeModal}
			/>
		{:else if $currentStep === 2}
			<FinalImportStep
				title="Review and finalize import"
				nfts={$updatedNfts}
				onCompleteImport={finalizeImport}
				onClose={closeModal}
			/>
		{/if}
	{/if}
</div>

<style lang="scss">
	.loading {
		@apply mx-auto w-[40px] h-[40px] my-16;
	}
	.nft-gallery {
		@apply grid gap-4 grid-cols-6 p-6 border-l border-r border-b border-gray-200 bg-white rounded-b-sm;
	}

	.load-more-container {
		@apply text-center mt-4;

		.button {
			@apply py-2 px-4 bg-blue-500 text-white rounded-md;
		}
	}

	.nft-card {
		@apply relative outline outline-gray-200 outline-2 outline-offset-0 rounded-sm cursor-pointer transition-all relative p-0;

		&:after {
			@apply absolute top-4 right-4 w-[24px] h-[24px] z-10 bg-white rounded-full text-center text-sm;
			content: '';
		}

		&.selected {
			@apply outline outline-primary outline-2 outline-offset-0;

			&:after {
				@apply bg-green-500 text-white;
				content: '\2713';
			}
		}

		&:after {
			@apply absolute top-3 right-3 w-[24px] h-[24px] z-10 bg-white border-transparent border rounded-full;
			content: '';
		}

		.inner-container {
			@apply p-3 pt-2;
		}

		img,
		video {
			@apply w-full rounded-t-sm mb-1 aspect-square object-contain text-center bg-gray-200;
		}

		h3 {
			@apply text-[15px] truncate max-w-full font-normal my-0 leading-normal;
		}
	}

	.selection-header {
		@apply flex sticky top-0 bg-white py-2 items-center justify-between z-20 px-4 mb-0 rounded-t-md border border-gray-200;

		.number-found {
			div {
				@apply inline pr-3 mr-3 h-full whitespace-nowrap border-r border-gray-400;
			}
		}

		label {
			@apply font-normal inline;
		}

		input[type='checkbox'] {
			@apply mb-0 mr-2;
		}

		button {
			@apply py-2 px-4;
		}
	}

	.search {
		@apply mb-0;
	}
</style>
