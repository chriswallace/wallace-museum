<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from '@zerodevx/svelte-toast';
	import { placeholderAvatar } from '$lib/utils';

	interface Artist {
		id: number;
		name: string;
		avatarUrl: string | null;
	}

	function getCloudinaryUrl(url: string): string {
		if (!url || !url.includes('cloudinary.com')) return url;
		// Insert Cloudinary transformations for face-detection and square cropping
		return url.replace('/upload/', '/upload/c_thumb,g_face,h_300,w_300/');
	}

	let artists: Artist[] = [];
	let page = 1;
	let totalPages = 0;
	let sortColumn: string | null = null;
	let sortOrder: 'asc' | 'desc' | null = null;
	let searchQuery = '';

	async function fetchArtists(page = 1) {
		let url = `/api/admin/artists/search/`;

		if (searchQuery) {
			url += `?search=${encodeURIComponent(searchQuery)}`;
		}

		try {
			const response = await fetch(url);
			if (response.ok) {
				const data = await response.json();
				artists = data || []; // Ensure artists is an array
			} else {
				toast.push('Failed to fetch artists');
			}
		} catch (error) {
			console.error('Error fetching artists:', error);
			toast.push('Error fetching artists');
		}
	}

	onMount(() => {
		fetchArtists(page);
	});

	function editArtist(id: number) {
		goto(`/admin/artists/edit/${id}`);
	}

	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;
		if (searchQuery.length >= 3 || searchQuery.length === 0) {
			fetchArtists(page);
		}
	}

	function changeSorting(column: string) {
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
	<title>Artists | Wallace Museum Admin</title>
</svelte:head>

<h1>Artists <button class="ghost" on:click={addNew}>+ Add new</button></h1>
<input type="text" placeholder="Search artists..." class="search" on:input={handleSearchInput} />

{#if artists.length === 0}
	<div class="empty">
		<p>No artists found.</p>
	</div>
{:else}
	<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 w-full">
		{#each artists as artist}
			<button class="card" on:click={() => editArtist(artist.id)}>
				<div class="aspect-square w-full relative">
					<img
						class="avatar absolute inset-0 w-full h-full object-cover"
						src={artist.avatarUrl
							? getCloudinaryUrl(artist.avatarUrl)
							: placeholderAvatar(artist.name)}
						alt={artist.name}
					/>
				</div>
				<span>{artist.name}</span>
			</button>
		{/each}
	</div>
{/if}

<style lang="scss">
	.card {
		@apply p-4 shadow-md rounded-lg flex justify-between text-center items-center flex-col text-sm hover:scale-105 transition-transform;
	}

	.empty {
		text-align: center;
		margin: 20px 0;
	}

	span {
		@apply block w-full truncate mt-2;
	}

	.search {
		margin-bottom: 20px;
		width: 100%;
		padding: 10px;
		font-size: 16px;
	}
</style>
