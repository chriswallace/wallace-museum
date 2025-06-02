<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from '@zerodevx/svelte-toast';
	import { buildOptimizedImageUrl } from '$lib/imageOptimization';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';

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
				gravity: 'auto',
				format: 'webp',
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
				<div class="avatar-container">
					{#if artist.avatarUrl}
						<OptimizedImage
							src={artist.avatarUrl}
							alt={artist.name}
							width={120}
							height={120}
							fit="crop"
							gravity="auto"
							format="webp"
							quality={85}
							showSkeleton={true}
							skeletonBorderRadius="6px"
							className="avatar-image"
							fallbackSrc="/images/medici-image.png"
						/>
					{:else}
						<div class="avatar-placeholder">
							{artist.name.charAt(0).toUpperCase()}
						</div>
					{/if}
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

	.avatar-container {
		@apply aspect-square w-full relative overflow-hidden;
		width: 100%;
		height: auto;
	}

	.avatar-image {
		@apply w-full h-full object-cover;
		border-radius: 6px;
	}

	.avatar-placeholder {
		@apply w-full h-full flex items-center justify-center text-2xl font-bold text-white bg-gray-500/20 border border-gray-500 rounded-full;
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
