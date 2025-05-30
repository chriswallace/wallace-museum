<script lang="ts">
	import ArtworkGrid from '$lib/components/ArtworkGrid.svelte';
	import ArtworkMasonryGrid from '$lib/components/ArtworkMasonryGrid.svelte';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import { onMount } from 'svelte';

	let showSkeletons = true;
	let gridType: 'regular' | 'masonry' = 'masonry';

	// Sample artwork data with various dimensions
	const sampleArtworks = [
		{
			id: 1,
			title: "Digital Landscape",
			imageUrl: "https://picsum.photos/400/500",
			creator: "Artist One",
			dimensions: { width: 400, height: 500 }
		},
		{
			id: 2,
			title: "Abstract Composition",
			imageUrl: "https://picsum.photos/600/400",
			creator: "Artist Two",
			dimensions: { width: 600, height: 400 }
		},
		{
			id: 3,
			title: "Portrait Study",
			imageUrl: "https://picsum.photos/300/400",
			creator: "Artist Three",
			dimensions: { width: 300, height: 400 }
		},
		{
			id: 4,
			title: "Geometric Pattern",
			imageUrl: "https://picsum.photos/400/400",
			creator: "Artist Four",
			dimensions: { width: 400, height: 400 }
		},
		{
			id: 5,
			title: "Nature Scene",
			imageUrl: "https://picsum.photos/800/400",
			creator: "Artist Five",
			dimensions: { width: 800, height: 400 }
		},
		{
			id: 6,
			title: "Urban Photography",
			imageUrl: "https://picsum.photos/400/600",
			creator: "Artist Six",
			dimensions: { width: 400, height: 600 }
		}
	];

	let displayedArtworks: typeof sampleArtworks = [];

	onMount(() => {
		// Simulate loading delay
		setTimeout(() => {
			showSkeletons = false;
			displayedArtworks = sampleArtworks;
		}, 3000);
	});

	function toggleSkeletons() {
		showSkeletons = !showSkeletons;
		if (showSkeletons) {
			displayedArtworks = [];
		} else {
			displayedArtworks = sampleArtworks;
		}
	}

	function handleArtworkClick(artwork: any) {
		console.log('Clicked artwork:', artwork.title);
	}
</script>

<svelte:head>
	<title>Skeleton Loading Demo | Wallace Museum</title>
	<meta name="description" content="Demonstration of skeleton loading with proper image dimensions" />
</svelte:head>

<div class="demo-container">
	<header class="demo-header">
		<h1>Skeleton Loading Demo</h1>
		<p>This page demonstrates skeleton loaders that match the exact dimensions of the images that will replace them.</p>
		
		<div class="controls">
			<button 
				class="toggle-btn"
				on:click={toggleSkeletons}
			>
				{showSkeletons ? 'Load Images' : 'Show Skeletons'}
			</button>
			
			<div class="grid-type-selector">
				<label>
					<input 
						type="radio" 
						bind:group={gridType} 
						value="regular"
					/>
					Regular Grid
				</label>
				<label>
					<input 
						type="radio" 
						bind:group={gridType} 
						value="masonry"
					/>
					Masonry Grid
				</label>
			</div>
		</div>
	</header>

	<main class="demo-content">
		<section class="grid-demo">
			<h2>Artwork Grid with Skeleton Loading</h2>
			
			{#if gridType === 'regular'}
				<ArtworkGrid
					artworks={displayedArtworks}
					columns={3}
					gap="1.5rem"
					imageSize="medium"
					showSkeletonCount={6}
					onArtworkClick={handleArtworkClick}
				/>
			{:else}
				<ArtworkMasonryGrid
					artworks={displayedArtworks}
					columns={3}
					gap={24}
					imageWidth={300}
					showSkeletonCount={6}
					onArtworkClick={handleArtworkClick}
				/>
			{/if}
		</section>

		<section class="individual-demo">
			<h2>Individual OptimizedImage Components</h2>
			<div class="image-grid">
				{#each [
					{ width: 300, height: 200, ratio: '3/2' },
					{ width: 200, height: 300, ratio: '2/3' },
					{ width: 250, height: 250, ratio: '1/1' },
					{ width: 400, height: 200, ratio: '2/1' }
				] as config}
					<div class="image-demo">
						<h3>{config.width}×{config.height} ({config.ratio})</h3>
						<OptimizedImage
							src={showSkeletons ? '' : `https://picsum.photos/${config.width}/${config.height}`}
							alt="Demo image"
							width={config.width}
							height={config.height}
							aspectRatio={config.ratio}
							showSkeleton={true}
							skeletonBorderRadius="8px"
							className="demo-image"
						/>
					</div>
				{/each}
			</div>
		</section>
	</main>
</div>

<style>
	.demo-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.demo-header {
		text-align: center;
		margin-bottom: 3rem;
	}

	.demo-header h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: #1f2937;
		margin-bottom: 1rem;
	}

	.demo-header p {
		font-size: 1.125rem;
		color: #6b7280;
		margin-bottom: 2rem;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
	}

	.controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		flex-wrap: wrap;
	}

	.toggle-btn {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.toggle-btn:hover {
		background: #2563eb;
	}

	.grid-type-selector {
		display: flex;
		gap: 1rem;
	}

	.grid-type-selector label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
	}

	.demo-content {
		display: flex;
		flex-direction: column;
		gap: 4rem;
	}

	.grid-demo h2,
	.individual-demo h2 {
		font-size: 1.875rem;
		font-weight: 600;
		color: #1f2937;
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 2rem;
		margin-top: 2rem;
	}

	.image-demo {
		text-align: center;
	}

	.image-demo h3 {
		font-size: 1rem;
		font-weight: 500;
		color: #4b5563;
		margin-bottom: 1rem;
	}

	:global(.demo-image) {
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.demo-container {
			background: #111827;
			color: #f9fafb;
		}

		.demo-header h1 {
			color: #f9fafb;
		}

		.demo-header p {
			color: #9ca3af;
		}

		.grid-demo h2,
		.individual-demo h2 {
			color: #f9fafb;
		}

		.image-demo h3 {
			color: #d1d5db;
		}

		.grid-type-selector label {
			color: #d1d5db;
		}
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.demo-container {
			padding: 1rem;
		}

		.demo-header h1 {
			font-size: 2rem;
		}

		.controls {
			flex-direction: column;
			gap: 1rem;
		}

		.image-grid {
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 1rem;
		}
	}
</style> 