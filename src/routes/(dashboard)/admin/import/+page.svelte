<script>
  let nfts = [];
  let selectedNfts = new Set();
  let walletAddressInput = ''; // Use this to bind to the input field
  let loadState = 'idle';

  // Function to fetch NFTs for the entered wallet address
  async function fetchNfts() {
    try {
      loadState = 'loading';
      const response = await fetch(`/api/admin/import/eth/${walletAddressInput}`);
      if (response.ok) {
        const data = await response.json();
        nfts = data.assets || [];
        loadState = 'success';
      } else {
        console.error('Failed to fetch NFTs');
        loadState = 'error';
      }
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      loadState = 'error';
    }
  }

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
    const selectedIdsArray = Array.from(selectedNfts);
    console.log('Importing NFTs:', selectedIdsArray);

    try {
      const response = await fetch('/api/admin/importNfts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nftIds: selectedIdsArray }),
      });

      if (response.ok) {
        console.log('NFTs imported successfully');
        selectedNfts.clear();
      } else {
        console.error('Failed to import NFTs');
      }
    } catch (error) {
      console.error('Error importing NFTs:', error);
    }
  }
</script>

<div>
  <input type="text" bind:value={walletAddressInput} placeholder="Enter Ethereum Address" />
  <button on:click={fetchNfts} disabled={loadState === 'loading'}>
    {#if loadState === 'loading'}
      <i>Loading...</i> <!-- You can replace this with an actual animation or spinner -->
    {:else}
      Fetch NFTs
    {/if}
  </button>
</div>

{#if nfts.length > 0}
  <p>{nfts.length} NFTs available for import</p>
{:else if loadState === 'success'}
  <p>No NFTs found</p>
{:else if loadState === 'error'}
  <p>Failed to fetch NFTs</p>
{/if}

<div class="nft-gallery">
  {#each nfts as nft}
    <div class="nft-card">
      <img src="{nft.imageUrl}" alt="{nft.name}" />
      <h3>{nft.name}</h3>
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
  .nft-card h3 {
    font-size: 15px;
    font-weight: bold;
    margin: 8px 0;
  }
  button{
    background-color: #4CAF50;
    border: none;
    color: white;
    padding: 12px 24px;
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 16px;
    margin: 4px 2px;
    cursor: pointer;
  }
</style>
