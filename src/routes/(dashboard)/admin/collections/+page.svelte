<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getCloudinaryTransformedUrl } from '$lib/cloudinaryUtils';

	let collections = [];
	let page = 1;
	let totalPages = 0;
	let searchQuery = '';

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

	function editCollection(id) {
		goto(`/admin/collections/${id}`);
	}

	function handleSearchInput(event) {
		searchQuery = event.target.value;
		if (searchQuery.length >= 3 || searchQuery.length === 0) {
			fetchCollections(page);
		}
	}

	function changePage(newPage) {
		page = newPage;
		fetchCollections(page);
		window.scrollTo(0, 0);
	}

	function addNew() {
		goto(`/admin/collections/new`);
	}
</script>

<svelte:head>
	<title>Collections</title>
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
							{#if image.endsWith('.mp4')}
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
								<img
									src="{image}?tr=w-250,h-250,c_fill,q-70,dpr-auto"
									alt=""
									class="aspect-square object-cover"
								/>
							{/if}
						{/each}
					</div>
				</div>
				<div class="title">{collection.title}</div>
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
		@apply cursor-pointer bg-white rounded-md shadow-md overflow-hidden p-0;
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
</style>
