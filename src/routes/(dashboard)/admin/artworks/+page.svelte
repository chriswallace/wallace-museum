<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from '@zerodevx/svelte-toast';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import type { Artist } from '$lib/stores';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtistTableCell from '$lib/components/ArtistTableCell.svelte';

	interface Artwork {
		id: number | string;
		title: string;
		imageUrl?: string;
		image_url?: string;
		animationUrl?: string;
		animation_url?: string;
		artists?: Artist[];
		collection?: { id: number | string; title: string };
		enabled?: boolean;
		// Add other fields as needed
	}

	let artworks: Artwork[] = [];
	let page: number = 1;
	let totalPages: number = 0;
	let sortColumn: string = 'title';
	let sortOrder: 'asc' | 'desc' = 'asc'; // 'asc' for ascending, 'desc' for descending
	let searchQuery: string = '';

	async function fetchArtworks(page: number = 1) {
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

	async function toggleArtworkEnabled(artwork: Artwork) {
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

	function editArtwork(id: number | string) {
		goto(`/admin/artworks/edit/${id}`);
	}

	function handleSearchInput(event: Event) {
		searchQuery = (event.target as HTMLInputElement).value;
		if (searchQuery.length >= 3 || searchQuery.length === 0) {
			fetchArtworks(page);
		}
	}

	function changeSorting(column: string) {
		if (sortColumn === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortOrder = 'asc';
		}
		fetchArtworks(page);
	}

	function changePage(newPage: number) {
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
							<OptimizedImage
								src={artwork.imageUrl}
								alt=""
								width={80}
								height={80}
								fit="cover"
								format="webp"
								quality={85}
								showSkeleton={true}
								skeletonBorderRadius="4px"
								className="aspect-square"
							/>
						</button>
					</td>
					<td><div>{artwork.title}</div></td>
					<td>
						<ArtistTableCell 
							artists={artwork.artists}
							size="xs"
							showAvatars={true}
							linkToArtist={false}
							maxDisplay={3}
						/>
					</td>
					<td
						><div>
							{#if artwork.collection}
								<a
									href="/admin/collections/{artwork.collection?.id}"
									on:click|preventDefault={() =>
										goto(`/admin/collections/${artwork.collection?.id}`)}
									>{artwork.collection?.title ?? 'Untitled'}</a
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
