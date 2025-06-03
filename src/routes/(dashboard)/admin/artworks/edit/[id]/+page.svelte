<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import ArtworkMeta from '$lib/components/ArtworkMeta.svelte';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtistList from '$lib/components/ArtistList.svelte';

	import { showToast } from '$lib/toastHelper';
	import { goto } from '$app/navigation';

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
		dimensions: null
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

	let width: number = artwork.dimensions?.width ?? 0;
	let height: number = artwork.dimensions?.height ?? 0;

	$: if (artwork && artwork.dimensions) {
		width = artwork.dimensions.width ?? 0;
		height = artwork.dimensions.height ?? 0;
	}

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
			attributes: artwork.attributes
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
							{#if artwork.mime?.includes('video')}
								<video 
									src={artwork.animationUrl || artwork.generatorUrl} 
									controls 
									muted 
									autoplay 
									loop
									class="media-content"
								>
									<track kind="captions" />
								</video>
							{:else if artwork.generatorUrl}
								<iframe 
									src={artwork.generatorUrl} 
									title="Interactive Artwork"
									class="media-content"
									allowfullscreen
								></iframe>
							{:else}
								<OptimizedImage
									src={artwork.animationUrl}
									alt={artwork.title}
									width={400}
									height={400}
									fit="contain"
									format="webp"
									quality={85}
									showSkeleton={true}
									skeletonBorderRadius="8px"
									className="media-content"
								/>
							{/if}
						{:else if artwork.imageUrl}
							<OptimizedImage
								src={artwork.imageUrl}
								alt={artwork.title}
								width={400}
								height={400}
								fit="contain"
								format="webp"
								quality={85}
								showSkeleton={true}
								skeletonBorderRadius="8px"
								className="media-content"
							/>
						{:else if artwork.thumbnailUrl}
							<OptimizedImage
								src={artwork.thumbnailUrl}
								alt={artwork.title}
								width={400}
								height={400}
								fit="contain"
								format="webp"
								quality={85}
								showSkeleton={true}
								skeletonBorderRadius="8px"
								className="media-content"
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
					<div class="flex justify-between mt-8">
						<button class="destructive" on:click={confirmDeleteArtwork} type="button"
							>Delete Artwork</button
						>
						<button class="primary" type="submit">Save details</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	.multi-select {
		height: auto;
		min-height: 150px;
	}

	.artwork-preview-container {
		margin-bottom: 1.5rem;
	}

	.artwork-preview {
		max-height: 400px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.media-content {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.no-media-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 200px;
		background: var(--color-surface-tertiary, #f3f4f6);
		border: 2px dashed var(--color-border, #d1d5db);
		border-radius: 8px;
	}

	.no-media-content {
		text-align: center;
		color: var(--color-text-secondary, #6b7280);
	}

	/* Dark mode support */
	:global(.dark) .artwork-preview {
		background: var(--color-surface-secondary-dark, #1f2937);
		border-color: var(--color-border-dark, #374151);
	}

	:global(.dark) .no-media-placeholder {
		background: var(--color-surface-tertiary-dark, #111827);
		border-color: var(--color-border-dark, #374151);
	}

	:global(.dark) .no-media-content {
		color: var(--color-text-secondary-dark, #9ca3af);
	}
</style>
