<script lang="ts">
	import OptimizedImage from './OptimizedImage.svelte';
	import { fade } from 'svelte/transition';

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
	export let gap: string = '1rem';
	export let imageSize: 'small' | 'medium' | 'large' = 'medium';
	export let onArtworkClick: ((artwork: Artwork) => void) | undefined = undefined;
	export let showSkeletonCount: number = 12; // Number of skeleton items to show when loading

	// Image size configurations
	const imageSizes = {
		small: { width: 300, quality: 80 },
		medium: { width: 400, quality: 85 },
		large: { width: 500, quality: 90 }
	};

	$: currentImageConfig = imageSizes[imageSize];

	// Calculate aspect ratio for skeleton loaders
	function getAspectRatio(artwork: Artwork): string {
		if (artwork.dimensions?.width && artwork.dimensions?.height) {
			return `${artwork.dimensions.width}/${artwork.dimensions.height}`;
		}
		return '1/1'; // Default square aspect ratio
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

	// Generate skeleton items for loading state
	$: skeletonItems = Array.from({ length: showSkeletonCount }, (_, i) => ({
		id: `skeleton-${i}`,
		aspectRatio: i % 3 === 0 ? '4/5' : i % 3 === 1 ? '3/4' : '1/1' // Varied aspect ratios
	}));
</script>

<div 
	class="artwork-grid"
	style="--columns: {columns}; --gap: {gap};"
>
	{#if artworks.length > 0}
		{#each artworks as artwork (artwork.id)}
			<div 
				class="artwork-item"
				in:fade={{ duration: 300 }}
				role={onArtworkClick ? 'button' : undefined}
				tabindex={onArtworkClick ? 0 : undefined}
				on:click={() => handleArtworkClick(artwork)}
				on:keydown={(e) => {
					if (onArtworkClick && (e.key === 'Enter' || e.key === ' ')) {
						e.preventDefault();
						handleArtworkClick(artwork);
					}
				}}
			>
				<div 
					class="artwork-image-container"
					style="aspect-ratio: {getAspectRatio(artwork)};"
				>
					<OptimizedImage
						src={getImageUrl(artwork)}
						alt={artwork.title}
						width={currentImageConfig.width}
						quality={currentImageConfig.quality}
						format="webp"
						fit="cover"
						responsive={true}
						responsiveSizes={[currentImageConfig.width * 0.5, currentImageConfig.width, currentImageConfig.width * 1.5]}
						sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
						aspectRatio={getAspectRatio(artwork)}
						skeletonBorderRadius="8px"
						className="artwork-image"
					/>
				</div>
				
				<div class="artwork-info">
					<h3 class="artwork-title">{artwork.title}</h3>
					{#if artwork.creator || artwork.artist_display_name}
						<p class="artwork-artist">{artwork.creator || artwork.artist_display_name}</p>
					{/if}
				</div>
			</div>
		{/each}
	{:else}
		<!-- Loading skeleton grid -->
		{#each skeletonItems as skeleton}
			<div class="artwork-item skeleton-item">
				<div 
					class="artwork-image-container skeleton-image"
					style="aspect-ratio: {skeleton.aspectRatio};"
				>
					<!-- Skeleton loader will be shown by OptimizedImage when src is empty -->
					<OptimizedImage
						src=""
						alt=""
						width={currentImageConfig.width}
						aspectRatio={skeleton.aspectRatio}
						skeletonBorderRadius="8px"
						className="artwork-image"
					/>
				</div>
				
				<div class="artwork-info">
					<div class="skeleton-title"></div>
					<div class="skeleton-artist"></div>
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	.artwork-grid {
		display: grid;
		grid-template-columns: repeat(var(--columns), 1fr);
		gap: var(--gap);
		width: 100%;
	}

	.artwork-item {
		display: flex;
		flex-direction: column;
		background: white;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transition: all 0.3s ease;
		cursor: pointer;
	}

	.artwork-item:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}

	.artwork-item:focus {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.artwork-image-container {
		position: relative;
		width: 100%;
		overflow: hidden;
	}

	:global(.artwork-image) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.3s ease;
	}

	.artwork-item:hover :global(.artwork-image) {
		transform: scale(1.05);
	}

	.artwork-info {
		padding: 1rem;
		flex-grow: 1;
	}

	.artwork-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: #1f2937;
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.artwork-artist {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Skeleton loading styles */
	.skeleton-item {
		pointer-events: none;
		cursor: default;
	}

	.skeleton-item:hover {
		transform: none;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.skeleton-title {
		height: 1.2rem;
		background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
		margin-bottom: 0.5rem;
		width: 80%;
	}

	.skeleton-artist {
		height: 1rem;
		background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 4px;
		width: 60%;
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
		.artwork-item {
			background: #1f2937;
		}

		.artwork-title {
			color: #f9fafb;
		}

		.artwork-artist {
			color: #9ca3af;
		}

		.skeleton-title,
		.skeleton-artist {
			background: linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%);
			background-size: 200% 100%;
		}
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.artwork-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 480px) {
		.artwork-grid {
			grid-template-columns: 1fr;
		}
		
		.artwork-info {
			padding: 0.75rem;
		}
	}
</style> 