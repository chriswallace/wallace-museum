<script lang="ts">
	export let width: string = '100%';
	export let height: string = '100%';
	export let borderRadius: string = '4px';
</script>

<div
	class="skeleton-loader"
	style="width: {width}; height: {height}; border-radius: {borderRadius};"
>
	<div class="shimmer"></div>
</div>

<style lang="scss">
	.skeleton-loader {
		@apply relative overflow-hidden bg-gray-200 bg-opacity-20;
	}

	.shimmer {
		@apply absolute inset-0;
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0) 0%,
			rgba(255, 255, 255, 0.1) 50%,
			rgba(255, 255, 255, 0) 100%
		);
		animation: shimmer 1.5s infinite;
	}

	@keyframes shimmer {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}
</style>
