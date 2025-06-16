<script lang="ts">
	import MediaChromeVideoPlayer from '$lib/components/MediaChromeVideoPlayer.svelte';

	// Test video URL
	const testVideo = {
		src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
		title: 'Big Buck Bunny',
		description: 'A sample video to test the Media Chrome video player',
		aspectRatio: '16/9'
	};
</script>

<svelte:head>
	<title>Video Player Test - Wallace Collection</title>
</svelte:head>

<main class="container">
	<h1>Media Chrome Video Player Test</h1>
	<p>Testing the new Media Chrome web component-based video player with modern features.</p>

	<div class="video-section">
		<h2>{testVideo.title}</h2>
		<div class="video-container">
			<MediaChromeVideoPlayer
				src={testVideo.src}
				title={testVideo.title}
				aspectRatio={testVideo.aspectRatio}
				autoplay={false}
				loop={true}
				muted={true}
				className="test-video-player"
			/>
		</div>
	</div>

	<div class="features">
		<h3>Media Chrome Features</h3>
		<ul>
			<li>✅ Modern web component architecture</li>
			<li>✅ Framework agnostic (works with any JS framework)</li>
			<li>✅ Fully customizable with CSS variables</li>
			<li>✅ Accessibility built-in</li>
			<li>✅ Picture-in-picture support</li>
			<li>✅ Keyboard shortcuts</li>
			<li>✅ Touch-friendly controls</li>
			<li>✅ Professional video player controls</li>
			<li>✅ Works with any video source (MP4, HLS, DASH, etc.)</li>
			<li>✅ Actively maintained by Mux</li>
		</ul>
	</div>

	<div class="comparison">
		<h3>Why Media Chrome?</h3>
		<div class="comparison-grid">
			<div class="comparison-item">
				<h4>🚀 Modern</h4>
				<p>Built with modern web standards and actively maintained by video experts at Mux.</p>
			</div>
			<div class="comparison-item">
				<h4>🎨 Customizable</h4>
				<p>Fully customizable with CSS variables and modular components.</p>
			</div>
			<div class="comparison-item">
				<h4>🌐 Universal</h4>
				<p>Works with React, Vue, Svelte, Angular, or vanilla HTML/JS.</p>
			</div>
			<div class="comparison-item">
				<h4>♿ Accessible</h4>
				<p>Built-in accessibility features and keyboard navigation.</p>
			</div>
		</div>
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

	h4 {
		font-size: 1.1rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: #1f2937;
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
		margin-bottom: 3rem;
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

	.comparison {
		background: #fff;
		padding: 2rem;
		border-radius: 12px;
		border: 1px solid #e5e7eb;
	}

	.comparison-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		margin-top: 1rem;
	}

	.comparison-item {
		padding: 1.5rem;
		background: #f8fafc;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
	}

	.comparison-item p {
		margin: 0;
		color: #64748b;
		line-height: 1.6;
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

		.comparison-grid {
			grid-template-columns: 1fr;
		}
	}
</style> 