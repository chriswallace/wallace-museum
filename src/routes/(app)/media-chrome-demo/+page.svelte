<script lang="ts">
	import MediaChromeVideoPlayer from '$lib/components/MediaChromeVideoPlayer.svelte';
	import MinimalVideoPlayer from '$lib/components/MinimalVideoPlayer.svelte';

	// Sample videos for testing
	const videos = [
		{
			src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
			title: 'Big Buck Bunny',
			poster: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
			aspectRatio: '16/9'
		},
		{
			src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
			title: 'Elephants Dream',
			poster: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
			aspectRatio: '16/9'
		},
		{
			src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
			title: 'For Bigger Blazes',
			poster: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
			aspectRatio: '16/9'
		}
	];
</script>

<svelte:head>
	<title>Media Chrome Demo - Wallace Collection</title>
	<meta name="description" content="Demonstration of the Media Chrome video player component" />
</svelte:head>

<main class="container">
	<header class="header">
		<h1>Media Chrome Video Player</h1>
		<p class="subtitle">
			Modern, customizable video player built with web components by Mux
		</p>
	</header>

	<section class="demo-section">
		<h2>Standard Video Player</h2>
		<div class="video-wrapper">
			<MediaChromeVideoPlayer
				src={videos[0].src}
				poster={videos[0].poster}
				title={videos[0].title}
				aspectRatio={videos[0].aspectRatio}
				muted={true}
				className="demo-player"
			/>
		</div>
	</section>

	<section class="demo-section">
		<h2>Minimal Chrome Style</h2>
		<div class="video-wrapper">
			<MediaChromeVideoPlayer
				src={videos[1].src}
				poster={videos[1].poster}
				title={videos[1].title}
				aspectRatio={videos[1].aspectRatio}
				muted={true}
				minimal={true}
				className="minimal-demo-player"
			/>
		</div>
		<p class="demo-description">
			Fewer controls, cleaner appearance, and auto-hiding controls that appear on hover or when paused.
		</p>
	</section>

	<section class="demo-section">
		<h2>Ultra Minimal Player</h2>
		<div class="video-wrapper">
			<MinimalVideoPlayer
				src={videos[2].src}
				poster={videos[2].poster}
				title={videos[2].title}
				aspectRatio={videos[2].aspectRatio}
				muted={true}
				borderRadius="12px"
				className="ultra-minimal-demo"
			/>
		</div>
		<p class="demo-description">
			Only play button and progress bar. Perfect for artwork displays or embedded content.
		</p>
	</section>

	<section class="demo-section">
		<h2>Progress Bar Only</h2>
		<div class="video-wrapper">
			<MinimalVideoPlayer
				src={videos[0].src}
				poster={videos[0].poster}
				title={videos[0].title}
				aspectRatio={videos[0].aspectRatio}
				muted={true}
				showPlayButton={false}
				showProgress={true}
				borderRadius="8px"
				className="progress-only"
			/>
		</div>
		<p class="demo-description">
			Just a progress indicator at the bottom. Click anywhere to play/pause.
		</p>
	</section>

	<section class="demo-section">
		<h2>Ghost Chrome Style</h2>
		<div class="video-wrapper">
			<MediaChromeVideoPlayer
				src={videos[2].src}
				poster={videos[2].poster}
				title={videos[2].title}
				aspectRatio={videos[2].aspectRatio}
				muted={true}
				ghost={true}
				className="ghost-demo-player"
			/>
		</div>
		<p class="demo-description">
			Completely transparent controls with no dark backgrounds. Perfect for clean, unobtrusive video display.
		</p>
	</section>

	<section class="demo-section">
		<h2>Compact Audio-Style Player</h2>
		<div class="audio-wrapper">
			<MediaChromeVideoPlayer
				src={videos[1].src}
				poster={videos[1].poster}
				title={videos[1].title}
				aspectRatio="4/1"
				muted={true}
				height="120px"
				className="audio-player"
			/>
		</div>
	</section>

	<section class="demo-section">
		<h2>Square Format</h2>
		<div class="square-wrapper">
			<MediaChromeVideoPlayer
				src={videos[2].src}
				poster={videos[2].poster}
				title={videos[2].title}
				aspectRatio="1/1"
				muted={true}
				className="square-player"
			/>
		</div>
	</section>

	<section class="features-section">
		<h2>Minimal Chrome Options</h2>
		<div class="features-grid">
			<div class="feature-card">
				<div class="feature-icon">🎯</div>
				<h3>Minimal Prop</h3>
				<p>Add <code>minimal={true}</code> to reduce controls and create a cleaner interface</p>
			</div>
			<div class="feature-card">
				<div class="feature-icon">👻</div>
				<h3>Ghost Chrome</h3>
				<p>Use <code>ghost={true}</code> for completely transparent controls with no dark backgrounds</p>
			</div>
			<div class="feature-card">
				<div class="feature-icon">🎚️</div>
				<h3>Ultra Minimal</h3>
				<p>Use MinimalVideoPlayer for just play button and progress bar</p>
			</div>
			<div class="feature-card">
				<div class="feature-icon">📊</div>
				<h3>Progress Only</h3>
				<p>Show only a progress indicator for the cleanest possible interface</p>
			</div>
		</div>
	</section>

	<section class="code-examples">
		<h2>Usage Examples</h2>
		<div class="code-grid">
			<div class="code-example">
				<h3>Ghost Chrome</h3>
				<pre><code>&lt;MediaChromeVideoPlayer
  src="video.mp4"
  ghost={true}
  muted={true}
