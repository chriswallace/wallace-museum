<script lang="ts">
	import ArtistList from './ArtistList.svelte';

	export let artists: Array<{
		name: string;
		avatarUrl?: string | null;
		websiteUrl?: string | null;
		id?: number;
	}> | null = null;
	export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'sm';
	export let showAvatars = true;
	export let linkToWebsite = false;
	export let linkToArtist = false;
	export let maxDisplay = 3;
	export let emptyText = 'None';
	export let className = '';
	export let debugSkeletonMode = false;
</script>

<div class="py-1 {className}">
	{#if artists && artists.length > 0}
		<ArtistList 
			{artists}
			layout="badges"
			{size}
			showAvatars={showAvatars}
			{linkToWebsite}
			{linkToArtist}
			{maxDisplay}
			{debugSkeletonMode}
		/>
	{:else}
		<span class="text-gray-500 dark:text-gray-400 text-sm">{emptyText}</span>
	{/if}
</div> 