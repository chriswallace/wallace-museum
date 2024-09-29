<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from '@zerodevx/svelte-toast';
	import { placeholderAvatar } from '$lib/utils';

	let artists = [];
	let page = 1;
	let totalPages = 0;
	let sortColumn = null;
	let sortOrder = null; // 'asc' for ascending, 'desc' for descending
	let searchQuery = '';

	async function fetchArtists(page = 1) {
		let url = `/api/admin/artists/search/`;
		if (sortColumn && sortOrder) {
			url += `?sort=${sortColumn}&order=${sortOrder}`;
		}
		if (searchQuery) {
			url += `?search=${encodeURIComponent(searchQuery)}`;
		}

		try {
			const response = await fetch(url);
			if (response.ok) {
				const data = await response.json();
				artists = data || []; // Ensure artists is an array
			} else {
				toast.push('Failed to fetch artists', { type: 'error' });
			}
		} catch (error) {
			console.error('Error fetching artists:', error);
			toast.push('Error fetching artists', { type: 'error' });
		}
	}

	onMount(() => {
		fetchArtists(page);
	});

	function editArtist(id) {
		goto(`/admin/artists/edit/${id}`);
	}

	function handleSearchInput(event) {
		searchQuery = event.target.value;
		if (searchQuery.length >= 3 || searchQuery.length === 0) {
			fetchArtists(page);
		}
	}

	function changeSorting(column) {
		if (sortColumn === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortOrder = 'asc';
		}
		fetchArtists(page);
	}

	function addNew() {
		goto(`/admin/artists/new`);
	}
</script>

<svelte:head>
	<title>Artists</title>
</svelte:head>

<h1>Artists <button class="ghost" on:click={addNew}>+ Add new</button></h1>
	<input
		type="text"
		placeholder="Search artists..."
		class="search"
		on:input={handleSearchInput}
	/>
	
{#if artists.length === 0}
	<div class="empty">
		<p>No artists found.</p>
	</div>
{:else}
	<div class="grid grid-cols-6 gap-4 w-full">
		{#each artists as artist}
			<button class="card" on:click={() => editArtist(artist.id)}>		
				<img class="avatar" src="{artist.avatarUrl || placeholderAvatar(artist.name)}" alt={artist.name} />
				<span>{artist.name}</span>
			</button>
		{/each}
	</div>
{/if}

<style lang="scss">
	.avatar{
		@apply rounded-full border-2 border-white;
	}

	.card{
		@apply p-4 bg-white shadow-md rounded-lg flex justify-between text-center items-center flex-col text-sm hover:scale-105 transition-transform;

		img{
			@apply aspect-square w-full;
		}
	}

	.empty {
		text-align: center;
		margin: 20px 0;
	}

	span{
		@apply block w-full truncate mt-2;
	}

	.search {
		margin-bottom: 20px;
		width: 100%;
		padding: 10px;
		font-size: 16px;
	}
</style>