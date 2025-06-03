<script lang="ts">
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import LoaderWrapper from '$lib/components/LoaderWrapper.svelte';
	import { onMount } from 'svelte';

	let showImages = false;
	let testMode = 'skeleton'; // 'skeleton', 'loading', 'loaded'

	function toggleMode() {
		if (testMode === 'skeleton') {
			testMode = 'loading';
			// Simulate loading delay
			setTimeout(() => {
				testMode = 'loaded';
				showImages = true;
			}, 2000);
		} else {
			testMode = 'skeleton';
			showImages = false;
		}
	}
</script>

<svelte:head>
	<title>Skeleton Loading Test</title>
</svelte:head>

<div class="container mx-auto p-8">
	<h1 class="text-3xl font-bold mb-6">Skeleton Loading Test</h1>
	
	<div class="mb-6">
		<button 
			class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
			on:click={toggleMode}
		>
			Current Mode: {testMode} - Click to {testMode === 'skeleton' ? 'Start Loading' : 'Reset'}
		</button>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<!-- Direct LoaderWrapper Test -->
		<div class="border rounded-lg p-4 bg-yellow-50">
			<h3 class="font-semibold mb-2">Direct LoaderWrapper Test</h3>
			<div style="width: 300px; height: 200px; position: relative;">
				<LoaderWrapper 
					width="100%" 
					height="100%" 
					borderRadius="8px"
					aspectRatio="3/2"
				/>
			</div>
			<p class="text-sm text-gray-600 mt-2">This should always show a skeleton loader with 3:2 aspect ratio</p>
		</div>

		<!-- Test 1: Empty src (should always show skeleton) -->
		<div class="border rounded-lg p-4">
			<h3 class="font-semibold mb-2">Test 1: Empty src (Always Skeleton)</h3>
			<OptimizedImage
				src=""
				alt="Test image"
				width={300}
				height={200}
				aspectRatio="3/2"
				showSkeleton={true}
				skeletonBorderRadius="8px"
				className="w-full"
			/>
		</div>

		<!-- Test 2: Conditional src -->
		<div class="border rounded-lg p-4">
			<h3 class="font-semibold mb-2">Test 2: Conditional Loading</h3>
			<OptimizedImage
				src={showImages ? 'https://picsum.photos/300/200' : ''}
				alt="Test image"
				width={300}
				height={200}
				aspectRatio="3/2"
				showSkeleton={true}
				skeletonBorderRadius="8px"
				className="w-full"
			/>
		</div>

		<!-- Test 3: Different aspect ratio -->
		<div class="border rounded-lg p-4">
			<h3 class="font-semibold mb-2">Test 3: Portrait Aspect Ratio</h3>
			<OptimizedImage
				src={showImages ? 'https://picsum.photos/300/400' : ''}
				alt="Test image"
				width={300}
				height={400}
				aspectRatio="3/4"
				showSkeleton={true}
				skeletonBorderRadius="8px"
				className="w-full"
			/>
		</div>

		<!-- Test 4: Square with circular skeleton -->
		<div class="border rounded-lg p-4">
			<h3 class="font-semibold mb-2">Test 4: Circular Avatar</h3>
			<OptimizedImage
				src={showImages ? 'https://picsum.photos/100/100' : ''}
				alt="Avatar"
				width={100}
				height={100}
				aspectRatio="1/1"
				showSkeleton={true}
				skeletonBorderRadius="50%"
				className="w-24 h-24 rounded-full mx-auto"
			/>
		</div>

		<!-- Test 5: Artwork Dimensions Simulation -->
		<div class="border rounded-lg p-4 bg-green-50">
			<h3 class="font-semibold mb-2">Test 5: Simulated Artwork Dimensions</h3>
			<div class="space-y-4">
				{#each [
					{ width: 1920, height: 1080, title: 'Landscape (16:9)' },
					{ width: 800, height: 1200, title: 'Portrait (2:3)' },
					{ width: 1000, height: 1000, title: 'Square (1:1)' },
					{ width: 2400, height: 800, title: 'Panoramic (3:1)' }
				] as artwork}
					<div class="border p-2 rounded">
						<h4 class="text-sm font-medium mb-2">{artwork.title} - {artwork.width}×{artwork.height}</h4>
						<div style="max-width: 300px;">
							<OptimizedImage
								src={showImages ? `https://picsum.photos/${artwork.width}/${artwork.height}` : ''}
								alt={artwork.title}
								width={300}
								aspectRatio={`${artwork.width}/${artwork.height}`}
								showSkeleton={true}
								skeletonBorderRadius="4px"
								className="w-full"
							/>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Test 6: No aspect ratio -->
		<div class="border rounded-lg p-4">
			<h3 class="font-semibold mb-2">Test 5: No Aspect Ratio</h3>
			<OptimizedImage
				src={showImages ? 'https://picsum.photos/300/300' : ''}
				alt="Test image"
				width={300}
				showSkeleton={true}
				skeletonBorderRadius="8px"
				className="w-full"
			/>
		</div>

		<!-- Test 6: Very wide aspect ratio -->
		<div class="border rounded-lg p-4">
			<h3 class="font-semibold mb-2">Test 6: Wide Aspect Ratio</h3>
			<OptimizedImage
				src={showImages ? 'https://picsum.photos/600/200' : ''}
				alt="Test image"
				width={300}
				height={100}
				aspectRatio="6/2"
				showSkeleton={true}
				skeletonBorderRadius="8px"
				className="w-full"
			/>
		</div>
	</div>

	<div class="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
		<h3 class="font-semibold mb-2">Debug Info:</h3>
		<ul class="text-sm space-y-1">
			<li>Test Mode: <strong>{testMode}</strong></li>
			<li>Show Images: <strong>{showImages}</strong></li>
			<li>Expected Behavior: 
				{#if testMode === 'skeleton'}
					All images should show skeleton loaders
				{:else if testMode === 'loading'}
					Images should be loading (may show skeleton briefly)
				{:else}
					Images should be loaded and visible
				{/if}
			</li>
		</ul>
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
	}
</style> 