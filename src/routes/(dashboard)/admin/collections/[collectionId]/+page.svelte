<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { showToast } from '$lib/toastHelper';
	import Modal from '$lib/Modal.svelte';
	import { goto } from '$app/navigation';

	let collectionId;
	let isModalOpen = false;
	let searchQuery = '';
	let searchResults = [];
	let isLoading = true;
	let activeTab = 'artworks';

	$: $page, (collectionId = $page.params.collectionId);

	let collection = {
		title: '',
		description: '',
		slug: '',
		enabled: false,
		artworks: []
	};

	async function fetchCollection() {
		try {
			const response = await fetch(`/api/admin/collections/${collectionId}`);
			if (response.ok) {
				collection = await response.json();
			} else {
				showToast('Failed to fetch collection', 'error');
			}
		} catch (e) {
			showToast('Error fetching collection', 'error');
		} finally {
			isLoading = false;
		}
	}

	async function updateCollection() {
		const response = await fetch(`/api/admin/collections/${collectionId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(collection)
		});

		if (response.ok) {
			showToast('Collection updated', 'success');
		} else {
			showToast('Failed to update collection', 'error');
		}
	}

	function navigateToAddArtwork() {
		goto(`/admin/artworks/add?collectionId=${collectionId}`);
	}

	function openAddExistingArtworkModal() {
		isModalOpen = true;
		searchResults = [];
	}

	async function removeArtworkFromCollection(artworkToRemove) {
		try {
			// Call your API to remove the artwork from the collection
			const response = await fetch(
				`/api/admin/collections/${collectionId}/artworks/${artworkToRemove.id}`,
				{
					method: 'DELETE'
				}
			);

			if (response.ok) {
				// Remove the artwork from the local collection's artworks array
				collection.artworks = collection.artworks.filter(
					(artwork) => artwork.id !== artworkToRemove.id
				);
				showToast('Artwork removed from collection', 'success');
			} else {
				showToast('Failed to remove artwork from collection', 'error');
			}
		} catch (error) {
			console.error('Error removing artwork from collection:', error);
			showToast('Error removing artwork from collection', 'error');
		}
	}

	async function searchExistingArtworks() {
		const response = await fetch(
			`/api/admin/artworks/search?query=${encodeURIComponent(searchQuery)}`
		);
		if (response.ok) {
			const data = await response.json();
			searchResults = data.artworks;
		} else {
			showToast('Failed to search artworks', 'error');
		}
	}

	function addSelectedArtwork(artwork) {
		// Add logic to update collection with selected artwork
		isModalOpen = false;
	}

	onMount(() => {
		if (browser) {
			fetchCollection();
		}
	});

	function switchTab(tab) {
		activeTab = tab;
	}
</script>

<title>Edit {collection.title}</title>

{#if isModalOpen}
	<Modal onClose={() => (isModalOpen = false)}>
		<h2>Add Existing Artwork</h2>
		<input type="text" placeholder="Search artwork" bind:value={searchQuery} />
		<button on:click={searchExistingArtworks}>Search</button>
		{#each searchResults as artwork}
			<div on:click={() => addSelectedArtwork(artwork)}>
				<img src={artwork.image} alt={artwork.title} />
				<p>{artwork.title}</p>
			</div>
		{/each}
	</Modal>
{/if}

<div class="container">
	{#if isLoading}
		<p>Loading...</p>
	{:else}
		<a class="back-btn" href="/admin/collections">&lt; Back to Collections</a>
		<h1>Edit {collection.title}</h1>

		<div class="tabs">
			<button on:click={() => switchTab('artworks')} class:active={activeTab === 'artworks'}
				>Artworks</button
			>
			<button on:click={() => switchTab('details')} class:active={activeTab === 'details'}
				>Collection Details</button
			>
		</div>

		{#if activeTab === 'artworks'}
			<div class="artworks-tab">
				<div class="artwork-grid">
					{#each collection.artworks as artwork}
						<div>
							<img src="{artwork.image}?tr=w-400,h-400,q-70,cm-pad_resize,bg-e9e9e9" alt="" />
							<h3>{artwork.title}</h3>
							<button class="remove" on:click={() => removeArtworkFromCollection(artwork)}>
								<svg
									fill="none"
									height="15"
									viewBox="0 0 15 15"
									width="15"
									xmlns="http://www.w3.org/2000/svg"
									><path
										clip-rule="evenodd"
										d="M6.79289 7.49998L4.14645 4.85353L4.85355 4.14642L7.5 6.79287L10.1464 4.14642L10.8536 4.85353L8.20711 7.49998L10.8536 10.1464L10.1464 10.8535L7.5 8.20708L4.85355 10.8535L4.14645 10.1464L6.79289 7.49998Z"
										fill="black"
										fill-rule="evenodd"
									/></svg
								>
							</button>
						</div>
					{/each}
					<div class="fieldset add-artwork">
						<div class="add-artwork-buttons">
							<button class="cta" on:click={navigateToAddArtwork}>Add new</button>
							<button class="cta" on:click={openAddExistingArtworkModal}>Add existing</button>
						</div>
					</div>
				</div>
			</div>
		{:else if activeTab === 'details'}
			<div class="details-tab">
				<form on:submit|preventDefault={updateCollection}>
					<div>
						<label for="title">Title</label>
						<input type="text" id="title" bind:value={collection.title} />
					</div>
					<div>
						<label for="description">Description</label>
						<textarea id="description" bind:value={collection.description}></textarea>
					</div>
					<div>
						<label for="curator-notes">Curator notes</label>
						<textarea id="curator-notes" bind:value={collection.curatorNotes}></textarea>
					</div>
					<div>
						<input type="checkbox" id="enabled" bind:checked={collection.enabled} />
						<label for="enabled">Enabled</label>
					</div>
					<div class="button-split">
						<button class="cta" type="submit">Save Collection</button>
						<button class="cta delete" type="submit">Delete Collection</button>
					</div>
				</form>
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	.container {
		@apply max-w-7xl mx-auto;
	}

	h2 {
		@apply mb-8;
	}

	h3 {
		@apply text-lg font-semibold mb-3;
	}

	.collection-edit-grid {
		@apply grid grid-cols-2 gap-8;
	}

	input[type='checkbox'] {
		@apply mr-2 inline w-auto;
	}

	input[type='checkbox'] + label {
		@apply inline;
	}

	.button-split {
		@apply flex gap-4;
	}

	.add-artwork {
		@apply grid grid-cols-1 content-center text-center border-2 border-dashed border-gray-300 rounded-sm p-8 aspect-square;

		h3 {
			@apply mb-6;
		}
	}

	.delete {
		@apply bg-red-500;
	}

	.artwork-grid {
		@apply grid grid-cols-3 gap-4;

		& > div {
			@apply mb-8 relative;
		}

		.remove {
			@apply absolute top-[-8px] right-[-8px] bg-red-500 rounded-full p-1;

			svg {
				@apply w-[20px] h-[20px];
			}
			path {
				@apply fill-white;
			}
		}

		img {
			@apply w-full aspect-square mb-3 rounded-md;
		}
	}

	.tabs {
		@apply flex mb-8;
	}

	.tabs button {
		@apply border-b-2 py-2 px-4 mr-4;
	}

	.tabs button.active {
		@apply border-primary;
	}

	.details-tab form {
		@apply max-w-4xl block;
	}
</style>
