<script lang="ts">
	import OptimizedImage from './OptimizedImage.svelte';
	import ArtistNameWithAvatar from './ArtistNameWithAvatar.svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { getBestMediaUrl, getMediaDisplayType } from '$lib/utils/mediaHelpers';
	import type { MediaUrls } from '$lib/utils/mediaHelpers';

	// Extended artwork type for import functionality
	export let artwork: {
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
		mime?: string;
		[key: string]: any;
	};

	export let isSelected = false;
	export let onToggleSelection: ((artwork: any) => void) | null = null;
	export let canSelect = true;
	export let debugSkeletonMode = false;
	export let viewMode: 'grid' | 'list' = 'grid';

	// Use centralized media handling utilities
	$: mediaUrls = {
		generatorUrl: null, // Import cards typically don't have generator URLs
		animationUrl: getArtworkAnimationUrl(artwork),
		imageUrl: getArtworkImageUrl(artwork),
		thumbnailUrl: artwork.thumbnailUrl || artwork.thumbnail_uri
	} as MediaUrls;

	$: bestMediaForThumbnail = getBestMediaUrl(mediaUrls, 'thumbnail', artwork.mime);
	$: bestMediaForFullsize = getBestMediaUrl(mediaUrls, 'fullscreen', artwork.mime);
	$: thumbnailDisplayType = getMediaDisplayType(bestMediaForThumbnail, artwork.mime);
	$: fullsizeDisplayType = getMediaDisplayType(bestMediaForFullsize, artwork.mime);

	// Helper functions
	function getArtworkImageUrl(artwork: any): string {
		return artwork.image_url || 
			   artwork.imageUrl || 
			   artwork.display_uri || 
			   artwork.displayUrl || 
			   '';
	}

	function getArtworkAnimationUrl(artwork: any): string {
		return artwork.animation_url || 
			   artwork.animationUrl || 
			   artwork.artifact_uri || 
			   artwork.artifactUrl || 
			   '';
	}

	function getArtworkTitle(artwork: any): string {
		return artwork.title || artwork.name || 'Untitled';
	}

	function getContractName(artwork: any): string {
		return artwork.contractAlias || artwork.contractAddr || 'Unknown Contract';
	}

	function getBlockchain(artwork: any): string {
		return artwork.blockchain || '';
	}

	function getTokenId(artwork: any): string {
		return artwork.tokenID || artwork.token_id || '';
	}

	function hasIpfsContent(artwork: any): boolean {
		const imageUrl = getArtworkImageUrl(artwork);
		const animationUrl = getArtworkAnimationUrl(artwork);
		return imageUrl.includes('ipfs://') || imageUrl.includes('/ipfs/') ||
			   animationUrl.includes('ipfs://') || animationUrl.includes('/ipfs/');
	}

	function getCollectionInfo(artwork: any): { title?: string } | null {
		// This would need to be implemented based on your data structure
		return null;
	}

	function getArtistInfo(artwork: any) {
		return artwork.artist;
	}

	function handleImageError(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		img.src = '/images/medici-image.png';
	}

	function handleClick() {
		if (canSelect && onToggleSelection) {
			onToggleSelection(artwork);
		}
	}

	// Get the appropriate media URL for display
	function getDisplayMediaUrl(context: 'thumbnail' | 'fullsize' = 'thumbnail'): string {
		const mediaResult = context === 'thumbnail' ? bestMediaForThumbnail : bestMediaForFullsize;
		return mediaResult?.url ? ipfsToHttpUrl(mediaResult.url) : '';
	}

	// Determine if we should display as video
	function shouldDisplayAsVideo(context: 'thumbnail' | 'fullsize' = 'thumbnail'): boolean {
		const displayType = context === 'thumbnail' ? thumbnailDisplayType : fullsizeDisplayType;
		return displayType === 'video';
	}
</script>

