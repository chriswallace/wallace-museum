<script lang="ts">
	import SkeletonLoader from './SkeletonLoader.svelte';

	export let width: number | undefined = undefined;
	export let height: number | undefined = undefined;
	export let aspectRatio: string | undefined = undefined;
	export let style: string = '';
	export let className: string = '';

	// Calculate aspect ratio
	$: calculatedAspectRatio = aspectRatio || (width && height ? `${width}/${height}` : '1/1');
</script>

<div 
	class="iframe-skeleton {className}"
	{style}
	style:aspect-ratio={calculatedAspectRatio}
	style:width={width ? `${width}px` : '100%'}
	style:height={calculatedAspectRatio ? 'auto' : (height ? `${height}px` : '100%')}
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

<style>
	.iframe-skeleton {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		min-width: 0;
		box-sizing: border-box;
		background: var(--color-surface-secondary, #f5f5f5);
		border-radius: 4px;
		overflow: hidden;
	}

	.iframe-skeleton-overlay {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		z-index: 2;
		pointer-events: none;
	}

	.iframe-skeleton-icon {
		margin-bottom: 8px;
		color: var(--color-text-secondary, #666);
	}

	.iframe-skeleton-text {
		font-size: 0.875rem;
		color: var(--color-text-secondary, #666);
		margin: 0;
		opacity: 0.7;
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.iframe-skeleton {
			background: var(--color-surface-secondary-dark, #374151);
		}

		.iframe-skeleton-icon,
		.iframe-skeleton-text {
			color: var(--color-text-secondary-dark, #9CA3AF);
		}
	}
</style> 