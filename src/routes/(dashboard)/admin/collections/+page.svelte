<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCloudinaryTransformedUrl } from '$lib/pinataUtils.client';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtistList from '$lib/components/ArtistList.svelte';

	interface Artist {
		id: number;
		name: string;
		avatarUrl?: string;
	}

	interface Collection {
		id: number;
		title: string;
		coverImages: string[];
		artists?: Artist[];
	}

	let collections: Collection[] = [];
	let page = 1;
	let totalPages = 0;
	let searchQuery = '';

	// Video detection function consistent with media helpers
	function isVideoUrl(url: string): boolean {
		if (!url) return false;
		
		// Check for video file extensions (case insensitive)
		const videoExtensions = /\.(mp4|webm|mov|avi|ogv|m4v|3gp|flv|wmv|mkv|gif)$/i;
		return videoExtensions.test(url);
	}

	async function fetchCollections(page = 1) {
		let url = `/api/admin/collections/?page=${page}`;
		if (searchQuery) {
			url += `&search=${encodeURIComponent(searchQuery)}`;
		}

		const response = await fetch(url);
		if (response.ok) {
			const data = await response.json();
			collections = data.collections;
			totalPages = data.totalPages;
			page = data.page;
		}
	}

	onMount(() => {
		fetchCollections(page);
	});

	function editCollection(id: number) {
		goto(`/admin/collections/${id}`);
	}

	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;
		if (searchQuery.length >= 3 || searchQuery.length === 0) {
			fetchCollections(page);
		}
	}

	function changePage(newPage: number) {
		page = newPage;
		fetchCollections(page);
		window.scrollTo(0, 0);
	}

	function addNew() {
		goto(`/admin/collections/new`);
	}
</script>

<svelte:head>
	<title>Collections | Wallace Museum Admin</title>
</svelte:head>

<h1>Collections <button class="ghost" on:click={addNew}>+ Add new</button></h1>

{#if collections.length === 0}
	<div class="empty">
		<p>No collections found.</p>
	</div>
{:else}
	<input
		type="text"
		placeholder="Search by Collection Title"
		class="search"
		on:input={handleSearchInput}
	/>

	<div class="collection-grid">
		{#each collections as collection}
			<button class="card" on:click={() => editCollection(collection.id)}>
				<div class="cover-image-wrap">
					<div class="cover-image-grid">
						{#each collection.coverImages as image}
							{#if isVideoUrl(image)}
								<video
									src={image}
									autoplay
									loop
									muted
									playsinline
									class="object-cover"
									width="250"
									height="250"
								/>
							{:else}
								<OptimizedImage
									src={image}
									alt=""
									width={250}
									height={250}
									fit="cover"
									format="webp"
									quality={80}
									className="aspect-square object-cover"
								/>
							{/if}
						{/each}
					</div>
				</div>
				<div class="title">{collection.title}</div>
				{#if collection.artists && collection.artists.length > 0}
					<div class="artists-container">
						<ArtistList 
							artists={collection.artists}
							layout="badges"
							size="xs"
							showAvatars={true}
							maxDisplay={3}
							className="px-4 pb-2"
						/>
					</div>
				{/if}
			</button>
		{/each}
	</div>
{/if}

{#if totalPages > 1}
	<nav class="pagination">
		{#each Array(totalPages) as _, i}
			<button on:click={() => changePage(i + 1)} class:selected={page === i + 1}>{i + 1}</button>
		{/each}
	</nav>
{/if}

<style>
	.collection-grid {
		@apply w-full grid grid-cols-3 gap-4;
	}
	.card {
		@apply cursor-pointer rounded-md shadow-md overflow-hidden p-0;
	}
	.cover-image-wrap {
		@apply overflow-hidden;
	}
	.cover-image-grid {
		@apply w-full aspect-square grid grid-cols-2 transition duration-200 ease-in-out hover:scale-105;
	}
	.title {
		@apply text-lg font-semibold p-4;
	}
	.pagination {
		@apply flex justify-center items-center space-x-2 my-4;
	}
	.artists-container {
		@apply pb-2;
	}
</style>