{#if viewMode === 'grid'}
	<!-- Grid View Card -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="grid-item group bg-white dark:bg-gray-800 rounded-sm shadow-sm overflow-hidden transition-all duration-200"
		class:opacity-50={artwork.isImported}
		class:cursor-not-allowed={artwork.isImported}
		class:cursor-pointer={!artwork.isImported}
		class:hover:shadow-lg={!artwork.isImported}
		class:selected={isSelected && !artwork.isImported}
		on:click={handleClick}
		role="button"
		tabindex={canSelect ? 0 : -1}
	>
		<div class="relative">
			{#if debugSkeletonMode}
				<!-- Debug skeleton mode - show empty OptimizedImage -->
				<OptimizedImage
					src=""
					alt={getArtworkTitle(artwork)}
					width={300}
					height={artwork.dimensions ? Math.round((300 * artwork.dimensions.height) / artwork.dimensions.width) : 300}
					format="webp"
					quality={80}
					aspectRatio={artwork.dimensions ? `${artwork.dimensions.width}/${artwork.dimensions.height}` : '1/1'}
					showSkeleton={true}
					skeletonBorderRadius="0px"
					className="w-full h-auto object-contain rounded-t-sm"
					fallbackSrc="/images/medici-image.png"
					loading="lazy"
					on:error={handleImageError}
				/>
			{:else if shouldDisplayAsVideo()}
				<!-- Video display without controls -->
				<video
					src={getDisplayMediaUrl()}
					class="w-full h-auto object-contain rounded-t-sm"
					style="aspect-ratio: {artwork.dimensions ? `${artwork.dimensions.width}/${artwork.dimensions.height}` : '1/1'};"
					autoplay
					loop
					muted
					playsinline
					on:error={handleImageError}
				>
					<track kind="captions" />
					Your browser does not support the video tag.
				</video>
			{:else}
				<!-- Image display -->
				<OptimizedImage
					src={getDisplayMediaUrl()}
					alt={getArtworkTitle(artwork)}
					width={300}
					height={artwork.dimensions ? Math.round((300 * artwork.dimensions.height) / artwork.dimensions.width) : 300}
					format="webp"
					quality={80}
					aspectRatio={artwork.dimensions ? `${artwork.dimensions.width}/${artwork.dimensions.height}` : '1/1'}
					showSkeleton={true}
					skeletonBorderRadius="0px"
					className="w-full h-auto object-contain rounded-t-sm"
					fallbackSrc="/images/medici-image.png"
					loading="lazy"
					on:error={handleImageError}
				/>
			{/if}

			<!-- Selection indicator -->
			{#if isSelected}
				<div
					class="absolute top-3 right-3 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-xl border-4 border-white dark:border-gray-800 z-20"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
				</div>
			{:else if !artwork.isImported}
				<!-- Unselected state indicator (shows on hover) -->
				<div
					class="absolute top-3 right-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-full w-8 h-8 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-70 transition-all duration-200 z-20"
				>
					<!-- Empty circle for unselected state -->
				</div>
			{/if}

			<!-- Imported indicator -->
			{#if artwork.isImported}
				<div
					class="absolute top-3 left-3 bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-xl border-2 border-white dark:border-gray-800 z-20"
					title="Already imported"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
				</div>
			{/if}

			<!-- IPFS indicator -->
			{#if hasIpfsContent(artwork)}
				<div
					class="absolute bottom-3 right-3 bg-purple-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800 z-10"
					title="Contains IPFS content"
				>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
						<path
							d="M12 2L4 6V12C4 15.31 7.58 18.5 12 20C16.42 18.5 20 15.31 20 12V6L12 2Z"
						/>
					</svg>
				</div>
			{/if}
		</div>
		
		<div class="p-3">
			<h3 class="font-medium text-base truncate dark:text-gray-100" title={getArtworkTitle(artwork)}>
				{getArtworkTitle(artwork)}
			</h3>

			<!-- Enhanced collection/artist info -->
			{#if artwork.supportsArtistLookup}
				{@const collectionInfo = getCollectionInfo(artwork)}
				{@const artistInfo = getArtistInfo(artwork)}

				<div class="space-y-1">
					<!-- Collection name -->
					{#if collectionInfo}
						<div class="font-medium text-sm">
							{collectionInfo.title || 'Unknown Collection'}
						</div>
					{:else}
						<div class="font-medium text-sm">
							{getContractName(artwork)}
						</div>
					{/if}

					<!-- Artist info -->
					{#if artistInfo}
						<ArtistNameWithAvatar 
							artist={{
								name: artistInfo.name,
								avatarUrl: artistInfo.avatarUrl
							}}
							size="xs"
							showAvatar={true}
							debugSkeletonMode={debugSkeletonMode}
							nameClassName="text-gray-500 dark:text-gray-400"
							containerClassName="mt-1"
							prefix="by"
						/>
					{/if}
				</div>
			{:else}
				<div class="text-xs text-gray-500 dark:text-gray-400 truncate">
					{getContractName(artwork)}
				</div>
			{/if}

			{#if getBlockchain(artwork)}
				<div class="mt-1">
					<span
						class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
					>
						{getBlockchain(artwork)}
					</span>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<!-- List View Row -->
	<tr
		class="{isSelected && !artwork.isImported
			? 'bg-blue-50 dark:bg-blue-900/30'
			: 'dark:bg-gray-800'} {artwork.isImported
			? 'opacity-50'
			: 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'}"
		on:click={handleClick}
	>
		<td class="p-3">
			{#if artwork.isImported}
				<div class="flex items-center space-x-2">
					<span class="text-green-600 font-medium text-sm">✓ Imported</span>
				</div>
			{:else}
				<input
					type="checkbox"
					checked={isSelected}
					class="checkbox"
					on:change={(e) => {
						e.stopPropagation();
						if (onToggleSelection) onToggleSelection(artwork);
					}}
					on:click={(e) => e.stopPropagation()}
				/>
			{/if}
		</td>
		<td class="p-3 w-16">
			<div class="w-12 h-12 overflow-hidden rounded-sm">
				<div class="relative">
					{#if debugSkeletonMode}
						<!-- Debug skeleton mode -->
						<OptimizedImage
							src=""
							alt={getArtworkTitle(artwork)}
							width={48}
							height={48}
							fit="cover"
							format="webp"
							quality={80}
							aspectRatio="1/1"
							showSkeleton={true}
							skeletonBorderRadius="6px"
							className="w-full h-full object-cover"
							fallbackSrc="/images/medici-image.png"
							loading="lazy"
							on:error={handleImageError}
						/>
					{:else if shouldDisplayAsVideo()}
						<!-- Video thumbnail without controls -->
						<video
							src={getDisplayMediaUrl()}
							class="w-full h-full object-cover"
							autoplay
							loop
							muted
							playsinline
							on:error={handleImageError}
						>
							<track kind="captions" />
							Your browser does not support the video tag.
						</video>
					{:else}
						<!-- Image thumbnail -->
						<OptimizedImage
							src={getDisplayMediaUrl()}
							alt={getArtworkTitle(artwork)}
							width={48}
							height={48}
							fit="cover"
							format="webp"
							quality={80}
							aspectRatio="1/1"
							showSkeleton={true}
							skeletonBorderRadius="6px"
							className="w-full h-full object-cover"
							fallbackSrc="/images/medici-image.png"
							loading="lazy"
							on:error={handleImageError}
						/>
					{/if}
				</div>
			</div>
		</td>
		<td class="p-3">
			<div class="font-medium dark:text-gray-100">{getArtworkTitle(artwork)}</div>
			<div class="text-xs text-gray-500 dark:text-gray-400">
				ID: {getTokenId(artwork)}
			</div>
		</td>
		<td class="p-3 dark:text-gray-300">
			<!-- Enhanced collection/artist info -->
			{#if artwork.supportsArtistLookup}
				{@const collectionInfo = getCollectionInfo(artwork)}
				{@const artistInfo = getArtistInfo(artwork)}

				<div class="space-y-1">
					<!-- Collection name -->
					{#if collectionInfo}
						<div class="font-medium text-sm">
							{collectionInfo.title || 'Unknown Collection'}
						</div>
					{:else}
						<div class="font-medium text-sm">
							{getContractName(artwork)}
						</div>
					{/if}

					<!-- Artist info -->
					{#if artistInfo}
						<ArtistNameWithAvatar 
							artist={{
								name: artistInfo.name,
								avatarUrl: artistInfo.avatarUrl
							}}
							size="xs"
							showAvatar={true}
							debugSkeletonMode={debugSkeletonMode}
							nameClassName="text-gray-500 dark:text-gray-400"
							prefix="by"
						/>
					{/if}
				</div>
			{:else}
				<div class="text-xs text-gray-500 dark:text-gray-400 truncate">
					{getContractName(artwork)}
				</div>
			{/if}
		</td>
		<td class="p-3 dark:text-gray-300">
			{#if getBlockchain(artwork)}
				<span
					class="blockchain-badge px-2 py-1 text-xs font-semibold rounded-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
				>
					{getBlockchain(artwork)}
				</span>
			{/if}
		</td>
		<td class="p-3 dark:text-gray-300">
			{#if hasIpfsContent(artwork)}
				<div class="flex items-center space-x-1">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="text-purple-600">
						<path
							d="M12 2L4 6V12C4 15.31 7.58 18.5 12 20C16.42 18.5 20 15.31 20 12V6L12 2Z"
						/>
					</svg>
					<span class="text-xs">IPFS</span>
				</div>
			{:else}
				<span class="text-xs text-gray-400">HTTP</span>
			{/if}
		</td>
	</tr>
{/if}

<style lang="scss">
	.grid-item {
		/* Remove masonry-specific styles and add grid-appropriate ones */
		display: flex;
		flex-direction: column;
		height: fit-content;
	}

	.selected {
		@apply ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900;
	}

	.blockchain-badge {
		@apply inline-block;
	}
</style> 