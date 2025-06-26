<script lang="ts">
	import SkeletonLoader from './SkeletonLoader.svelte';

	export let width: number | undefined = undefined;
	export let height: number | undefined = undefined;
	export let aspectRatio: string | undefined = undefined;
	export let style: string = '';
	export let className: string = '';

	// Calculate dimensions based on container constraints
	// Use height-based scaling like the actual iframe to prevent overflow
	$: containerStyle = (() => {
		// If we have explicit width and height, use them
		if (width && height) {
			return `width: ${width}px; height: ${height}px;`;
		}
		
		// If we have aspect ratio, calculate dimensions that fit the container
		if (aspectRatio) {
			const [w, h] = aspectRatio.split('/').map(Number);
			if (w && h) {
				// Use height-based scaling to match iframe behavior
				return `width: auto; height: 100%; aspect-ratio: ${w}/${h}; max-width: 100%;`;
			}
		}
		
		// Default to container-fitting behavior
		return 'width: auto; height: 100%; max-width: 100%;';
	})();
</script>

<div 
	class="iframe-skeleton {className}"
	style="{containerStyle} {style}"
>
	<SkeletonLoader
		width="100%"
		height="100%"
		borderRadius="4px"
	/>
	
	<!-- Optional overlay to indicate interactive content -->
	<div class="iframe-skeleton-overlay">
		<div class="iframe-skeleton-icon">
			<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
				<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
			</svg>
		</div>
		<p class="iframe-skeleton-text">Loading interactive content...</p>
	</div>
</div>

<style lang="scss">
	.iframe-skeleton {
		@apply relative flex items-center justify-center overflow-hidden;
		/* Remove aspect-ratio from here since it's now handled in the style attribute */
	}

	.iframe-skeleton-overlay {
		@apply absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center gap-3 z-[2] pointer-events-none;
	}

	.iframe-skeleton-icon {
		@apply flex items-center justify-center text-black/30 dark:text-white/30;
	}

	.iframe-skeleton-text {
		@apply text-sm text-black/50 dark:text-white/50 m-0 text-center font-medium;
	}
</style> 