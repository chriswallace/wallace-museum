<script lang="ts">
	export let width: string = '100%';
	export let height: string = '100%';
	export let borderRadius: string = '4px';
</script>

<div
	class="skeleton-loader bg-gray-200 dark:bg-gray-700 relative overflow-hidden box-border"
	style="width: {width}; height: {height}; border-radius: {borderRadius}; max-width: 100%;"
>
	<div class="shimmer absolute inset-0"></div>
</div>

<style lang="scss">
	.skeleton-loader {
		contain: strict;
		display: block;
	}

	.shimmer {
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0) 0%,
			rgba(255, 255, 255, 0.1) 50%,
			rgba(255, 255, 255, 0) 100%
		);
		animation: shimmer 1.5s infinite;
		contain: paint;
	}

	@media (prefers-color-scheme: dark) {
		.shimmer {
			background: linear-gradient(
				90deg,
				rgba(50, 50, 50, 0) 0%,
				rgba(80, 80, 80, 0.2) 50%,
				rgba(50, 50, 50, 0) 100%
			);
		}
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
