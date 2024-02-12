<script>
	import { writable } from 'svelte/store';
	import Modal from '$lib/Modal.svelte';
	import { intersectionObserver } from '$lib/intersectionObserver';

	let walletAddress = writable('');
	let nftType = writable('collected');
	let nfts = writable([]);
	let isLoading = writable(false);
	let isModalOpen = writable(false);
	let selectedNfts = writable(new Set());
	let selectAllChecked = writable(false);

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
		const selectedIndices = $selectedNfts; // Get the current state of selected NFTs indices
		const selectedNftData = Array.from(selectedIndices).map((index) => $nfts[index]); // Map indices to NFT data

		const response = await fetch('/api/admin/import/eth/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ nfts: selectedNftData }) // Ensure this matches your server-side expectation
		});

		const result = await response.json();
		console.log(result);
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
			<!-- Modal content for adding existing artworks -->
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
