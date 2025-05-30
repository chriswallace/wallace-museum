<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import ArtworkDisplay from '$lib/components/ArtworkDisplay.svelte';
	import ArtworkMeta from '$lib/components/ArtworkMeta.svelte';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';

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
		enabled?: boolean;

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
		enabled: true,
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
			enabled: artwork.enabled,
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
		{#if artwork.artists && artwork.artists.length > 0}
			<div class="artists-list mb-6">
				{#each artwork.artists as artist}
					<span class="artist-name">
						{#if artist.avatarUrl}
							<OptimizedImage
								src={artist.avatarUrl}
								alt={artist.name}
								width={32}
								height={32}
								fit="cover"
								format="webp"
								quality={85}
								className="artist-avatar"
							/>
						{/if}
						{artist.name}
					</span>
				{/each}
			</div>
		{/if}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
			<div>
				<ArtworkDisplay {artwork} />
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
	.artists-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.artist-name {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.85rem;
		background: #f3f4f6;
		color: #222;
		border-radius: 0.375rem;
		padding: 0.15rem 0.5rem;
	}
	.artist-avatar {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 9999px;
		object-fit: cover;
		margin-right: 0.25rem;
	}
</style>
