<script>
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { toast } from '@zerodevx/svelte-toast';

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

	async function fetchArtwork() {
		try {
			const [artistsRes, collectionsRes] = await Promise.all([
				fetch('/api/admin/artists'), // Assuming you have an endpoint to fetch artists
				fetch('/api/admin/collections') // Assuming you have an endpoint to fetch collections
			]);

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

	function addArtwork() {}

	onMount(() => {
		if (browser) {
			fetchArtwork();
		}
	});
</script>

<title>Add new artwork</title>

<div class="container">
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<a class="back-btn" href="/admin/artworks">&lt; Back</a>
		<h1>Add new artwork</h1>
		<div class="edit-form">
			<div class="artwork">
				<div class="file-uploader">
					<input type="file" name="image" />
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

					<button type="submit">Save</button>
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

	button {
		@apply inline-block w-[100%] mt-2 px-4 py-3 bg-primary rounded-sm text-white font-semibold;

		&.delete {
			@apply bg-red-500;
		}
	}

	.error {
		color: red;
	}
	/* Add more styles as needed */
</style>
