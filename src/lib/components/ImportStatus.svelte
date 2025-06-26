<!-- src/lib/components/ImportStatus.svelte -->
<script>
	import { importProgress } from '$lib/stores';
</script>

<div class="progress-list">
	{#each $importProgress as item}
		<div class="item">
			<div class="title">
				<span>{item.name}</span>
			</div>
			{#if item.status === 'loading'}
				<div class="loading pending"></div>
			{:else if item.status === 'complete'}
				<div class="loading complete"></div>
			{:else if item.status === 'error'}
				<div class="loading error"></div>
			{/if}
		</div>
	{/each}
</div>

<style lang="scss">
	.progress-list {
		@apply max-h-[200px] overflow-y-auto;
	}
	.item {
		@apply flex items-center justify-between;
	}
	.title {
		@apply w-3/4 grow text-sm;
	}
	.title span {
		@apply truncate max-w-[14em] block;
	}
	.loading {
		@apply w-6 h-6 bg-center bg-contain block;
	}
	.pending {
		background-image: url('/images/loading-small.gif');
	}
	.complete {
		background-image: url('/images/complete-small.png');
	}
	.error {
		background-image: url('/images/error-small.png');
	}
</style>
