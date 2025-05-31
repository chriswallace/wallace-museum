import type { MinimalNFTData, MinimalCollectionData, MinimalCreatorData } from './types/minimal-nft';
import { MinimalNFTTransformer } from './minimal-transformers';
import { WRAPPED_TEZOS_CONTRACT } from './constants/tezos';

/**
 * Minimal API helpers - only fetch data we actually store in the database
 * Reduces API payload size and processing overhead
 */

const transformer = new MinimalNFTTransformer();

// OpenSea API helpers
export class MinimalOpenSeaAPI {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  /**
   * Fetch NFTs by wallet address - enhanced with creator information
   */
  async fetchNFTsByAddress(
    walletAddress: string, 
    limit = 50, 
    nextCursor?: string
  ): Promise<{ nfts: MinimalNFTData[]; nextCursor?: string }> {
    let url = `https://api.opensea.io/api/v2/chain/ethereum/account/${walletAddress}/nfts?limit=${limit}`;
    if (nextCursor) url += `&next=${nextCursor}`;
    
    console.log(`[OpenSeaAPI] Making request to: ${url}`);
    console.log(`[OpenSeaAPI] Headers: X-API-KEY: ${this.apiKey ? 'present' : 'missing'}`);
    
    // Implement retry logic for rate limiting
    let retries = 0;
    const maxRetries = 3;
    
    while (retries <= maxRetries) {
      try {
        console.log(`[OpenSeaAPI] Attempt ${retries + 1}/${maxRetries + 1} for ${walletAddress}`);
        
        const response = await fetch(url, {
          headers: { 'X-API-KEY': this.apiKey }
        });
        
        console.log(`[OpenSeaAPI] Response status: ${response.status} ${response.statusText}`);
        
        if (response.status === 429) {
          // Rate limited - wait longer and retry
          const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`[MinimalOpenSeaAPI] Rate limited (429), waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
          continue;
        }
        
        if (!response.ok) {
          console.log(`[OpenSeaAPI] Error response: ${response.status} ${response.statusText}`);
          throw new Error(`OpenSea API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log(`[MinimalOpenSeaAPI] Raw OpenSea response for ${walletAddress}: ${data.nfts?.length || 0} NFTs, next: ${data.next ? 'present' : 'null'}`);
        console.log(`[OpenSeaAPI] Full response keys: ${Object.keys(data).join(', ')}`);
        if (data.next) {
          console.log(`[MinimalOpenSeaAPI] Next cursor value: ${data.next.substring(0, 50)}...`);
        }
        
        // Enhanced NFT processing with aggressive rate limiting
        const enhancedNFTs = [];
        console.log(`[OpenSeaAPI] Processing ${data.nfts?.length || 0} NFTs with enrichment...`);
        
        for (let i = 0; i < (data.nfts || []).length; i++) {
          const nft = data.nfts[i];
          try {
            console.log(`[OpenSeaAPI] Processing NFT ${i + 1}/${data.nfts.length}: ${nft.contract}:${nft.identifier}`);
            
            // First, try to enhance with blockchain data if we have contract and identifier
            let enrichedNft = nft;
            if (nft.contract && nft.identifier) {
              try {
                console.log(`[OpenSeaAPI] Fetching enhanced data for ${nft.contract}:${nft.identifier}`);
                const enhancedData = await this.fetchEnhancedNFTData(nft.contract, nft.identifier);
                if (enhancedData) {
                  // Merge enhanced data, prioritizing blockchain-sourced mint dates
                  enrichedNft = { ...nft, ...enhancedData };
                  console.log(`[OpenSeaAPI] Enhanced data merged for ${nft.contract}:${nft.identifier}`);
                }
                
                // Rate limiting: wait 0.2 seconds after enhanced data fetch
                console.log(`[OpenSeaAPI] Waiting 0.2 seconds after enhanced data fetch...`);
                await new Promise(resolve => setTimeout(resolve, 200));
                
              } catch (error) {
                console.warn(`[MinimalOpenSeaAPI] Failed to fetch enhanced data for ${nft.contract}:${nft.identifier}:`, error);
              }
            }
            
            // Transform the enriched NFT data
            console.log(`[OpenSeaAPI] Transforming NFT ${nft.contract}:${nft.identifier}`);
            const transformedNFT = await transformer.transformOpenSeaNFT(enrichedNft);
            
            // Additional creator data enrichment if still needed
            if (transformedNFT.creator?.address && !transformedNFT.creator.username) {
              try {
                console.log(`[OpenSeaAPI] Fetching creator data for ${transformedNFT.creator.address}`);
                const creatorData = await this.fetchCreator(transformedNFT.creator.address);
                if (creatorData) {
                  transformedNFT.creator = {
                    ...transformedNFT.creator,
                    username: creatorData.username,
                    profileUrl: creatorData.profileUrl,
                    avatarUrl: creatorData.avatarUrl,
                    bio: creatorData.bio,
                    socialLinks: creatorData.socialLinks
                  };
                  console.log(`[OpenSeaAPI] Creator data enriched for ${transformedNFT.creator.address}`);
                }
                
                // Rate limiting: wait 0.2 seconds after creator data fetch
                console.log(`[OpenSeaAPI] Waiting 0.2 seconds after creator data fetch...`);
                await new Promise(resolve => setTimeout(resolve, 200));
                
              } catch (error) {
                console.warn(`[MinimalOpenSeaAPI] Failed to enrich creator data for ${transformedNFT.creator.address}:`, error);
              }
            }
            
            enhancedNFTs.push(transformedNFT);
            console.log(`[OpenSeaAPI] Successfully processed NFT ${nft.contract}:${nft.identifier}`);
            
            // Add delay between each NFT to be extra conservative
            if (i < data.nfts.length - 1) {
              console.log(`[OpenSeaAPI] Waiting 0.2 seconds before next NFT...`);
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
          } catch (error) {
            console.warn(`[MinimalOpenSeaAPI] Failed to transform NFT ${nft.contract}:${nft.identifier}:`, error);
          }
        }

        console.log(`[OpenSeaAPI] Returning ${enhancedNFTs.length} processed NFTs, nextCursor: ${data.next ? 'present' : 'null'}`);
        
        return {
          nfts: enhancedNFTs,
          nextCursor: data.next
        };
        
      } catch (error) {
        console.error(`[OpenSeaAPI] Error on attempt ${retries + 1}:`, error);
        if (retries === maxRetries) {
          console.error(`[MinimalOpenSeaAPI] Failed to fetch NFTs after ${maxRetries} retries:`, error);
          return { nfts: [] };
        }
        retries++;
        const waitTime = Math.pow(2, retries) * 1000;
        console.log(`[OpenSeaAPI] Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    console.log(`[OpenSeaAPI] Exhausted all retries, returning empty result`);
    return { nfts: [] };
  }
  
  /**
   * Fetch single NFT details - enhanced with creator and collection data
   */
  async fetchNFTDetails(
    contractAddress: string, 
    tokenId: string
  ): Promise<MinimalNFTData | null> {
    const url = `https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}/nfts/${tokenId}`;
    
    // Implement retry logic for rate limiting
    let retries = 0;
    const maxRetries = 3;
    
    while (retries <= maxRetries) {
      try {
        const response = await fetch(url, {
          headers: { 'X-API-KEY': this.apiKey }
        });
        
        if (response.status === 429) {
          // Rate limited - wait longer and retry
          const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff
          console.log(`[MinimalOpenSeaAPI] Rate limited (429) on NFT details, waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
          continue;
        }
        
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`OpenSea API error: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.nft) return null;
        
        // Enhanced NFT data with comprehensive blockchain information
        let nft = data.nft;
        
        // First, enhance with blockchain data for accurate mint date and additional metadata
        try {
          const enhancedData = await this.fetchEnhancedNFTData(contractAddress, tokenId);
          if (enhancedData) {
            // Merge enhanced data, prioritizing blockchain-sourced information
            nft = { ...nft, ...enhancedData };
          }
        } catch (error) {
          console.warn(`[MinimalOpenSeaAPI] Failed to fetch enhanced data for ${contractAddress}:${tokenId}:`, error);
        }
        
        // Enrich with collection data if available
        if (nft.collection && typeof nft.collection === 'string') {
          try {
            const collectionData = await this.fetchCollection(nft.collection);
            if (collectionData) {
              // Merge collection data into NFT
              nft.collection_name = collectionData.title;
              nft.collection_description = collectionData.description;
              nft.collection_website_url = collectionData.websiteUrl;
              nft.collection_discord_url = collectionData.discordUrl;
              nft.collection_image_url = collectionData.imageUrl;
            }
          } catch (error) {
            console.warn(`[MinimalOpenSeaAPI] Failed to fetch collection data for ${nft.collection}:`, error);
          }
        }
        
        const transformedNFT = await transformer.transformOpenSeaNFT(nft);
        
        // Enrich creator data if available
        if (transformedNFT.creator?.address && !transformedNFT.creator.username) {
          try {
            const creatorData = await this.fetchCreator(transformedNFT.creator.address);
            if (creatorData) {
              transformedNFT.creator = {
                ...transformedNFT.creator,
                username: creatorData.username,
                profileUrl: creatorData.profileUrl,
                avatarUrl: creatorData.avatarUrl,
                bio: creatorData.bio,
                socialLinks: creatorData.socialLinks
              };
            }
          } catch (error) {
            console.warn(`[MinimalOpenSeaAPI] Failed to enrich creator data:`, error);
          }
        }
        
        return transformedNFT;
        
      } catch (error) {
        if (retries === maxRetries) {
          console.warn(`[MinimalOpenSeaAPI] Failed to fetch NFT details after ${maxRetries} retries:`, error);
          return null;
        }
        retries++;
        const waitTime = Math.pow(2, retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    return null;
  }
  
  /**
   * Fetch collection data - enhanced with more details
   */
  async fetchCollection(slug: string): Promise<MinimalCollectionData | null> {
    const url = `https://api.opensea.io/api/v2/collections/${slug}`;
    
    // Implement retry logic for rate limiting
    let retries = 0;
    const maxRetries = 3;
    
    while (retries <= maxRetries) {
      try {
        const response = await fetch(url, {
          headers: { 'X-API-KEY': this.apiKey }
        });
        
        if (response.status === 429) {
          const waitTime = Math.pow(2, retries) * 1000;
          console.log(`[MinimalOpenSeaAPI] Rate limited (429) on collection, waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
          continue;
        }
        
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`OpenSea API error: ${response.status}`);
        }
        
        const data = await response.json();
        return transformer.extractCollectionData(data, 'ethereum');
        
      } catch (error) {
        if (retries === maxRetries) {
          console.warn(`[MinimalOpenSeaAPI] Failed to fetch collection after ${maxRetries} retries:`, error);
          return null;
        }
        retries++;
        const waitTime = Math.pow(2, retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    return null;
  }
  
  /**
   * Fetch enhanced NFT data with mint date and additional metadata
   */
  async fetchEnhancedNFTData(contractAddress: string, tokenId: string): Promise<any | null> {
    try {
      // Import the enhanced helper function
      const { fetchEnhancedNFTData } = await import('./openseaHelpers.js');
      return await fetchEnhancedNFTData(contractAddress, tokenId, this.apiKey);
    } catch (error) {
      console.warn(`[MinimalOpenSeaAPI] Failed to fetch enhanced NFT data for ${contractAddress}:${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Fetch creator/artist data from OpenSea accounts endpoint
   */
  async fetchCreator(address: string): Promise<MinimalCreatorData | null> {
    const url = `https://api.opensea.io/api/v2/accounts/${address}`;
    
    console.log(`[OpenSeaAPI] Fetching creator data from: ${url}`);
    
    // Implement retry logic for rate limiting
    let retries = 0;
    const maxRetries = 3;
    
    while (retries <= maxRetries) {
      try {
        console.log(`[OpenSeaAPI] Creator fetch attempt ${retries + 1}/${maxRetries + 1} for ${address}`);
        
        const response = await fetch(url, {
          headers: { 'X-API-KEY': this.apiKey }
        });
        
        console.log(`[OpenSeaAPI] Creator response status: ${response.status} ${response.statusText}`);
        
        if (response.status === 429) {
          const waitTime = Math.pow(2, retries) * 1000;
          console.log(`[MinimalOpenSeaAPI] Rate limited (429) on creator, waiting ${waitTime}ms before retry ${retries + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
          continue;
        }
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log(`[OpenSeaAPI] Creator not found (404) for ${address}`);
            return null;
          }
          console.log(`[OpenSeaAPI] Creator error response: ${response.status} ${response.statusText}`);
          throw new Error(`OpenSea API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[OpenSeaAPI] Creator data received for ${address}:`, Object.keys(data).join(', '));
        
        const result = transformer.extractCreatorData(data, 'ethereum');
        console.log(`[OpenSeaAPI] Creator data transformed for ${address}:`, result ? 'success' : 'null');
        
        return result;
        
      } catch (error) {
        console.error(`[OpenSeaAPI] Creator fetch error on attempt ${retries + 1}:`, error);
        if (retries === maxRetries) {
          console.warn(`[MinimalOpenSeaAPI] Failed to fetch creator after ${maxRetries} retries:`, error);
          return null;
        }
        retries++;
        const waitTime = Math.pow(2, retries) * 1000;
        console.log(`[OpenSeaAPI] Creator fetch waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    console.log(`[OpenSeaAPI] Creator fetch exhausted all retries for ${address}`);
    return null;
  }
}

// Tezos/Objkt API helpers
export class MinimalObjktAPI {
  private graphqlEndpoint = 'https://data.objkt.com/v3/graphql';
  
  /**
   * Fetch NFTs by wallet address - only essential fields
   */
  async fetchNFTsByAddress(
    walletAddress: string,
    limit = 500,
    offset = 0,
    type: 'owned' | 'created' = 'owned'
  ): Promise<{ nfts: MinimalNFTData[]; hasMore: boolean }> {
    let query: string;
    
    if (type === 'owned') {
      // Use token_holder with quantity > 0 to get only currently owned tokens
      query = `
        query {
          token_holder(
            where: {holder_address: {_eq: "${walletAddress}"}, quantity: {_gt: "0"}}
            limit: ${limit}
            offset: ${offset}
            order_by: {last_incremented_at: desc}
          ) {
            quantity
            last_incremented_at
            token {
              token_id
              name
              description
              artifact_uri
              display_uri
              thumbnail_uri
              mime
              symbol
              supply
              metadata
              timestamp
              dimensions
              fa {
                contract
                name
                description
                website
              }
              creators {
                creator_address
                holder {
                  address
                  alias
                  logo
                  description
                  website
                  twitter
                  instagram
                }
              }
            }
          }
        }
      `;
    } else {
      // For created tokens, use the original approach with created_tokens
      query = `
        query {
          holder(where: {address: {_eq: "${walletAddress}"}}) {
            created_tokens(limit: ${limit}, offset: ${offset}) {
              token {
                token_id
                name
                description
                artifact_uri
                display_uri
                thumbnail_uri
                mime
                symbol
                supply
                metadata
                timestamp
                dimensions
                fa {
                  contract
                  name
                  description
                  website
                }
                creators {
                  creator_address
                  holder {
                    address
                    alias
                    logo
                    description
                    website
                    twitter
                    instagram
                  }
                }
              }
            }
          }
        }
      `;
    }
    
    const response = await this.graphqlFetch(query);
    
    let tokens: any[];
    if (type === 'owned') {
      tokens = response?.data?.token_holder || [];
    } else {
      tokens = response?.data?.holder?.[0]?.created_tokens || [];
    }
    
    // Filter out wrapped Tezos tokens - these are not real NFTs
    const filteredTokens = tokens.filter((item: any) => {
      const contractAddress = type === 'owned' 
        ? item?.token?.fa?.contract 
        : item?.token?.fa?.contract;
      if (contractAddress === WRAPPED_TEZOS_CONTRACT) {
        console.log(`[MinimalObjktAPI] Filtering out wrapped Tezos token from contract ${contractAddress}`);
        return false;
      }
      return true;
    });

    console.log(`[MinimalObjktAPI] Filtered ${tokens.length - filteredTokens.length} wrapped Tezos tokens, ${filteredTokens.length} remaining`);
    
    // Transform tokens to MinimalNFTData - properly await async transformations
    const nfts = await Promise.all(
      filteredTokens.map((item: any) => transformer.transformTezosToken(item))
    );
    
    return {
      nfts,
      hasMore: tokens.length === limit
    };
  }
  
  /**
   * Fetch single NFT details - only essential fields
   */
  async fetchNFTDetails(
    contractAddress: string, 
    tokenId: string
  ): Promise<MinimalNFTData | null> {
    const query = `
      query {
        token(where: {fa_contract: {_eq: "${contractAddress}"}, token_id: {_eq: "${tokenId}"}}) {
          token_id
          name
          description
          artifact_uri
          display_uri
          thumbnail_uri
          mime
          symbol
          supply
          metadata
          timestamp
          dimensions
          fa {
            contract
            name
            description
            website
          }
          creators {
            creator_address
            holder {
              address
              alias
              logo
              description
              website
              twitter
              instagram
            }
          }
        }
      }
    `;
    
    const response = await this.graphqlFetch(query);
    const token = response?.data?.token?.[0];
    
    return token ? await transformer.transformTezosToken(token) : null;
  }
  
  /**
   * Fetch collection data - only essential fields
   */
  async fetchCollection(contractAddress: string): Promise<MinimalCollectionData | null> {
    const query = `
      query {
        fa(where: {contract: {_eq: "${contractAddress}"}}) {
          contract
          name
          description
          website
          logo
        }
      }
    `;
    
    const response = await this.graphqlFetch(query);
    const collection = response?.data?.fa?.[0];
    
    return collection ? transformer.extractCollectionData(collection, 'tezos') : null;
  }
  
  /**
   * Fetch creator/artist data - only essential fields
   */
  async fetchCreator(address: string): Promise<MinimalCreatorData | null> {
    const query = `
      query {
        holder(where: {address: {_eq: "${address}"}}) {
          address
          alias
          logo
          description
          website
          twitter
          instagram
        }
      }
    `;
    
    const response = await this.graphqlFetch(query);
    const creator = response?.data?.holder?.[0];
    
    return creator ? transformer.extractCreatorData(creator, 'tezos') : null;
  }
  
  private async graphqlFetch(query: string): Promise<any> {
    const response = await fetch(this.graphqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      throw new Error(`Objkt API error: ${response.status}`);
    }
    
    return response.json();
  }
}

// Simplified indexing workflow
export class MinimalIndexingWorkflow {
  private openSeaAPI: MinimalOpenSeaAPI;
  private objktAPI: MinimalObjktAPI;
  
  constructor(openSeaApiKey: string) {
    this.openSeaAPI = new MinimalOpenSeaAPI(openSeaApiKey);
    this.objktAPI = new MinimalObjktAPI();
  }
  
  /**
   * Index NFTs from a wallet address
   */
  async indexWalletNFTs(
    walletAddress: string,
    blockchain: 'ethereum' | 'tezos',
    type: 'owned' | 'created' = 'owned'
  ): Promise<MinimalNFTData[]> {
    if (blockchain === 'ethereum') {
      // Handle pagination for OpenSea API
      const allNfts: MinimalNFTData[] = [];
      let nextCursor: string | undefined = undefined;
      let pageCount = 0;
      const maxPages = 100; // Safety limit to prevent infinite loops
      
      do {
        console.log(`[MinimalIndexingWorkflow] Fetching page ${pageCount + 1} for wallet ${walletAddress}${nextCursor ? ` (cursor: ${nextCursor.substring(0, 20)}...)` : ''}`);
        
        const result = await this.openSeaAPI.fetchNFTsByAddress(walletAddress, 50, nextCursor);
        console.log(`[MinimalIndexingWorkflow] OpenSea API returned ${result.nfts.length} NFTs, nextCursor: ${result.nextCursor ? 'present' : 'null'}`);
        
        allNfts.push(...result.nfts);
        nextCursor = result.nextCursor;
        pageCount++;
        
        console.log(`[MinimalIndexingWorkflow] Page ${pageCount}: fetched ${result.nfts.length} NFTs, total so far: ${allNfts.length}, nextCursor: ${nextCursor ? 'present' : 'null'}`);
        
        // Add delay between requests to respect rate limits
        if (nextCursor) {
          console.log(`[MinimalIndexingWorkflow] Waiting 0.2 seconds before next page...`);
          await new Promise(resolve => setTimeout(resolve, 200)); // Reduced to 0.2 seconds
        } else {
          console.log(`[MinimalIndexingWorkflow] No more pages available (nextCursor is null/undefined)`);
        }
        
      } while (nextCursor && pageCount < maxPages);
      
      console.log(`[MinimalIndexingWorkflow] Completed pagination for wallet ${walletAddress}: ${allNfts.length} total NFTs across ${pageCount} pages`);
      return allNfts;
    } else {
      // Handle pagination for Tezos/Objkt API
      const allNfts: MinimalNFTData[] = [];
      let offset = 0;
      const limit = 500;
      let hasMore = true;
      let pageCount = 0;
      const maxPages = 100; // Safety limit to prevent infinite loops
      
      while (hasMore && pageCount < maxPages) {
        console.log(`[MinimalIndexingWorkflow] Fetching page ${pageCount + 1} for Tezos wallet ${walletAddress} (offset: ${offset})`);
        
        const result = await this.objktAPI.fetchNFTsByAddress(walletAddress, limit, offset, type);
        allNfts.push(...result.nfts);
        hasMore = result.hasMore;
        offset += limit;
        pageCount++;
        
        console.log(`[MinimalIndexingWorkflow] Page ${pageCount}: fetched ${result.nfts.length} NFTs, total so far: ${allNfts.length}`);
        
        // Add delay between requests to respect rate limits
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`[MinimalIndexingWorkflow] Completed pagination for Tezos wallet ${walletAddress}: ${allNfts.length} total NFTs across ${pageCount} pages`);
      return allNfts;
    }
  }
  
  /**
   * Get single NFT data
   */
  async getNFTData(
    contractAddress: string,
    tokenId: string,
    blockchain: 'ethereum' | 'tezos'
  ): Promise<MinimalNFTData | null> {
    if (blockchain === 'ethereum') {
      return this.openSeaAPI.fetchNFTDetails(contractAddress, tokenId);
    } else {
      return this.objktAPI.fetchNFTDetails(contractAddress, tokenId);
    }
  }
  
  /**
   * Get collection data
   */
  async getCollectionData(
    identifier: string,
    blockchain: 'ethereum' | 'tezos'
  ): Promise<MinimalCollectionData | null> {
    if (blockchain === 'ethereum') {
      return this.openSeaAPI.fetchCollection(identifier);
    } else {
      return this.objktAPI.fetchCollection(identifier);
    }
  }
  
  /**
   * Get creator data
   */
  async getCreatorData(
    address: string,
    blockchain: 'ethereum' | 'tezos'
  ): Promise<MinimalCreatorData | null> {
    if (blockchain === 'ethereum') {
      return this.openSeaAPI.fetchCreator(address);
    } else {
      return this.objktAPI.fetchCreator(address);
    }
  }
} 