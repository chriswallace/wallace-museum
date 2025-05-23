<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { isModalOpen } from '$lib/stores';
	import { browser } from '$app/environment';
	import { showToast } from '$lib/toastHelper';
	import Modal from '$lib/components/Modal.svelte';
	import { goto } from '$app/navigation';
	import { closeModal, openModal } from '$lib/modal';
	import { getCloudinaryTransformedUrl } from '$lib/cloudinaryUtils';

	// Define a basic Artwork type (adjust properties as needed based on actual data)
	interface Artwork {
		id: number | string;
		title?: string;
		image_url?: string;
		mime?: string;
		// Add other properties returned by your API
	}

	// Define type for the collection state
	interface Collection {
		title: string;
		description: string;
		curatorNotes: string;
		slug: string;
		enabled: boolean;
		artworks: Artwork[];
	}

	let collectionId: string;
	let searchQuery = '';
	let searchResults: Artwork[] = []; // Use Artwork type
	let isLoading = true;
	let activeTab: 'artworks' | 'details' = 'artworks'; // Type for tabs

	$: $page, (collectionId = $page.params.collectionId);

	let collection: Collection = {
		title: '',
		description: '',
		curatorNotes: '',
		slug: '',
		enabled: false,
		artworks: []
	};

	let selectedArtworks = new Set<number | string>(); // Specify Set type

	$: selectedArtworksArray = Array.from(selectedArtworks); // Reactive conversion to array for reactivity and iteration

	// Assuming Modal is already imported and set up for dynamic content
	let confirmationModalOpen = false;
	let confirmationPromiseResolve: (value: boolean | PromiseLike<boolean>) => void;

	function confirmAction(message: string): Promise<boolean> {
		// Type message and return
		return new Promise((resolve) => {
			confirmationModalOpen = true;
			// This function will be called with true or false when the user responds
			confirmationPromiseResolve = resolve;
		});
	}

	async function confirmRemoval(artworkToRemove: Artwork) {
		// Type artworkToRemove
		const confirmed = await confirmAction(
			'Are you sure you want to remove this artwork from the collection?'
		);
		if (confirmed) {
			removeArtworkFromCollection(artworkToRemove);
		} else {
			confirmationModalOpen = false;
			return;
		}
	}

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
		goto(`/admin/artworks/new?cID=${collectionId}`);
	}

	function openAddExistingArtworkModal() {
		openModal();
		searchResults = [];
	}

	async function removeArtworkFromCollection(artworkToRemove: Artwork) {
		// Type artworkToRemove
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
			searchResults = data; // Assumes API returns Artwork[]
		} else {
			showToast('Failed to search artworks', 'error');
		}
	}

	function toggleArtworkSelection(artworkId: number | string) {
		// Type artworkId
		if (selectedArtworks.has(artworkId)) {
			selectedArtworks.delete(artworkId);
		} else {
			selectedArtworks.add(artworkId);
		}
		selectedArtworks = new Set(selectedArtworks); // Trigger reactivity
	}

	async function addSelectedArtworksToCollection() {
		if (selectedArtworks.size === 0) {
			showToast('No artworks selected', 'error');
			return;
		}

		const response = await fetch(`/api/admin/collections/${collectionId}/artworks/add`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ collectionId: collectionId, artworkIds: Array.from(selectedArtworks) }) // Convert Set to Array
		});

		if (response.ok) {
			showToast('Artworks added to collection', 'success');
			selectedArtworks.clear(); // Clear selection after successful addition
			closeModal();
			fetchCollection();
		} else {
			showToast('Failed to add artworks to collection', 'error');
		}
	}

	async function deleteCollection() {
		const confirmed = await confirmAction('Are you sure you want to delete this collection?');
		if (confirmed) {
			const deleteUrl = `/api/admin/collections/${collectionId}/`;
			const response = await fetch(deleteUrl, {
				method: 'DELETE'
			});

			if (response.ok) {
				showToast('Collection deleted', 'success');
				goto('/admin/collections');
			} else {
				showToast('Failed to delete collection', 'error');
			}
		}
	}

	onMount(() => {
		if (browser) {
			fetchCollection();
		}
	});

	function switchTab(tab: 'artworks' | 'details') {
		// Type tab
		activeTab = tab;
	}

	// Create a reactive title variable
	$: pageTitle = collection.title
		? `Edit ${collection.title} | Wallace Museum Admin`
		: 'Edit Collection | Wallace Museum Admin';
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

