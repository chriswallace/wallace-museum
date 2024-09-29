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

	interface Artwork {
		id?: string;
		title: string;
		description: string;
		image_url: string;
		animation_url: string;
		artistId: string;
		collectionId: string;
		mime: string;
		attributes: string;
		curatorNotes: string;
		contractAddr: string;
		contractAlias: string;
		totalSupply: string;
		symbol: string;
		blockchain: string;
		tokenID: string;
		mintDate: string;
	}

	let artwork: Artwork = {
		title: '',
		description: '',
		image_url: '',
		animation_url: '',
		artistId: '',
		collectionId: '',
		mime: '',
		attributes: '',
		curatorNotes: '',
		contractAddr: '',
		contractAlias: '',
		totalSupply: '',
		symbol: '',
		blockchain: '',
		tokenID: '',
		mintDate: ''
	};

	interface Artist {
		id: string;
		name: string;
	}

	interface Collection {
		id: string;
		title: string;
	}

	let artists: Artist[] = [];
	let collections: Collection[] = [];
	let error: string = '';
	let isLoading: boolean = true;

	async function updateArtwork(event: Event) {
		const response = await fetch(`/api/admin/artworks/${artwork.id}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(artwork)
		});

		if (response.ok) {
			showToast('Artwork saved.', 'success');
		} else {
			showToast('Failed to update artwork.', 'error');
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
			showToast('Failed to delete artwork.', 'error');
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
			} else {
				error = 'Failed to fetch artwork';
			}

			if (artistsRes.ok) {
				artists = await artistsRes.json();
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
		<a class="back-btn" href="/admin/artworks">&lt; Back</a>
		<h1>Edit artwork</h1>
		<div class="grid grid-cols-2 gap-4">
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
						<label for="artist">Artist</label>
						<select id="artist" bind:value={artwork.artistId}>
							<option value="" disabled selected>Select Artist</option>
							{#each artists as artist}
								<option value={artist.id}>{artist.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="collection">Collection</label>
						<select id="collection" bind:value={artwork.collectionId}>
                            <option value="" disabled selected>Select your option</option>
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
		margin-bottom: 3rem; /* Example styling */
	}

	.container {
		max-width: 1200px;
		margin: auto;
	}

	.error {
		color: red;
	}
</style>
