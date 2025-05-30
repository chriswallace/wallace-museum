<script lang="ts">
	import OptimizedImage from './OptimizedImage.svelte';
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';

	interface Artwork {
		id: number | string;
		title: string;
		imageUrl?: string;
		animationUrl?: string;
		mime?: string;
		dimensions?: {
			width: number;
			height: number;
		};
		creator?: string;
		artist_display_name?: string;
	}

	export let artworks: Artwork[] = [];
	export let columns: number = 3;
	export let gap: number = 16;
	export let imageWidth: number = 300;
	export let onArtworkClick: ((artwork: Artwork) => void) | undefined = undefined;
	export let showSkeletonCount: number = 12;

	let container: HTMLDivElement;
	let mounted = false;

	onMount(() => {
		mounted = true;
	});

	// Pre-defined aspect ratios for consistent skeleton layout
	const skeletonAspectRatios = [
		{ width: 400, height: 500 }, // 4:5 portrait
		{ width: 500, height: 400 }, // 5:4 landscape
		{ width: 400, height: 400 }, // 1:1 square
		{ width: 600, height: 400 }, // 3:2 landscape
		{ width: 400, height: 600 }, // 2:3 portrait
		{ width: 800, height: 400 }, // 2:1 wide
		{ width: 300, height: 500 }, // 3:5 tall portrait
		{ width: 700, height: 400 }, // 7:4 wide landscape
		{ width: 400, height: 300 }, // 4:3 landscape
		{ width: 500, height: 600 }, // 5:6 portrait
		{ width: 600, height: 300 }, // 2:1 wide
		{ width: 350, height: 500 }, // 7:10 portrait
	];

	// Calculate aspect ratio for each artwork
	function getAspectRatio(artwork: Artwork): string {
		if (artwork.dimensions?.width && artwork.dimensions?.height) {
			return `${artwork.dimensions.width}/${artwork.dimensions.height}`;
		}
		return '1/1'; // Default square aspect ratio
	}

	// Calculate height based on aspect ratio and fixed width
	function calculateHeight(artwork: Artwork): number {
		if (artwork.dimensions?.width && artwork.dimensions?.height) {
			return Math.round((imageWidth * artwork.dimensions.height) / artwork.dimensions.width);
		}
		return imageWidth; // Square fallback
	}

	// Get image URL with fallback
	function getImageUrl(artwork: Artwork): string {
		return artwork.imageUrl || artwork.animationUrl || '';
	}

	// Handle artwork click
	function handleArtworkClick(artwork: Artwork) {
		if (onArtworkClick) {
			onArtworkClick(artwork);
		}
	}

	// Create stable grid items that combine artworks and skeletons
	$: gridItems = (() => {
		const items = [];
		const totalItems = Math.max(artworks.length, showSkeletonCount);
		
		for (let i = 0; i < totalItems; i++) {
			const artwork = artworks[i];
			const skeletonRatio = skeletonAspectRatios[i % skeletonAspectRatios.length];
			
			if (artwork) {
				// Real artwork
				items.push({
					id: artwork.id,
					type: 'artwork' as const,
					artwork,
					aspectRatio: getAspectRatio(artwork),
					height: calculateHeight(artwork)
				});
			} else {
				// Skeleton placeholder
				items.push({
					id: `skeleton-${i}`,
					type: 'skeleton' as const,
					aspectRatio: `${skeletonRatio.width}/${skeletonRatio.height}`,
					height: Math.round((imageWidth * skeletonRatio.height) / skeletonRatio.width)
				});
			}
		}
		
		return items;
	})();

	// Responsive column calculation
	$: responsiveColumns = mounted ? Math.min(columns, Math.floor(container?.offsetWidth / (imageWidth + gap)) || columns) : columns;
</script>

<div 
	bind:this={container}
	class="stable-masonry-container"
	style="--columns: {responsiveColumns}; --gap: {gap}px; --image-width: {imageWidth}px;"
