<script lang="ts">
	import OptimizedImage from './OptimizedImage.svelte';
	import { placeholderAvatar } from '$lib/utils';

	export let artist: {
		name: string;
		avatarUrl?: string | null;
	};
	export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
	export let className = '';
	export let showSkeleton = true;
	export let debugSkeletonMode = false;

	// Size mappings
	const sizeMap = {
		xs: { width: 16, height: 16, class: 'w-4 h-4' },
		sm: { width: 20, height: 20, class: 'w-5 h-5' },
		md: { width: 32, height: 32, class: 'w-8 h-8' },
		lg: { width: 48, height: 48, class: 'w-12 h-12' },
		xl: { width: 300, height: 300, class: '' }
	};

	$: sizeConfig = sizeMap[size];
	$: isSquare = className.includes('square-avatar') || className.includes('rounded-none');
	$: containerClasses = isSquare ? className : `flex-shrink-0 ${sizeConfig.class}`;
	$: imageClasses = isSquare ? 'w-full h-full object-cover' : 'w-full h-full rounded-full object-cover';
	$: placeholderClasses = isSquare ? 'w-full h-full object-cover' : 'w-full h-full rounded-full object-cover';
</script>

<div 
	class={containerClasses}
	style={sizeConfig.class === '' && !className.includes('w-') ? `width: ${sizeConfig.width}px; height: ${sizeConfig.height}px;` : ''}
>
	{#if artist.avatarUrl}
		<OptimizedImage
			src={debugSkeletonMode ? '' : artist.avatarUrl}
			alt={artist.name}
			width={sizeConfig.width}
			height={sizeConfig.height}
			fit="crop"
			gravity="auto"
			format="webp"
			quality={85}
			aspectRatio="1/1"
			showSkeleton={showSkeleton}
			skeletonBorderRadius={isSquare ? "4px" : "50%"}
			className={imageClasses}
			fallbackSrc="/images/medici-image.png"
		/>
	{:else}
		<img
			class={placeholderClasses}
			src={placeholderAvatar(artist.name)}
			alt={artist.name}
			width={sizeConfig.width}
			height={sizeConfig.height}
		/>
	{/if}
</div> 