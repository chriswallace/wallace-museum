<script lang="ts">
	import OptimizedImage from './OptimizedImage.svelte';
	import { fade } from 'svelte/transition';
	import ArtworkCard from './ArtworkCard.svelte';

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

	export let artworks: Array<{
		id: number | string;
		title?: string;
		imageUrl?: string;
		mime?: string;
	}> = [];
	export let variant: 'collection' | 'search' = 'collection';
	export let showRemoveButtons = false;
	export let onRemove: ((artwork: any) => void) | null = null;
	export let selectedArtworks: Set<number | string> = new Set();
	export let onToggleSelection: ((artworkId: number | string) => void) | null = null;
	export let showAddCard = false;
	export let onAddNew: (() => void) | null = null;
	export let onAddExisting: (() => void) | null = null;
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

<div class="artwork-grid" class:search-grid={variant === 'search'}>
	{#each artworks as artwork}
		<ArtworkCard
			{artwork}
			showRemoveButton={showRemoveButtons}
			{onRemove}
			selectable={variant === 'search'}
			isSelected={selectedArtworks.has(artwork.id)}
			onSelect={onToggleSelection}
		/>
	{/each}

	{#if showAddCard && variant === 'collection'}
		<div class="fieldset add-artwork">
			<div class="add-artwork-buttons">
				<button class="primary w-full mb-4" on:click={onAddNew}>Add new</button>
				<button class="secondary w-full" on:click={onAddExisting}>Add existing</button>
				</div>
			</div>
	{/if}
</div>

<style lang="scss">
	.artwork-grid {
		@apply grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4;

		&.search-grid {
			@apply grid-cols-4 gap-4 w-full max-h-[60vh] overflow-y-scroll mt-8 items-start justify-start;
		}
	}

	.add-artwork {
		@apply grid grid-cols-1 content-center text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-sm p-8 aspect-square;
	}
</style> 