<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import ArtworkDisplay from '$lib/components/ArtworkDisplay.svelte';
	import ArtworkMeta from '$lib/components/ArtworkMeta.svelte';

	import { showToast } from '$lib/toastHelper';
	import { goto } from '$app/navigation';

	let artworkId: string;

	$: $page, (artworkId = $page.params.id);

	interface Artist {
		id: number;
		name: string;
	}

	interface Artwork {
		id?: number;
		title: string;
		description: string;
		image_url: string;
		animation_url: string;
		artists?: Artist[];
		collectionId: number | null;
		mime: string;
		attributes: string;
		curatorNotes: string;
		contractAddr: string;
		contractAlias: string;
		symbol: string;
		blockchain: string;
		tokenID: string;
		mintDate: string;
		enabled: boolean;
	}

	let artwork: Artwork = {
		title: '',
		description: '',
		image_url: '',
		animation_url: '',
		artists: [],
		collectionId: null,
		mime: '',
		attributes: '',
		curatorNotes: '',
		contractAddr: '',
		contractAlias: '',
		symbol: '',
		blockchain: '',
		tokenID: '',
		mintDate: '',
		enabled: true
	};

	interface Collection {
		id: number;
		title: string;
	}

	let allArtists: Artist[] = [];
	let selectedArtistIds: number[] = [];
	let collections: Collection[] = [];
	let error: string = '';
	let isLoading: boolean = true;

	async function updateArtwork(event: Event) {
		const payload = {
			title: artwork.title,
			description: artwork.description,
			enabled: artwork.enabled,
			collectionId: artwork.collectionId,
			artistIds: selectedArtistIds,
			image_url: artwork.image_url,
			animation_url: artwork.animation_url,
			mime: artwork.mime
		};

		const response = await fetch(`/api/admin/artworks/${artwork.id}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		if (response.ok) {
			showToast('Artwork saved.', 'success');
			const updatedData = await response.json();
			artwork = updatedData;
			selectedArtistIds = artwork.artists?.map((a) => a.id) || [];
		} else {
			const errorData = await response.json();
			showToast(
				`Failed to update artwork: ${errorData.details || errorData.error || 'Unknown error'}`,
				'error'
			);
		}
	}

	async function deleteArtwork() {
		const response = await fetch(`/api/admin/artworks/${artwork.id}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			showToast('Artwork deleted.', 'success');
			goto('/admin/artworks');
		} else {
			const errorData = await response.json();
			showToast(
				`Failed to delete artwork: ${errorData.details || errorData.error || 'Unknown error'}`,
				'error'
			);
		}
	}

	async function confirmDeleteArtwork() {
		if (confirm('Are you sure you want to delete this artwork?')) {
			await deleteArtwork();
		}
	}

	async function fetchArtwork() {
		try {
			const [artworkRes, artistsRes, collectionsRes] = await Promise.all([
				fetch(`/api/admin/artworks/${artworkId}`),
				fetch('/api/admin/artists'),
				fetch('/api/admin/collections/all')
			]);

			if (artworkRes.ok) {
				artwork = await artworkRes.json();
				selectedArtistIds = artwork.artists?.map((a) => a.id) || [];
			} else {
				error = 'Failed to fetch artwork';
			}

			if (artistsRes.ok) {
				allArtists = await artistsRes.json();
			}

			if (collectionsRes.ok) {
				const collectionsData = await collectionsRes.json();
				collections = collectionsData.collections;
			}
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isLoading = false;
		}
	}

	function goBack() {
		history.back();
	}

	onMount(() => {
		if (browser) {
			fetchArtwork();
		}
	});
</script>

<svelte:head>
	<title>Edit artwork</title>
</svelte:head>

<div class="container">
	{#if isLoading}
		<p>Loading...</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else}
		<button class="back-btn" on:click={goBack}>&lt; Back</button>
		<h1>Edit artwork</h1>
		<div class="grid grid-cols-2 gap-12">
			<div>
				<ArtworkDisplay {artwork} />
				<ArtworkMeta {artwork} />
			</div>
			<div>
				<form on:submit|preventDefault={updateArtwork}>
					<div>
						<label for="title">Title</label>
						<input type="text" id="title" bind:value={artwork.title} />
					</div>
					<div>
						<label for="description">Description</label>
						<textarea id="description" bind:value={artwork.description}></textarea>
					</div>
					<div>
						<label for="image_url">Image URL</label>
						<input
							type="url"
							id="image_url"
							bind:value={artwork.image_url}
							placeholder="https://res.cloudinary.com/..."
						/>
						<small
							>Change the image URL to update the artwork image. Cloudinary URLs will have
							dimensions automatically detected.</small
						>
					</div>
					<div>
						<label for="animation_url">Animation URL</label>
						<input
							type="url"
							id="animation_url"
							bind:value={artwork.animation_url}
							placeholder="https://res.cloudinary.com/..."
						/>
						<small
							>URL for animation or interactive content. This will be prioritized over the image URL
							when present. MIME type will be auto-detected.</small
						>
					</div>
					<div>
						<label for="artist">Artists</label>
						<select id="artist" multiple bind:value={selectedArtistIds} class="multi-select">
							{#each allArtists as artist}
								<option value={artist.id}>{artist.name}</option>
							{/each}
						</select>
						<small>Hold Command/Ctrl to select multiple.</small>
					</div>
					<div>
						<label for="collection">Collection</label>
						<select id="collection" bind:value={artwork.collectionId}>
							<option value={null}>-- No Collection --</option>
							{#each collections as collection}
								<option value={collection.id}>{collection.title}</option>
							{/each}
						</select>
					</div>
					<div class="flex justify-between">
						<button class="destructive" on:click={confirmDeleteArtwork} type="button"
							>Delete Artwork</button
						>
						<button class="primary" type="submit">Save details</button>
					</div>
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
		max-width: 1200px;
		margin: auto;
	}

	.error {
		color: red;
	}

	.multi-select {
		min-height: 100px;
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	form > div {
		margin-bottom: 1rem;
	}

	label {
		display: block;
		font-weight: bold;
		margin-bottom: 0.5rem;
	}

	input[type='text'],
	input[type='url'],
	textarea,
	select {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}
</style>
