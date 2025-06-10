<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import SkeletonLoader from './SkeletonLoader.svelte';

	export let src: string;
	export let poster: string = '';
	export let autoplay: boolean = false;
	export let loop: boolean = false;
	export let muted: boolean = true;
	export let width: number | undefined = undefined;
	export let height: number | undefined = undefined;
	export let className: string = '';
	export let style: string = '';
	export let showSkeleton: boolean = true;
	export let aspectRatio: string | undefined = undefined;

	const dispatch = createEventDispatcher();

	let videoElement: HTMLVideoElement;
	let isPlaying = false;
	let isMuted = muted;
	let showControls = false;
	let controlsTimeout: ReturnType<typeof setTimeout>;
	let isLoading = true;
	let hasError = false;

	// Calculate aspect ratio
	$: calculatedAspectRatio = aspectRatio || (width && height ? `${width}/${height}` : undefined);

	// Show skeleton when loading and showSkeleton is enabled
	$: shouldShowSkeleton = showSkeleton && isLoading && !hasError;

	// Toggle play/pause
	function togglePlay() {
		if (videoElement.paused) {
			videoElement.play();
		} else {
			videoElement.pause();
		}
	}

	// Toggle mute
	function toggleMute() {
		isMuted = !isMuted;
		videoElement.muted = isMuted;
	}

	// Show controls temporarily
	function showControlsTemporarily() {
		showControls = true;
		clearTimeout(controlsTimeout);
		controlsTimeout = setTimeout(() => {
			showControls = false;
		}, 4000);
	}

	// Video event handlers
	function handleLoadedMetadata() {
		isLoading = false;
		hasError = false;
		dispatch('loadeddata');
	}

	function handlePlay() {
		isPlaying = true;
	}

	function handlePause() {
		isPlaying = false;
	}

	function handleError() {
		hasError = true;
		isLoading = false;
		console.error('Video failed to load:', src);
	}

	function handleLoadStart() {
		isLoading = true;
		hasError = false;
	}

	// Handle video tap
	function handleVideoTap() {
		if (!showControls) {
			showControlsTemporarily();
		} else {
			togglePlay();
		}
	}

	onMount(() => {
		// Set initial muted state
		if (videoElement) {
			videoElement.muted = isMuted;
		}
	});

	onDestroy(() => {
		clearTimeout(controlsTimeout);
	});
</script>

<div 
	class="mobile-video-player {className}"
	{style}
	style:aspect-ratio={calculatedAspectRatio}
	on:touchstart={showControlsTemporarily}
>
	<!-- Skeleton loader -->
	{#if shouldShowSkeleton}
		<div class="skeleton-overlay">
			<SkeletonLoader
				width="100%"
				height="100%"
				borderRadius="4px"
			/>
		</div>
	{/if}

	{#if hasError}
		<!-- Error state -->
		<div class="error-state">
			<div class="error-content">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
				</svg>
				<p>Unable to load video</p>
			</div>
		</div>
	{/if}

	<video
		bind:this={videoElement}
		{src}
		{poster}
		{autoplay}
		{loop}
		{width}
		{height}
		playsinline
		on:loadedmetadata={handleLoadedMetadata}
		on:play={handlePlay}
		on:pause={handlePause}
		on:click={handleVideoTap}
		on:error={handleError}
		on:loadstart={handleLoadStart}
		class="video-element"
		class:hidden={shouldShowSkeleton || hasError}
	>
		Your browser does not support the video tag.
	</video>

	<!-- Simplified controls overlay -->
	<div class="controls-overlay" class:visible={showControls && !shouldShowSkeleton && !hasError}>
		<div class="controls-center">
			<!-- Play/Pause button -->
			<button
				class="play-button"
				on:click={togglePlay}
				aria-label={isPlaying ? 'Pause' : 'Play'}
			>
				{#if isPlaying}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
						<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
					</svg>
				{:else}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
						<path d="M8 5v14l11-7z"/>
					</svg>
				{/if}
			</button>
		</div>

		<div class="controls-corner">
			<!-- Mute button -->
			<button
				class="mute-button"
				on:click={toggleMute}
				aria-label={isMuted ? 'Unmute' : 'Mute'}
			>
				{#if isMuted}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
						<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
					</svg>
				{:else}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
						<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
					</svg>
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.mobile-video-player {
		position: relative;
		width: 100%;
		max-width: 100%;
		background: black;
		border-radius: 4px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: manipulation;
	}

	.mobile-video-player::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 80px;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.1));
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
		z-index: 1;
	}

	.mobile-video-player:hover::after {
		opacity: 1;
	}

	.video-element {
		width: 100%;
		height: auto;
		max-width: 100%;
		object-fit: contain;
		display: block;
		position: relative;
		z-index: 2;
	}

	.skeleton-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1;
	}

	.error-state {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.8);
		color: white;
		z-index: 10;
	}

	.error-content {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.error-content svg {
		color: #ef4444;
	}

	.hidden {
		opacity: 0;
		pointer-events: none;
	}

	.controls-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.3);
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 3;
	}

	.controls-overlay.visible {
		opacity: 1;
		pointer-events: auto;
	}

	.controls-center {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.controls-corner {
		position: absolute;
		top: 16px;
		right: 16px;
	}

	.play-button,
	.mute-button {
		background: rgba(0, 0, 0, 0.7);
		border: none;
		color: white;
		cursor: pointer;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s ease;
		backdrop-filter: blur(4px);
	}

	.play-button {
		width: 64px;
		height: 64px;
		padding: 16px;
	}

	.mute-button {
		width: 48px;
		height: 48px;
		padding: 12px;
	}

	.play-button:active,
	.mute-button:active {
		background: rgba(0, 0, 0, 0.9);
		transform: scale(0.95);
	}

	/* Touch device optimizations */
	@media (hover: none) and (pointer: coarse) {
		.mobile-video-player::after {
			opacity: 1; /* Always show subtle gradient on touch devices */
		}
	}
</style> 