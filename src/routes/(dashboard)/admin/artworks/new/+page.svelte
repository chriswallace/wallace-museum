<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { showToast } from '$lib/toastHelper';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores'; // Import the page store

	interface Artist {
		id: number;
		name: string;
	}

	interface Collection {
		id: number;
		title: string;
	}

	interface Artwork {
		title: string;
		description: string;
		image: string;
		curatorNotes: string;
		artistId: string;
		collectionId: string;
		animation_url?: string;
		mime?: string;
	}

	export let artist: Artist | undefined;

	let artwork: Artwork = {
		title: '',
		description: '',
		image: '',
		curatorNotes: '',
		artistId: '',
		collectionId: '',
		animation_url: '',
		mime: ''
	};

	let artists: Artist[] = [];
	let collections: Collection[] = [];
	let error = '';

	function goBack() {
		history.back();
	}

	async function fetchArtwork() {
		try {
			const [artistsRes, collectionsRes] = await Promise.all([
				fetch('/api/admin/artists'), // Assuming you have an endpoint to fetch artists
				fetch('/api/admin/collections/all') // Assuming you have an endpoint to fetch collections
			]);

			if (artistsRes.ok) {
				artists = await artistsRes.json();
			}

			if (collectionsRes.ok) {
				const collectionsData = await collectionsRes.json();
				collections = collectionsData.collections || collectionsData;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			error = errorMessage;
		}
	}

	async function addArtwork() {
		const formData = new FormData();
		const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

		if (fileInput?.files?.[0]) {
			formData.append('image', fileInput.files[0]);
		}

		formData.append('title', artwork.title);
		formData.append('description', artwork.description);
		formData.append('curatorNotes', artwork.curatorNotes);
		
		// Add animation_url and mime if provided
		if (artwork.animation_url) {
			formData.append('animation_url', artwork.animation_url);
			if (artwork.mime) {
				formData.append('mime', artwork.mime);
			}
		}

		// Append artist and collection IDs or new names
		if (addingNewArtist) {
			formData.append('newArtistName', newArtistName);
		} else {
			formData.append('artistId', artwork.artistId);
		}
		if (addingNewCollection) {
			formData.append('newCollectionTitle', newCollectionTitle);
		} else {
			formData.append('collectionId', artwork.collectionId);
		}

		const response = await fetch('/api/admin/artworks/create', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			const responseData = await response.json();
			showToast('Artwork added successfully', 'success');
			goto(`/admin/artworks/edit/${responseData.id}`);
		} else {
			const { error } = await response.json();
			showToast(error, 'error');
		}
	}

	let addingNewArtist = false;
	let newArtistName = '';

	let addingNewCollection = false;
	let newCollectionTitle = '';

	onMount(() => {
		if (browser) {
			fetchArtwork().then(() => {
				if (collections.length > 0) {
					const collectionId = $page.url.searchParams.get('cID');
					if (collectionId) {
						artwork.collectionId = collectionId;
					}
				}
			});
		}
	});
</script>

<svelte:head>
	<title>Add new artwork</title>
</svelte:head>

<div class="container">
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<div>
			<button class="back-btn" on:click={goBack}>&lt; Back</button>
		</div>
		<h1>Add new artwork</h1>
		<div class="edit-form">
			<div class="artwork">
				<div class="file-uploader">
					<input type="file" name="image" />
					<label for="image">Upload media (JPG, PNG, GIF, MP4 under 25MB)</label>
				</div>
			</div>
			<div>
				<form on:submit|preventDefault={addArtwork}>
					<!-- Artwork Fields -->
					<div>
						<label for="title">Title</label>
						<input type="text" id="title" bind:value={artwork.title} />
					</div>
					<div>
						<label for="description">Description</label>
						<textarea id="description" bind:value={artwork.description}></textarea>
					</div>
					<div>
						<label for="animation_url">Animation URL (Optional)</label>
						<input type="url" id="animation_url" bind:value={artwork.animation_url} />
						<small>URL for animation or interactive content. Will be used if no file is uploaded. MIME type will be auto-detected.</small>
					</div>
					<fieldset>
						<label for="artist">Artist</label>
						{#if addingNewArtist}
							<input
								type="text"
								name="newArtistName"
								bind:value={newArtistName}
								placeholder="Artist Name"
							/>
						{:else}
							<div class="flex gap-4">
								<div style="flex: 1;">
									<select id="artistId" name="artistId" bind:value={artwork.artistId}>
										<option value="">Select Artist</option>
										{#each artists as artist}
											<option value={artist.id}>{artist.name}</option>
										{/each}
									</select>
								</div>
								<div style="flex: none;">
									<button class="cta button primary" on:click={() => (addingNewArtist = true)}>
										Add New
									</button>
								</div>
							</div>
						{/if}
					</fieldset>
					<fieldset>
						<label for="collection">Collection</label>
						{#if addingNewCollection}
							<input
								type="text"
								name="newCollectionTitle"
								bind:value={newCollectionTitle}
								placeholder="Collection Title"
							/>
						{:else}
							<div class="flex gap-4">
								<div style="flex: 1;">
									<select id="collection" name="collectionId" bind:value={artwork.collectionId}>
										<option value="">Select Collection</option>
										{#each collections as collection}
											<option value={collection.id}>{collection.title}</option>
										{/each}
									</select>
								</div>
								<div style="flex: none;">
									<button class="cta button primary" on:click={() => (addingNewCollection = true)}>
										Add New
									</button>
								</div>
							</div>
						{/if}
					</fieldset>

					<button class="cta button primary w-full" type="submit">Add artwork</button>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	h1 {
		@apply mb-12;
	}

	.container {
		@apply max-w-7xl mx-auto;
	}

	.edit-form {
		@apply pb-24 sm:grid sm:grid-cols-2 sm:gap-8;
	}

	.artwork {
		@apply w-full;
	}

	label,
	input,
	select,
	textarea {
		@apply block mb-4 w-full p-3;
	}

	label {
		@apply px-0 mb-0 font-semibold;
	}

	textarea {
		@apply h-32;
	}

	fieldset {
		@apply border border-gray-300 p-4 my-8 rounded-md text-sm;

		select {
			@apply mb-0;
		}
	}

	.error {
		color: red;
	}
	/* Add more styles as needed */
</style>
