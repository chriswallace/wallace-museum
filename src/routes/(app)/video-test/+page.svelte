<script lang="ts">
	import EnhancedVideoPlayer from '$lib/components/EnhancedVideoPlayer.svelte';

	// Test video URL
	const testVideo = {
		src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
		title: 'Big Buck Bunny',
		description: 'A sample video to test the enhanced video player',
		aspectRatio: '16/9'
	};
</script>

<svelte:head>
	<title>Video Player Test - Wallace Collection</title>
</svelte:head>

<main class="container">
	<h1>Enhanced Video Player Test</h1>
	<p>Testing the web component-based video player with advanced features.</p>

	<div class="video-section">
		<h2>{testVideo.title}</h2>
		<div class="video-container">
			<EnhancedVideoPlayer
				src={testVideo.src}
				title={testVideo.title}
				description={testVideo.description}
				aspectRatio={testVideo.aspectRatio}
				autoplay={false}
				loop={true}
				muted={true}
				themeColor="#3b82f6"
				className="test-video-player"
			/>
		</div>
	</div>

	<div class="features">
		<h3>Features</h3>
		<ul>
			<li>✅ Custom video controls with smooth animations</li>
			<li>✅ Touch device detection and adaptive UI</li>
			<li>✅ Keyboard shortcuts (Space/K for play/pause, M for mute, F for fullscreen)</li>
			<li>✅ Volume control with visual bars</li>
			<li>✅ Progress bar with seeking</li>
			<li>✅ Fullscreen support</li>
			<li>✅ Auto-pause when out of view</li>
			<li>✅ Accessibility features</li>
		</ul>
	</div>
</main>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		margin-bottom: 1rem;
		color: #1f2937;
	}

	h2 {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: #374151;
	}

	h3 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: #374151;
	}

	.video-section {
		margin-bottom: 3rem;
	}

	.video-container {
		width: 100%;
		max-width: 800px;
		aspect-ratio: 16/9;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
	}

	:global(.test-video-player) {
		border-radius: 12px;
	}

	.features {
		background: #f9fafb;
		padding: 2rem;
		border-radius: 12px;
		border: 1px solid #e5e7eb;
	}

	.features ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.features li {
		padding: 0.5rem 0;
		font-size: 1rem;
		color: #374151;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		h1 {
			font-size: 2rem;
		}

		.video-container {
			max-width: 100%;
		}
	}
</style> 