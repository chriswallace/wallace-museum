<script lang="ts">
	import ArtistNameWithAvatar from './ArtistNameWithAvatar.svelte';

	export let artists: Array<{
		name: string;
		avatarUrl?: string | null;
		websiteUrl?: string | null;
		id?: number;
		bio?: string | null;
		twitterHandle?: string | null;
		instagramHandle?: string | null;
	}>;
	export let layout: 'horizontal' | 'vertical' | 'badges' = 'horizontal';
	export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'sm';
	export let showAvatars = true;
	export let linkToWebsite = false;
	export let linkToArtist = false;
	export let showPopover = false;
	export let maxDisplay = 0; // 0 means show all
	export let separator = ', ';
	export let className = '';
	export let itemClassName = '';
	export let debugSkeletonMode = false;

	$: displayArtists = maxDisplay > 0 ? artists.slice(0, maxDisplay) : artists;
	$: hasMore = maxDisplay > 0 && artists.length > maxDisplay;
	$: remainingCount = hasMore ? artists.length - maxDisplay : 0;
</script>

{#if layout === 'horizontal'}
	<div class="flex items-center flex-wrap gap-1 {className}">
		{#each displayArtists as artist, i}
			<ArtistNameWithAvatar 
				{artist} 
				{size} 
				showAvatar={showAvatars}
				{linkToWebsite}
				{linkToArtist}
				{showPopover}
				{debugSkeletonMode}
				className={itemClassName}
			/>
			{#if i < displayArtists.length - 1}
				<span class="text-gray-500 dark:text-gray-400">{separator.trim()}</span>
			{/if}
		{/each}
		{#if hasMore}
			<span class="text-gray-500 dark:text-gray-400 text-xs">
				+{remainingCount} more
			</span>
		{/if}
	</div>
{:else if layout === 'vertical'}
	<div class="flex flex-col gap-2 {className}">
		{#each displayArtists as artist}
			<ArtistNameWithAvatar 
				{artist} 
				{size} 
				showAvatar={showAvatars}
				{linkToWebsite}
				{linkToArtist}
				{showPopover}
				{debugSkeletonMode}
				className={itemClassName}
			/>
		{/each}
		{#if hasMore}
			<span class="text-gray-500 dark:text-gray-400 text-xs">
				+{remainingCount} more artists
			</span>
		{/if}
	</div>
{:else if layout === 'badges'}
	<div class="flex flex-wrap gap-2 {className}">
		{#each displayArtists as artist}
			<span class="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded {itemClassName}">
				<ArtistNameWithAvatar 
					{artist} 
					{size} 
					showAvatar={showAvatars}
					{linkToWebsite}
					{linkToArtist}
					{showPopover}
					{debugSkeletonMode}
					containerClassName="gap-1"
				/>
			</span>
		{/each}
		{#if hasMore}
			<span class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-500 dark:text-gray-400">
				+{remainingCount}
			</span>
		{/if}
	</div>
{/if} 