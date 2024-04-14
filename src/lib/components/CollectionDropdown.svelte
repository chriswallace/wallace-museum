<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	export let currentSlug = ''; // Add this line to accept the current collection slug as a prop

	let collections = [];
	let selectedCollection = '';

	onMount(async () => {
		const response = await fetch('/api/collections');

		if (response.ok) {
			const data = await response.json();
			collections = data;
			selectedCollection = currentSlug; // Set the current collection as selected
		}
	});

	function handleSelectionChange(event) {
		selectedCollection = event.target.value;
		if (selectedCollection) {
			goto(`/collection/${selectedCollection}`);
		}
	}
</script>

<div class="collection-dropdown">
	<select bind:value={currentSlug} on:change={handleSelectionChange}>
		<option value="">Select a Collection</option>
		{#each collections as collection}
			<option value={collection.slug}>{collection.title}</option>
		{/each}
	</select>
</div>

<style lang="scss">
	.collection-dropdown {
		@apply relative mt-6;

		select {
			@apply block w-full border-2 border-gray-300 rounded-sm shadow-sm p-3 pr-12 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm;

			-webkit-appearance: none; /* Remove default arrow in WebKit browsers */
			-moz-appearance: none; /* Remove default arrow in Mozilla Firefox */
			appearance: none; /* Remove default arrow in modern browsers */
			background-image: url('/images/caret-down.svg'); /* Path to your custom arrow icon */
			background-repeat: no-repeat;
			background-position: right 0.8rem center; /* Adjust position of the arrow */
			background-size: 1.5em; /* Adjust size of the arrow icon */

			@media (prefers-color-scheme: dark) {
				@apply bg-black text-gray-200 border-gray-800;
				background-image: url('/images/caret-down-dark-mode.svg'); /* Path to your custom arrow icon */
			}
		}
	}
</style>
