<script lang="ts">
	import ImportArtworkCard from './ImportArtworkCard.svelte';

	// Extended artwork type for import functionality
	export let artworks: Array<{
		id: number;
		title: string;
		name?: string;
		description: string;
		image_url?: string | null;
		animation_url?: string | null;
		thumbnailUrl?: string;
		contractAddr?: string;
		contractAlias?: string;
		tokenID?: string;
		blockchain?: string;
		indexed?: boolean;
		ownerAddresses?: string[];
		isCreatedBy?: string | null;
		attributes?: any[];
		tags?: string[];
		artist?: {
			name: string;
			avatarUrl: string | null;
			walletAddress?: string;
		} | null;
		supportsArtistLookup?: boolean;
		isImported?: boolean;
		dimensions?: {
			width: number;
			height: number;
		};
		imageUrl?: string;
		metadata?: any;
		display_uri?: string;
		artifact_uri?: string;
		thumbnail_uri?: string;
		displayUrl?: string;
		artifactUrl?: string;
		[key: string]: any;
	}> = [];

	export let selectedIds: number[] = [];
	export let onToggleSelection: ((artwork: any) => void) | null = null;
	export let canSelect: (artwork: any) => boolean = () => true;
	export let debugSkeletonMode = false;
	export let viewMode: 'grid' | 'list' = 'grid';
	export let selectAllChecked = false;
	export let onToggleSelectAll: (() => void) | null = null;

	// Helper function to create unique key from contract address and token ID
	function getArtworkKey(artwork: any): string {
		return `${artwork.contractAddress || artwork.contractAddr || 'unknown'}-${artwork.tokenId || artwork.tokenID || artwork.id}`;
	}

	// Deduplicate artworks by contract address + token ID
	$: uniqueArtworks = (() => {
		const seen = new Set<string>();
		return artworks.filter(artwork => {
			const key = getArtworkKey(artwork);
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	})();
</script>

{#if viewMode === 'grid'}
	<!-- Grid View -->
	<div class="artwork-grid">
		{#each uniqueArtworks as artwork (getArtworkKey(artwork))}
			<ImportArtworkCard
				{artwork}
				isSelected={selectedIds.includes(artwork.id)}
				{onToggleSelection}
				canSelect={canSelect(artwork)}
				{debugSkeletonMode}
				{viewMode}
			/>
		{/each}
	</div>
{:else}
	<!-- List View -->
	<div class="overflow-x-auto">
		<table class="w-full border-collapse bg-white dark:bg-gray-800 rounded-lg shadow-sm">
			<thead>
				<tr class="bg-gray-50 dark:bg-gray-700">
					<th class="p-3 text-left dark:text-gray-300 w-10">
						<input
							type="checkbox"
							checked={selectAllChecked}
							on:change={onToggleSelectAll}
							class="checkbox"
						/>
					</th>
					<th class="p-3 text-left dark:text-gray-300">Image</th>
					<th class="p-3 text-left dark:text-gray-300">Title</th>
					<th class="p-3 text-left dark:text-gray-300">Contract</th>
					<th class="p-3 text-left dark:text-gray-300">Blockchain</th>
					<th class="p-3 text-left dark:text-gray-300">Storage</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
				{#each uniqueArtworks as artwork (getArtworkKey(artwork))}
					<ImportArtworkCard
						{artwork}
						isSelected={selectedIds.includes(artwork.id)}
						{onToggleSelection}
						canSelect={canSelect(artwork)}
						{debugSkeletonMode}
						{viewMode}
					/>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style lang="scss">
	.artwork-grid {
		@apply grid gap-3;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		
		/* Responsive breakpoints for better grid layout */
		@apply gap-2 sm:gap-3;
		@media (max-width: 640px) {
			grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		}
		
		@media (min-width: 641px) and (max-width: 768px) {
			grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		}
		
		@media (min-width: 769px) and (max-width: 1024px) {
			grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
			@apply gap-3;
		}
		
		@media (min-width: 1025px) and (max-width: 1280px) {
			grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
			@apply gap-3;
		}
		
		@media (min-width: 1281px) {
			@apply gap-4;
			grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		}
	}
	
	/* Ensure consistent card heights in grid */
	.artwork-grid :global(.grid-item) {
		@apply h-fit;
		min-height: 320px;
	}
	
	/* Table styling improvements */
	.overflow-x-auto {
		@apply rounded-lg shadow-sm;
	}
	
	table th {
		@apply font-semibold text-sm uppercase tracking-wider;
	}
	
	/* Checkbox styling */
	.checkbox {
		@apply w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-md bg-transparent cursor-pointer transition-all duration-200 ease-in-out;
	}
	
	.checkbox:checked {
		@apply bg-amber-400 border-amber-400;
		background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='m13.854 3.646-7.5 7.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6 10.293l7.146-7.147a.5.5 0 0 1 .708.708z'/%3e%3c/svg%3e");
	}
</style> 