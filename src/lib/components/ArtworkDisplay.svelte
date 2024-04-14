<script>
  export let artwork;
  
  function hasVideo() {
    return artwork.video && artwork.video.length > 0;
  }
</script>

<div class="artwork">
  {#if hasVideo()}
    <video src={artwork.video} autoplay controls playsinline muted loop></video>
  {:else}
    <img src="{artwork.image}?tr=w-740,q-70" alt={artwork.title} />
  {/if}
</div>

<style>
  .artwork {
    width: 100%;
  }
</style>
