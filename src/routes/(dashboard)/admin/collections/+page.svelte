<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCloudinaryTransformedUrl } from '$lib/pinataUtils.client';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtistList from '$lib/components/ArtistList.svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';

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

<div class="admin-header">
	<h1>Collections</h1>
	<div class="header-actions">
		<button class="ghost" on:click={addNew}>+ Add new</button>
	</div>
</div>

<div class="admin-search">
	<input
		type="text"
		placeholder="Search by Collection Title"
		class="search"
		on:input={handleSearchInput}
	/>
</div>

{#if collections.length === 0}
	<div class="empty">
		<p>No collections found.</p>
	</div>
{:else}
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
									fit="crop"
									format="auto"
									quality={80}
									aspectRatio="1/1"
									showSkeleton={true}
									skeletonBorderRadius="4px"
									className="aspect-square object-cover"
								/>
							{/if}
						{/each}
					</div>
				</div>
				<div class="flex items-center justify-between">
					<div class="title">{collection.title}</div>
					{#if collection.artists && collection.artists.length > 0}
						<div class="artists-container">
							<ArtistList 
								artists={collection.artists}
								layout="badges"
								size="md"
								showAvatars={true}
								maxDisplay={3}
								className="pr-2"
							/>
						</div>
					{/if}
				</div>
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
		display: grid;
		width: 100%;
		gap: 1.5rem;
		grid-template-columns: 1fr;
	}
	
	@media (min-width: 640px) {
		.collection-grid {
			grid-template-columns: 1fr 1fr;
			gap: 2rem;
		}
	}
	
	@media (min-width: 1024px) {
		.collection-grid {
			grid-template-columns: 1fr 1fr 1fr;
			gap: 2.5rem;
		}
	}
	
	@media (min-width: 1280px) {
		.collection-grid {
			gap: 3rem;
		}
	}
	
	.card {
		cursor: pointer;
		border-radius: 0.375rem;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		overflow: hidden;
		padding: 0;
		background: white;
		border: 1px solid rgb(229 231 235);
		transition: all 0.2s ease-in-out;
	}
	
	.card:hover {
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
		transform: translateY(-0.25rem);
	}
	
	@media (prefers-color-scheme: dark) {
		.card {
			background: rgb(31 41 55);
			border-color: rgb(75 85 99);
		}
	}
	
	.cover-image-wrap {
		overflow: hidden;
	}
	
	.cover-image-grid {
		display: grid;
		width: 100%;
		aspect-ratio: 1;
		grid-template-columns: 1fr 1fr;
		transition: transform 0.2s ease-in-out;
	}
	
	.cover-image-grid:hover {
		transform: scale(1.05);
	}
	
	.title {
		font-weight: 600;
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
	}
	
	@media (min-width: 640px) {
		.title {
			font-size: 1rem;
		}
	}
	
	@media (min-width: 768px) {
		.title {
			font-size: 1.125rem;
			padding: 1rem;
		}
	}
	
	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		margin-top: 2rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}
	
	.artists-container {
		padding-bottom: 0.5rem;
		padding-right: 0.75rem;
	}
	
	@media (min-width: 768px) {
		.artists-container {
			padding-right: 1rem;
		}
	}
	
	.artists-count {
		font-size: 0.75rem;
		color: rgb(107 114 128);
		margin-top: 0.25rem;
	}
	
	@media (prefers-color-scheme: dark) {
		.artists-count {
			color: rgb(156 163 175);
		}
	}
</style>


