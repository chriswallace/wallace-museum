<script lang="ts">
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import MobileVideoPlayer from '$lib/components/MobileVideoPlayer.svelte';
	import { onMount } from 'svelte';

	let isMobileDevice = false;

	// Test video URLs with different aspect ratios
	const testVideos = [
		{
			src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
			title: 'Landscape Video (16:9)',
			aspectRatio: '16/9',
			width: 1920,
			height: 1080
		},
		{
			src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
			title: 'Another Landscape Video',
			aspectRatio: '16/9',
			width: 1280,
			height: 720
		}
	];

	onMount(() => {
		isMobileDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	});
</script>

<svelte:head>
	<title>Video Player Test - Wallace Collection</title>
</svelte:head>

<div class="container">
	<h1>Video Player Test</h1>
	<p>Testing improved video player with dimension constraints and mobile support.</p>
	<p><strong>Device Type:</strong> {isMobileDevice ? 'Mobile/Touch' : 'Desktop'}</p>

	<div class="video-grid">
		{#each testVideos as video, index}
			<div class="video-section">
				<h2>{video.title}</h2>
				<p>Aspect Ratio: {video.aspectRatio} | Dimensions: {video.width}x{video.height}</p>
				
				<div class="video-container">
					{#if isMobileDevice}
						<MobileVideoPlayer
							src={video.src}
							autoplay={false}
							loop={true}
							muted={true}
							aspectRatio={video.aspectRatio}
							width={video.width}
							height={video.height}
							className="test-video-player"
						/>
					{:else}
						<VideoPlayer
							src={video.src}
							autoplay={false}
							loop={true}
							muted={true}
							aspectRatio={video.aspectRatio}
							width={video.width}
							height={video.height}
							className="test-video-player"
							showControls={true}
							simplifiedControls={false}
						/>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<div class="test-info">
		<h2>Test Features</h2>
		<ul>
			<li>✅ Video dimensions are properly constrained</li>
			<li>✅ Aspect ratios are maintained</li>
			<li>✅ Mobile devices get simplified controls</li>
			<li>✅ Desktop devices get full controls</li>
			<li>✅ Touch-friendly controls on mobile</li>
			<li>✅ Proper video sizing within containers</li>
		</ul>
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	h1 {
		font-size: 2rem;
		margin-bottom: 1rem;
		color: #333;
	}

	h2 {
		font-size: 1.5rem;
		margin-bottom: 0.5rem;
		color: #555;
	}

	p {
		margin-bottom: 1rem;
		color: #666;
	}

	.video-grid {
		display: grid;
		gap: 3rem;
		margin: 2rem 0;
	}

	.video-section {
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		background: #f9f9f9;
	}

	.video-container {
		width: 100%;
		max-width: 800px;
		margin: 1rem 0;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		overflow: hidden;
	}

	:global(.test-video-player) {
		width: 100%;
		height: auto;
	}

	.test-info {
		margin-top: 3rem;
		padding: 1.5rem;
		background: #e8f5e8;
		border-radius: 8px;
		border-left: 4px solid #4caf50;
	}

	.test-info ul {
		list-style: none;
		padding: 0;
	}

	.test-info li {
		margin: 0.5rem 0;
		padding-left: 1rem;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		.video-section {
			padding: 1rem;
		}

		h1 {
			font-size: 1.5rem;
		}

		h2 {
			font-size: 1.25rem;
		}
	}
</style> 