/&gt;</code></pre>
			</div>
			<div class="code-example">
				<h3>Minimal Chrome</h3>
				<pre><code>&lt;MediaChromeVideoPlayer
  src="video.mp4"
  minimal={true}
  muted={true}
/&gt;</code></pre>
			</div>
			<div class="code-example">
				<h3>Ultra Minimal</h3>
				<pre><code>&lt;MinimalVideoPlayer
  src="video.mp4"
  borderRadius="12px"
  muted={true}
/&gt;</code></pre>
			</div>
			<div class="code-example">
				<h3>Progress Only</h3>
				<pre><code>&lt;MinimalVideoPlayer
  src="video.mp4"
  showPlayButton={false}
  showProgress={true}
  className="progress-only"
/&gt;</code></pre>
			</div>
		</div>
	</section>

	<section class="features-section">
		<h2>Key Features</h2>
		<div class="features-grid">
			<div class="feature-card">
				<div class="feature-icon">🎮</div>
				<h3>Modern Controls</h3>
				<p>Professional video player controls with smooth animations and responsive design</p>
			</div>
			<div class="feature-card">
				<div class="feature-icon">🎨</div>
				<h3>Fully Customizable</h3>
				<p>Style with CSS variables, swap out components, or build your own controls</p>
			</div>
			<div class="feature-card">
				<div class="feature-icon">📱</div>
				<h3>Touch Friendly</h3>
				<p>Optimized for mobile devices with touch gestures and responsive layouts</p>
			</div>
			<div class="feature-card">
				<div class="feature-icon">♿</div>
				<h3>Accessible</h3>
				<p>Built-in keyboard navigation, screen reader support, and ARIA labels</p>
			</div>
			<div class="feature-card">
				<div class="feature-icon">🖼️</div>
				<h3>Picture-in-Picture</h3>
				<p>Native browser PiP support for multitasking while watching videos</p>
			</div>
			<div class="feature-card">
				<div class="feature-icon">🌐</div>
				<h3>Framework Agnostic</h3>
				<p>Works with React, Vue, Svelte, Angular, or vanilla HTML/JavaScript</p>
			</div>
		</div>
	</section>

	<section class="comparison-section">
		<h2>Why Choose Media Chrome?</h2>
		<div class="comparison-table">
			<div class="comparison-header">
				<div class="feature-name">Feature</div>
				<div class="media-chrome">Media Chrome</div>
				<div class="others">Other Players</div>
			</div>
			<div class="comparison-row">
				<div class="feature-name">Web Components</div>
				<div class="media-chrome">✅ Native</div>
				<div class="others">❌ Framework-specific</div>
			</div>
			<div class="comparison-row">
				<div class="feature-name">Customization</div>
				<div class="media-chrome">✅ CSS Variables</div>
				<div class="others">⚠️ Limited themes</div>
			</div>
			<div class="comparison-row">
				<div class="feature-name">Maintenance</div>
				<div class="media-chrome">✅ Active (Mux)</div>
				<div class="others">❌ Often abandoned</div>
			</div>
			<div class="comparison-row">
				<div class="feature-name">Bundle Size</div>
				<div class="media-chrome">✅ Lightweight</div>
				<div class="others">⚠️ Often bloated</div>
			</div>
			<div class="comparison-row">
				<div class="feature-name">Accessibility</div>
				<div class="media-chrome">✅ Built-in</div>
				<div class="others">⚠️ Varies</div>
			</div>
		</div>
	</section>
