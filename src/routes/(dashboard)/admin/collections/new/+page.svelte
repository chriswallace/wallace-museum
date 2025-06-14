<script lang="ts">
	import { page } from '$app/stores';
	import { showToast } from '$lib/toastHelper';
	import { goto } from '$app/navigation';

	interface Artist {
		id: number;
		name: string;
	}

	// Get artists from server load
	export let data: { artists: Artist[] };
	let artists = data.artists || [];
	let selectedArtistIds: number[] = [];

	let collectionId: string;

	$: $page, (collectionId = $page.params.collectionId);

	let collection = {
		title: '',
		description: '',
		curatorNotes: '',
		slug: '',
		enabled: false,
		artworks: []
	};

	async function addCollection() {
		const payload = {
			...collection,
			artistIds: selectedArtistIds
		};
		const response = await fetch(`/api/admin/collections/new/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		const responseData = await response.json();

		if (response.ok && responseData.id) {
			showToast('Collection updated', 'success');
			goto(`/admin/collections/${responseData.id}`);
		} else if (response.status === 400) {
			showToast(response.body, 'error');
		}
	}
</script>

<svelte:head>
	<title>New Collection | Wallace Museum Admin</title>
</svelte:head>

<div class="max-w-3xl mx-auto">
	<a class="back-btn" href="/admin/collections">&lt; Back to Collections</a>

	<h1>New collection</h1>

	<form on:submit|preventDefault={addCollection}>
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
		<div class="button-split">
			<button class="save" type="submit">Save and Add Artworks</button>
		</div>
	</form>
</div>

<style lang="scss">
	.container {
		@apply max-w-3xl mx-auto;
	}

	input[type='checkbox'] {
		@apply mr-2 inline w-auto;
	}

	input[type='checkbox'] + label {
		@apply inline;
	}
</style>
