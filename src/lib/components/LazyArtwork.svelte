<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import OptimizedImage from './OptimizedImage.svelte';

	export let artwork: {
		id?: string | number;
		title: string;
		imageUrl?: string | null;
		image_url?: string | null;
		animationUrl?: string | null;
		animation_url?: string | null;
		thumbnailUrl?: string | null;
		thumbnail_url?: string | null;
		generatorUrl?: string | null;
		mime?: string | null;
		dimensions?: { width: number; height: number } | null;
	};
	
	export let aspectRatio: 'square' | 'auto' | 'video' | 'wide' | 'tall' = 'square';
	export let className: string = '';
	export let onClick: (() => void) | null = null;
	export let quality: number = 75;
	export let showSkeleton: boolean = true;
	export let rootMargin: string = '50px';
	export let threshold: number = 0.1;
	export let priority: boolean = false; // For above-the-fold content
	export let fit: 'contain' | 'cover' | 'crop' | 'scale-down' | 'pad' = 'contain';
	export let sizes: string = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw';
	export let responsiveSizes: number[] = [200, 300, 400, 500];

	let containerElement: HTMLElement;
	let observer: IntersectionObserver | null = null;
	let isVisible = false;
	let isLoaded = false;
	let imageError = false;

	// Normalize artwork properties to handle both formats
	$: displayImageUrl = artwork.imageUrl || artwork.image_url;
	$: displayAnimationUrl = artwork.animationUrl || artwork.animation_url;
	$: displayThumbnailUrl = artwork.thumbnailUrl || artwork.thumbnail_url;

	// Media detection functions
	function isVideoMimeType(mime: string | null | undefined): boolean {
		if (!mime) return false;
		return mime.startsWith('video/');
	}

	function isVideoUrl(url: string | null | undefined): boolean {
		if (!url) return false;
		return /\.(mp4|webm|mov|avi|m4v)$/i.test(url);
	}

	// Determine what to display
	$: isVideo = (isVideoMimeType(artwork.mime) || isVideoUrl(displayAnimationUrl)) && displayAnimationUrl;
	$: primaryUrl = displayThumbnailUrl || displayImageUrl || (isVideo ? null : displayAnimationUrl) || artwork.generatorUrl;
	$: videoUrl = isVideo ? displayAnimationUrl : null;

	// CSS class for aspect ratio
	$: aspectRatioClass = {
		'square': 'aspect-square',
		'auto': 'aspect-auto',
		'video': 'aspect-video',
		'wide': 'aspect-[16/9]',
		'tall': 'aspect-[9/16]'
	}[aspectRatio];

	function setupIntersectionObserver() {
		if (!containerElement || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
			// Fallback: load immediately if no intersection observer support
			isVisible = true;
			return;
		}

		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						isVisible = true;
						// Disconnect observer once visible to prevent re-triggering
						if (observer) {
							observer.unobserve(entry.target);
						}
					}
				});
			},
			{
				rootMargin,
				threshold
			}
		);

		observer.observe(containerElement);
	}

	function handleImageLoad() {
		isLoaded = true;
		imageError = false;
	}

	function handleImageError() {
		imageError = true;
		isLoaded = true; // Consider it "loaded" even if error to stop skeleton
	}

	onMount(() => {
		if (priority) {
			// Load immediately for priority content
			isVisible = true;
		} else {
			setupIntersectionObserver();
		}

		return () => {
			if (observer) {
				observer.disconnect();
			}
		};
	});

	onDestroy(() => {
		if (observer) {
			observer.disconnect();
		}
	});
</script>

<div 
	bind:this={containerElement}
	class="lazy-artwork-container {className}"
