<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let artworks = [];
	let page = 1;
	let totalPages = 0;

	async function fetchArtworks(page = 1) {
		const response = await fetch(`/api/admin/artworks/?page=${page}`);
		if (response.ok) {
			const data = await response.json();
			artworks = data.artworks;

			console.log(artworks);
			totalPages = data.totalPages;
			page = data.page;
		}
	}

	onMount(() => {
		fetchArtworks(page);
	});

	function editArtwork(id) {
		// navigate to the artwork edit page
		goto(`/admin/artworks/edit/${id}`);
	}

	function changePage(newPage) {
		page = newPage;
		fetchArtworks(page);
	}
</script>

<h1>Artworks</h1>

<table>
	<thead>
		<tr>
			<th class="artwork"></th>
			<th class="title">Title</th>
			<th class="artist">Artist</th>
			<th class="collection">Collection(s)</th>
			<th class="actions">Actions</th>
		</tr>
	</thead>
	<tbody>
		{#each artworks as artwork}
			<tr>
				<td
					><button on:click={() => editArtwork(artwork.id)}
						><img src="{artwork.image}?tr=h-120,w-120,q-70" alt="" /></button
					></td
				>
				<td><button on:click={() => editArtwork(artwork.id)}>{artwork.title}</button></td>
				<td><div>{artwork.artist.name}</div></td>
				<td><div>{artwork.collection.title}</div></td>
				<td class="text-center"
					><button class="edit" on:click={() => editArtwork(artwork.id)}>Edit</button></td
				>
			</tr>
		{/each}
	</tbody>
</table>

{#if totalPages > 1}
	<nav class="pagination">
		{#each Array(totalPages) as _, i}
			<button on:click={() => changePage(i + 1)} class:selected={page === i + 1}>
				{i + 1}
			</button>
		{/each}
	</nav>
{/if}

<style>
</style>
