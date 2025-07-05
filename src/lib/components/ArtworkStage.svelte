<script lang="ts">
	import OptimizedImage from './OptimizedImage.svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';

	export let artwork: {
		id?: string | number;
		title: string;
		imageUrl?: string | null;
		animationUrl?: string | null;
		generatorUrl?: string | null;
		mime?: string | null;
		dimensions?: { width: number; height: number } | null;
	};
	
	export let aspectRatio: 'square' | 'auto' | 'video' | 'wide' | 'tall' = 'square';
	export let className: string = '';
	export let onClick: (() => void) | null = null;
	export let loading: 'lazy' | 'eager' = 'lazy';
	export let quality: number = 85;
	export let showShadow: boolean = false;

	// Add key to force re-render when artwork changes
	$: artworkKey = `${artwork.id}-${artwork.imageUrl || artwork.animationUrl || artwork.generatorUrl}`;

	// Media detection functions
	function isVideoMimeType(mime: string | null | undefined): boolean {
		if (!mime) return false;
		return mime.startsWith('video/');
	}

	function isVideoUrl(url: string | null | undefined): boolean {
		if (!url) return false;
		return /\.(mp4|webm|mov|avi|m4v)$/i.test(url);
	}

	// Determine display URL and type
	$: displayUrl = artwork.imageUrl || artwork.animationUrl || artwork.generatorUrl;
	$: isVideo = (isVideoMimeType(artwork.mime) || isVideoUrl(artwork.animationUrl)) && artwork.animationUrl;
	$: videoUrl = isVideo ? artwork.animationUrl : null;
	$: imageUrl = artwork.imageUrl || (isVideo ? null : artwork.animationUrl) || artwork.generatorUrl;

	// CSS class for aspect ratio
	$: aspectRatioClass = {
		'square': 'aspect-square',
		'auto': 'aspect-auto',
		'video': 'aspect-video',
		'wide': 'aspect-[16/9]',
		'tall': 'aspect-[9/16]'
	}[aspectRatio];
</script>

{#key artworkKey}
	{#if onClick}
		<button 
			class="artwork-stage-button {className}" 
			on:click={onClick}
			aria-label="View {artwork.title}"
		>
		<div class="stage {aspectRatioClass}" class:shadow={showShadow}>
			{#if isVideo && videoUrl}
				<video
					src={ipfsToHttpUrl(videoUrl)}
					class="stage-video"
					muted
					autoplay
					loop
					playsinline
					preload="metadata"
				>
					<!-- Fallback to image if video fails -->
					{#if imageUrl}
						<OptimizedImage
							src={ipfsToHttpUrl(imageUrl)}
							alt={artwork.title}
							fit="contain"
							format="auto"
							quality={quality}
							className="stage-image"
							fallbackSrc="/images/placeholder.webp"
							loading={loading}
							mimeType="image/png"
						/>
					{/if}
				</video>
			{:else if imageUrl}
				<OptimizedImage
					src={ipfsToHttpUrl(imageUrl)}
					alt={artwork.title}
					fit="contain"
					format="auto"
					quality={quality}
					className="stage-image"
					fallbackSrc="/images/placeholder.webp"
					loading={loading}
					mimeType={artwork.mime || 'image/png'}
				/>
			{:else}
				<div class="stage-placeholder">
					<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
						<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
					</svg>
				</div>
			{/if}
		</div>
	</button>
{:else}
	<div class="artwork-stage-container {className}">
		<div class="stage {aspectRatioClass}" class:shadow={showShadow}>
			{#if isVideo && videoUrl}
				<video
					src={ipfsToHttpUrl(videoUrl)}
					class="stage-video"
					muted
					autoplay
					loop
					playsinline
					preload="metadata"
				>
					<!-- Fallback to image if video fails -->
					{#if imageUrl}
						<OptimizedImage
							src={ipfsToHttpUrl(imageUrl)}
							alt={artwork.title}
							fit="contain"
							format="auto"
							quality={quality}
							className="stage-image"
							fallbackSrc="/images/placeholder.webp"
							loading={loading}
							mimeType="image/png"
						/>
					{/if}
				</video>
			{:else if imageUrl}
				<OptimizedImage
					src={ipfsToHttpUrl(imageUrl)}
					alt={artwork.title}
					fit="contain"
					format="auto"
					quality={quality}
					className="stage-image"
					fallbackSrc="/images/placeholder.webp"
					loading={loading}
					mimeType={artwork.mime || 'image/png'}
				/>
			{:else}
				<div class="stage-placeholder">
					<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
						<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
					</svg>
				</div>
			{/if}
		</div>
	</div>
{/if}
{/key}

<style lang="scss">
	.artwork-stage-button {
		@apply w-full bg-transparent border-none p-0 cursor-pointer block;
		@apply transition-transform duration-300 hover:scale-[1.01] focus:outline-none focus:scale-[1.01];
	}

	.artwork-stage-container {
		@apply w-full;
	}

	.stage {
		@apply bg-gray-100 dark:bg-gray-950/70 w-full overflow-hidden flex items-center justify-center;
		
		&.shadow {
			@apply shadow-2xl;
		}
		
		/* Ensure auto aspect ratio doesn't break container constraints */
		&.aspect-auto {
			@apply h-full;
			max-height: 100%;
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