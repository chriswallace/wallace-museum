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

	// Common MIME types for artworks
	const commonMimeTypes = [
		{ value: '', label: '-- Select MIME Type --' },
		{ value: 'image/jpeg', label: 'JPEG Image (image/jpeg)' },
		{ value: 'image/png', label: 'PNG Image (image/png)' },
		{ value: 'image/gif', label: 'GIF Image (image/gif)' },
		{ value: 'image/webp', label: 'WebP Image (image/webp)' },
		{ value: 'image/svg+xml', label: 'SVG Image (image/svg+xml)' },
		{ value: 'video/mp4', label: 'MP4 Video (video/mp4)' },
		{ value: 'video/webm', label: 'WebM Video (video/webm)' },
		{ value: 'video/quicktime', label: 'QuickTime Video (video/quicktime)' },
		{ value: 'video/ogg', label: 'OGG Video (video/ogg)' },
		{ value: 'text/html', label: 'HTML Document (text/html)' },
		{ value: 'application/javascript', label: 'JavaScript (application/javascript)' },
		{ value: 'model/gltf+json', label: 'glTF Model (model/gltf+json)' },
		{ value: 'model/gltf-binary', label: 'glTF Binary (model/gltf-binary)' },
		{ value: 'application/pdf', label: 'PDF Document (application/pdf)' },
		{ value: 'audio/mpeg', label: 'MP3 Audio (audio/mpeg)' },
		{ value: 'audio/wav', label: 'WAV Audio (audio/wav)' },
		{ value: 'audio/ogg', label: 'OGG Audio (audio/ogg)' }
	];

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

		// Add animation_url if provided
		if (artwork.animation_url) {
			formData.append('animation_url', artwork.animation_url);
		}

		// Add mime type if provided
		if (artwork.mime) {
			formData.append('mime', artwork.mime);
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
	<title>Add New Artwork | Wallace Museum Admin</title>
</svelte:head>

<div class="max-w-7xl mx-auto">
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<div>
			<button class="back-btn" on:click={goBack}>&lt; Back</button>
		</div>
		<h1 class="mb-12">Add new artwork</h1>
		<div class="pb-24 sm:grid sm:grid-cols-2 sm:gap-8">
			<div>
				<div class="file-uploader">
					<input type="file" name="image" />
					<label for="image">Upload media (JPG, PNG, GIF, MP4 under 25MB)</label>
				</div>
			</div>
			<div>
				<form on:submit|preventDefault={addArtwork}>
					<!-- Artwork Fields -->
					<div class="mb-4">
						<label for="title">Title</label>
						<input type="text" id="title" bind:value={artwork.title} />
					</div>
					<div class="mb-4">
						<label for="description">Description</label>
						<textarea id="description" bind:value={artwork.description}></textarea>
					</div>
					<div class="mb-4">
						<label for="animation_url">Animation URL (Optional)</label>
						<input type="url" id="animation_url" bind:value={artwork.animation_url} />
						<small class="text-gray-600 dark:text-gray-400 block mt-1"
							>URL for animation or interactive content. Will be used if no file is uploaded. MIME
							type will be auto-detected.</small
						>
					</div>
					<div class="mb-4">
						<label for="mime">MIME Type (Optional)</label>
						<select id="mime" bind:value={artwork.mime}>
							{#each commonMimeTypes as mimeType}
								<option value={mimeType.value}>{mimeType.label}</option>
							{/each}
						</select>
						<small class="text-gray-600 dark:text-gray-400 block mt-1"
							>The MIME type of the primary media file. Leave blank for auto-detection.</small
						>
					</div>
					<fieldset class="mb-4 border-0 p-0">
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
									<button
										type="button"
										class="primary"
										on:click|preventDefault={() => (addingNewArtist = true)}
									>
										Add New
									</button>
								</div>
							</div>
						{/if}
					</fieldset>
					<fieldset class="mb-4 border-0 p-0">
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
									<button
										type="button"
										class="primary"
										on:click|preventDefault={() => (addingNewCollection = true)}
									>
										Add New
									</button>
								</div>
							</div>
						{/if}
					</fieldset>

					<button class="primary w-full" type="submit">Add artwork</button>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	h1 {
		margin-bottom: 3rem;
	}

	.container {
		max-width: 80rem;
		margin-left: auto;
		margin-right: auto;
	}

	.edit-form {
		padding-bottom: 6rem;
	}

	@media (min-width: 640px) {
		.edit-form {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 2rem;
		}
	}

	.artwork {
		width: 100%;
	}

	label,
	input,
	select,
	textarea {
		display: block;
		margin-bottom: 1rem;
		width: 100%;
		padding: 0.75rem;
	}

	label {
		padding-left: 0;
		padding-right: 0;
		margin-bottom: 0;
		font-weight: 600;
	}

	textarea {
		height: 8rem;
	}

	fieldset {
		border: 1px solid #d1d5db;
		padding: 1rem;
		margin-top: 2rem;
		margin-bottom: 2rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	fieldset select {
		margin-bottom: 0;
	}

	.error {
		color: red;
	}
	/* Add more styles as needed */
</style>
