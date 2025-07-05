<script lang="ts">
	import OptimizedImage from './OptimizedImage.svelte';
	import ArtistNameWithAvatar from './ArtistNameWithAvatar.svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';

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

	// Display URLs
	$: displayImageUrl = getDisplayImageUrl();
	$: displayAnimationUrl = getDisplayAnimationUrl();

	// Check if this is a GIF that should preserve original size
	$: isGif = artwork.mime === 'image/gif';

	// Grid optimization settings
	$: gridWidth = isGif ? undefined : 300;
	$: gridHeight = isGif ? undefined : 300;
	$: gridQuality = isGif ? undefined : 50;
	$: gridFormat = isGif ? 'auto' as const : 'webp' as const;

	// Simplified media URL resolution - prioritize thumbnails for grid display
	$: shouldShowVideo = shouldDisplayAsVideo();

	// Helper functions
	function getDisplayImageUrl(): string {
		// For grid display, prioritize thumbnail URLs for better performance
		const candidates = [
			artwork.thumbnailUrl,
			artwork.thumbnail_uri,
			artwork.image_url,
			artwork.imageUrl,
			artwork.display_uri,
			artwork.displayUrl
		].filter(Boolean);
		
		return candidates.length > 0 ? ipfsToHttpUrl(candidates[0]!) : '';
	}

	function getDisplayAnimationUrl(): string {
		const candidates = [
			artwork.animation_url,
			artwork.animationUrl,
			artwork.artifact_uri,
			artwork.artifactUrl
		].filter(Boolean);
		
		return candidates.length > 0 ? ipfsToHttpUrl(candidates[0]!) : '';
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
		const imageUrl = getDisplayImageUrl();
		const animationUrl = getDisplayAnimationUrl();
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
		const target = event.currentTarget as HTMLImageElement | HTMLVideoElement;
		if (target instanceof HTMLImageElement) {
			target.src = '/images/placeholder.webp';
		}
	}

	function handleClick() {
		if (canSelect && onToggleSelection) {
			onToggleSelection(artwork);
		}
	}

	// Simplified video detection based on MIME type and URL patterns
	function shouldDisplayAsVideo(): boolean {
		// First check MIME type if available (most reliable)
		if (artwork.mime) {
			console.log(`[ImportArtworkCard] Using MIME type for media detection: ${artwork.mime} (${getArtworkTitle(artwork)})`);
			return artwork.mime.startsWith('video/');
		}
		
		// Fallback to URL-based detection for animation_url
		if (displayAnimationUrl) {
			const isVideoUrl = /\.(mp4|webm|mov|avi|ogv|m4v|3gp|flv|wmv|mkv)(\?.*)?$/i.test(displayAnimationUrl);
			if (isVideoUrl) {
				console.log(`[ImportArtworkCard] Detected video from animation URL pattern: ${displayAnimationUrl}`);
				return true;
			}
		}
		
		return false;
	}

	// Get the best URL for display based on context
	function getMediaUrl(): string {
		return shouldShowVideo ? displayAnimationUrl : displayImageUrl;
	}
</script>

