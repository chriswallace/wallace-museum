<script lang="ts">
	import { onMount } from 'svelte';
	import ArtworkStage from '$lib/components/ArtworkStage.svelte';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';

	let currentArtwork = {
		id: '1',
		title: 'Test Artwork 1',
		imageUrl: 'https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/test1.png',
		mime: 'image/png'
	};

	let artworks = [
		{
			id: '1',
			title: 'Test Artwork 1',
			imageUrl: 'https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/test1.png',
			mime: 'image/png'
		},
		{
			id: '2',
			title: 'Test Artwork 2',
			imageUrl: 'https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/test2.png',
			mime: 'image/png'
		},
		{
			id: '3',
			title: 'Test Artwork 3',
			imageUrl: 'https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/test3.png',
			mime: 'image/png'
		}
	];

	function switchArtwork(artwork: any) {
		console.log('Switching to artwork:', artwork.title);
		currentArtwork = artwork;
	}
</script>

<svelte:head>
	<title>Skeleton Loading Test</title>
</svelte:head>

<div class="container mx-auto p-8">
	<h1 class="text-2xl font-bold mb-8">Skeleton Loading Test</h1>
	
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<!-- ArtworkStage Test -->
		<div>
			<h2 class="text-xl font-semibold mb-4">ArtworkStage Component</h2>
			<div class="w-full h-96 border border-gray-300 rounded-lg overflow-hidden">
				<ArtworkStage
					artwork={currentArtwork}
					aspectRatio="square"
					className="w-full h-full"
					loading="eager"
					quality={85}
				/>
			</div>
		</div>

		<!-- OptimizedImage Test -->
		<div>
			<h2 class="text-xl font-semibold mb-4">OptimizedImage Component</h2>
			<div class="w-full h-96 border border-gray-300 rounded-lg overflow-hidden">
				<OptimizedImage
					src={currentArtwork.imageUrl}
					alt={currentArtwork.title}
					width={400}
					height={400}
					fit="contain"
					format="auto"
					quality={85}
					className="w-full h-full object-contain"
					fallbackSrc="/images/placeholder.webp"
					loading="eager"
					mimeType={currentArtwork.mime}
					showSkeleton={true}
				/>
			</div>
		</div>
	</div>

	<!-- Controls -->
	<div class="mt-8">
		<h2 class="text-xl font-semibold mb-4">Switch Artworks</h2>
		<div class="flex gap-4">
			{#each artworks as artwork}
				<button
					class="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 transition-colors"
					class:bg-blue-700={currentArtwork.id === artwork.id}
					on:click={() => switchArtwork(artwork)}
				>
					{artwork.title}
				</button>
			{/each}
		</div>
	</div>

	<!-- Debug Info -->
	<div class="mt-8 p-4 bg-gray-100 rounded-lg">
		<h3 class="font-semibold mb-2">Current Artwork Debug Info:</h3>
		<pre class="text-sm">{JSON.stringify(currentArtwork, null, 2)}</pre>
	</div>
</div> 