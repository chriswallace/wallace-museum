<script lang="ts">
	import ArtistAvatar from './ArtistAvatar.svelte';
	import ArtistPopover from './ArtistPopover.svelte';

	export let artist: {
		name: string;
		avatarUrl?: string | null;
		websiteUrl?: string | null;
		id?: number;
		bio?: string | null;
		twitterHandle?: string | null;
		instagramHandle?: string | null;
		addresses?: Array<{
			blockchain: string;
			address: string;
		}> | null;
	};
	export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'sm';
	export let showAvatar = true;
	export let linkToWebsite = false;
	export let linkToArtist = false;
	export let showPopover = false;
	export let className = '';
	export let nameClassName = '';
	export let containerClassName = '';
	export let debugSkeletonMode = false;
	export let prefix = '';

	// Text size mappings based on avatar size
	const textSizeMap = {
		xs: 'text-xs',
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-lg',
		xl: 'text-xl'
	};

	$: textSize = textSizeMap[size];
	$: hasLink = (linkToWebsite && artist.websiteUrl) || (linkToArtist && artist.id);
	$: hasPopoverData = artist.bio || artist.websiteUrl || artist.twitterHandle || artist.instagramHandle;

	// Popover state
	let isPopoverOpen = false;
	let nameElement: HTMLElement;

	function handleNameClick() {
		if (showPopover) {
			isPopoverOpen = true;
		}
	}

	function handlePopoverClose() {
		isPopoverOpen = false;
	}
</script>

<div class="flex items-center gap-2 {containerClassName}">
	{#if showAvatar}
		<ArtistAvatar {artist} {size} {debugSkeletonMode} />
	{/if}
	
	<span class="truncate {textSize} {nameClassName} {className}">
		{#if prefix}
			<span class="mr-1">{prefix}</span>
		{/if}
		{#if hasLink && !showPopover}
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
		{:else if showPopover && hasPopoverData}
			<button
				class="artist-name-button"
				on:click={handleNameClick}
				title="Click to view artist details"
			>
				<span class="{nameClassName}">
					{artist.name}
				</span>
			</button>
		{:else}
			{artist.name}
		{/if}
	</span>
</div>

<!-- Popover component -->
{#if showPopover}
	<ArtistPopover 
		{artist} 
		isOpen={isPopoverOpen} 
		on:close={handlePopoverClose}
	/>
{/if}

<style lang="postcss">
	a{
		@apply text-gray-800 no-underline dark:text-gray-200 hover:underline;
	}

	.artist-name-button {
		@apply bg-transparent border-none p-0 m-0 text-inherit cursor-pointer no-underline transition-all duration-200 ease-in-out rounded-sm inline-block;
		padding: 2px 4px;
		margin: -2px -4px;
	}

	.artist-name-button span {
		@apply transition-all duration-200 ease-in-out;
	}

	.artist-name-button:hover span {
		@apply underline rounded-sm text-primary dark:text-primary-dark;
		background: rgba(255, 17, 17, 0.1); /* Light red background for light mode */
		padding: 2px 4px;
		margin: -2px -4px;
	}

	.artist-name-button:focus {
		@apply outline-2 outline-offset-2 outline-primary dark:outline-primary-dark;
	}
</style> 