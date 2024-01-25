const axios = require("axios");
const fs = require("fs");

const walletAddress = "tz1Ym9Ued9v2N2wwsrtQ52HRGGn7qDmzuUZU";
const baseUrl = `https://api.tzkt.io/v1/tokens/balances`;
const transfersUrl = `https://api.tzkt.io/v1/tokens/transfers`;
const query = `?account=${walletAddress}&token.standard=fa2`;

const stream = fs.createWriteStream("nfts-tezos.json");
let isFirstToken = true;
let totalProcessed = 0;
const existingTokens = new Set();

stream.write("[");

async function fetchMintDate(tokenId, contractAddress) {
  try {
    const response = await axios.get(`${transfersUrl}?token.tokenId=${tokenId}&token.contract=${contractAddress}&from.null=true`);
    console.log(`${transfersUrl}?token.tokenId=${tokenId}&token.contract=${contractAddress}&from.null=true`);
    return response.data[0]?.timestamp; // Assuming the first transfer is the mint event
  } catch (error) {
    console.error(`Error fetching mint date for token ${tokenId}: ${error.message}`);
    return null;
  }
}

function getContractId(address) {
  if (address === 'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton')
    return "hicetnunc";
  else if (address === 'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi')
    return "fxhash";
  else if (address === 'KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE')
    return "fxhashgenesis";
  else if (address === 'KT1LjmAdYQCLBjwv4S2oFkEzyHVkomAf5MrW')
    return "versum_items";
  else if (address === 'KT1EfsNuqwLAWDd3o4pvfUx1CAh5GMdTrRvr')
    return "fxparams";
  else if (address === 'KT1Fxz4V3LaUcVFpvF8pAAx8G3Z4H7p7hhDg')
    return "h3p";
  else if (address === 'KT1S23ui1PKU5G3V52Ds2NyNnPgxJbZhUY6y')
    return "c-verso";
  else
    return address;
}

function slugifyAndTrimNumbers(str) {
  // Remove trailing numbers and any hashes/spaces before them
  const cleanedStr = str.replace(/[\s#]*\d+$/, '');

  // Slugify: replace spaces with dashes and convert to lowercase
  return cleanedStr.trim().replace(/\s+/g, '-').toLowerCase();
}

async function fetchNFTs(url) {
  try {
    const response = await axios.get(url);
    const nfts = response.data;

    if (nfts.length === 0) {
      finishStream();
      return;
    }

    for (const nft of nfts) {
      const uniqueId = `${nft.token.contract.address}-${nft.token.tokenId}`;
      if (!existingTokens.has(uniqueId)) {

        const mintDate = await fetchMintDate(nft.token.tokenId, nft.token.contract.address);

        // Create a new structured object based on the desired format
        const structuredNFT = {
          identifier: nft.token.tokenId,
          contract: nft.token.contract.address,
          collection: nft.token.contract.alias,
          token_standard: nft.token.standard,
          updated_at: nft.lastTime,
          is_disabled: false, // Modify as necessary
          is_nsfw: false, // Modify as necessary
          metadata: {
            ...nft.token.metadata, // Spread operator to include all metadata
            external_url: `https://objkt.com/asset/${getContractId(nft.token.contract.address)}/${nft.token.tokenId}`,
          },
          mint_date: mintDate
        };

        if (nft.token && nft.token.metadata && nft.token.metadata.name) {
          structuredNFT.collection = slugifyAndTrimNumbers(nft.token.metadata.name);
          structuredNFT.name = nft.token.metadata.name;
        }

        if (nft.token && nft.token.metadata && nft.token.metadata.description) {
          structuredNFT.description = nft.token.metadata.description;
        }

        if (nft.token && nft.token.metadata && nft.token.metadata.displayUri) {
          structuredNFT.image_url = nft.token.metadata.displayUri;
          structuredNFT.metadata.image = nft.token.metadata.displayUri;
        }

        if (nft.balance > 0)
          streamData(structuredNFT);

        totalProcessed++;
      }
    }

    await fetchNFTs(`${baseUrl}${query}&offset=${totalProcessed}`);
  } catch (error) {
    console.error(`Error fetching NFTs: ${error.message}`);
    finishStream();
  }
}

function streamData(nft) {
  if (!isFirstToken) {
    stream.write(",");
  } else {
    isFirstToken = false;
  }
  stream.write(JSON.stringify(nft, null, 2));
}

function finishStream() {
  stream.write("]");
  stream.end();
  console.log("Stream finished. Data written to nfts.json");
}

fetchNFTs(`${baseUrl}${query}`);
