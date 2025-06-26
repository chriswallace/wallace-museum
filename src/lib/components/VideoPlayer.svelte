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
	export let showControls: boolean = true;
	export let simplifiedControls: boolean = false;

	const dispatch = createEventDispatcher();

	let videoElement: HTMLVideoElement;
	let isPlaying = false;
	let currentTime = 0;
	let duration = 0;
	let isMuted = muted;
	let controlsVisible = false;
	let controlsTimeout: ReturnType<typeof setTimeout>;
	let isDragging = false;
	let isLoading = true;
	let hasError = false;
	let isTouchDevice = false;

	// Calculate aspect ratio
	$: calculatedAspectRatio = aspectRatio || (width && height ? `${width}/${height}` : undefined);

	// Calculate sizing strategy based on aspect ratios
	$: containerAspectRatio = calculatedAspectRatio ? parseFloat(calculatedAspectRatio.replace('/', ' / ').split(' / ')[0]) / parseFloat(calculatedAspectRatio.replace('/', ' / ').split(' / ')[1]) : null;
	
	// Determine sizing strategy - if no aspect ratio provided, fill container
	$: sizingStrategy = calculatedAspectRatio ? 'aspect-ratio' : 'fill-container';

	// Show skeleton when loading and showSkeleton is enabled
	$: shouldShowSkeleton = showSkeleton && isLoading && !hasError;

	// Detect touch device
	onMount(() => {
		isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
		
		// Set initial muted state
		if (videoElement) {
			videoElement.muted = isMuted;
		}
	});

	// Format time in MM:SS format
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Toggle play/pause
	function togglePlay() {
		if (videoElement.paused) {
			videoElement.play();
		} else {
			videoElement.pause();
		}
	}

	// Toggle mute - simplified for mobile
	function toggleMute() {
		isMuted = !isMuted;
		videoElement.muted = isMuted;
	}

	// Handle seek
	function handleSeek(event: Event) {
		const target = event.target as HTMLInputElement;
		const newTime = (parseFloat(target.value) / 100) * duration;
		videoElement.currentTime = newTime;
	}

	// Handle mouse/touch events for progress bar
	function handleProgressStart() {
		isDragging = true;
	}

	function handleProgressEnd() {
		isDragging = false;
	}

	// Show controls temporarily
	function showControlsTemporarily() {
		if (!showControls) return;
		
		controlsVisible = true;
		clearTimeout(controlsTimeout);
		controlsTimeout = setTimeout(() => {
			if (!isDragging && !isTouchDevice) {
				controlsVisible = false;
			}
		}, isTouchDevice ? 5000 : 3000); // Longer timeout on touch devices
	}

	// Hide controls
	function hideControls() {
		if (!isTouchDevice) {
			controlsVisible = false;
		}
	}

	// Video event handlers
	function handleLoadedMetadata() {
		duration = videoElement.duration;
		isLoading = false;
		hasError = false;
		dispatch('loadeddata');
	}

	function handleTimeUpdate() {
		if (!isDragging) {
			currentTime = videoElement.currentTime;
		}
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

	// Handle video click
	function handleVideoClick() {
		if (isTouchDevice) {
			// On touch devices, first click shows controls, second click toggles play
			if (!controlsVisible) {
				showControlsTemporarily();
			} else {
				togglePlay();
			}
		} else {
			// On desktop, click toggles play
			togglePlay();
		}
	}

	// Keyboard controls (desktop only)
	function handleKeyDown(event: KeyboardEvent) {
		if (isTouchDevice) return; // Skip keyboard controls on touch devices
		
		switch (event.code) {
			case 'Space':
				event.preventDefault();
				togglePlay();
				break;
			case 'KeyM':
				event.preventDefault();
				toggleMute();
				break;
			case 'ArrowLeft':
				event.preventDefault();
				videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
				break;
			case 'ArrowRight':
				event.preventDefault();
				videoElement.currentTime = Math.min(duration, videoElement.currentTime + 10);
				break;
		}
	}

	onDestroy(() => {
		clearTimeout(controlsTimeout);
	});

	$: progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
</script>

<div 
	class="video-player {className}"
	{style}
	style:aspect-ratio={calculatedAspectRatio}
	style:width={sizingStrategy === 'fill-container' ? '100%' : 'auto'}
	style:height={sizingStrategy === 'fill-container' ? '100%' : 'auto'}
	style:max-width={sizingStrategy === 'aspect-ratio' ? '100%' : 'none'}
	style:max-height={sizingStrategy === 'aspect-ratio' ? '100%' : 'none'}
	on:mousemove={showControlsTemporarily}
	on:mouseleave={hideControls}
	on:touchstart={showControlsTemporarily}
	role="application"
	tabindex="0"
	on:keydown={handleKeyDown}
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
		on:timeupdate={handleTimeUpdate}
		on:play={handlePlay}
		on:pause={handlePause}
		on:click={handleVideoClick}
		on:error={handleError}
		on:loadstart={handleLoadStart}
		class="video-element"
		class:hidden={shouldShowSkeleton || hasError}
	>
		Your browser does not support the video tag.
	</video>

	<!-- Controls overlay -->
	{#if showControls}
		<div 
			class="controls-overlay" 
			class:visible={controlsVisible && !shouldShowSkeleton && !hasError}
			class:simplified={simplifiedControls || isTouchDevice}
		>
			<!-- Progress bar -->
			<div class="progress-container">
				<input
					type="range"
					min="0"
					max="100"
					value={progressPercentage}
					on:input={handleSeek}
					on:mousedown={handleProgressStart}
					on:mouseup={handleProgressEnd}
					on:touchstart={handleProgressStart}
					on:touchend={handleProgressEnd}
					class="progress-bar"
					aria-label="Video progress"
				/>
			</div>

			<!-- Control buttons and info -->
			<div class="controls-bar">
				<div class="controls-left">
					<!-- Play/Pause button -->
					<button
						class="control-button"
						on:click={togglePlay}
						aria-label={isPlaying ? 'Pause' : 'Play'}
					>
						{#if isPlaying}
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
							</svg>
						{:else}
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path d="M8 5v14l11-7z"/>
							</svg>
						{/if}
					</button>

					<!-- Time display (hidden on simplified/mobile) -->
					{#if !simplifiedControls && !isTouchDevice}
						<div class="time-display">
							{formatTime(currentTime)} / {formatTime(duration)}
						</div>
					{/if}
				</div>

				<div class="controls-right">
					<!-- Simplified mute button -->
					<button
						class="control-button"
						on:click={toggleMute}
						aria-label={isMuted ? 'Unmute' : 'Mute'}
					>
						{#if isMuted}
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
							</svg>
						{:else}
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
							</svg>
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.video-player {
		@apply relative w-full max-w-full bg-black rounded-sm overflow-hidden outline-none;
	}

	.video-player::after {
		content: '';
		@apply absolute bottom-0 left-0 right-0 opacity-0 transition-opacity duration-300 ease-in-out pointer-events-none z-[1];
		height: 80px;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.1));
	}

	.video-player:hover::after {
		@apply opacity-100;
	}

	.video-element {
		@apply absolute top-0 left-0 w-full h-full object-contain cursor-pointer block z-[2];
	}

	.skeleton-overlay {
		@apply absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center z-[1];
	}

	.error-state {
		@apply absolute top-0 left-0 w-full h-full flex items-center justify-center text-white z-10;
		background: rgba(0, 0, 0, 0.8);
	}

	.error-content {
		@apply text-center flex flex-col items-center gap-4;
	}

	.error-content svg {
		@apply text-red-500;
	}

	.hidden {
		@apply opacity-0 pointer-events-none;
	}

	.controls-overlay {
		@apply absolute bottom-0 left-0 right-0 opacity-0 transition-opacity duration-300 ease-in-out pointer-events-none z-[3];
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
		padding: 20px 16px 16px;
	}

	.controls-overlay.visible {
		@apply opacity-100 pointer-events-auto;
	}

	.controls-overlay.simplified {
		@apply px-3 py-4;
	}

	.progress-container {
		@apply mb-3;
	}

	.progress-bar {
		@apply w-full h-1.5 rounded-sm outline-none cursor-pointer;
		background: rgba(255, 255, 255, 0.3);
		-webkit-appearance: none;
		appearance: none;
	}

	.progress-bar::-webkit-slider-thumb {
		@apply w-4 h-4 rounded-full bg-white cursor-pointer border-none;
		-webkit-appearance: none;
		appearance: none;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.progress-bar::-moz-range-thumb {
		@apply w-4 h-4 rounded-full bg-white cursor-pointer border-none;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.controls-bar {
		@apply flex justify-between items-center text-white;
	}

	.controls-left,
	.controls-right {
		@apply flex items-center gap-4;
	}

	.control-button {
		@apply bg-transparent border-none text-white cursor-pointer p-2 rounded-md flex items-center justify-center transition-colors duration-200;
		min-width: 36px;
		min-height: 36px;
	}

	.control-button:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.control-button:active {
		background: rgba(255, 255, 255, 0.3);
	}

	.time-display {
		@apply text-sm font-mono text-white whitespace-nowrap px-2 py-1 rounded-sm;
		background: rgba(0, 0, 0, 0.5);
	}

	/* Touch device optimizations - keep as media query since it's not a screen size */
	@media (hover: none) and (pointer: coarse) {
		.video-player::after {
			@apply opacity-100; /* Always show subtle gradient on touch devices */
		}

		.controls-overlay {
			@apply py-5 px-4;
		}

		.progress-bar {
			@apply h-2;
		}

		.progress-bar::-webkit-slider-thumb {
			@apply w-5 h-5;
		}

		.progress-bar::-moz-range-thumb {
			@apply w-5 h-5;
		}

		.control-button {
			@apply p-3;
			min-width: 44px;
			min-height: 44px;
		}

		.controls-left,
		.controls-right {
			@apply gap-3;
		}
	}

	/* Mobile responsive adjustments */
	.controls-overlay {
		@apply md:py-5 md:px-4;
	}

	.controls-bar {
		@apply gap-2 md:gap-4;
	}

	.controls-left,
	.controls-right {
		@apply gap-3 md:gap-4;
	}

	.time-display {
		@apply text-xs md:text-sm px-1.5 md:px-2 py-0.5 md:py-1;
	}
</style> 