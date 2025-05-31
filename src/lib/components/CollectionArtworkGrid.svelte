<script lang="ts">
	import ArtworkCard from './ArtworkCard.svelte';

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