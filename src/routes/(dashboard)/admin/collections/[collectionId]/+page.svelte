<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { isModalOpen } from '$lib/stores';
	import { browser } from '$app/environment';
	import { showToast } from '$lib/toastHelper';
	import Modal from '$lib/components/Modal.svelte';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtworkCard from '$lib/components/ArtworkCard.svelte';
	import CollectionArtworkGrid from '$lib/components/CollectionArtworkGrid.svelte';
	import { goto } from '$app/navigation';
	import { closeModal, openModal } from '$lib/modal';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';

	// Get artists from server load
	export let data;
	let artists = data.artists || [];
	let selectedArtistIds: number[] = [];

	// Define a basic Artwork type (adjust properties as needed based on actual data)
	interface Artwork {
		id: number | string;
		title?: string;
		imageUrl?: string;
		mime?: string;
		// Add other properties returned by your API
	}

	// Define type for artist
	interface Artist {
		id: number;
		name: string;
	}

	// Define type for the collection state
	interface Collection {
		title: string;
		description: string;
		curatorNotes: string;
		slug: string;
		enabled: boolean;
		artworks: Artwork[];
		artists?: Artist[];
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
				// Pre-select associated artists
				selectedArtistIds = (collection.artists || []).map((a) => a.id);
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
		const payload = {
			...collection,
			artistIds: selectedArtistIds
		};
		const response = await fetch(`/api/admin/collections/${collectionId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
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
			<CollectionArtworkGrid
				artworks={searchResults}
				variant="search"
				{selectedArtworks}
				onToggleSelection={toggleArtworkSelection}
			/>
			<div class="well">
				{#if selectedArtworks.size > 0}
					<button class="save" on:click={addSelectedArtworksToCollection}>
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

		<div class="admin-header">
			<h1>Edit {collection.title}</h1>
		</div>

		<div class="tabs">
			<div class="flex border-b border-gray-200 dark:border-gray-700">
				<button 
					class="px-6 py-3 text-sm font-medium transition-colors border-b-2 {activeTab === 'artworks'
						? 'border-yellow-400 text-gray-900 dark:text-yellow-400'
						: 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-yellow-300'}"
					on:click={() => switchTab('artworks')}
				>
					Artworks
				</button>
				<button 
					class="px-6 py-3 text-sm font-medium transition-colors border-b-2 {activeTab === 'details'
						? 'border-yellow-400 text-gray-900 dark:text-yellow-400'
						: 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-yellow-300'}"
					on:click={() => switchTab('details')}
				>
					Collection Details
				</button>
			</div>
		</div>

		{#if activeTab === 'artworks'}
			<div class="artworks-tab mt-8">
				<CollectionArtworkGrid
					artworks={collection.artworks}
					variant="collection"
					showRemoveButtons={true}
					onRemove={confirmRemoval}
					showAddCard={true}
					onAddNew={navigateToAddArtwork}
					onAddExisting={openAddExistingArtworkModal}
				/>
			</div>
		{:else if activeTab === 'details'}
			<div class="details-tab mt-8">
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
						<label for="artists">Artists</label>
						<select id="artists" multiple bind:value={selectedArtistIds}>
							{#each artists as artist}
								<option value={artist.id}>{artist.name}</option>
							{/each}
						</select>
						<small class="text-gray-600 dark:text-gray-400 block mt-1">
							Hold Command/Ctrl to select multiple artists.
						</small>
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
						<button class="save" type="submit">Save</button>
					</div>
				</form>
			</div>
		{/if}
	{/if}
</div>

<style lang="scss">
	.button-split {
		@apply flex gap-4;

		button {
			@apply w-full;
		}
	}

	.well {
		@apply mt-8 text-right;
	}

	.delete {
		@apply bg-red-600 text-white hover:bg-red-700 transition-colors;
	}

	.tabs {
		@apply mb-6;
	}

	.details-tab form {
		@apply max-w-4xl block;
	}

	// Modal button overrides to ensure proper padding
	:global(.modal) {
		button.primary,
		button.save {
			@apply px-4 py-2 text-sm;
			min-height: 44px;
		}

		button.primary.mt-0 {
			margin-top: 0;
		}
	}
</style>
