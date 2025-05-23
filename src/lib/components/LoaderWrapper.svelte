<script lang="ts">
	import SkeletonLoader from './SkeletonLoader.svelte';

	export let width: string = '100%';
	export let height: string = 'auto';
	export let borderRadius: string = '4px';
	export let aspectRatio: string | null = null;
</script>

<div
	class="loader-wrapper overflow-hidden"
	style={aspectRatio ? `aspect-ratio: ${aspectRatio};` : ''}
>
	<SkeletonLoader {width} {height} {borderRadius} />
</div>

<style>
	.loader-wrapper {
		contain: content;
		position: relative;
		box-sizing: border-box;
		max-width: 100%;
		display: block;
	}
</style>
