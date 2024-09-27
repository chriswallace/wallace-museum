<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import ArtistEditor from '$lib/components/ArtistEditor.svelte';

    let artistId;
    
    $: $page, (artistId = $page.params.id);

	let artist = {
		name: '',
		bio: '',
		avatarUrl: '',
		websiteUrl: '',
		twitterHandle: '',
		instagramHandle: '',
		collections: []
	};
    
    let collections = [];
    let error = '';
    let isLoading = true;

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
        } catch (e) {
            error = e.message;
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
    <title>Edit Artist</title>
</svelte:head>

<div class="container">
    {#if isLoading}
        <p>Loading...</p>
    {:else if error}
        <p class="error">{error}</p>
    {:else}
        <a class="back-btn" href="/admin/artists">&lt; Back</a>
        <h1>Edit Artist</h1>
        <ArtistEditor {artist}/>
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