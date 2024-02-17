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

	// Function to format the date
	function formatDate(dateString) {
		const options = {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		};
		return new Date(dateString).toLocaleDateString('en-US', options);
	}

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

<svelte:head>
	<title>Edit artwork</title>
</svelte:head>

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

					<button type="submit" class="primary w-full mt-4">Save details</button>
				</form>
				<button class="delete w-full" on:click={deleteArtwork}>Delete Artwork</button>
			</div>

			<div>
				<div class="additional-meta">
					<div class="non-editable">
						<h3>Token ID</h3>
						<p>{artwork.tokenID}</p>
					</div>
					<div class="non-editable">
						<h3>Blockchain</h3>
						<p>{artwork.blockchain}</p>
					</div>
					<div class="non-editable">
						<h3>Token Standard</h3>
						<p>{artwork.tokenStandard}</p>
					</div>
					<div class="non-editable">
						<h3>Contract</h3>
						<p>
							<a href="https://etherscan.io/address/{artwork.contractAddr}"
								>{artwork.contractAlias}</a
							>
						</p>
					</div>
					<div class="non-editable">
						<h3>Mint Date</h3>
						<p>{formatDate(artwork.mintDate)}</p>
					</div>
					<div class="non-editable">
						<h3>Total Supply</h3>
						<p>{artwork.totalSupply}</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
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

	.additional-meta {
		@apply text-gray-600 text-base border border-gray-300 p-6 pt-4 pb-0 bg-gray-100;

		.non-editable {
			@apply mb-8;
		}

		h3 {
			@apply mb-1 text-sm tracking-wide font-normal uppercase;
		}

		a {
			@apply text-gray-600;
		}
	}
</style>
