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

<style>
	.toast {
		/* Your undismissable toast styling */
	}
	.progress-list {
		max-height: 200px;
		overflow-y: auto;
	}
	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.title {
		@apply w-3/4 grow text-sm;
	}
	.title span {
		@apply truncate max-w-[14em] block;
	}
	.loading {
		width: 24px;
		height: 24px;
		background-position: center center;
		background-size: contain;
		display: block;
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
