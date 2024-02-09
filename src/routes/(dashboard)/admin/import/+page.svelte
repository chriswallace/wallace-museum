<script>
  import { onMount } from 'svelte';
  let nfts = [];
  let selectedNfts = new Set();
  let walletAddress = '0x8Dfd856Af8B868bDC73b4EddBf34511310402C03'; // Define or pass the wallet address here

  onMount(async () => {
    try {
      const response = await fetch(`/api/admin/import/eth/${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        nfts = data.assets || [];
      } else {
        console.error('Failed to fetch NFTs');
      }
    } catch (error) {
      console.error('Error fetching NFTs:', error);
    }
  });

  // Function to handle NFT selection
  function toggleSelection(nftId) {
    if (selectedNfts.has(nftId)) {
      selectedNfts.delete(nftId);
    } else {
      selectedNfts.add(nftId);
    }
  }

  // Function to import selected NFTs
  async function importSelectedNfts() {
    // Here you would typically send the selected NFT IDs to your backend
    // to be processed and added to your database. This is a placeholder for that functionality.
    const selectedIdsArray = Array.from(selectedNfts);
    console.log('Importing NFTs:', selectedIdsArray);

    // Example POST request to your backend API endpoint for importing NFTs
    try {
      const response = await fetch('/api/importNfts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nftIds: selectedIdsArray }),
      });

      if (response.ok) {
        // Handle successful import
        console.log('NFTs imported successfully');
        // Reset selection
        selectedNfts.clear();
      } else {
        // Handle errors
        console.error('Failed to import NFTs');
      }
    } catch (error) {
      console.error('Error importing NFTs:', error);
    }
  }
</script>

<div class="nft-gallery">
  {#each nfts as nft}
    <div class="nft-card">
      <img src="{nft.imageUrl}" alt="{nft.name}" />
      <p>{nft.name}</p>
      <button on:click={() => toggleSelection(nft.id)}>{selectedNfts.has(nft.id) ? 'Deselect' : 'Select'}</button>
    </div>
  {/each}
</div>

{#if selectedNfts.size > 0}
  <button on:click={importSelectedNfts}>Import Selected NFTs</button>
{/if}

<style>
  .nft-gallery {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .nft-card {
    border: 1px solid #ccc;
    padding: 8px;
    border-radius: 8px;
    width: 200px;
  }
  .nft-card img {
    width: 100%;
    border-radius: 4px;
  }
</style>
