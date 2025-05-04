<script lang="ts">
  import { placeholderAvatar } from '$lib/utils';
  import { updateArtist, deleteArtist } from '$lib/artistActions';
  import { showToast } from '$lib/toastHelper';
  import { createEventDispatcher } from 'svelte';

  interface Artist {
    id: number;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    websiteUrl: string | null;
    twitterHandle: string | null;
    instagramHandle: string | null;
    artworks?: any[];
  }
  
  export let artist: Artist;

  let isUploadingAvatar = false;
  let fileInputRef: HTMLInputElement;

  async function confirmAndDelete() {
    const artworksMessage = artist.artworks && artist.artworks.length > 0 
        ? `\n\nWarning: This artist has ${artist.artworks.length} associated artwork(s). Deleting the artist will remove these associations.`
        : '';
        
    if (window.confirm(`Are you sure you want to delete ${artist.name}?${artworksMessage}`)) {
      await deleteArtist(artist.id);
    }
  }

  async function handleFileSelect(event: Event & { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    isUploadingAvatar = true;
    showToast('Uploading avatar...', 'info');

    const formData = new FormData();
    formData.append('imageFile', file);

    try {
      const response = await fetch('/api/admin/upload/image', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.url) {
        const newUrl: string = result.url;
        const updatedArtistData = { ...artist, avatarUrl: newUrl };
        
        await updateArtist(updatedArtistData);
        artist.avatarUrl = newUrl;
        
        showToast('Avatar updated successfully.', 'success');
      } else {
        throw new Error(result.details || result.error || 'Upload request failed.');
      }
    } catch (error) {
      console.error('Error uploading avatar via API:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Avatar upload failed: ${message}`, 'error');
    } finally {
      isUploadingAvatar = false;
      if (event.currentTarget) {
          event.currentTarget.value = '';
      }
    }
  }
</script>

<form on:submit|preventDefault={() => updateArtist(artist)} class="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
  <div class="md:col-span-1 relative group">
    {#if artist.name}
      <img class="avatar w-full h-auto object-cover rounded-full" src="{artist.avatarUrl || placeholderAvatar(artist.name)}" alt={artist.name} />
      <button 
        type="button" 
        on:click={() => fileInputRef?.click()} 
        disabled={isUploadingAvatar}
        class="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if isUploadingAvatar}
          <span>Uploading...</span>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        {/if}
      </button>
      <input 
        type="file" 
        class="hidden" 
        accept="image/png, image/jpeg, image/gif, image/webp" 
        bind:this={fileInputRef} 
        on:change={handleFileSelect}
        disabled={isUploadingAvatar}
      />
    {/if}
  </div>
  <div class="md:col-span-2 space-y-4">
    <div>
      <label for="name">Name</label>
      <input type="text" id="name" bind:value={artist.name} />
    </div>
    <div>
      <label for="bio">Bio</label>
      <textarea id="bio" bind:value={artist.bio}></textarea>
    </div>
    <div>
      <label for="websiteUrl">Website</label>
      <input type="url" id="websiteUrl" bind:value={artist.websiteUrl} />
    </div>
    <div>
      <label for="twitterHandle">Twitter Handle</label>
      <input type="text" id="twitterHandle" bind:value={artist.twitterHandle} />
    </div>
    <div>
      <label for="instagramHandle">Instagram Handle</label>
      <input type="text" id="instagramHandle" bind:value={artist.instagramHandle} />
    </div>
  </div>
  <div class="md:col-span-3 flex justify-between mt-4">
    <button class="destructive" on:click={confirmAndDelete} type="button">Delete Artist</button>
    <button class="primary" type="submit">Save details</button>
  </div>
</form>

<style>
  .avatar {
    display: block;
    border-radius: 50%;
    pointer-events: none;
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