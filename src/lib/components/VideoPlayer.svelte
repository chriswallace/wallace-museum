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
	let currentTime = 0;
	let duration = 0;
	let volume = 1;
	let isMuted = muted;
	let showControls = false;
	let controlsTimeout: ReturnType<typeof setTimeout>;
	let isDragging = false;
	let isLoading = true;
	let hasError = false;

	// Calculate aspect ratio
	$: calculatedAspectRatio = aspectRatio || (width && height ? `${width}/${height}` : undefined);

	// Show skeleton when loading and showSkeleton is enabled
	$: shouldShowSkeleton = showSkeleton && isLoading && !hasError;

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

	// Toggle mute
	function toggleMute() {
		isMuted = !isMuted;
		videoElement.muted = isMuted;
	}

	// Handle volume change
	function handleVolumeChange(event: Event) {
		const target = event.target as HTMLInputElement;
		volume = parseFloat(target.value);
		videoElement.volume = volume;
		if (volume > 0 && isMuted) {
			isMuted = false;
			videoElement.muted = false;
		}
	}

	// Handle seek
	function handleSeek(event: Event) {
		const target = event.target as HTMLInputElement;
		const newTime = (parseFloat(target.value) / 100) * duration;
		videoElement.currentTime = newTime;
	}

	// Handle mouse events for progress bar
	function handleProgressMouseDown() {
		isDragging = true;
	}

	function handleProgressMouseUp() {
		isDragging = false;
	}

	// Show controls temporarily
	function showControlsTemporarily() {
		showControls = true;
		clearTimeout(controlsTimeout);
		controlsTimeout = setTimeout(() => {
			if (!isDragging) {
				showControls = false;
			}
		}, 3000);
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

	function handleVolumeChangeEvent() {
		volume = videoElement.volume;
		isMuted = videoElement.muted;
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

	// Keyboard controls
	function handleKeyDown(event: KeyboardEvent) {
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

	onMount(() => {
		// Set initial volume and muted state
		if (videoElement) {
			videoElement.volume = volume;
			videoElement.muted = isMuted;
		}
	});

	onDestroy(() => {
		clearTimeout(controlsTimeout);
	});

	$: progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
</script>

<div 
	class="video-player {className}"
	{style}
	style:aspect-ratio={calculatedAspectRatio}
	on:mousemove={showControlsTemporarily}
	on:mouseleave={() => showControls = false}
	role="application"
	tabindex="0"
	on:keydown={handleKeyDown}
>
	<!-- Skeleton loader -->
	{#if shouldShowSkeleton}
		<SkeletonLoader
			width="100%"
			height="100%"
			borderRadius="4px"
		/>
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
		on:volumechange={handleVolumeChangeEvent}
		on:click={togglePlay}
		on:error={handleError}
		on:loadstart={handleLoadStart}
		class="video-element"
		class:hidden={shouldShowSkeleton || hasError}
	>
		Your browser does not support the video tag.
	</video>

	<!-- Controls overlay -->
	<div class="controls-overlay" class:visible={showControls && !shouldShowSkeleton && !hasError}>
		<!-- Progress bar -->
		<div class="progress-container">
			<input
				type="range"
				min="0"
				max="100"
				value={progressPercentage}
				on:input={handleSeek}
				on:mousedown={handleProgressMouseDown}
				on:mouseup={handleProgressMouseUp}
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
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
							<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
						</svg>
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
							<path d="M8 5v14l11-7z"/>
						</svg>
					{/if}
				</button>

				<!-- Time display -->
				<div class="time-display">
					{formatTime(currentTime)} / {formatTime(duration)}
				</div>
			</div>

			<div class="controls-right">
				<!-- Volume control -->
				<div class="volume-control">
					<button
						class="control-button"
						on:click={toggleMute}
						aria-label={isMuted ? 'Unmute' : 'Mute'}
					>
						{#if isMuted || volume === 0}
							<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
								<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
							</svg>
						{:else if volume < 0.5}
							<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
								<path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
							</svg>
						{:else}
							<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
								<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
							</svg>
						{/if}
					</button>
					<input
						type="range"
						min="0"
						max="1"
						step="0.1"
						value={isMuted ? 0 : volume}
						on:input={handleVolumeChange}
						class="volume-slider"
						aria-label="Volume"
					/>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.video-player {
		position: relative;
		width: 100%;
		height: 100%;
		background: black;
		border-radius: 4px;
		overflow: hidden;
		outline: none;
	}

	.video-element {
		width: 100%;
		height: 100%;
		object-fit: contain;
		cursor: pointer;
	}

	.loading-state,
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

	.loading-content,
	.error-content {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
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

	.error-content svg {
		color: #ef4444;
	}

	.hidden {
		opacity: 0;
		pointer-events: none;
	}

	.controls-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
		padding: 20px 16px 16px;
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
	}

	.controls-overlay.visible {
		opacity: 1;
		pointer-events: auto;
	}

	.progress-container {
		margin-bottom: 12px;
	}

	.progress-bar {
		width: 100%;
		height: 4px;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
		-webkit-appearance: none;
		appearance: none;
	}

	.progress-bar::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: white;
		cursor: pointer;
		border: none;
	}

	.progress-bar::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: white;
		cursor: pointer;
		border: none;
	}

	.controls-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: white;
	}

	.controls-left,
	.controls-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.control-button {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s ease;
	}

	.control-button:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.time-display {
		font-size: 14px;
		font-family: monospace;
		color: white;
		white-space: nowrap;
	}

	.volume-control {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.volume-slider {
		width: 60px;
		height: 4px;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
		-webkit-appearance: none;
		appearance: none;
	}

	.volume-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: white;
		cursor: pointer;
		border: none;
	}

	.volume-slider::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: white;
		cursor: pointer;
		border: none;
	}

	/* Mobile responsive adjustments */
	@media (max-width: 768px) {
		.controls-overlay {
			padding: 16px 12px 12px;
		}

		.controls-bar {
			gap: 8px;
		}

		.controls-left,
		.controls-right {
			gap: 8px;
		}

		.time-display {
			font-size: 12px;
		}

		.volume-slider {
			width: 40px;
		}
	}
</style> 