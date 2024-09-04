<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import ArtworkDisplay from '$lib/components/ArtworkDisplay.svelte';
    import ArtworkEditor from '$lib/components/ArtworkEditor.svelte';
    import ArtworkMeta from '$lib/components/ArtworkMeta.svelte';

    let artworkId;
    
    $: $page, (artworkId = $page.params.id);

	let artwork = {
		title: '',
		description: '',
		image_url: '',
		animation_url: '',
		artistId: '',
		collectionId: '',
		liveUri: '',
        mime: '',
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
                fetch('/api/admin/artists'),
                fetch('/api/admin/collections/all')
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
        <div class="grid grid-cols-2 gap-4">
            <div>
                <ArtworkDisplay {artwork}/>
                <ArtworkMeta {artwork}/>
            </div>
            <div>
                <ArtworkEditor {artwork} {artists} {collections}/>
            </div>
        </div>
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
