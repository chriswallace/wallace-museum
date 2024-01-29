<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

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

<title>Collections</title>

<h1>Collections <button on:click={addNew}>+ Add new</button></h1>

<p>
	This is a list of collections currently stored in your system. Here, you can edit or view
	individual collections.
</p>

<input
	type="text"
	placeholder="Search by Collection Title"
	class="search"
	on:input={handleSearchInput}
/>

<div class="collection-grid">
	{#each collections as collection}
		<div class="card" on:click={() => editCollection(collection.id)}>
			<div class="cover-image-wrap">
				<img
					src="{collection.coverImage}?tr=w-500,h-500,q-70,dpr-auto"
					alt={collection.title}
					class="cover-image"
				/>
			</div>
			<div class="title">{collection.title}</div>
			<!-- Include toggle button for enable/disable if needed -->
		</div>
	{/each}
</div>

{#if totalPages > 1}
	<nav class="pagination">
		{#each Array(totalPages) as _, i}
			<button on:click={() => changePage(i + 1)} class:selected={page === i + 1}>{i + 1}</button>
		{/each}
	</nav>
{/if}

<style>
	h1 {
		@apply mb-8;
	}
	p {
		@apply max-w-3xl mb-16 text-gray-500 text-lg;
	}
	.collection-grid {
		@apply w-full grid grid-cols-3 gap-4;
	}
	.card {
		@apply cursor-pointer bg-white rounded-md shadow-md overflow-hidden;

		&:hover .cover-image {
			transform: scale(1.2);
		}
	}
	.cover-image-wrap {
		@apply w-full aspect-square overflow-hidden;
	}
	.cover-image {
		@apply w-full object-cover aspect-square transition duration-200 ease-in-out;
		transform: scale(1.15);
	}
	.title {
		@apply text-lg font-semibold p-4;
	}
	.pagination {
		@apply flex justify-center items-center space-x-2 my-4;
	}
</style>