>
	{#each gridItems as item (item.id)}
		<div 
			class="masonry-item {item.type === 'skeleton' ? 'skeleton-item' : ''}"
			style="height: {item.height}px;"
		>
			{#if item.type === 'artwork'}
				<div 
					class="artwork-content"
					in:fade={{ duration: 300 }}
					role={onArtworkClick ? 'button' : undefined}
					tabindex={onArtworkClick ? 0 : undefined}
					on:click={() => handleArtworkClick(item.artwork)}
					on:keydown={(e) => {
						if (onArtworkClick && (e.key === 'Enter' || e.key === ' ')) {
							e.preventDefault();
							handleArtworkClick(item.artwork);
						}
					}}
				>
					<div class="artwork-image-wrapper">
						<OptimizedImage
							src={getImageUrl(item.artwork)}
							alt={item.artwork.title}
							width={imageWidth}
							height={item.height}
							quality={85}
							format="webp"
							fit="cover"
							responsive={true}
							responsiveSizes={[imageWidth * 0.5, imageWidth, imageWidth * 1.5]}
							sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
							aspectRatio={item.aspectRatio}
							skeletonBorderRadius="12px"
							className="masonry-image"
						/>
					</div>
					
					<div class="artwork-overlay">
						<div class="artwork-info">
							<h3 class="artwork-title">{item.artwork.title}</h3>
							{#if item.artwork.creator || item.artwork.artist_display_name}
								<p class="artwork-artist">{item.artwork.creator || item.artwork.artist_display_name}</p>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<!-- Skeleton placeholder -->
				<div class="skeleton-content">
					<div class="artwork-image-wrapper">
						<OptimizedImage
							src=""
							alt=""
							width={imageWidth}
							height={item.height}
							aspectRatio={item.aspectRatio}
							skeletonBorderRadius="12px"
							className="masonry-image"
						/>
					</div>
					
					<div class="artwork-overlay skeleton-overlay">
						<div class="artwork-info">
							<div class="skeleton-title"></div>
							<div class="skeleton-artist"></div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.stable-masonry-container {
		display: grid;
		grid-template-columns: repeat(var(--columns), 1fr);
		gap: var(--gap);
		width: 100%;
		align-items: start;
	}

	.masonry-item {
		position: relative;
		width: 100%;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		background: #f8fafc;
	}

	.artwork-content {
		width: 100%;
		height: 100%;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
	}

	.artwork-content:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
	}

	.artwork-content:focus {
		outline: 3px solid #3b82f6;
		outline-offset: 2px;
	}

	.skeleton-content {
		width: 100%;
		height: 100%;
		pointer-events: none;
		cursor: default;
	}

	.skeleton-item {
		background: #f1f5f9;
	}

	.artwork-image-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
	}

	:global(.masonry-image) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.3s ease;
	}

	.artwork-content:hover :global(.masonry-image) {
		transform: scale(1.02);
	}

	.artwork-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
		padding: 2rem 1rem 1rem;
		transform: translateY(100%);
		transition: transform 0.3s ease;
	}

	.artwork-content:hover .artwork-overlay {
		transform: translateY(0);
	}

	.skeleton-overlay {
		transform: translateY(0);
		background: rgba(0, 0, 0, 0.1);
	}

	.artwork-info {
		color: white;
	}

	.artwork-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.artwork-artist {
		font-size: 0.875rem;
		opacity: 0.9;
		margin: 0;
		line-height: 1.2;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Skeleton loading styles */
	.skeleton-title {
		height: 1rem;
		background: linear-gradient(90deg, rgba(255, 255, 255, 0.3) 25%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0.3) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
		margin-bottom: 0.25rem;
		width: 85%;
	}

	.skeleton-artist {
		height: 0.875rem;
		background: linear-gradient(90deg, rgba(255, 255, 255, 0.3) 25%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0.3) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
		width: 65%;
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.masonry-item {
			background: #1e293b;
		}

		.skeleton-item {
			background: #334155;
		}

		.skeleton-overlay {
			background: rgba(0, 0, 0, 0.2);
		}

		.skeleton-title,
		.skeleton-artist {
			background: linear-gradient(90deg, rgba(100, 116, 139, 0.3) 25%, rgba(148, 163, 184, 0.5) 50%, rgba(100, 116, 139, 0.3) 75%);
			background-size: 200% 100%;
		}
	}

	/* Responsive breakpoints */
	@media (max-width: 1024px) {
		.stable-masonry-container {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 768px) {
		.stable-masonry-container {
			grid-template-columns: repeat(2, 1fr);
			gap: 12px;
		}

		.masonry-item {
			border-radius: 8px;
		}

		.artwork-overlay {
			padding: 1.5rem 0.75rem 0.75rem;
		}

		.artwork-title {
			font-size: 0.9rem;
		}

		.artwork-artist {
			font-size: 0.8rem;
		}
	}

	@media (max-width: 480px) {
		.stable-masonry-container {
			grid-template-columns: 1fr;
			gap: 8px;
		}

		.artwork-overlay {
			padding: 1rem 0.75rem 0.75rem;
		}
	}

	/* Ensure proper stacking for overlay */
	.masonry-item {
		isolation: isolate;
	}
</style> 