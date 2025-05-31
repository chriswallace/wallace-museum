<script lang="ts">
	import ArtistAvatar from './ArtistAvatar.svelte';

	export let artist: {
		name: string;
		avatarUrl?: string | null;
		websiteUrl?: string | null;
		id?: number;
	};
	export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'sm';
	export let showAvatar = true;
	export let linkToWebsite = false;
	export let linkToArtist = false;
	export let className = '';
	export let nameClassName = '';
	export let containerClassName = '';
	export let debugSkeletonMode = false;
	export let prefix = '';

	// Text size mappings based on avatar size
	const textSizeMap = {
		xs: 'text-xs',
		sm: 'text-xs',
		md: 'text-sm',
		lg: 'text-base',
		xl: 'text-lg'
	};

	$: textSize = textSizeMap[size];
	$: hasLink = (linkToWebsite && artist.websiteUrl) || (linkToArtist && artist.id);
</script>

<div class="flex items-center gap-2 {containerClassName}">
	{#if showAvatar}
		<ArtistAvatar {artist} {size} {debugSkeletonMode} />
	{/if}
	
	<span class="truncate {textSize} {nameClassName} {className}">
		{#if prefix}
			<span class="mr-1">{prefix}</span>
		{/if}
		{#if hasLink}
			{#if linkToWebsite && artist.websiteUrl}
				<a 
					href={artist.websiteUrl} 
					target="_blank" 
					rel="noopener noreferrer"
					class="hover:underline"
				>
					{artist.name}
				</a>
			{:else if linkToArtist && artist.id}
				<a 
					href="/artist/{artist.id}"
					class="hover:underline"
				>
					{artist.name}
				</a>
			{/if}
		{:else}
			{artist.name}
		{/if}
	</span>
</div> 