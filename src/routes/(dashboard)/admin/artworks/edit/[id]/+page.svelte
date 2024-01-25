<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';

	let artworkId;

	$: $page, (artworkId = $page.params.id);

	let artwork = {
		title: '',
		description: '',
		image: '',
		// ... include other fields as necessary ...
		artistId: '',
		collectionId: ''
	};
	let artists = [];
	let collections = [];
	let error = '';
	let isLoading = true;

	async function fetchArtwork() {
		try {
			const [artworkRes, artistsRes, collectionsRes] = await Promise.all([
				fetch(`/api/admin/artworks/${artworkId}`),
				fetch('/api/admin/artists'), // Assuming you have an endpoint to fetch artists
				fetch('/api/admin/collections') // Assuming you have an endpoint to fetch collections
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
				collections = await collectionsRes.json();
			}
		} catch (e) {
			error = e.message;
		} finally {
			isLoading = false;
		}
	}

	// Implement updateArtwork and deleteArtwork functions as before

	onMount(() => {
		if (browser) {
			fetchArtwork();
		}
	});
</script>

{#if isLoading}
	<p>Loading...</p>
{:else if error}
	<p class="error">{error}</p>
{:else}
	<form on:submit|preventDefault={updateArtwork}>
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
			<label for="artist">Artist</label>
			<select id="artist" bind:value={artwork.artistId}>
				<option value="">Select Artist</option>
				{#each artists as artist}
					<option value={artist.id}>{artist.name}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="collection">Collection</label>
			<select id="collection" bind:value={artwork.collectionId}>
				<option value="">Select Collection</option>
				{#each collections as collection}
					<option value={collection.id}>{collection.title}</option>
				{/each}
			</select>
		</div>
		<!-- Add other fields as necessary -->

		<button type="submit">Update Artwork</button>
	</form>
	<button on:click={deleteArtwork}>Delete Artwork</button>
{/if}

<style>
	.error {
		color: red;
	}
	/* Add more styles as needed */
</style>
