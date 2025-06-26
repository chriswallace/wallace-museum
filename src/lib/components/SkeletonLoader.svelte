<script lang="ts">
	export let width: string = '100%';
	export let height: string = '100%';
	export let borderRadius: string = '4px';
</script>

<div
	class="skeleton-loader bg-gray-200 dark:bg-gray-900 relative overflow-hidden box-border"
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
			rgba(255, 255, 255, 0.4) 20%,
			rgba(255, 255, 255, 0.6) 30%,
			rgba(255, 255, 255, 0.4) 40%,
			rgba(255, 255, 255, 0) 100%
		);
		animation: shimmer 1.2s ease-in-out infinite;
		contain: paint;
	}

	:global(.dark) .shimmer {
		background: linear-gradient(
			90deg,
			rgba(120, 120, 120, 0) 0%,
			rgba(160, 160, 160, 0.3) 20%,
			rgba(200, 200, 200, 0.5) 50%,
			rgba(160, 160, 160, 0.3) 80%,
			rgba(120, 120, 120, 0) 100%
		);
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
