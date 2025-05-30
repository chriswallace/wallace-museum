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
</script>

{#if viewMode === 'grid'}
	<!-- Grid View -->
	<div class="css-grid">
		{#each artworks as artwork (artwork.id)}
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
		<table class="w-full border-collapse bg-white dark:bg-gray-800 rounded-sm shadow-sm">
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
				{#each artworks as artwork (artwork.id)}
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
	.css-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
		
		/* Responsive breakpoints for better control */
		@media (min-width: 640px) {
			grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		}
		
		@media (min-width: 768px) {
			grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		}
		
		@media (min-width: 1024px) {
			grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		}
		
		@media (min-width: 1280px) {
			grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		}
	}
</style> 