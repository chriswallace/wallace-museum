<script lang="ts">
	import { buildOptimizedImageUrl, createResponsiveSrcSet, createRetinaUrls } from '$lib/imageOptimization';
	import type { ImageOptimizationOptions } from '$lib/imageOptimization';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import SkeletonLoader from './SkeletonLoader.svelte';

	// Props
	export let src: string | null | undefined;
	export let alt: string = '';
	export let width: number | undefined = undefined;
	export let height: number | undefined = undefined;
	export let sizes: string | undefined = undefined;
	export let loading: 'lazy' | 'eager' = 'lazy';
	export let className: string = '';
	export let style: string = '';
	
	// Image optimization options
	export let quality: number = 85;
	export let format: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png' = 'webp';
	export let fit: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad' = 'contain';
	export let gravity: 'auto' | 'center' | 'top' | 'bottom' | 'left' | 'right' = 'auto';
	export let dpr: 1 | 2 | 3 = 1;
	export let sharpen: number | undefined = undefined;
	export let animation: boolean = true;
	
	// Responsive options
	export let responsive: boolean = false;
	export let responsiveSizes: number[] = [400, 800, 1200];
	export let retina: boolean = false;
	
	// Fallback options
	export let fallbackSrc: string = '/images/medici-image.png';
	export let showFallbackOnError: boolean = true;

	// Skeleton loader options
	export let showSkeleton: boolean = true;
	export let skeletonBorderRadius: string = '4px';
	export let aspectRatio: string | undefined = undefined;

	// Internal state
	let imageElement: HTMLImageElement;
	let hasError = false;
	let isLoaded = false;

	/**
	 * Detect if a URL points to an SVG file
	 */
	function isSvgUrl(url: string): boolean {
		if (!url) return false;
		
		// Check for .svg extension (case insensitive)
		if (url.toLowerCase().includes('.svg')) {
			return true;
		}
		
		// Check for SVG MIME type in data URLs
		if (url.startsWith('data:image/svg+xml')) {
			return true;
		}
		
		return false;
	}

	/**
	 * Check if a URL is an IPFS URL that can be optimized
	 */
	function isIpfsUrl(url: string): boolean {
		if (!url) return false;
		
		// Check for IPFS protocol URLs
		if (url.startsWith('ipfs://')) {
			return true;
		}
		
		// Check for IPFS gateway URLs that contain CIDs
		// This is a simplified check - the full logic is in imageOptimization.ts
		return url.includes('ipfs') || url.includes('/ipfs/') || url.includes('gateway');
	}

	// Check if the source is an SVG or non-IPFS URL
	$: isSvg = src ? isSvgUrl(src) : false;
	$: isIpfs = src ? isIpfsUrl(src) : false;
	$: canOptimize = isIpfs && !isSvg; // Only optimize IPFS URLs that aren't SVGs

	// Build optimization options - don't apply format conversion to SVGs
	$: optimizationOptions = {
		width,
		height,
		quality,
		format: isSvg ? 'auto' : format, // Use 'auto' for SVGs to preserve original format
		fit,
		gravity,
		dpr: retina ? 2 : dpr,
		sharpen,
		animation,
		metadata: 'copyright'
	} as ImageOptimizationOptions;

	// Generate optimized URLs - only for IPFS URLs
	$: optimizedSrc = src && canOptimize ? buildOptimizedImageUrl(src, optimizationOptions) : src;
	$: fallbackUrl = src && isIpfs ? ipfsToHttpUrl(src) : (src || fallbackSrc);
	
	// Determine if we should show the image or skeleton
	$: shouldShowImage = src && src.trim() !== '';
	$: imageSrc = shouldShowImage ? (optimizedSrc || fallbackUrl) : '';

	// Generate responsive srcset if enabled - only for IPFS URLs that can be optimized
	$: srcset = responsive && src && canOptimize ? createResponsiveSrcSet(src, responsiveSizes, {
		height: optimizationOptions.height,
		quality: optimizationOptions.quality,
		format: optimizationOptions.format,
		fit: optimizationOptions.fit,
		gravity: optimizationOptions.gravity,
		dpr: optimizationOptions.dpr,
		sharpen: optimizationOptions.sharpen,
		animation: optimizationOptions.animation,
		metadata: optimizationOptions.metadata
	}) : '';

	// Generate retina URLs if enabled - only for IPFS URLs that can be optimized
	$: retinaUrls = retina && width && src && canOptimize ? createRetinaUrls(src, width, {
		height: optimizationOptions.height,
		quality: optimizationOptions.quality,
		format: optimizationOptions.format,
		fit: optimizationOptions.fit,
		gravity: optimizationOptions.gravity,
		sharpen: optimizationOptions.sharpen,
		animation: optimizationOptions.animation,
		metadata: optimizationOptions.metadata
	}) : null;

	// Calculate skeleton dimensions and aspect ratio
	$: skeletonWidth = width ? `${width}px` : '100%';
	$: skeletonHeight = height ? `${height}px` : (aspectRatio ? 'auto' : '100%');
	$: calculatedAspectRatio = aspectRatio || (width && height ? `${width}/${height}` : undefined);

	// Improved skeleton visibility logic - show skeleton when:
	// 1. showSkeleton is enabled AND
	// 2. Either no image source OR image hasn't loaded yet (and no error with fallback)
	$: shouldShowSkeleton = showSkeleton && (!shouldShowImage || !isLoaded);

	// Handle image load
	function handleLoad() {
		isLoaded = true;
		hasError = false;
	}

	// Handle image error
	function handleError() {
		if (showFallbackOnError && !hasError) {
			hasError = true;
			isLoaded = false; // Reset loaded state when switching to fallback
			// Try fallback URL
			if (imageElement && fallbackUrl !== optimizedSrc) {
				imageElement.src = fallbackUrl;
			}
		}
	}

	// Handle retry with fallback
	function retryWithFallback() {
		if (imageElement && src) {
			hasError = false;
			isLoaded = false; // Reset loaded state when retrying
			imageElement.src = fallbackUrl;
		}
	}
</script>

<div class="optimized-image-container {className}" {style}>
	<!-- Skeleton loader -->
	{#if shouldShowSkeleton}
		<div class="skeleton-wrapper {isLoaded ? 'hidden' : ''}">
			<SkeletonLoader 
				width="100%"
				height="100%"
				borderRadius={skeletonBorderRadius}
			/>
		</div>
	{/if}

	<!-- Main image element -->
	{#if shouldShowImage}
		<img
			bind:this={imageElement}
			src={imageSrc}
			srcset={responsive ? srcset : (retina && retinaUrls ? `${retinaUrls.src1x} 1x, ${retinaUrls.src2x} 2x` : '')}
			sizes={responsive ? sizes : ''}
			{alt}
			{loading}
			class={`${className} ${!isLoaded ? 'loading' : 'loaded'}`}
			on:load={handleLoad}
			on:error={handleError}
			{...$$restProps}
		/>
	{/if}
</div>

<style>
	.optimized-image-container {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
	}

	.skeleton-wrapper {
		width: 100%;
		height: 100%;
		z-index: 1;
		position: absolute;
		top: 0;
		left: 0;
		transition: opacity 0.3s ease-in-out;
	}

	.skeleton-wrapper.hidden {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 0;
		opacity: 0;
		pointer-events: none;
	}

	img {
		@apply mx-auto;
		display: block;
		position: relative;
		z-index: 2;
		transition: opacity 0.3s ease-in-out;
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
	}

	img.loading {
		opacity: 0;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	img.loaded {
		opacity: 1;
		position: relative;
	}
</style> 