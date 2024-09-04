<script>
  import { showToast } from '$lib/toastHelper';
  import { goto } from '$app/navigation';
  import { placeholderAvatar } from '$lib/utils';
  import { formatDate } from '$lib/dateFormatter.js'; // Assuming you have a date formatting utility

  export let artist;

  async function updateArtist(event) {
    const response = await fetch(`/api/admin/artists/${artist.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(artist)
    });

    if (response.ok) {
      showToast('Artist details saved.', 'success');
    } else {
      showToast('Failed to update artist details.', 'error');
    }
  }

  async function deleteArtist() {
    const response = await fetch(`/api/admin/artists/${artist.id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showToast('Artist deleted.', 'success');
      goto('/admin/artists');
    } else {
      showToast('Failed to delete artist.', 'error');
    }
  }
</script>

<form on:submit|preventDefault={updateArtist}>
  <div>
    <img class="avatar" width="88" height="88" src="{artist.avatarUrl || placeholderAvatar(artist.name)}" alt={artist.name} />
  </div>
  <div>
    <label for="name">Name</label>
    <input type="text" id="name" bind:value={artist.name} />
  </div>
  <div>
    <label for="bio">Bio</label>
    <textarea id="bio" bind:value={artist.bio}></textarea>
  </div>
  <div>
    <label for="website">Website</label>
    <input type="url" id="website" bind:value={artist.website} />
  </div>
  <div>
    <label for="twitterHandle">Twitter Handle</label>
    <input type="text" id="twitterHandle" bind:value={artist.twitterHandle} />
  </div>
  <div>
    <label for="instagramHandle">Instagram Handle</label>
    <input type="text" id="instagramHandle" bind:value={artist.instagramHandle} />
  </div>
  <div class="flex justify-between">
    <button class="destructive" on:click={deleteArtist} type="button">Delete Artist</button>
    <button class="primary" type="submit">Save details</button>
  </div>
</form>

<style>
  .avatar {
    display: block;
    margin-bottom: 1rem;
    border-radius: 50%;
  }

  form > div {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  input[type="text"],
  input[type="url"],
  textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
</style>