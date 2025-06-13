<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';

	// Props
	export let src: string;
	export let poster: string = '';
	export let title: string = '';
	export let description: string = '';
	export let autoplay: boolean = false;
	export let loop: boolean = false;
	export let muted: boolean = true;
	export let width: string = '100%';
	export let height: string = '100%';
	export let aspectRatio: string = '16/9';
	export let className: string = '';
	export let style: string = '';
	export let themeColor: string = '#3b82f6';

	const dispatch = createEventDispatcher();

	let isLoaded = false;
	let videoPlayerElement: HTMLElement;

	onMount(async () => {
		// Dynamically import the web component
		await import('./VideoPlayerWebComponent.js');
		isLoaded = true;

		// Set up event forwarding after the component is loaded
		if (videoPlayerElement) {
			const video = videoPlayerElement.shadowRoot?.querySelector('video');
			if (video) {
				video.addEventListener('loadeddata', () => dispatch('loadeddata'));
				video.addEventListener('play', () => dispatch('play'));
				video.addEventListener('pause', () => dispatch('pause'));
				video.addEventListener('ended', () => dispatch('ended'));
				video.addEventListener('error', () => dispatch('error'));
			}
		}
	});
</script>

{#if isLoaded}
	<video-player
		bind:this={videoPlayerElement}
		video-url={src}
		video-poster={poster}
		video-title={title}
		video-description={description}
		{autoplay}
		{loop}
		{muted}
		playsinline
		class={className}
		style="width: {width}; height: {height}; aspect-ratio: {aspectRatio}; --video-theme-color: {themeColor}; {style}"
	></video-player>
{:else}
	<div
		class="video-loading-placeholder {className}"
		style="width: {width}; height: {height}; aspect-ratio: {aspectRatio}; {style}"
	>
		<div class="loading-content">
			<div class="loading-spinner"></div>
			<div>Loading video player...</div>
		</div>
	</div>
{/if}

<style>
	video-player {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: inherit;
	}

	.video-loading-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #000;
		color: white;
		border-radius: inherit;
	}

	.loading-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		font-size: 14px;
		opacity: 0.8;
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top: 2px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}
</style> 