>
	{#if onClick}
		<button 
			class="lazy-artwork-button" 
			on:click={onClick}
			aria-label="View {artwork.title}"
		>
			<div class="artwork-stage {aspectRatioClass}">
				{#if !isVisible && showSkeleton}
					<!-- Skeleton loader -->
					<div class="skeleton-loader" />
				{:else if isVideo && videoUrl}
					<!-- Video content -->
					<video
						src={ipfsToHttpUrl(videoUrl)}
						class="stage-video"
						muted
						autoplay
						loop
						playsinline
						preload="metadata"
						on:loadeddata={handleImageLoad}
						on:error={handleImageError}
					>
						<!-- Video fallback -->
						{#if primaryUrl}
							<OptimizedImage
								src={ipfsToHttpUrl(primaryUrl)}
								alt={artwork.title}
								width={responsiveSizes[responsiveSizes.length - 1]}
								{sizes}
								responsive={true}
								{responsiveSizes}
								{quality}
								{fit}
								format="webp"
								className="stage-image"
								fallbackSrc="/images/medici-image.png"
								loading="lazy"
								mimeType={artwork.mime || 'image/png'}
								on:load={handleImageLoad}
								on:error={handleImageError}
							/>
						{/if}
					</video>
				{:else if primaryUrl}
					<!-- Image content -->
					<OptimizedImage
						src={ipfsToHttpUrl(primaryUrl)}
						alt={artwork.title}
						width={responsiveSizes[responsiveSizes.length - 1]}
						{sizes}
						responsive={true}
						{responsiveSizes}
						{quality}
						{fit}
						format="webp"
						className="stage-image"
						fallbackSrc="/images/medici-image.png"
						loading="lazy"
						mimeType={artwork.mime || 'image/png'}
						showSkeleton={showSkeleton && !isLoaded}
						on:load={handleImageLoad}
						on:error={handleImageError}
					/>
				{:else}
					<!-- Placeholder -->
					<div class="stage-placeholder">
						<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
							<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
						</svg>
					</div>
				{/if}
			</div>
		</button>
	{:else}
		<div class="lazy-artwork-display">
			<div class="artwork-stage {aspectRatioClass}">
				{#if !isVisible && showSkeleton}
					<!-- Skeleton loader -->
					<div class="skeleton-loader" />
				{:else if isVideo && videoUrl}
					<!-- Video content -->
					<video
						src={ipfsToHttpUrl(videoUrl)}
						class="stage-video"
						muted
						autoplay
						loop
						playsinline
						preload="metadata"
						on:loadeddata={handleImageLoad}
						on:error={handleImageError}
					>
						<!-- Video fallback -->
						{#if primaryUrl}
							<OptimizedImage
								src={ipfsToHttpUrl(primaryUrl)}
								alt={artwork.title}
								width={responsiveSizes[responsiveSizes.length - 1]}
								{sizes}
								responsive={true}
								{responsiveSizes}
								{quality}
								{fit}
								format="webp"
								className="stage-image"
								fallbackSrc="/images/medici-image.png"
								loading="lazy"
								mimeType={artwork.mime || 'image/png'}
								on:load={handleImageLoad}
								on:error={handleImageError}
							/>
						{/if}
					</video>
				{:else if primaryUrl}
					<!-- Image content -->
					<OptimizedImage
						src={ipfsToHttpUrl(primaryUrl)}
						alt={artwork.title}
						width={responsiveSizes[responsiveSizes.length - 1]}
						{sizes}
						responsive={true}
						{responsiveSizes}
						{quality}
						{fit}
						format="webp"
						className="stage-image"
						fallbackSrc="/images/medici-image.png"
						loading="lazy"
						mimeType={artwork.mime || 'image/png'}
						showSkeleton={showSkeleton && !isLoaded}
						on:load={handleImageLoad}
						on:error={handleImageError}
					/>
				{:else}
					<!-- Placeholder -->
					<div class="stage-placeholder">
						<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
							<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
						</svg>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.lazy-artwork-container {
		@apply w-full;
	}

	.lazy-artwork-button {
		@apply w-full bg-transparent border-none p-0 cursor-pointer block;
		@apply transition-transform duration-300 hover:scale-[1.01] focus:outline-none focus:scale-[1.01];
	}

	.lazy-artwork-display {
		@apply w-full;
	}

	.artwork-stage {
		@apply bg-gray-100 dark:bg-gray-950/70 w-full overflow-hidden flex items-center justify-center;
		
		/* Ensure auto aspect ratio doesn't break container constraints */
		&.aspect-auto {
			@apply h-full;
			max-height: 100%;
		}
	}

	.skeleton-loader {
		@apply w-full h-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700;
		animation: shimmer 1.5s infinite;
		background-size: 200% 100%;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	.stage-video {
		@apply w-full h-full object-contain;
		max-width: 100%;
		max-height: 100%;
	}

	:global(.stage-image) {
		@apply w-full h-full object-contain;
		max-width: 100% !important;
		max-height: 100% !important;
	}

	.stage-placeholder {
		@apply w-full h-full flex items-center justify-center text-gray-500;
	}

	.placeholder-icon {
		@apply w-16 h-16;
	}
</style> 