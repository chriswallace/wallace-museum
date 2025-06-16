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
	export let playsinline: boolean = true;
	export let showProgress: boolean = true; // Show only progress bar
	export let showPlayButton: boolean = true; // Show play/pause button
	export let borderRadius: string = '0px'; // Custom border radius

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
		class="minimal-video-player {className}"
		style="width: {width}; height: {height}; aspect-ratio: {aspectRatio}; border-radius: {borderRadius}; {style}"
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

		<!-- Ultra minimal controls -->
		{#if showProgress || showPlayButton}
			<media-control-bar class="ultra-minimal-bar">
				{#if showPlayButton}
					<media-play-button class="minimal-play-btn"></media-play-button>
				{/if}
				{#if showProgress}
					<media-time-range class="minimal-progress"></media-time-range>
				{/if}
			</media-control-bar>
		{/if}
	</media-controller>
{:else}
	<div
		class="video-loading-placeholder {className}"
		style="width: {width}; height: {height}; aspect-ratio: {aspectRatio}; border-radius: {borderRadius}; {style}"
	>
		<div class="loading-content">
			<div class="loading-spinner"></div>
		</div>
	</div>
{/if}

<style>
	.minimal-video-player {
		display: block;
		background-color: black;
		overflow: hidden;
		position: relative;
	}

	.video-loading-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #000;
		color: white;
	}

	.loading-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
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

	/* Ultra minimal styling */
	:global(.minimal-video-player) {
		--media-primary-color: #ffffff;
		--media-secondary-color: rgba(255, 255, 255, 0.8);
		--media-text-color: white;
		--media-control-background: transparent;
		--media-control-hover-background: rgba(255, 255, 255, 0.1);
		--media-range-thumb-background: #ffffff;
		--media-range-track-background: rgba(255, 255, 255, 0.3);
		--media-range-track-height: 2px;
		--media-font-size: 12px;
	}

	/* Ultra minimal control bar */
	:global(.ultra-minimal-bar) {
		background: transparent;
		padding: 0;
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: auto;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	/* Show controls on hover or when paused */
	:global(.minimal-video-player:hover .ultra-minimal-bar),
	:global(.minimal-video-player[media-paused] .ultra-minimal-bar) {
		opacity: 1;
	}

	/* Minimal play button */
	:global(.minimal-play-btn) {
		width: 40px;
		height: 40px;
		background: transparent;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.8);
		transition: all 0.2s ease;
	}

	:global(.minimal-play-btn:hover) {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 1);
		transform: scale(1.05);
	}

	/* Minimal progress bar */
	:global(.minimal-progress) {
		flex: 1;
		height: 4px;
		margin: 0;
	}

	/* Progress bar track styling */
	:global(.minimal-progress [part~="track"]) {
		background: rgba(255, 255, 255, 0.3);
		height: 2px;
		border-radius: 1px;
	}

	/* Progress bar fill styling */
	:global(.minimal-progress [part~="track-fill"]) {
		background: #ffffff;
		height: 2px;
		border-radius: 1px;
	}

	/* Progress bar thumb styling */
	:global(.minimal-progress [part~="thumb"]) {
		width: 12px;
		height: 12px;
		background: #ffffff;
		border-radius: 50%;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	:global(.minimal-progress:hover [part~="thumb"]) {
		opacity: 1;
	}

	/* Alternative: Progress bar only at bottom */
	:global(.minimal-video-player.progress-only .ultra-minimal-bar) {
		padding: 0;
		background: transparent;
		height: 4px;
		opacity: 1;
	}

	:global(.minimal-video-player.progress-only .minimal-progress) {
		margin: 0;
		height: 4px;
	}

	:global(.minimal-video-player.progress-only .minimal-progress [part~="track"]) {
		height: 4px;
		border-radius: 0;
	}

	:global(.minimal-video-player.progress-only .minimal-progress [part~="track-fill"]) {
		height: 4px;
		border-radius: 0;
	}
</style> 