{#if viewMode === 'grid'}
	<!-- Grid View Card -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="grid-item group bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-all duration-200 border border-gray-200 dark:border-gray-700"
		class:opacity-50={artwork.isImported}
		class:cursor-not-allowed={artwork.isImported}
		class:cursor-pointer={!artwork.isImported}
		class:hover:shadow-md={!artwork.isImported}
		class:hover:scale-[1.02]={!artwork.isImported}
		class:selected={isSelected && !artwork.isImported}
		on:click={handleClick}
		role="button"
		tabindex={canSelect ? 0 : -1}
	>
		<div class="relative aspect-square bg-gray-50 dark:bg-gray-900">
			{#if debugSkeletonMode}
				<!-- Debug skeleton mode -->
				<OptimizedImage
					src=""
					alt={getArtworkTitle(artwork)}
					width={300}
					height={300}
					format="auto"
					quality={80}
					aspectRatio="1/1"
					showSkeleton={true}
					skeletonBorderRadius="0px"
					className="w-full h-full object-cover"
					fallbackSrc="/images/placeholder.webp"
					loading="lazy"
					on:error={handleImageError}
				/>
			{:else if shouldShowVideo && displayAnimationUrl}
				<!-- Video display optimized for grid -->
				<video
					src={displayAnimationUrl}
					class="w-full h-full object-contain"
					width="300"
					height="300"
					autoplay
					loop
					muted
					playsinline
					preload="metadata"
					on:error={handleImageError}
				>
					<track kind="captions" />
					Your browser does not support the video tag.
				</video>
			{:else if displayImageUrl}
				<!-- Image display optimized for grid -->
				<OptimizedImage
					src={displayImageUrl}
					alt={getArtworkTitle(artwork)}
					width={gridWidth}
					height={gridHeight}
					aspectRatio="1/1"
					fit="contain"
					format={gridFormat}
					quality={gridQuality}
					className="w-full h-full object-contain"
					fallbackSrc="/images/placeholder.webp"
					loading="lazy"
					mimeType={artwork.mime}
					on:error={handleImageError}
				/>
			{:else}
				<!-- Fallback placeholder -->
				<div class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
					<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
				</div>
			{/if}

			<!-- Selection indicator -->
			{#if isSelected}
				<div
					class="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800 z-20"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
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
					class="absolute top-2 right-2 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 rounded-full w-6 h-6 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-70 transition-all duration-200 z-20"
				>
					<!-- Empty circle for unselected state -->
				</div>
			{/if}

			<!-- Imported indicator -->
			{#if artwork.isImported}
				<div
					class="absolute top-2 left-2 bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800 z-20"
					title="Already imported"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
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
					class="absolute bottom-2 right-2 bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-lg border border-white dark:border-gray-800 z-10"
					title="Contains IPFS content"
				>
					<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
						<path
							d="M12 2L4 6V12C4 15.31 7.58 18.5 12 20C16.42 18.5 20 15.31 20 12V6L12 2Z"
						/>
					</svg>
				</div>
			{/if}

			<!-- Video indicator -->
			{#if shouldShowVideo}
				<div
					class="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white rounded-sm px-1.5 py-0.5 text-xs font-medium"
					title="Video content"
				>
					VIDEO
				</div>
			{/if}
		</div>
		
		<div class="p-3">
			<h3 class="font-medium text-sm dark:text-gray-100 line-clamp-2 mb-1" title={getArtworkTitle(artwork)}>
				{getArtworkTitle(artwork)}
			</h3>

			<!-- Enhanced collection/artist info -->
			{#if artwork.supportsArtistLookup}
				{@const collectionInfo = getCollectionInfo(artwork)}
				{@const artistInfo = getArtistInfo(artwork)}

				<div class="space-y-1">
					<!-- Collection name -->
					{#if collectionInfo}
						<div class="text-xs text-gray-600 dark:text-gray-400 truncate">
							{collectionInfo.title || 'Unknown Collection'}
						</div>
					{:else}
						<div class="text-xs text-gray-600 dark:text-gray-400 truncate">
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
				<div class="mt-2">
					<span
						class="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
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
			<div class="w-12 h-12 overflow-hidden rounded-md bg-gray-50 dark:bg-gray-900">
				{#if debugSkeletonMode}
					<!-- Debug skeleton mode -->
					<OptimizedImage
						src=""
						alt={getArtworkTitle(artwork)}
						width={48}
						height={48}
						fit="cover"
						format="auto"
						quality={80}
						aspectRatio="1/1"
						showSkeleton={true}
						skeletonBorderRadius="6px"
						className="w-full h-full object-cover"
						fallbackSrc="/images/placeholder.webp"
						loading="lazy"
						on:error={handleImageError}
					/>
				{:else if shouldShowVideo && displayAnimationUrl}
					<!-- Video thumbnail -->
					<video
						src={displayAnimationUrl}
						class="w-full h-full object-contain"
						width="48"
						height="48"
						autoplay
						loop
						muted
						playsinline
						preload="metadata"
						on:error={handleImageError}
					>
						<track kind="captions" />
						Your browser does not support the video tag.
					</video>
				{:else if displayImageUrl}
					<!-- Image thumbnail -->
					<OptimizedImage
						src={displayImageUrl}
						alt={getArtworkTitle(artwork)}
						width={isGif ? undefined : 48}
						height={isGif ? undefined : 48}
						aspectRatio="1/1"
						fit="contain"
						format={gridFormat}
						quality={gridQuality}
						className="w-full h-full object-contain"
						fallbackSrc="/images/placeholder.webp"
						loading="lazy"
						mimeType={artwork.mime}
						on:error={handleImageError}
					/>
				{:else}
					<!-- Fallback placeholder -->
					<div class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
						<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
				{/if}
			</div>
		</td>
		<td class="p-3">
			<div class="font-medium dark:text-gray-100 line-clamp-1" style="word-break: break-word; white-space: normal; overflow-wrap: break-word; hyphens: auto;">{getArtworkTitle(artwork)}</div>
			<div class="text-xs text-gray-500 dark:text-gray-400">
				ID: {getTokenId(artwork)}
				{#if artwork.mime}
					<span class="ml-2 text-purple-600 dark:text-purple-400">({artwork.mime})</span>
				{/if}
			</div>
		</td>
		<td class="p-3">
			<div class="text-sm dark:text-gray-300 truncate">{getContractName(artwork)}</div>
		</td>
		<td class="p-3">
			{#if getBlockchain(artwork)}
				<span
					class="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
				>
					{getBlockchain(artwork)}
				</span>
			{/if}
		</td>
		<td class="p-3">
			{#if hasIpfsContent(artwork)}
				<span
					class="inline-block px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
					title="Contains IPFS content"
				>
					IPFS
				</span>
			{:else}
				<span class="text-xs text-gray-500 dark:text-gray-400">HTTP</span>
			{/if}
		</td>
	</tr>
{/if}

<style lang="scss">
	.grid-item.selected {
		@apply shadow-[0_0_0_2px_rgb(59_130_246),0_0_0_4px_rgb(255_255_255)] dark:shadow-[0_0_0_2px_rgb(59_130_246),0_0_0_4px_rgb(17_24_39)];
	}
	
	.line-clamp-1 {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style> 