{#if confirmationModalOpen}
	<Modal title="Confirm Action" width="500px" onClose={closeModal}>
		<div class="w-[440px]">
			<p class="mb-4">Are you sure you want to remove this artwork?</p>
			<div class="modal-actions">
				<button
					class="delete button cta"
					on:click={() => {
						confirmationModalOpen = false;
						confirmationPromiseResolve(true);
					}}>Yes, remove it</button
				>
				<button
					class="button cta"
					on:click={() => {
						confirmationModalOpen = false;
						confirmationPromiseResolve(false);
					}}>No, keep it</button
				>
			</div>
		</div>
	</Modal>
{/if}
{#if $isModalOpen}
	<Modal title="Add existing artwork" width="75%" onClose={closeModal}>
		<div class="w-full">
			<div class="flex">
				<input
					type="text"
					class="flex-grow mb-0 border border-gray-400 border-r-0"
					placeholder="Search artwork"
					bind:value={searchQuery}
					on:keypress={(e) => e.key === 'Enter' && searchExistingArtworks()}
				/>
				<button class="primary mt-0" on:click={searchExistingArtworks}>Search</button>
			</div>
			<div class="search-grid">
				{#each searchResults as artwork}
					<button
						class="card"
						class:active={selectedArtworks.has(artwork.id)}
						on:click={() => toggleArtworkSelection(artwork.id)}
					>
						{#if artwork.mime?.startsWith('video') || artwork.image_url?.endsWith('.mp4')}
							<video width="204" height="204" loop muted playsinline>
								<source src={artwork.image_url} type="video/mp4" />
							</video>
						{:else}
							<img
								src={getCloudinaryTransformedUrl(
									artwork.image_url,
									'w_400,h_400,c_pad,q_auto,f_auto,b_rgb:e9e9e9'
								)}
								alt={artwork.title || 'Artwork thumbnail'}
							/>
						{/if}
						<p>{artwork.title}</p>
						{#if selectedArtworks.has(artwork.id)}
							<div class="selected-indicator">Selected</div>
						{/if}
					</button>
				{/each}
			</div>
			<div class="well">
				{#if selectedArtworks.size > 0}
					<button class="primary" on:click={addSelectedArtworksToCollection}>
						Add Selected Artworks
					</button>
				{/if}
			</div>
		</div>
	</Modal>
{/if}

<div class="max-w-7xl mx-auto">
	{#if isLoading}
		<p>Loading...</p>
	{:else}
		<div>
			<a class="back-btn" href="/admin/collections">&lt; Back to Collections</a>
		</div>

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
							{#if artwork.mime?.startsWith('video') || artwork.image_url?.endsWith('.mp4')}
								<video width="204" height="204" loop muted playsinline>
									<source src={artwork.image_url} type="video/mp4" />
								</video>
							{:else}
								<img
									src={getCloudinaryTransformedUrl(
										artwork.image_url,
										'w_204,h_204,c_fit,q_auto,f_auto'
									)}
									alt={artwork.title || 'Artwork thumbnail'}
								/>
							{/if}
							<h3>{artwork.title}</h3>
							<button class="remove" on:click={() => confirmRemoval(artwork)}>
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
									/>
								</svg>
							</button>
						</div>
					{/each}
					<div class="fieldset add-artwork">
						<div class="add-artwork-buttons">
							<button class="primary w-full mb-4" on:click={navigateToAddArtwork}>Add new</button>
							<button class="secondary w-full" on:click={openAddExistingArtworkModal}
								>Add existing</button
							>
						</div>
					</div>
				</div>
			</div>
		{:else if activeTab === 'details'}
			<div class="details-tab">
				<form on:submit|preventDefault={updateCollection}>
					<div class="mb-4">
						<label for="title">Title</label>
						<input type="text" id="title" bind:value={collection.title} />
					</div>
					<div class="mb-4">
						<label for="description">Description</label>
						<textarea id="description" bind:value={collection.description}></textarea>
					</div>
					<div class="mb-4">
						<label for="curator-notes">Curator notes</label>
						<textarea id="curator-notes" bind:value={collection.curatorNotes}></textarea>
					</div>
					<div class="mb-4">
						<input
							type="checkbox"
							id="enabled"
							class="mr-2 inline w-auto"
							bind:checked={collection.enabled}
						/>
						<label for="enabled" class="inline">Enabled</label>
					</div>
					<div class="flex justify-between mt-8">
						<button class="destructive" type="button" on:click={deleteCollection}>Delete</button>
						<button class="primary" type="submit">Save</button>
					</div>
				</form>
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	h3 {
		@apply text-lg font-semibold mb-3;
	}

	.button-split {
		@apply flex gap-4;

		button {
			@apply w-full;
		}
	}

	.add-artwork {
		@apply grid grid-cols-1 content-center text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-sm p-8 aspect-square;
	}

	.search-grid {
		@apply grid grid-cols-4 gap-4 w-full max-h-[60vh] overflow-y-scroll mt-8 items-start justify-start;

		.card {
			@apply p-0 rounded-[8px];

			img,
			video {
				@apply w-full aspect-square object-contain rounded-t-[8px];
			}
		}

		p {
			@apply py-3 truncate;
		}

		.active {
			@apply border-2 border-primary relative;

			p {
				@apply p-3;
			}
		}
	}

	.well {
		@apply mt-8 text-right;
	}

	.delete {
		@apply bg-red-500 text-white;
	}

	.artwork-grid {
		@apply grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4;

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
