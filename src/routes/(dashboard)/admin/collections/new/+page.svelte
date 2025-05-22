<script>
	import { page } from '$app/stores';
	import { showToast } from '$lib/toastHelper';
	import { goto } from '$app/navigation';

	let collectionId;

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
		const response = await fetch(`/api/admin/collections/new/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(collection)
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
	<title>New collection</title>
</svelte:head>

<div class="container">
	<a class="back-btn" href="/admin/collections">&lt; Back to Collections</a>

	<h1>New collection</h1>

	<form on:submit|preventDefault={addCollection}>
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
			<button class="button primary" type="submit">Save and Add Artworks</button>
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
