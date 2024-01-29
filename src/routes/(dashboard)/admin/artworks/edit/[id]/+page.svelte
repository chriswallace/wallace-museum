<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { showToast } from '$lib/toastHelper';

	let artworkId;

	$: $page, (artworkId = $page.params.id);

	let artwork = {
		title: '',
		description: '',
		image: '',
		video: '',
		artistId: '',
		collectionId: '',
		liveUri: '',
		attributes: '',
		curatorNotes: '',
		contractAddr: '',
		contractAlias: '',
		totalSupply: '',
		symbol: '',
		blockchain: '',
		tokenID: '',
		mintDate: ''
	};
	let artists = [];
	let collections = [];
	let error = '';
	let isLoading = true;

	async function fetchArtwork() {
		try {
			const [artworkRes, artistsRes, collectionsRes] = await Promise.all([
				fetch(`/api/admin/artworks/${artworkId}`),
				fetch('/api/admin/artists'), // Assuming you have an endpoint to fetch artists
				fetch('/api/admin/collections/all') // Assuming you have an endpoint to fetch collections
			]);

			if (artworkRes.ok) {
				artwork = await artworkRes.json();
			} else {
				error = 'Failed to fetch artwork';
			}

			if (artistsRes.ok) {
				artists = await artistsRes.json();
			}

			if (collectionsRes.ok) {
				collections = await collectionsRes.json();
			}
		} catch (e) {
			error = e.message;
		} finally {
			isLoading = false;
		}
	}

	async function updateArtwork() {
		const response = await fetch(`/api/admin/artworks/${artworkId}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(artwork)
		});

		if (response.ok) {
			showToast('Artwork saved.', 'success');
		} else {
			toast.push(error, { theme: 'error' });
			showToast('Failed to update artwork.', 'error');
		}
	}

	async function deleteArtwork() {
		const response = await fetch(`/api/admin/artworks/${artworkId}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			showToast('Artwork deleted.', 'success');
			goto('/admin/artworks');
		} else {
			showToast('Failed to update artwork.', 'error');
		}
	}

	function hasVideo() {
		return artwork.video && artwork.video.length > 0;
	}

	onMount(() => {
		if (browser) {
			fetchArtwork();
		}
	});
</script>

<title>Edit artwork</title>

<div class="container">
	{#if isLoading}
		<p>Loading...</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else}
		<a class="back-btn" href="/admin/artworks">&lt; Back</a>
		<h1>Edit artwork</h1>
		<div class="edit-form">
			<div class="artwork">
				{#if hasVideo()}
					<video src={artwork.video} autoplay controls playsinline muted loop></video>
				{:else}
					<img src="{artwork.image}?tr=w-740,q-70" alt={artwork.title} />
				{/if}
			</div>
			<div>
				<form on:submit|preventDefault={updateArtwork}>
					<!-- Artwork Fields -->
					<div>
						<label for="title">Title</label>
						<input type="text" id="title" bind:value={artwork.title} />
					</div>
					<div>
						<label for="description">Description</label>
						<textarea id="description" bind:value={artwork.description}></textarea>
					</div>
					<div>
						<label for="curator-notes">Curator notes</label>
						<textarea id="curator-notes" bind:value={artwork.curatorNotes}></textarea>
					</div>
					<div>
						<label for="artist">Artist</label>
						<select id="artist" bind:value={artwork.artistId}>
							<option value="">Select Artist</option>
							{#each artists as artist}
								<option value={artist.id}>{artist.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="collection">Collection</label>
						<select id="collection" bind:value={artwork.collectionId}>
							<option value="">Select Collection</option>
							{#each collections as collection}
								<option value={collection.id}>{collection.title}</option>
							{/each}
						</select>
					</div>

					<button type="submit" class="cta">Save details</button>
				</form>
				<button class="delete cta" on:click={deleteArtwork}>Delete Artwork</button>
			</div>

			<div>
				<div class="additional-meta">
					<div class="non-editable">
						<label>Blockchain</label>
						<p>{artwork.blockchain}</p>
					</div>
					<div class="non-editable">
						<label>Contract Address</label>
						<p>{artwork.contractAddr}</p>
					</div>
					<div class="non-editable">
						<label>Contract Alias</label>
						<p>{artwork.contractAlias}</p>
					</div>
					<div class="non-editable">
						<label>Token ID</label>
						<p>{artwork.tokenID}</p>
					</div>
					<div class="non-editable">
						<label>Mint Date</label>
						<p>{artwork.mintDate}</p>
					</div>
					<div class="non-editable">
						<label>Total Supply</label>
						<p>{artwork.totalSupply}</p>
					</div>
					<div class="non-editable">
						<label>Symbol</label>
						<p>{artwork.symbol}</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	h1 {
		@apply mb-12;
	}

	.container {
		@apply max-w-7xl mx-auto;
	}

	.edit-form {
		@apply pb-24 sm:grid sm:grid-cols-3 sm:gap-8;
	}

	.artwork {
		@apply w-full;
	}
</style>
