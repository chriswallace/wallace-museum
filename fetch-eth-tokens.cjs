const fs = require('fs');
const axios = require('axios');
const sdk = require('api')('@opensea/v2.0#kke226lqeabeu1');
const { Network, Alchemy } = require('alchemy-sdk');
const BigNumber = require('bignumber.js');
const { env } = require('$env/dynamic/private');

const walletAddress = "0x8367A713bc14212Ab1bB8c55A778e43e50B8b927"; // Ethereum wallet address
const openseaApiKey = env.OPENSEA_API_KEY; // Replace with your OpenSea API key
const alchemyApiKey = env.ALCHEMY_API_KEY; // Replace with your Alchemy API key

const settings = {
  apiKey: alchemyApiKey,
  network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(settings);

sdk.auth(openseaApiKey);
sdk.server('https://api.opensea.io');

const stream = fs.createWriteStream("nfts-eth.json");

function fromHexToBigNumber(hexString) {
  return new BigNumber(hexString);
}

async function fetchNFTs(chain = 'ethereum', next) {
  try {
    const response = await sdk.list_nfts_by_account({
      chain: chain,
      address: walletAddress,
      limit: 200,
      next: next
    });

    const { data } = response;
    const assets = data.nfts;

    if (!assets || assets.length === 0) {
      finishStream();
      return;
    }

    for (const asset of assets) {
      await enrichNFTData(asset);
      streamData(asset);
    }

    if (data.next) {
      await fetchNFTs(chain, data.next);
    } else {
      finishStream();
    }
  } catch (error) {
    //console.error(`Error fetching NFTs: ${error.message}`);
    finishStream();
  }
}

async function enrichNFTData(nft) {
  try {
    // Check and convert IPFS URL if necessary
    let metadataUrl = nft.metadata_url;
    if (metadataUrl && metadataUrl.startsWith('ipfs://')) {
      metadataUrl = ipfsUriToUrl(metadataUrl);
    }

    // Fetch metadata
    if (metadataUrl) {
      const metadataResponse = await axios.get(metadataUrl);
      nft.metadata = metadataResponse.data;
    }

    // Fetch mint date
    nft.mint_date = await fetchMintDate(nft.contract, nft.identifier);
  } catch (error) {
    console.error(`Error enriching NFT data for ${nft.identifier}: ${error.message}`);
  }
}

function ipfsUriToUrl(ipfsUri) {
  const ipfsGateway = "https://ipfs.io/ipfs/";
  return ipfsUri.replace(/^ipfs:\/\//, ipfsGateway);
}

async function fetchMintDate(contract, tokenId) {
  try {
    let pageKey, transfer;

    const tokenIdBigNumber = new BigNumber(tokenId);

    const blockNumber = 18780771;

    while (true) {
      const res = await alchemy.core.getAssetTransfers({
        fromBlock: '0x' + blockNumber.toString(16),
        toBlock: "latest",
        fromAddress: "0x0000000000000000000000000000000000000000",
        contractAddresses: [contract],
        category: ["erc721", "erc1155"],
        maxCount: "0x3e8", // 1000 in decimal
        pageKey: pageKey
      });

      const transfers = res.transfers;

      // Find the mint event for the specific tokenId
      const mintEvent = transfers.find(transfer => {
        // Convert transfer token ID from hex to BigNumber for comparison
        const transferTokenIdBigNumber = new BigNumber(transfer.tokenId, 16);
        transfer = transfer;
        return transferTokenIdBigNumber.isEqualTo(tokenIdBigNumber);
      });

      if (mintEvent) {
        const receipt = await alchemy.core.getTransactionReceipt(mintEvent.hash);
        // Assuming you want the block timestamp, you need to get the block details
        const block = await alchemy.core.getBlock(receipt.blockNumber);
        return block.timestamp; // Extract the timestamp from the block
      }

      // Pagination handling
      if (res.pageKey) {
        pageKey = res.pageKey;
      } else {
        break; // Exit loop if no more pages
      }
    }

    return null; // Return null if mint event not found
  } catch (error) {
    console.error(`Error fetching mint date for token ${tokenId}: ${error.message}`);
    return null;
  }
}

function streamData(nft) {
  stream.write((stream.bytesWritten > 0 ? "," : "") + JSON.stringify(nft, null, 2));
}

function finishStream() {
  stream.write("]");
  stream.end();
  console.log("Stream finished. Data written to nfts-eth.json");
}

fetchNFTs();