<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;

	import ArtworkFeed from '$lib/components/ArtworkFeed.svelte';
</script>

<svelte:head>
	<title>Wallace Museum | Digital Art Collection</title>
	<meta
		name="description"
		content="The Wallace Museum showcases pioneering works from bleeding-edge artists pushing the boundaries of computational aesthetics and algorithmic expression."
	/>
</svelte:head>

<div class="homepage-container">
	<ArtworkFeed />
</div>

<style lang="scss">
	.homepage-container {
		@apply w-full min-h-screen bg-black pt-12;
	}
</style>
