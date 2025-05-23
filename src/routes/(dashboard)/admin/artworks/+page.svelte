<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from '@zerodevx/svelte-toast';
	import { getCloudinaryTransformedUrl } from '$lib/cloudinaryUtils';

	let artworks = [];
	let page = 1;
	let totalPages = 0;
	let sortColumn = 'title';
	let sortOrder = 'asc'; // 'asc' for ascending, 'desc' for descending
	let searchQuery = '';

	async function fetchArtworks(page = 1) {
		let url = `/api/admin/artworks/?page=${page}`;
		if (sortColumn && sortOrder) {
			url += `&sort=${sortColumn}&order=${sortOrder}`;
		}
		if (searchQuery) {
			url += `&search=${encodeURIComponent(searchQuery)}`;
		}

		const response = await fetch(url);
		if (response.ok) {
			const data = await response.json();
			artworks = data.artworks;
			totalPages = data.totalPages;
			page = data.page;
		}
	}

	async function toggleArtworkEnabled(artwork) {
		const response = await fetch(`/api/admin/artworks/toggle/${artwork.id}`, {
			method: 'POST' // Or the appropriate method
		});
		if (response.ok) {
			artwork.enabled = !artwork.enabled;
			toast.push(`Artwork ${artwork.enabled ? 'enabled' : 'disabled'} successfully`);
		} else {
			toast.push(`Artwork ${artwork.enabled ? 'enable' : 'disable'} failed`);
			console.error('Failed to toggle artwork enabled state');
		}
	}

	onMount(() => {
		fetchArtworks(page);
	});

	function editArtwork(id) {
		goto(`/admin/artworks/edit/${id}`);
	}

	function handleSearchInput(event) {
		searchQuery = event.target.value;
		if (searchQuery.length >= 3 || searchQuery.length === 0) {
			fetchArtworks(page);
		}
	}

	function changeSorting(column) {
		if (sortColumn === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortOrder = 'asc';
		}
		fetchArtworks(page);
	}

	function changePage(newPage) {
		page = newPage;
		fetchArtworks(page);

		// This will scroll the window to the top of the page
		window.scrollTo(0, 0);
	}

	function addNew() {
		goto(`/admin/artworks/new`);
	}
</script>

<svelte:head>
	<title>Artworks | Wallace Museum Admin</title>
</svelte:head>

<h1>Artworks <button class="ghost" on:click={() => addNew()}>+ Add new</button></h1>

{#if artworks.length === 0}
	<div class="empty">
		<p>No artworks found.</p>
	</div>
{:else}
	<input
		type="text"
		placeholder="Search by Title, Artist, or Collection"
		class="search"
		on:input={handleSearchInput}
	/>

	<table>
		<thead>
			<tr>
				<th class="enable sortable" on:click={() => changeSorting('enabled')}>
					Enabled
					{sortColumn === 'enabled' && sortOrder === 'asc' ? ' ↑' : ''}
					{sortColumn === 'enabled' && sortOrder === 'desc' ? ' ↓' : ''}
				</th>
				<th class="artwork"></th>
				<th class="title sortable" on:click={() => changeSorting('title')}>
					Title
					{sortColumn === 'title' && sortOrder === 'asc' ? ' ↑' : ''}
					{sortColumn === 'title' && sortOrder === 'desc' ? ' ↓' : ''}
				</th>
				<th class="artist sortable" on:click={() => changeSorting('artist')}>
					Artist
					{sortColumn === 'artist' && sortOrder === 'asc' ? ' ↑' : ''}
					{sortColumn === 'artist' && sortOrder === 'desc' ? ' ↓' : ''}
				</th>
				<th class="collection sortable" on:click={() => changeSorting('collection')}>
					Collection(s)
					{sortColumn === 'collection' && sortOrder === 'asc' ? ' ↑' : ''}
					{sortColumn === 'collection' && sortOrder === 'desc' ? ' ↓' : ''}
				</th>
				<th class="actions">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each artworks as artwork}
				<tr>
					<td>
						<input
							type="checkbox"
							checked={artwork.enabled}
							on:click={() => toggleArtworkEnabled(artwork)}
						/>
					</td>
					<td>
						<button class="image" on:click={() => editArtwork(artwork.id)}>
							<img
								src={getCloudinaryTransformedUrl(artwork.image_url, 'w_120,h_120,c_fit,q_70')}
								alt=""
							/>
						</button>
					</td>
					<td><div>{artwork.title}</div></td>
					<td>
						<div>
							{#if artwork.artists && artwork.artists.length > 0}
								{artwork.artists[0].name}
								{#if artwork.artists.length > 1}
									(+{artwork.artists.length - 1} others)
								{/if}
							{:else}
								None
							{/if}
						</div>
					</td>
					<td
						><div>
							{#if artwork.collection}
								<a
									href="/admin/collections/{artwork.collection.id}"
									on:click|preventDefault={() =>
										goto(`/admin/collections/${artwork.collection.id}`)}
									>{artwork.collection.title}</a
								>
							{:else}
								None
							{/if}
						</div></td
					>
					<td class="text-center"
						><button class="edit button" on:click={() => editArtwork(artwork.id)}>Edit</button></td
					>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

{#if totalPages > 1}
	<nav class="pagination">
		{#each Array(totalPages) as _, i}
			<button on:click={() => changePage(i + 1)} class:selected={page === i + 1}>
				{i + 1}
			</button>
		{/each}
	</nav>
{/if}

<style lang="scss">
	.enable {
		@apply w-32;
	}

	.artwork {
		@apply w-32;
	}

	.title {
		@apply w-[400px];
	}

	.artist {
		@apply w-[400px];
	}

	.collection {
		@apply w-[400px];
	}

	.actions {
		@apply w-12;
	}
</style>
