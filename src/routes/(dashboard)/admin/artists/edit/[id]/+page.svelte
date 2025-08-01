<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import ArtistEditor from '$lib/components/ArtistEditor.svelte';

	interface Artwork {
		id: number;
		title: string;
		imageUrl: string;
	}

	interface ArtistArtwork {
		artwork: Artwork;
	}

	interface CreatorAddressWithArtworks {
		id: number; // Or string, depending on your schema
		address: string;
		// other CreatorAddress fields...
		artworks: Artwork[];
		blockchain: string;
		createdAt: Date;
		updatedAt: Date;
	}

	interface ArtistAddress {
		id: number;
		address: string;
		blockchain: string;
		createdAt: Date;
		updatedAt: Date;
	}

	interface Artist {
		id: number;
		name: string;
		bio: string | null;
		avatarUrl: string | null;
		websiteUrl: string | null;
		twitterHandle: string | null;
		instagramHandle: string | null;
		creatorAddresses: CreatorAddressWithArtworks[];
		addresses: ArtistAddress[];
		artworks: Artwork[];
	}

	interface Collection {
		id: number;
		title: string;
	}

	let artistId: string;

	$: $page, (artistId = $page.params.id);

	let artist: Artist = {
		id: 0,
		name: '',
		bio: null,
		avatarUrl: null,
		websiteUrl: null,
		twitterHandle: null,
		instagramHandle: null,
		creatorAddresses: [],
		addresses: [],
		artworks: []
	};

	let collections: Collection[] = [];
	let error = '';
	let isLoading = true;

	// Create a reactive title variable
	$: pageTitle = artist.name
		? `Edit ${artist.name} | Wallace Museum Admin`
		: 'Edit Artist | Wallace Museum Admin';

	function goBack() {
		history.back();
	}

	async function fetchArtist() {
		try {
			const [artistRes, collectionsRes] = await Promise.all([
				fetch(`/api/admin/artists/${artistId}`),
				fetch('/api/admin/collections/all')
			]);

			if (artistRes.ok) {
				artist = await artistRes.json();
			} else {
				error = 'Failed to fetch artist';
			}

			if (collectionsRes.ok) {
				collections = await collectionsRes.json();
			}
		} catch (error) {
			error = error instanceof Error ? error.message : 'Unknown error';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		if (browser) {
			fetchArtist();
		}
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="container">
	{#if isLoading}
		<p>Loading...</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else}
		<button class="back-btn" on:click={goBack}>&lt; Back</button>
		<div class="admin-header">
			<h1>Edit Artist</h1>
		</div>
		<ArtistEditor {artist} />
	{/if}
</div>

<style>
	h1 {
		margin-bottom: 3rem; /* Example styling */
	}

	.container {
		max-width: 1200px;
		margin: auto;
	}

	.error {
		color: red;
	}
</style>
