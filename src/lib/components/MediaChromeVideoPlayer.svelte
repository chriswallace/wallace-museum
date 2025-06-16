<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';

	// Props
	export let src: string;
	export let poster: string = '';
	export let title: string = '';
	export let autoplay: boolean = false;
	export let loop: boolean = false;
	export let muted: boolean = true;
	export let width: string = '100%';
	export let height: string = '100%';
	export let aspectRatio: string = '16/9';
	export let className: string = '';
	export let style: string = '';
	export let controls: boolean = true;
	export let playsinline: boolean = true;
	export let minimal: boolean = false;
	export let ghost: boolean = false;

	const dispatch = createEventDispatcher();

	let mediaController: HTMLElement;
	let videoElement: HTMLVideoElement;
	let isLoaded = false;

	onMount(async () => {
		// Dynamically import Media Chrome
		await import('media-chrome');
		isLoaded = true;

		// Set up event forwarding after the component is loaded
		if (videoElement) {
			videoElement.addEventListener('loadeddata', () => dispatch('loadeddata'));
			videoElement.addEventListener('play', () => dispatch('play'));
			videoElement.addEventListener('pause', () => dispatch('pause'));
			videoElement.addEventListener('ended', () => dispatch('ended'));
			videoElement.addEventListener('error', () => dispatch('error'));
			videoElement.addEventListener('timeupdate', () => dispatch('timeupdate'));
			videoElement.addEventListener('loadstart', () => dispatch('loadstart'));
		}
	});

	// Reactive statement to update video properties
	$: if (videoElement) {
		videoElement.muted = muted;
		videoElement.loop = loop;
		if (autoplay) {
			videoElement.play().catch(() => {
				console.log('Autoplay failed');
			});
		}
	}
</script>

{#if isLoaded}
	<media-controller
		bind:this={mediaController}
		class="media-chrome-player {className} {minimal ? 'minimal-chrome' : ''} {ghost ? 'ghost-chrome' : ''}"
		style="width: {width}; height: {height}; aspect-ratio: {aspectRatio}; {style}"
	>
		<video
			bind:this={videoElement}
			slot="media"
			{src}
			{poster}
			{muted}
			{loop}
			{playsinline}
			crossorigin="anonymous"
		>
			{#if title}
				<track kind="metadata" label={title} />
			{/if}
			Your browser does not support the video tag.
		</video>

		{#if controls}
			<media-control-bar class={minimal ? 'minimal-controls' : ''}>
				<media-play-button></media-play-button>
				{#if !minimal}
					<media-mute-button></media-mute-button>
					<media-volume-range></media-volume-range>
					<media-time-display show-duration></media-time-display>
				{/if}
				<media-time-range></media-time-range>
				{#if !minimal}
					<media-pip-button></media-pip-button>
				{/if}
				<media-fullscreen-button></media-fullscreen-button>
			</media-control-bar>
		{/if}
	</media-controller>
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
	.media-chrome-player {
		display: block;
		background-color: black;
		border-radius: 8px;
		overflow: hidden;
	}

	.video-loading-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #000;
		border-radius: 8px;
		color: white;
	}

	.loading-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top: 3px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}
</style> 