</main>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.header {
		text-align: center;
		margin-bottom: 4rem;
	}

	.header h1 {
		font-size: 3rem;
		font-weight: 800;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin-bottom: 1rem;
	}

	.subtitle {
		font-size: 1.25rem;
		color: #6b7280;
		max-width: 600px;
		margin: 0 auto;
		line-height: 1.6;
	}

	.demo-section {
		margin-bottom: 4rem;
	}

	.demo-section h2 {
		font-size: 1.75rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
		color: #1f2937;
	}

	.demo-description {
		margin-top: 1rem;
		color: #6b7280;
		font-style: italic;
		text-align: center;
	}

	.video-wrapper {
		max-width: 800px;
		margin: 0 auto;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.audio-wrapper {
		max-width: 600px;
		margin: 0 auto;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
	}

	.square-wrapper {
		max-width: 400px;
		margin: 0 auto;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.code-examples {
		margin: 6rem 0;
	}

	.code-examples h2 {
		font-size: 2rem;
		font-weight: 700;
		text-align: center;
		margin-bottom: 3rem;
		color: #1f2937;
	}

	.code-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
	}

	.code-example {
		background: #1f2937;
		border-radius: 8px;
		overflow: hidden;
	}

	.code-example h3 {
		background: #374151;
		color: white;
		padding: 1rem;
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.code-example pre {
		margin: 0;
		padding: 1.5rem;
		overflow-x: auto;
	}

	.code-example code {
		color: #e5e7eb;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.features-section {
		margin: 6rem 0;
	}

	.features-section h2 {
		font-size: 2rem;
		font-weight: 700;
		text-align: center;
		margin-bottom: 3rem;
		color: #1f2937;
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
	}

	.feature-card {
		background: white;
		padding: 2rem;
		border-radius: 12px;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		text-align: center;
		transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
	}

	.feature-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.feature-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.feature-card h3 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		color: #1f2937;
	}

	.feature-card p {
		color: #6b7280;
		line-height: 1.6;
	}

	.feature-card code {
		background: #f3f4f6;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		color: #1f2937;
	}

	.comparison-section {
		margin: 6rem 0;
	}

	.comparison-section h2 {
		font-size: 2rem;
		font-weight: 700;
		text-align: center;
		margin-bottom: 3rem;
		color: #1f2937;
	}

	.comparison-table {
		background: white;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}

	.comparison-header {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
	}

	.comparison-header > div {
		padding: 1rem;
		font-weight: 600;
		color: #374151;
		text-align: center;
	}

	.comparison-header .feature-name {
		text-align: left;
	}

	.comparison-row {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		border-bottom: 1px solid #f3f4f6;
	}

	.comparison-row:last-child {
		border-bottom: none;
	}

	.comparison-row > div {
		padding: 1rem;
		text-align: center;
	}

	.comparison-row .feature-name {
		text-align: left;
		font-weight: 500;
		color: #374151;
	}

	.media-chrome {
		color: #059669;
		font-weight: 500;
	}

	.others {
		color: #dc2626;
		font-weight: 500;
	}

	/* Custom styling for demo players */
	:global(.demo-player) {
		border-radius: 12px;
	}

	:global(.minimal-demo-player) {
		border-radius: 12px;
	}

	:global(.ultra-minimal-demo) {
		border-radius: 12px;
	}

	:global(.audio-player) {
		border-radius: 8px;
	}

	:global(.square-player) {
		border-radius: 12px;
	}

	:global(.ghost-demo-player) {
		border-radius: 12px;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		.header h1 {
			font-size: 2.5rem;
		}

		.features-grid,
		.code-grid {
			grid-template-columns: 1fr;
		}

		.comparison-header,
		.comparison-row {
			grid-template-columns: 1fr;
		}

		.comparison-header > div,
		.comparison-row > div {
			text-align: left;
		}

		.comparison-header .media-chrome::before {
			content: 'Media Chrome: ';
			font-weight: 400;
		}

		.comparison-header .others::before {
			content: 'Others: ';
			font-weight: 400;
		}
	}
</style> 