<script>
    import { writable } from 'svelte/store';
    import Modal from '$lib/Modal.svelte';
    import EditableCollectionTable from '$lib/EditableCollectionTable.svelte';
    import EditableArtistTable from '$lib/EditableArtistTable.svelte';
    import { intersectionObserver } from '$lib/intersectionObserver';

    let walletAddress = writable('');
    let nftType = writable('collected');
    let nfts = writable([]);
    let isLoading = writable(false);
    let isModalOpen = writable(false);
    let selectedNfts = writable(new Set());
    let selectAllChecked = writable(false);
    let reviewData = writable({ collections: [], artists: [] });

    async function openReviewModal() {
        const selectedIndices = Array.from($selectedNfts);
        const collectionSlugs = selectedIndices.map(index => $nfts[index].collection);

        isLoading.set(true);

        try {
            const response = await fetch('/api/admin/nft-data/ethereum', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ collections: collectionSlugs }),
            });

			console.log(collectionSlugs);

            if (!response.ok) throw new Error('Failed to fetch collection and artist data');
            const { data } = await response.json();

			console.log(data);

            // Assuming the API returns the data in the format you've shown
            let collections = [];
            let artists = [];
            data.forEach(item => {
                if (!collections.some(c => c.collection === item.collection.collection)) {
                    collections.push(item.collection);
                }
                if (!artists.some(a => a.address === item.artist.address)) {
                    artists.push(item.artist);
                }
            });

            reviewData.set({ collections, artists });
			console.log($reviewData.artists);
            isModalOpen.set(true);
        } catch (error) {
            console.error('Error opening review modal:', error);
        } finally {
            isLoading.set(false);
        }
    }

    async function finalizeImport() {
        // Extract the updated collection and artist data
        const { collections, artists } = $reviewData;
        const updatedNfts = $selectedNfts.map(index => {
            const nft = $nfts[index];
            // Find the updated collection and artist based on a matching property, e.g., collection slug or artist address
            const updatedCollection = collections.find(c => c.collection === nft.collectionSlug);
            const updatedArtist = artists.find(a => a.address === nft.artist.address);

            return { ...nft, collection: updatedCollection, artist: updatedArtist };
        });

        try {
            const response = await fetch('/api/admin/import/eth/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nfts: updatedNfts }),
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Import success:', result);
                selectedNfts.set(new Set());
                isModalOpen.set(false);
            } else {
                console.error('Failed to import NFTs');
            }
        } catch (error) {
            console.error('Error finalizing import:', error);
        }
    }

	const loadingImageUrl = '/images/loading.png';

	function handleLazyLoad(node, { src }) {
		node.src = loadingImageUrl;

		const onEnter = () => {
			const img = new Image();
			img.src = src;
			img.onload = () => {
				node.src = src;
			};
		};

		const onLeave = () => {
			node.src = loadingImageUrl;
		};

		intersectionObserver(node, { onEnter, onLeave });
	}

	function toggleSelection(index) {
		selectedNfts.update((current) => {
			const newSet = new Set(current);
			if (newSet.has(index)) {
				newSet.delete(index);
			} else {
				newSet.add(index);
			}
			selectAllChecked.set(newSet.size === $nfts.length);
			return newSet;
		});
	}

	function toggleSelectAll(event) {
		const isChecked = event.target.checked;
		selectAllChecked.set(isChecked);
		if (isChecked) {
			selectedNfts.set(new Set($nfts.map((_, index) => index)));
		} else {
			selectedNfts.set(new Set());
		}
	}

	async function fetchNfts() {
		isLoading.set(true);
		selectAllChecked.set(false);
		selectedNfts.set(new Set());
		const wallet = $walletAddress;
		if (wallet.length > 0) {
			const type = $nftType;
			try {
				const response = await fetch(`/api/admin/import/eth/${wallet}/?type=${type}`);
				if (response.ok) {
					const data = await response.json();
					nfts.set(data.nfts);
				} else {
					console.error('Failed to fetch NFTs');
				}
			} catch (error) {
				console.error('Error fetching NFTs:', error);
			} finally {
				isLoading.set(false);
			}
		}
	}

	async function importArtworks() {
		openReviewModal();
	}

	function handleCollectionSave(editedCollection, index) {
		reviewData.update(($reviewData) => {
			$reviewData.collections[index] = editedCollection;
			return $reviewData;
		});
	}

	function handleArtistSave(editedArtist, index) {
		reviewData.update(($reviewData) => {
			$reviewData.artists[index] = editedArtist;
			return $reviewData;
		});
	}
</script>

<svelte:head>
	<title>Import NFTs</title>
</svelte:head>

<h1>Import NFTs</h1>

<p class="subheading">Enter your wallet address to fetch and import NFTs into your Compendium.</p>

<div>
	<div class="flex mb-8 gap-2">
		<select class="flex-shrink w-auto mb-0 px-4" bind:value={$nftType} on:change={fetchNfts}>
			<option value="collected">Collected</option>
			<option value="created">Created</option>
		</select>

		<input
			class="search flex-grow"
			type="text"
			bind:value={$walletAddress}
			placeholder="Wallet Address"
		/>
		<button class="primary button flex-shrink mt-0" on:click={fetchNfts}>Fetch NFTs</button>
	</div>

	<div class="relative">
		{#if $nfts.length > 0}
			<div class="selection-header">
				<div class="pr-3 mr-3 h-full whitespace-nowrap border-r border-gray-400">
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
				<button class="cta button" on:click={importArtworks} disabled={$selectedNfts.size === 0}>
					Import {$selectedNfts.size} Selected
				</button>
			</div>

			<div class="nft-gallery">
				{#if $isLoading}
					<p>Loading NFTs...</p>
				{:else}
					{#each $nfts as { image_url, name }, index}
						<div
							class="nft-card {$selectedNfts.has(index) ? 'selected' : ''}"
							on:click={() => toggleSelection(index)}
						>
							<img use:handleLazyLoad={{ src: image_url }} alt={name} class="nft-image" />
							<div class="inner-container">
								<h3>{name}</h3>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	{#if $isModalOpen}
		<Modal onClose={() => isModalOpen.set(false)}>
			<h2>Review and Edit Collections</h2>
			<EditableCollectionTable items={$reviewData.collections} onSave={handleCollectionSave} />

			<h2>Review and Edit Artists</h2>
			<EditableArtistTable items={$reviewData.artists} onSave={handleArtistSave} />

			<button on:click={finalizeImport}>Finalize Import</button>
		</Modal>
	{/if}
</div>

<style lang="scss">
	.nft-gallery {
		@apply grid gap-4 grid-cols-6 p-6 border-l border-r border-b border-gray-200 bg-white rounded-b-sm;
	}

	.nft-card {
		@apply relative outline outline-gray-200 outline-2 outline-offset-0 rounded-sm cursor-pointer transition-all relative;

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

		img {
			@apply w-full rounded-t-sm mb-1 aspect-square object-contain text-center bg-gray-200;
		}

		h3 {
			@apply text-[15px] font-normal my-0 leading-normal;
		}
	}

	.selection-header {
		@apply flex sticky top-0 bg-white py-2 items-center justify-between z-20 px-4 mb-0 rounded-t-md border border-gray-200;

		label {
			@apply font-normal;
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
