<script>
  export let artwork;
  
  function hasVideo() {
    return artwork.animation_url && artwork.mime.startsWith('video');
  }
</script>

<div class="artwork">
  {#if hasVideo()}
    <video src={artwork.animation_url} autoplay controls playsinline muted loop></video>
  {:else}
    <img src="{artwork.image_url}?tr=w-740,q-70" alt={artwork.title} />
  {/if}
</div>

<style>
  .artwork {
    width: 100%;
  }
</style>
