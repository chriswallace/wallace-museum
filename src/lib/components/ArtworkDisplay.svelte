<script>
  export let artwork;
  
  function hasVideo() {
    return artwork.animation_url && artwork.mime.startsWith('video');
  }
</script>

<div class="artwork">
  {#if hasVideo()}
    <video src={artwork.animation_url} autoplay controls playsinline muted loop></video>
  {:else if (artwork.mime.startsWith('application') || artwork.mime.startsWith('html')) && artwork.animation_url}
    <iframe src={artwork.animation_url} class="live-code"></iframe>
  {:else}
    <img src="{artwork.image_url}?tr=w-740,q-70" alt={artwork.title} />
  {/if}
</div>

<style lang="scss">
  .artwork {
    @apply w-full;
  }
  .live-code {
    @apply w-full h-full aspect-square;
  }
</style>
