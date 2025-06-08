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
		gap: 12px;
		z-index: 2;
		pointer-events: none;
	}

	.iframe-skeleton-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(0, 0, 0, 0.3);
	}

	.iframe-skeleton-text {
		font-size: 14px;
		color: rgba(0, 0, 0, 0.5);
		margin: 0;
		text-align: center;
		font-weight: 500;
	}

	@media (prefers-color-scheme: dark) {
		.iframe-skeleton-icon {
			color: rgba(255, 255, 255, 0.3);
		}

		.iframe-skeleton-text {
			color: rgba(255, 255, 255, 0.5);
		}
	}
</style> 