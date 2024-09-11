<script>
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
		isModalOpen
	} from '$lib/stores';

	import { closeModal } from '$lib/modal';
	import EditableCollectionTable from '$lib/components/EditableCollectionTable.svelte';
	import EditableArtistTable from '$lib/components/EditableArtistTable.svelte';
	import FinalImportStep from '$lib/components/FinalImportStep.svelte';

	import {
		finalizeImport,
		nextStep,
		openReviewModal,
		handleCollectionSave,
		handleArtistSave
	} from '$lib/importHandler';

	import { intersectionObserver } from '$lib/intersectionObserver';
	import { get } from 'svelte/store';

	const loadingImageUrl = '/images/medici-image.png';

	let offset = 0;
	const limit = 250;

	function handleLazyLoad(node, { src }) {
		node.src = loadingImageUrl;

		const onEnter = () => {
			const img = new Image();
			img.src = src;
			img.onload = () => {
				node.src = src;
			};
		};

		intersectionObserver(node, { onEnter });
	}

	async function fetchNfts(loadMore = false) {
		isLoading.set(true);
		const wallet = $walletAddress;
		let blockchain = 'opensea';

		if (wallet.length > 0) {
			const type = $nftType;
			if (wallet.startsWith('tz')) {
				blockchain = 'tezos';
			}
			const apiEndpoint = `/api/admin/import/${blockchain}/${wallet}/?type=${type}&limit=${limit}&offset=${offset}`;

			try {
				const response = await fetch(apiEndpoint);
				if (response.ok) {
					const data = await response.json();

					// If loading more, append to existing items
					if (loadMore) {
						nfts.update((current) => [...current, ...data.nfts]);
					} else {
						nfts.set(data.nfts);
					}

					// Update the offset for the next load
					offset += limit;
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

	function toggleSelection(index) {
		selectedNfts.update((current) => {
			const newSet = new Set(current);
			if (newSet.has(index)) {
				newSet.delete(index);
			} else {
				newSet.add(index);
			}
			selectAllChecked.set(newSet.size === get(nfts).length);
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
					on:click={openReviewModal}
					disabled={$selectedNfts.size === 0}
				>
					Import {$selectedNfts.size} Selected
				</button>
			</div>

			<div class="nft-gallery">
				{#each $nfts as { animation_url, image_url, name, mime }, index}
					<button
						class="nft-card {$selectedNfts.has(index) ? 'selected' : ''}"
						on:click={() => toggleSelection(index)}
					>
						{#if image_url && image_url.endsWith('.mp4')}
							<video autoplay playsinline muted loop>
								<source src={image_url} type="video/mp4" />
							</video>
						{:else if animation_url && animation_url.endsWith('mp4')}
							<video autoplay playsinline muted loop>
								<source src={animation_url} type="video/mp4" />
							</video>
						{:else if image_url}
							<img use:handleLazyLoad={{ src: image_url }} alt={name} class="nft-image" />
						{:else if animation_url}
							<img use:handleLazyLoad={{ src: animation_url }} alt={name} class="nft-image" />
						{:else }
							<div class="nft-image bg-gray-200 aspect-square flex items-center text-center justify-center">No Image</div>
						{/if}
						<div class="inner-container">
							<h3>{name}</h3>
						</div>
					</button>
				{/each}
			</div>

			<div class="load-more-container">
				<button class="secondary button" on:click={() => fetchNfts(true)}>
					Load More
				</button>
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
			<EditableArtistTable
				title="Review/edit {$reviewData.artists.length} artists to be imported"
				items={$reviewData.artists}
				onSave={handleArtistSave}
				onNext={nextStep}
				onClose={closeModal}
			/>
		{:else if $currentStep === 3}
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
