<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import ArtworkMeta from '$lib/components/ArtworkMeta.svelte';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtistList from '$lib/components/ArtistList.svelte';

	import { showToast } from '$lib/toastHelper';
	import { goto } from '$app/navigation';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';

	let artworkId: string;

	$: $page, (artworkId = $page.params.id);

	// Create a reactive title variable
	$: pageTitle = artwork.title
		? `Edit ${artwork.title} | Wallace Museum Admin`
		: 'Edit Artwork | Wallace Museum Admin';

	interface Artist {
		id: number;
		name: string;
		avatarUrl?: string;
	}

	interface Artwork {
		id?: number;
		title: string;
		description: string;
		imageUrl?: string | null;
		animationUrl?: string | null;
		thumbnailUrl?: string | null;
		generatorUrl?: string | null;
		artists?: Artist[];
		collectionId: number | null;
		mime?: string | null;
		attributes?: string | null;
		curatorNotes?: string;
		contractAddr?: string;
		contractAlias?: string;
		symbol?: string;
		blockchain?: string;
		tokenID?: string;
		mintDate?: string;
		fullscreen?: boolean;

		// OpenSea-specific display-optimized URLs
		// display_image_url?: string;
		// display_animation_url?: string;

		// Tezos-specific URLs
		// thumbnailUri?: string;
		// artifactUri?: string;
		// displayUri?: string;

		// External and metadata URLs
		metadataUrl?: string | null;
		externalUrl?: string | null;

		// Content moderation flags
		// isDisabled?: boolean;
		// isNsfw?: boolean;
		// isSuspicious?: boolean;

		// Media metadata
		fileSize?: number;
		duration?: number;
		supply?: number;

		// Creator tracking
		// resolvedArtist?: boolean;

		// Ownership data
		dimensions?: { width: number; height: number } | null;
	}

	let artwork: Artwork = {
		title: '',
		description: '',
		imageUrl: null,
		animationUrl: null,
		thumbnailUrl: null,
		generatorUrl: null,
		artists: [],
		collectionId: null,
		mime: null,
		attributes: null,
		curatorNotes: '',
		contractAddr: '',
		contractAlias: '',
		symbol: '',
		blockchain: '',
		tokenID: '',
		mintDate: '',
		metadataUrl: null,
		externalUrl: null,
		dimensions: null,
		fullscreen: false
	};

	interface Collection {
		id: number;
		title: string;
	}

	let allArtists: Artist[] = [];
	let selectedArtistIds: number[] = [];
	let collections: Collection[] = [];
	let error: string = '';
	let isLoading: boolean = true;
	let isRefetching: boolean = false;

	let width: number = artwork.dimensions?.width ?? 0;
	let height: number = artwork.dimensions?.height ?? 0;

	$: if (artwork && artwork.dimensions) {
		width = artwork.dimensions.width ?? 0;
		height = artwork.dimensions.height ?? 0;
	}

	// Determine which dimension should be 100% based on aspect ratio
	$: isWiderThanTall = artwork.dimensions ? artwork.dimensions.width >= artwork.dimensions.height : true;
	$: mediaStyle = artwork.dimensions 
		? (isWiderThanTall 
			? `width: 100%; height: auto; aspect-ratio: ${artwork.dimensions.width}/${artwork.dimensions.height};`
			: `height: 100%; width: auto; aspect-ratio: ${artwork.dimensions.width}/${artwork.dimensions.height};`)
		: 'width: 100%; height: auto;';

	// Common MIME types for artworks
	const commonMimeTypes = [
		{ value: '', label: '-- Select MIME Type --' },
		{ value: 'image/jpeg', label: 'JPEG Image (image/jpeg)' },
		{ value: 'image/png', label: 'PNG Image (image/png)' },
		{ value: 'image/gif', label: 'GIF Image (image/gif)' },
		{ value: 'image/webp', label: 'WebP Image (image/webp)' },
		{ value: 'image/svg+xml', label: 'SVG Image (image/svg+xml)' },
		{ value: 'video/mp4', label: 'MP4 Video (video/mp4)' },
		{ value: 'video/webm', label: 'WebM Video (video/webm)' },
		{ value: 'video/quicktime', label: 'QuickTime Video (video/quicktime)' },
		{ value: 'video/ogg', label: 'OGG Video (video/ogg)' },
		{ value: 'text/html', label: 'HTML Document (text/html)' },
		{ value: 'application/javascript', label: 'JavaScript (application/javascript)' },
		{ value: 'model/gltf+json', label: 'glTF Model (model/gltf+json)' },
		{ value: 'model/gltf-binary', label: 'glTF Binary (model/gltf-binary)' },
		{ value: 'application/pdf', label: 'PDF Document (application/pdf)' },
		{ value: 'audio/mpeg', label: 'MP3 Audio (audio/mpeg)' },
		{ value: 'audio/wav', label: 'WAV Audio (audio/wav)' },
		{ value: 'audio/ogg', label: 'OGG Audio (audio/ogg)' }
	];

	async function updateArtwork(event: Event) {
		const payload = {
			title: artwork.title,
			description: artwork.description,
			collectionId: artwork.collectionId,
			artistIds: selectedArtistIds,
			image_url: artwork.imageUrl,
			animation_url: artwork.animationUrl,
			thumbnail_url: artwork.thumbnailUrl,
			generator_url: artwork.generatorUrl,
			mime: artwork.mime,
			metadataUrl: artwork.metadataUrl,
			externalUrl: artwork.externalUrl,
			supply: artwork.supply,
			attributes: artwork.attributes,
			dimensions: width && height ? { width: Number(width), height: Number(height) } : null,
			fullscreen: artwork.fullscreen
		};

		const response = await fetch(`/api/admin/artworks/${artwork.id}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		if (response.ok) {
			showToast('Artwork saved.', 'success');
			const updatedData = await response.json();
			artwork = updatedData;
			selectedArtistIds = artwork.artists?.map((a) => a.id) || [];
		} else {
			const errorData = await response.json();
			showToast(
				`Failed to update artwork: ${errorData.details || errorData.error || 'Unknown error'}`,
				'error'
			);
		}
	}

	async function deleteArtwork() {
		const response = await fetch(`/api/admin/artworks/${artwork.id}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			showToast('Artwork deleted.', 'success');
			goto('/admin/artworks');
		} else {
			const errorData = await response.json();
			showToast(
				`Failed to delete artwork: ${errorData.details || errorData.error || 'Unknown error'}`,
				'error'
			);
		}
	}

	async function confirmDeleteArtwork() {
		if (confirm('Are you sure you want to delete this artwork?')) {
			await deleteArtwork();
		}
	}

	async function refetchArtworkData() {
		if (!artwork.id) return;
		
		isRefetching = true;
		try {
			const response = await fetch(`/api/admin/artworks/${artwork.id}/refetch`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const result = await response.json();
				if (result.success) {
					// Update the artwork with the fresh data
					artwork = result.artwork;
					selectedArtistIds = artwork.artists?.map((a) => a.id) || [];
					
					// Show success message with updated fields
					const updatedFields = result.updatedFields || [];
					if (updatedFields.length > 0) {
						showToast(`Successfully refetched artwork data. Updated: ${updatedFields.join(', ')}`, 'success');
					} else {
						showToast(result.message || 'Artwork data is already up to date', 'info');
					}
				} else {
					showToast(`Failed to refetch artwork data: ${result.error}`, 'error');
				}
			} else {
				const errorData = await response.json();
				showToast(
					`Failed to refetch artwork data: ${errorData.error || 'Unknown error'}`,
					'error'
				);
			}
		} catch (error) {
			console.error('Error refetching artwork data:', error);
			showToast('Failed to refetch artwork data: Network error', 'error');
		} finally {
			isRefetching = false;
		}
	}

	async function fetchArtwork() {
		try {
			const [artworkRes, artistsRes, collectionsRes] = await Promise.all([
				fetch(`/api/admin/artworks/${artworkId}`),
				fetch('/api/admin/artists'),
				fetch('/api/admin/collections/all')
			]);

			if (artworkRes.ok) {
				artwork = await artworkRes.json();
				selectedArtistIds = artwork.artists?.map((a) => a.id) || [];
			} else {
				error = 'Failed to fetch artwork';
			}

			if (artistsRes.ok) {
				allArtists = await artistsRes.json();
			}

			if (collectionsRes.ok) {
				const collectionsData = await collectionsRes.json();
				collections = collectionsData.collections;
			}
		} catch (e) {
			error = (e as Error).message;
		} finally {
			isLoading = false;
		}
	}

	function goBack() {
		history.back();
	}

	onMount(() => {
		if (browser) {
			fetchArtwork();
		}
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="max-w-7xl mx-auto">
	{#if isLoading}
		<p>Loading...</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else}
		<button class="back-btn" on:click={goBack}>&lt; Back</button>
		<h1>Edit artwork</h1>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
			<div>
				<div class="artwork-preview-container">
					<div class="artwork-preview">
						{#if artwork.animationUrl || artwork.generatorUrl}
							{#if artwork.mime?.startsWith('video/')}
								<video 
									src={ipfsToHttpUrl(artwork.animationUrl || artwork.generatorUrl)} 
									controls 
									muted 
									autoplay 
									loop
									class="media-content"
									width={artwork.dimensions?.width || 800}
									height={artwork.dimensions?.height || 800}
									style={mediaStyle}
								>
									<track kind="captions" />
								</video>
							{:else if artwork.mime === 'text/html' || artwork.mime === 'application/javascript' || artwork.generatorUrl}
								<iframe 
									src={ipfsToHttpUrl(artwork.animationUrl || artwork.generatorUrl)} 
									title="Interactive Artwork"
									class="media-content"
									width={artwork.dimensions?.width || 800}
									height={artwork.dimensions?.height || 800}
									style={mediaStyle}
									allowfullscreen
								></iframe>
							{:else}
								<OptimizedImage
									src={artwork.animationUrl}
									alt={artwork.title}
									width={artwork.dimensions?.width || 800}
									height={artwork.dimensions?.height || 800}
									fit="contain"
									format="webp"
									quality={85}
									className="media-content"
									style={mediaStyle}
								/>
							{/if}
						{:else if artwork.imageUrl}
							<OptimizedImage
								src={artwork.imageUrl}
								alt={artwork.title}
								width={artwork.dimensions?.width || 800}
								height={artwork.dimensions?.height || 800}
								fit="contain"
								format="webp"
								quality={85}
								className="media-content"
								style={mediaStyle}
							/>
						{:else if artwork.thumbnailUrl}
							<OptimizedImage
								src={artwork.thumbnailUrl}
								alt={artwork.title}
								width={artwork.dimensions?.width || 800}
								height={artwork.dimensions?.height || 800}
								fit="contain"
								format="webp"
								quality={85}
								className="media-content"
								style={mediaStyle}
							/>
						{:else}
							<div class="no-media-placeholder">
								<div class="no-media-content">
									<svg class="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
									</svg>
									<p class="text-gray-500">No media available</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
				<ArtworkMeta {artwork} />
			</div>
			<div>
				<form on:submit|preventDefault={updateArtwork}>
					<div class="mb-4">
						<label for="title">Title</label>
						<input type="text" id="title" bind:value={artwork.title} />
					</div>
					<div class="mb-4">
						<label for="description">Description</label>
						<textarea id="description" bind:value={artwork.description}></textarea>
					</div>
					<div class="mb-4">
						<label for="image_url">Image URL/IPFS</label>
						<input
							type="url"
							id="imageUrl"
							bind:value={artwork.imageUrl}
							placeholder="ipfs://"
						/>
						<small class="text-gray-600 dark:text-gray-400 block mt-1"
							>Change the image URL to update the artwork image. Pinata URLs will have
							dimensions automatically detected.</small
						>
					</div>
					<div class="mb-4">
						<label for="animation_url">Animation or Live URL/IPFS</label>
						<input
							type="url"
							id="animationUrl"
							bind:value={artwork.animationUrl}
							placeholder="ipfs://"
						/>
						<small class="text-gray-600 dark:text-gray-400 block mt-1"
							>URL for animation or interactive content. This will be prioritized over the image URL
							when present. MIME type will be auto-detected.</small
						>
					</div>
					<div class="mb-4">
						<label for="thumbnail_url">Thumbnail URL/IPFS</label>
						<input
							type="url"
							id="thumbnailUrl"
							bind:value={artwork.thumbnailUrl}
							placeholder="ipfs://"
						/>
						<small class="text-gray-600 dark:text-gray-400 block mt-1"
							>URL for thumbnail image. Used for previews and grid displays.</small
						>
					</div>
					<div class="mb-4">
						<label for="generator_url">Generator URL/IPFS</label>
						<input
							type="url"
							id="generatorUrl"
							bind:value={artwork.generatorUrl}
							placeholder="ipfs://"
						/>
						<small class="text-gray-600 dark:text-gray-400 block mt-1"
							>URL for generative art generator. Used for interactive or code-based artworks.</small
						>
					</div>
					<div class="mb-4">
						<label for="metadata_url">Metadata URL/IPFS</label>
						<input
							type="url"
							id="metadataUrl"
							bind:value={artwork.metadataUrl}
							placeholder="ipfs://"
						/>
						<small class="text-gray-600 dark:text-gray-400 block mt-1"
							>URL for NFT metadata JSON. Contains attributes and other metadata.</small
						>
					</div>
					<div class="mb-4">
						<label for="mime">MIME Type</label>
						<select id="mime" bind:value={artwork.mime}>
							{#each commonMimeTypes as mimeType}
								<option value={mimeType.value}>{mimeType.label}</option>
							{/each}
						</select>
						<small class="text-gray-600 dark:text-gray-400 block mt-1"
							>The MIME type of the primary media file. This helps determine how the artwork should be displayed.</small
						>
					</div>
					<div class="mb-4">
						<label for="artist">Artists</label>
						<select id="artist" multiple bind:value={selectedArtistIds} class="multi-select">
							{#each allArtists as artist}
								<option value={artist.id}>{artist.name}</option>
							{/each}
						</select>
						<small class="text-gray-600 dark:text-gray-400 block mt-1"
							>Hold Command/Ctrl to select multiple.</small
						>
					</div>
					<div class="mb-4">
						<label for="collection">Collection</label>
						<select id="collection" bind:value={artwork.collectionId}>
							<option value={null}>-- No Collection --</option>
							{#each collections as collection}
								<option value={collection.id}>{collection.title}</option>
							{/each}
						</select>
					</div>
					<div class="mb-4">
						<label for="supply">Supply/Edition Size</label>
						<input type="number" id="supply" bind:value={artwork.supply} placeholder="1" />
						<small class="text-gray-600 dark:text-gray-400 block mt-1">
							Total supply or edition size of this NFT.
						</small>
					</div>
					<div class="mb-4">
						<fieldset>
							<legend>Dimensions</legend>
							<div class="grid grid-cols-2 gap-4">
								<div>
									<label for="width" class="text-sm">Width (px)</label>
									<input 
										type="number" 
										id="width" 
										bind:value={width} 
										placeholder="0"
										min="0"
										step="1"
									/>
								</div>
								<div>
									<label for="height" class="text-sm">Height (px)</label>
									<input 
										type="number" 
										id="height" 
										bind:value={height} 
										placeholder="0"
										min="0"
										step="1"
									/>
								</div>
							</div>
							<small class="text-gray-600 dark:text-gray-400 block mt-1">
								Set the dimensions of the artwork in pixels. Leave empty if unknown.
							</small>
						</fieldset>
					</div>
					<div class="mb-4">
						<label class="flex items-center">
							<input 
								type="checkbox" 
								bind:checked={artwork.fullscreen}
								class="mr-2"
							/>
							<span>Fullscreen Display</span>
						</label>
						<small class="text-gray-600 dark:text-gray-400 block mt-1">
							Enable this for artworks that can be stretched to any dimensions and still render beautifully. 
							Fullscreen artworks will be displayed with full bleed to the browser edges at 80svh height.
						</small>
					</div>
					<div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
						<h3 class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Refetch Data</h3>
						<p class="text-sm text-blue-700 dark:text-blue-300">
							Use "Refetch Data" to fetch the latest information from external APIs (OpenSea for Ethereum, Objkt for Tezos). 
							This will update the artwork's metadata, images, and other properties with the most current data available.
						</p>
					</div>
					<div class="flex justify-between mt-8">
						<button class="destructive" on:click={confirmDeleteArtwork} type="button"
							>Delete Artwork</button
						>
						<div class="flex gap-3">
							<button 
								class="secondary" 
								on:click={refetchArtworkData} 
								type="button"
								disabled={isRefetching}
							>
								{#if isRefetching}
									<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Refetching...
								{:else}
									<svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
									</svg>
									Refetch Data
								{/if}
							</button>
							<button class="primary" type="submit">Save details</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>

<style lang="postcss">
	.multi-select {
		height: auto;
		min-height: 150px;
	}

	.artwork-preview-container {
		margin-bottom: 1.5rem;
	}

	.artwork-preview {
		background: var(--color-surface-secondary, #343434);
		border-radius: 8px;
		aspect-ratio: 1/1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		height: 100%;
		width: 100%;
	}

	.media-content {
		max-height: 100%;
		max-width: 100%;
	}

	.no-media-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		background: var(--color-surface-tertiary, #222);
		border: 2px dashed var(--color-border, #333);
		border-radius: 8px;
	}

	.no-media-content {
		text-align: center;
		color: var(--color-text-secondary, #6b7280);
	}

	/* Fieldset styling for dimensions */
	fieldset {
		border: 1px solid #d1d5db;
		border-radius: 6px;
		padding: 1rem;
		margin: 0;
	}

	:global(.dark) fieldset {
		border-color: #374151;
	}

	legend {
		@apply text-gray-700 dark:text-white font-medium;
		padding: 0 0.5rem;
	}
</style>
