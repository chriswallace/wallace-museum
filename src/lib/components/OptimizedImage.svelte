<script lang="ts">
	import { buildOptimizedImageUrl, createResponsiveSrcSet, createRetinaUrls, buildDirectImageUrl } from '$lib/imageOptimization';
	import type { ImageOptimizationOptions } from '$lib/imageOptimization';
	import { ipfsToHttpUrl, IPFS_GATEWAYS } from '$lib/mediaUtils';
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
	export let mimeType: string | null | undefined = undefined;
	
	// Image optimization options
	export let quality: number = 85;
	export let format: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png' = 'auto';
	export let fit: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad' = 'contain';
	export let gravity: 'auto' | 'side' | string = 'center';
	export let dpr: 1 | 2 | 3 = 1;
	export let sharpen: number | undefined = undefined;
	export let animation: boolean = true;
	
	// Responsive options
	export let responsive: boolean = false;
	export let responsiveSizes: number[] = [400, 800, 1200];
	export let retina: boolean = false;
	
	// Fallback options
	export let fallbackSrc: string = '/images/placeholder.webp';
	export let showFallbackOnError: boolean = false;

	export let aspectRatio: string | undefined = undefined;

	// Skeleton loading options
	export let showSkeleton: boolean = true;
	export let skeletonBorderRadius: string = '4px';

	// Internal state
	let imageElement: HTMLImageElement;
	let hasError = false;
	let isLoaded = false;
	let isLoading = false;
	let hasTriedDirectIpfs = false;
	let hasTriedAlternativeGateways = false;
	let currentGatewayIndex = 0;
	let previousSrc = src;

	/**
	 * Extract CID from IPFS URL for fallback gateway usage
	 */
	function extractCidFromUrl(url: string): string | null {
		if (!url) return null;

		// If it's already just a CID (starts with Qm or bafy)
		if (url.startsWith('Qm') || url.startsWith('bafy')) {
			return url;
		}

		// Handle ipfs:// protocol
		if (url.startsWith('ipfs://')) {
			const cleaned = url.replace('ipfs://', '');
			const cidPart = cleaned.split('/')[0];
			return cidPart;
		}

		// Handle various gateway URLs
		const gatewayPatterns = [
			/https?:\/\/[^/]+\/ipfs\/([^/?#]+)/,
			/https?:\/\/gateway\.pinata\.cloud\/([^/?#]+)/,
			/https?:\/\/[^/]+\/([^/?#]+)/
		];

		for (const pattern of gatewayPatterns) {
			const match = url.match(pattern);
			if (match && match[1]) {
				const potentialCid = match[1];
				if (potentialCid.startsWith('Qm') || potentialCid.startsWith('bafy')) {
					return potentialCid;
				}
			}
		}

		return null;
	}

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
	 * Detect if this is a GIF file based on URL or MIME type
	 */
	function isGifFile(url: string, mime?: string | null): boolean {
		if (!url) return false;
		
		// Check MIME type first (most reliable)
		if (mime === 'image/gif') {
			return true;
		}
		
		// Check for .gif extension (case insensitive) as fallback
		if (url.toLowerCase().includes('.gif')) {
			return true;
		}
		
		// Check for GIF MIME type in data URLs
		if (url.startsWith('data:image/gif')) {
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
	$: isGif = src ? isGifFile(src, mimeType) : false;
	$: isIpfs = src ? isIpfsUrl(src) : false;
	$: canOptimize = isIpfs && !isSvg && !isGif; // Only optimize IPFS URLs that aren't SVGs or GIFs

	// Debug logging
	$: if (src && mimeType && isGif) {
		console.log(`[OptimizedImage] GIF detected - src: ${src}, mimeType: ${mimeType}, optimizedSrc: ${optimizedSrc}, directIpfsSrc: ${directIpfsSrc}, basicIpfsSrc: ${basicIpfsSrc}`);
	}

	// Additional debugging for cases where we might expect a GIF but it's not detected
	$: if (src && (src.toLowerCase().includes('.gif') || (mimeType && mimeType.includes('gif')))) {
		console.log(`[OptimizedImage] Potential GIF - src: ${src}, mimeType: ${mimeType}, isGif: ${isGif}, isIpfs: ${isIpfs}, canOptimize: ${canOptimize}, currentSrc: ${currentSrc}`);
	}

	// Build optimization options - don't apply format conversion to SVGs or GIFs
	$: optimizationOptions = {
		width,
		height,
		quality,
		format: (isSvg || isGif) ? 'auto' : format, // Use 'auto' for SVGs and GIFs to preserve original format
		fit,
		gravity,
		dpr: retina ? 2 : dpr,
		sharpen,
		animation,
		metadata: 'copyright',
		mimeType
	} as ImageOptimizationOptions;

	// Generate optimized URLs - only for IPFS URLs that can be optimized
	$: optimizedSrc = (() => {
		if (!src) return src;
		
		if (canOptimize) {
			// Can optimize - use the optimization service
			return buildOptimizedImageUrl(src, optimizationOptions);
		} else if (isGif && isIpfs) {
			// GIF on IPFS - use direct URL to preserve animation
			return buildDirectImageUrl(src);
		} else if (isIpfs) {
			// Other IPFS content that can't be optimized - use direct URL
			return buildDirectImageUrl(src);
		} else {
			// Non-IPFS URL - use as-is
			return src;
		}
	})();
	
	// Create different fallback levels for IPFS content
	$: directIpfsSrc = src && isIpfs ? buildDirectImageUrl(src) : '';
	$: basicIpfsSrc = src && isIpfs ? ipfsToHttpUrl(src) : '';
	$: alternativeGatewaySrc = (() => {
		if (!src || !isIpfs || !hasTriedDirectIpfs || currentGatewayIndex >= IPFS_GATEWAYS.length) return '';
		
		const cid = extractCidFromUrl(src);
		if (!cid) return '';
		
		return IPFS_GATEWAYS[currentGatewayIndex] + cid;
	})();
	$: finalFallbackSrc = fallbackSrc;
	
	// Determine which source to use based on error state and attempts
	$: currentSrc = (() => {
		if (!src || src.trim() === '') return '';
		
		if (!hasError) {
			// No error yet, use optimized version (which handles GIFs correctly)
			return optimizedSrc || src;
		}
		
		if (isIpfs && !hasTriedDirectIpfs) {
			// First error with IPFS content - try direct IPFS URL
			return directIpfsSrc || basicIpfsSrc || src;
		}
		
		if (isIpfs && !hasTriedAlternativeGateways && alternativeGatewaySrc) {
			// Try alternative IPFS gateways
			return alternativeGatewaySrc;
		}
		
		if (showFallbackOnError) {
			// Final fallback - use generic fallback image
			return finalFallbackSrc;
		}
		
		// No fallback allowed, stick with last attempted URL
		return src;
	})();
	
	// Determine if we should show the image
	$: shouldShowImage = src && src.trim() !== '';
	$: imageSrc = shouldShowImage ? currentSrc : '';

	// Show skeleton when loading or when src is empty but showSkeleton is true
	$: shouldShowSkeleton = showSkeleton && (isLoading || !shouldShowImage);
	
	// Debug logging for skeleton state
	$: if (src && shouldShowSkeleton !== previousSkeletonState) {
		console.log(`[OptimizedImage] Skeleton state changed for ${src?.substring(0, 50)}... - shouldShowSkeleton: ${shouldShowSkeleton}, isLoading: ${isLoading}, shouldShowImage: ${shouldShowImage}`);
		previousSkeletonState = shouldShowSkeleton;
	}
	
	let previousSkeletonState = shouldShowSkeleton;

	// Generate responsive srcset if enabled - only for IPFS URLs that can be optimized
	$: srcset = responsive && src && canOptimize && !hasError ? createResponsiveSrcSet(src, responsiveSizes, {
		height: optimizationOptions.height,
		quality: optimizationOptions.quality,
		format: optimizationOptions.format,
		fit: optimizationOptions.fit,
		gravity: optimizationOptions.gravity,
		dpr: optimizationOptions.dpr,
		sharpen: optimizationOptions.sharpen,
		animation: optimizationOptions.animation,
		metadata: optimizationOptions.metadata,
		mimeType: optimizationOptions.mimeType
	}) : '';

	// Generate retina URLs if enabled - only for IPFS URLs that can be optimized
	$: retinaUrls = retina && width && src && canOptimize && !hasError ? createRetinaUrls(src, width, {
		height: optimizationOptions.height,
		quality: optimizationOptions.quality,
		format: optimizationOptions.format,
		fit: optimizationOptions.fit,
		gravity: optimizationOptions.gravity,
		sharpen: optimizationOptions.sharpen,
		animation: optimizationOptions.animation,
		metadata: optimizationOptions.metadata,
		mimeType: optimizationOptions.mimeType
	}) : null;

	// Calculate aspect ratio
	$: calculatedAspectRatio = aspectRatio || (width && height ? `${width}/${height}` : undefined);

	// Handle image load start
	function handleLoadStart() {
		isLoading = true;
		isLoaded = false;
	}

	// Handle image load
	function handleLoad() {
		isLoaded = true;
		isLoading = false;
		// Don't reset hasError here - let it persist to track fallback state
	}

	// Handle image error
	function handleError() {
		console.log(`[OptimizedImage] Image failed to load: ${currentSrc}`);
		isLoading = false;
		
		if (isIpfs && !hasTriedDirectIpfs) {
			// First error with IPFS - try direct IPFS URL
			console.log(`[OptimizedImage] Trying direct IPFS URL for: ${src}`);
			hasTriedDirectIpfs = true;
			hasError = true;
			isLoaded = false;
		} else if (isIpfs && !hasTriedAlternativeGateways && currentGatewayIndex < IPFS_GATEWAYS.length) {
			// Try alternative IPFS gateways
			console.log(`[OptimizedImage] Trying alternative IPFS gateway ${currentGatewayIndex + 1}/${IPFS_GATEWAYS.length}: ${IPFS_GATEWAYS[currentGatewayIndex]}`);
			currentGatewayIndex++;
			
			// If we've tried all gateways, mark as having tried alternatives
			if (currentGatewayIndex >= IPFS_GATEWAYS.length) {
				hasTriedAlternativeGateways = true;
			}
			
			hasError = true;
			isLoaded = false;
		} else if (showFallbackOnError && currentSrc !== finalFallbackSrc) {
			// Try final fallback
			console.log(`[OptimizedImage] Trying final fallback for: ${src}`);
			hasError = true;
			isLoaded = false;
		} else {
			// All fallbacks exhausted
			console.log(`[OptimizedImage] All fallbacks exhausted for: ${src}`);
			isLoaded = true; // Stop trying
		}
	}

	// Handle retry with fallback
	function retryWithFallback() {
		if (imageElement && src) {
			hasError = false;
			hasTriedDirectIpfs = false;
			hasTriedAlternativeGateways = false;
			currentGatewayIndex = 0;
			isLoaded = false;
			isLoading = true;
		}
	}

	// Reset loading state when src changes
	$: if (src && shouldShowImage) {
		isLoading = true;
		isLoaded = false;
		hasError = false;
		hasTriedDirectIpfs = false;
		hasTriedAlternativeGateways = false;
		currentGatewayIndex = 0;
	}

	// Add cleanup timeout to prevent stuck loading states
	let loadingTimeout: ReturnType<typeof setTimeout> | null = null;
	
	// Set a timeout to force loading completion if image doesn't load
	$: if (isLoading && shouldShowImage) {
		if (loadingTimeout) {
			clearTimeout(loadingTimeout);
		}
		
		loadingTimeout = setTimeout(() => {
			if (isLoading) {
				console.warn(`[OptimizedImage] Loading timeout for: ${currentSrc}`);
				isLoading = false;
				isLoaded = true;
			}
		}, 10000); // 10 second timeout
	}

	// Clear timeout when loading completes
	$: if (!isLoading && loadingTimeout) {
		clearTimeout(loadingTimeout);
		loadingTimeout = null;
	}

	// Reset all states when src changes to prevent stuck states
	$: if (src !== previousSrc) {
		// Clear any existing timeout
		if (loadingTimeout) {
			clearTimeout(loadingTimeout);
			loadingTimeout = null;
		}
		
		// Reset all loading states
		isLoading = shouldShowImage ? true : false;
		isLoaded = false;
		hasError = false;
		hasTriedDirectIpfs = false;
		hasTriedAlternativeGateways = false;
		currentGatewayIndex = 0;
		
		// Track the previous src to detect changes
		previousSrc = src;
	}
</script>

<div 
	class="{className} image-container" 
	{style}
	style:aspect-ratio={calculatedAspectRatio}
	style:width={calculatedAspectRatio ? 'auto' : (width ? `${width}px` : '100%')}
	style:height={calculatedAspectRatio ? 'auto' : (height ? `${height}px` : '100%')}
>
	<!-- Skeleton loader positioned to exactly match the image -->
	{#if shouldShowSkeleton}
		<div class="skeleton-overlay">
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
			width={width || ''}
			height={height || ''}
			class={className}
			class:hidden={shouldShowSkeleton}
			style:--object-fit={fit}
			on:loadstart={handleLoadStart}
			on:load={handleLoad}
			on:error={handleError}
			{...$$restProps}
		/>
	{/if}
</div>

<style lang="scss">
	.image-container {
		@apply relative box-border flex items-center justify-center;
	}

	.skeleton-overlay {
		@apply absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center z-[1];
	}

	img {
		@apply mx-auto block transition-opacity duration-200 ease-in-out relative z-10;
		/* Apply object-fit based on the fit prop */
		object-fit: var(--object-fit, contain);
		/* Ensure proper scaling */
		max-width: 100%;
		max-height: 100%;
		width: 100%;
		height: 100%;
	}

	img.hidden {
		@apply opacity-0 pointer-events-none;
	}
</style> 