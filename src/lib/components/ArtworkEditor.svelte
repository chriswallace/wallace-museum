<script>
  import { showToast } from '$lib/toastHelper';
  import { goto } from '$app/navigation';

  export let artwork;
  export let artists;
  export let collections;

  async function updateArtwork(event) {
    const response = await fetch(`/api/admin/artworks/${artwork.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(artwork)
    });

    if (response.ok) {
      showToast('Artwork saved.', 'success');
    } else {
      showToast('Failed to update artwork.', 'error');
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
      showToast('Failed to delete artwork.', 'error');
    }
  }
</script>

<form on:submit|preventDefault={updateArtwork}>
  <div>
    <label for="title">Title</label>
    <input type="text" id="title" bind:value={artwork.title} />
  </div>
  <div>
    <label for="description">Description</label>
    <textarea id="description" bind:value={artwork.description}></textarea>
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
  <div class="flex justify-between">
    <button class="destructive" on:click={deleteArtwork} type="button">Delete Artwork</button>
    <button class="primary" type="submit">Save details</button>
  </div>
</form>
