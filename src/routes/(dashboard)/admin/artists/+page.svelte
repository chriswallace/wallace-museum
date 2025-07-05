<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from '@zerodevx/svelte-toast';
	import { buildOptimizedImageUrl } from '$lib/imageOptimization';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtistAvatar from '$lib/components/ArtistAvatar.svelte';
	import { placeholderAvatar } from '$lib/utils';

	interface Artist {
		id: number;
		name: string;
		avatarUrl: string | null;
	}

	let artists: Artist[] = [];
	let page = 1;
	let totalPages = 0;
	let sortColumn: string | null = null;
	let sortOrder: 'asc' | 'desc' | null = null;
	let searchQuery = '';

	// Function to get optimized avatar URL with face detection
	function getOptimizedAvatarUrl(avatarUrl: string): string {
		try {
			const optimizedUrl = buildOptimizedImageUrl(avatarUrl, {
				width: 300,
				height: 300,
				fit: 'crop',
				gravity: 'center',
				format: 'auto',
				quality: 85
			});
			
			// If the optimized URL contains 'hash=file' or similar invalid hash, fall back to original
			if (optimizedUrl.includes('hash=file') || optimizedUrl.includes('hash=undefined')) {
				return avatarUrl;
			}
			
			return optimizedUrl;
		} catch (error) {
			console.error('Error optimizing avatar URL:', error);
			return avatarUrl;
		}
	}

	// Function to handle image error and fallback to original URL
	function handleImageError(event: Event, originalUrl: string) {
		const img = event.target as HTMLImageElement;
		img.src = originalUrl;
	}

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

<div class="admin-header">
	<h1>Artists</h1>
	<div class="header-actions">
		<button class="ghost" on:click={addNew}>+ Add new</button>
	</div>
</div>

<div class="admin-search">
	<input type="text" placeholder="Search artists..." class="search" on:input={handleSearchInput} />
</div>

{#if artists.length === 0}
	<div class="empty">
		<p>No artists found.</p>
	</div>
{:else}
	<div class="artists-grid">
		{#each artists as artist}
			<button class="card" on:click={() => editArtist(artist.id)}>
				<div class="avatar-container">
					{#if artist.avatarUrl}
						<OptimizedImage
							src={artist.avatarUrl}
							alt={artist.name}
							width={48}
							height={48}
							fit="cover"
							gravity="center"
							format="auto"
							quality={85}
							aspectRatio="1/1"
							className="w-full h-full object-cover"
							fallbackSrc="/images/placeholder.webp"
						/>
					{:else}
						<img
							src={placeholderAvatar(artist.name)}
							alt="{artist.name} placeholder avatar"
							class="w-full h-full object-cover rounded-full"
						/>
					{/if}
				</div>
				<span>{artist.name}</span>
			</button>
		{/each}
	</div>
{/if}

<style lang="scss">
	.artists-grid {
		@apply w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6;
	}

	.card {
		@apply shadow-md rounded-lg flex flex-col items-center text-center text-sm transition-all duration-200 bg-white border border-gray-200 min-h-[120px] md:min-h-[140px] p-3 md:p-4 dark:bg-gray-800 dark:border-gray-700;
		
		&:hover {
			@apply scale-105 shadow-lg;
		}
		
		&:active {
			@apply scale-95;
		}
	}

	.avatar-container {
		@apply aspect-square w-full relative overflow-hidden rounded-full mb-2 md:mb-3;
		max-width: 60px;
		
		@apply md:max-w-[80px];
	}

	.avatar-image {
		@apply w-full h-full object-cover rounded-full;
	}



	.empty {
		@apply text-center my-5;
		
		p {
			@apply text-gray-600 dark:text-gray-400;
		}
	}

	span {
		@apply block w-full truncate text-xs md:text-sm;
	}

	.search {
		@apply mb-5 w-full p-4;
	}
</style>
