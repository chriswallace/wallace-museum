import type { MinimalNFTData } from './types/minimal-nft';
import { IntelligentRateLimiter } from './intelligent-rate-limiter';

interface AlchemyNFT {
  contract: {
    address: string;
    name?: string;
    symbol?: string;
    totalSupply?: string;
    tokenType?: string;
    contractDeployer?: string;
    deployedBlockNumber?: number;
    spamClassifications?: string[];
  };
  tokenId: string;
  tokenType: string;
  title?: string;
  description?: string;
  image?: {
    originalUrl?: string;
    thumbnailUrl?: string;
    pngUrl?: string;
    cachedUrl?: string;
  };
  raw?: {
    metadata?: any;
  };
  collection?: {
    name?: string;
    slug?: string;
    externalUrl?: string;
    bannerImageUrl?: string;
  };
  mint?: {
    mintAddress?: string;
    blockNumber?: number;
    timestamp?: string;
    transactionHash?: string;
  };
  timeLastUpdated?: string;
  balance?: string;
}

interface AlchemyResponse {
  ownedNfts: AlchemyNFT[];
  pageKey?: string;
  totalCount: number;
  validAt: {
    blockNumber: number;
    blockHash: string;
    blockTimestamp: string;
  };
}

interface AlchemyOwner {
  ownerAddress: string;
  tokenBalances: Array<{
    tokenId: string;
    balance: string;
  }>;
}

interface AlchemyOwnersResponse {
  owners: AlchemyOwner[];
  pageKey?: string;
}

interface AlchemyContractMetadata {
  address: string;
  name?: string;
  symbol?: string;
  totalSupply?: string;
  tokenType: string;
  contractDeployer?: string;
  deployedBlockNumber?: number;
  openSeaMetadata?: {
    floorPrice?: number;
    collectionName?: string;
    collectionSlug?: string;
    safelistRequestStatus?: string;
    imageUrl?: string;
    description?: string;
    externalUrl?: string;
    twitterUsername?: string;
    discordUrl?: string;
    bannerImageUrl?: string;
    lastIngestedAt?: string;
  };
}

export interface AlchemyIndexingOptions {
  includeMetadata?: boolean;
  includeSpam?: boolean;
  pageSize?: number;
  maxPages?: number;
  enrichmentLevel?: 'minimal' | 'standard' | 'comprehensive';
  blockchain?: 'ethereum' | 'base' | 'shape' | 'polygon';
}

export class AlchemyNFTIndexer {
  public apiKey: string;
  private rateLimiter: IntelligentRateLimiter;
  private baseUrl: string;
  private blockchain: string;

  constructor(apiKey: string, blockchain: 'ethereum' | 'base' | 'shape' | 'polygon' = 'ethereum') {
    this.apiKey = apiKey;
    this.blockchain = blockchain;
    
    // Set the appropriate base URL for the blockchain
    this.baseUrl = this.getAlchemyBaseUrl(blockchain);
    
    // Configure rate limiter for Alchemy (more generous than OpenSea)
    this.rateLimiter = new IntelligentRateLimiter({
      baseDelay: 200,        // 5 requests per second base rate
      maxDelay: 5000,        // Max 5 seconds
      backoffMultiplier: 2,  // Double delay on rate limit
      maxRetries: 5,
      batchSize: 10,         // Larger batches allowed
      adaptiveThreshold: 2
    });
  }

  /**
   * Get the appropriate Alchemy base URL for the blockchain
   */
  private getAlchemyBaseUrl(blockchain: string): string {
    const baseUrls: Record<string, string> = {
      ethereum: 'https://eth-mainnet.g.alchemy.com/nft/v3',
      base: 'https://base-mainnet.g.alchemy.com/nft/v3',
      shape: 'https://shape-mainnet.g.alchemy.com/nft/v3',
      polygon: 'https://polygon-mainnet.g.alchemy.com/nft/v3'
    };
    
    return baseUrls[blockchain] || baseUrls.ethereum;
  }

  /**
   * Get all NFTs owned by a wallet address with reliable pagination
   */
  async getWalletNFTs(
    walletAddress: string, 
    options: AlchemyIndexingOptions = {}
  ): Promise<MinimalNFTData[]> {
    const {
      includeMetadata = true,
      includeSpam = false,
      pageSize = 100, // Alchemy supports up to 100 per page
      maxPages = 1000,
      enrichmentLevel = 'standard'
    } = options;

    console.log(`[AlchemyNFTIndexer] Starting indexing for wallet ${walletAddress}`);
    console.log(`[AlchemyNFTIndexer] Options: pageSize=${pageSize}, maxPages=${maxPages}, enrichmentLevel=${enrichmentLevel}`);

    const allNFTs: MinimalNFTData[] = [];
    let pageKey: string | undefined = undefined;
    let pageCount = 0;
    let totalExpected = 0;

    try {
      while (pageCount < maxPages) {
        pageCount++;
        
        console.log(`[AlchemyNFTIndexer] Fetching page ${pageCount}${pageKey ? ` (pageKey: ${pageKey.substring(0, 20)}...)` : ''}`);

        const result = await this.rateLimiter.executeCall(
          () => this.fetchNFTsPage(walletAddress, {
            pageKey,
            pageSize,
            includeMetadata,
            includeSpam
          }),
          `NFTs page ${pageCount} for ${walletAddress}`
        );

        if (!result.success || !result.data) {
          console.error(`[AlchemyNFTIndexer] Failed to fetch page ${pageCount}:`, result.error);
          break;
        }

        const response = result.data as AlchemyResponse;
        
        // Set total expected on first page
        if (pageCount === 1) {
          totalExpected = response.totalCount;
          console.log(`[AlchemyNFTIndexer] Total NFTs expected: ${totalExpected}`);
        }

        if (!response.ownedNfts || response.ownedNfts.length === 0) {
          console.log(`[AlchemyNFTIndexer] Page ${pageCount}: No NFTs returned, ending pagination`);
          break;
        }

        // Filter out spam NFTs if includeSpam is false
        let filteredNFTs = response.ownedNfts;
        if (!includeSpam) {
          const beforeCount = filteredNFTs.length;
          filteredNFTs = response.ownedNfts.filter(nft => {
            const isSpam = nft.contract.spamClassifications && nft.contract.spamClassifications.length > 0;
            return !isSpam;
          });
          const spamCount = beforeCount - filteredNFTs.length;
          if (spamCount > 0) {
            console.log(`[AlchemyNFTIndexer] Filtered out ${spamCount} spam NFTs from page ${pageCount}`);
          }
        }

        // Transform Alchemy NFTs to MinimalNFTData
        const transformedNFTs = filteredNFTs.map(nft => this.transformAlchemyNFT(nft, enrichmentLevel));
        allNFTs.push(...transformedNFTs);

        console.log(`[AlchemyNFTIndexer] Page ${pageCount}: +${filteredNFTs.length} NFTs (${response.ownedNfts.length} total, ${response.ownedNfts.length - filteredNFTs.length} spam filtered) (running total: ${allNFTs.length})`);

        // Check if we have more pages
        pageKey = response.pageKey;
        if (!pageKey) {
          console.log(`[AlchemyNFTIndexer] No more pages available, pagination complete`);
          break;
        }

        // Add delay between requests
        await this.sleep(300);
      }

      if (pageCount >= maxPages) {
        console.warn(`[AlchemyNFTIndexer] Hit maximum page limit (${maxPages}), count may be incomplete`);
      }

      console.log(`[AlchemyNFTIndexer] Indexing completed: ${allNFTs.length} NFTs fetched across ${pageCount} pages`);
      
      if (totalExpected > 0 && allNFTs.length < totalExpected) {
        console.warn(`[AlchemyNFTIndexer] Warning: Expected ${totalExpected} NFTs but got ${allNFTs.length}`);
      }

      return allNFTs;

    } catch (error) {
      console.error(`[AlchemyNFTIndexer] Error during wallet indexing:`, error);
      return allNFTs; // Return what we have so far
    }
  }

  /**
   * Get NFT count for a wallet (much more reliable than OpenSea)
   * By default returns total count including spam for performance.
   * Set filterSpam=true for accurate non-spam count (slower).
   */
  async getWalletNFTCount(walletAddress: string, filterSpam: boolean = false): Promise<number> {
    try {
      console.log(`[AlchemyNFTIndexer] Getting NFT count for ${walletAddress} (filterSpam: ${filterSpam})`);

      if (filterSpam) {
        // For non-spam count, we need to fetch and filter the NFTs
        // This is less efficient but more accurate
        const nfts = await this.getWalletNFTs(walletAddress, {
          includeMetadata: false,
          includeSpam: false,
          pageSize: 100,
          maxPages: 1000
        });
        
        console.log(`[AlchemyNFTIndexer] Wallet ${walletAddress} has ${nfts.length} non-spam NFTs`);
        return nfts.length;
      }

      // For total count including spam (faster), we can use the API directly
      const result = await this.rateLimiter.executeCall(
        () => this.fetchNFTsPage(walletAddress, {
          pageSize: 1, // Just get first page to get total count
          includeMetadata: false,
          includeSpam: true
        }),
        `NFT count for ${walletAddress}`
      );

      if (!result.success || !result.data) {
        console.error(`[AlchemyNFTIndexer] Failed to get NFT count:`, result.error);
        return 0;
      }

      const response = result.data as AlchemyResponse;
      const count = response.totalCount || 0;
      
      console.log(`[AlchemyNFTIndexer] Wallet ${walletAddress} has ${count} total NFTs (including spam)`);
      return count;

    } catch (error) {
      console.error(`[AlchemyNFTIndexer] Error getting NFT count:`, error);
      return 0;
    }
  }

  /**
   * Get detailed contract metadata
   */
  async getContractMetadata(contractAddress: string): Promise<AlchemyContractMetadata | null> {
    try {
      const result = await this.rateLimiter.executeCall(
        () => this.fetchContractMetadata(contractAddress),
        `Contract metadata for ${contractAddress}`
      );

      if (!result.success || !result.data) {
        console.error(`[AlchemyNFTIndexer] Failed to get contract metadata:`, result.error);
        return null;
      }

      return result.data as AlchemyContractMetadata;

    } catch (error) {
      console.error(`[AlchemyNFTIndexer] Error getting contract metadata:`, error);
      return null;
    }
  }

  /**
   * Fetch a single page of NFTs from Alchemy
   */
  private async fetchNFTsPage(
    walletAddress: string,
    options: {
      pageKey?: string;
      pageSize?: number;
      includeMetadata?: boolean;
      includeSpam?: boolean;
    }
  ): Promise<AlchemyResponse> {
    const {
      pageKey,
      pageSize = 100,
      includeMetadata = true,
      includeSpam = false
    } = options;

    const url = new URL(`${this.baseUrl}/${this.apiKey}/getNFTsForOwner`);
    url.searchParams.set('owner', walletAddress);
    url.searchParams.set('pageSize', pageSize.toString());
    url.searchParams.set('withMetadata', includeMetadata.toString());
    
    // Note: excludeFilters requires Growth+ plan, so we skip it for compatibility
    // The spam filtering will need to be done post-processing if needed
    // if (!includeSpam) {
    //   url.searchParams.set('excludeFilters[]', 'SPAM');
    // }
    
    if (pageKey) {
      url.searchParams.set('pageKey', pageKey);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limited');
      }
      throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Fetch contract metadata from Alchemy
   */
  private async fetchContractMetadata(contractAddress: string): Promise<AlchemyContractMetadata> {
    const url = new URL(`${this.baseUrl}/${this.apiKey}/getContractMetadata`);
    url.searchParams.set('contractAddress', contractAddress);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limited');
      }
      throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Transform Alchemy NFT to MinimalNFTData format with enhanced dimension extraction
   */
  private transformAlchemyNFT(nft: AlchemyNFT, enrichmentLevel: string): MinimalNFTData {
    const contractAddress = nft.contract.address.toLowerCase();
    const tokenId = nft.tokenId;

    // Extract image URLs
    const imageUrl = nft.image?.originalUrl || nft.image?.cachedUrl || nft.image?.pngUrl;
    const thumbnailUrl = nft.image?.thumbnailUrl || nft.image?.cachedUrl;

    // Extract metadata
    const metadata = nft.raw?.metadata || {};
    const attributes = metadata.attributes || [];

    // Enhanced dimension extraction from Alchemy data
    let dimensions: { width: number; height: number } | undefined = undefined;
    
    // Try to extract dimensions from various sources in Alchemy data
    if (metadata.image_details) {
      const width = parseInt(metadata.image_details.width, 10);
      const height = parseInt(metadata.image_details.height, 10);
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        dimensions = { width, height };
        console.log(`[AlchemyNFTIndexer] Found dimensions in image_details for ${contractAddress}:${tokenId}: ${width}x${height}`);
      }
    }
    
    // Check for dimensions in attributes
    if (!dimensions && Array.isArray(attributes)) {
      for (const attr of attributes) {
        const traitType = (attr.trait_type || '').toLowerCase();
        if (traitType.includes('width') || traitType.includes('height')) {
          // Try to find width/height pairs in attributes
          const widthAttr = attributes.find(a => (a.trait_type || '').toLowerCase().includes('width'));
          const heightAttr = attributes.find(a => (a.trait_type || '').toLowerCase().includes('height'));
          
          if (widthAttr && heightAttr) {
            const width = parseInt(widthAttr.value, 10);
            const height = parseInt(heightAttr.value, 10);
            if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
              dimensions = { width, height };
              console.log(`[AlchemyNFTIndexer] Found dimensions in attributes for ${contractAddress}:${tokenId}: ${width}x${height}`);
              break;
            }
          }
        }
      }
    }
    
    // Check for dimension string patterns in metadata
    if (!dimensions) {
      const dimensionFields = ['dimensions', 'size', 'resolution'];
      for (const field of dimensionFields) {
        if (metadata[field] && typeof metadata[field] === 'string') {
          const match = metadata[field].match(/(\d+)\s*[x×]\s*(\d+)/i);
          if (match) {
            const width = parseInt(match[1], 10);
            const height = parseInt(match[2], 10);
            if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
              dimensions = { width, height };
              console.log(`[AlchemyNFTIndexer] Found dimensions in ${field} for ${contractAddress}:${tokenId}: ${width}x${height}`);
              break;
            }
          }
        }
      }
    }

    // Extract collection info
    const collection = nft.collection ? {
      slug: nft.collection.slug || contractAddress,
      title: nft.collection.name || 'Unknown Collection',
      description: '',
      contractAddress: contractAddress,
      websiteUrl: nft.collection.externalUrl,
      imageUrl: nft.collection.bannerImageUrl,
      isGenerativeArt: false,
      isSharedContract: false
    } : undefined;

    // Extract mint information
    const mintDate = nft.mint?.timestamp || nft.timeLastUpdated;

    // Extract creator/artist information
    let creator = undefined;
    
    // Debug logging to understand the response structure
    console.log(`[AlchemyNFTIndexer] DEBUG - NFT structure for ${contractAddress}:${tokenId}:`);
    console.log(`  mint:`, JSON.stringify(nft.mint, null, 2));
    console.log(`  contract:`, JSON.stringify(nft.contract, null, 2));
    console.log(`  metadata keys:`, Object.keys(metadata));
    
    // Write debug info to file for inspection
    try {
      const fs = require('fs');
      const debugInfo = {
        contractAddress,
        tokenId,
        mint: nft.mint,
        contract: nft.contract,
        metadataKeys: Object.keys(metadata),
        metadata: metadata
      };
      fs.writeFileSync(`debug-alchemy-${contractAddress.slice(-6)}-${tokenId}.json`, JSON.stringify(debugInfo, null, 2));
    } catch (e) {
      // Ignore file write errors
    }
    
    // Try to get creator from mint address (most reliable for Base/other chains)
    if (nft.mint?.mintAddress && nft.mint.mintAddress !== '0x0000000000000000000000000000000000000000') {
      creator = {
        address: nft.mint.mintAddress,
        username: undefined,
        bio: undefined,
        description: undefined,
        profileUrl: undefined,
        avatarUrl: undefined,
        websiteUrl: undefined,
        displayName: undefined,
        ensName: undefined,
        isVerified: undefined,
        twitterHandle: undefined,
        instagramHandle: undefined,
        profileData: undefined,
        resolutionSource: 'alchemy_mint',
        socialLinks: undefined
      };
      console.log(`[AlchemyNFTIndexer] Found creator from mint address for ${contractAddress}:${tokenId}: ${nft.mint.mintAddress}`);
    }
    // Fallback to contract deployer if no mint address
    else if (nft.contract?.contractDeployer && nft.contract.contractDeployer !== '0x0000000000000000000000000000000000000000') {
      creator = {
        address: nft.contract.contractDeployer,
        username: undefined,
        bio: undefined,
        description: undefined,
        profileUrl: undefined,
        avatarUrl: undefined,
        websiteUrl: undefined,
        displayName: undefined,
        ensName: undefined,
        isVerified: undefined,
        twitterHandle: undefined,
        instagramHandle: undefined,
        profileData: undefined,
        resolutionSource: 'alchemy_deployer',
        socialLinks: undefined
      };
      console.log(`[AlchemyNFTIndexer] Found creator from contract deployer for ${contractAddress}:${tokenId}: ${nft.contract.contractDeployer}`);
    }
    // Also check metadata for creator information
    else if (metadata.creator) {
      creator = {
        address: metadata.creator,
        username: metadata.creator_name || undefined,
        bio: undefined,
        description: undefined,
        profileUrl: undefined,
        avatarUrl: undefined,
        websiteUrl: undefined,
        displayName: metadata.creator_name || undefined,
        ensName: undefined,
        isVerified: undefined,
        twitterHandle: undefined,
        instagramHandle: undefined,
        profileData: undefined,
        resolutionSource: 'alchemy_metadata',
        socialLinks: undefined
      };
      console.log(`[AlchemyNFTIndexer] Found creator from metadata for ${contractAddress}:${tokenId}: ${metadata.creator}`);
    }
    else {
      console.log(`[AlchemyNFTIndexer] No creator information found for ${contractAddress}:${tokenId}`);
    }

    const minimalNFT: MinimalNFTData = {
      // Core identification
      contractAddress,
      tokenId,
      blockchain: this.blockchain as 'ethereum' | 'tezos' | 'polygon' | 'base' | 'shape',
      tokenStandard: nft.tokenType || 'ERC721',

      // Basic info
      title: nft.title || metadata.name || `Token ${tokenId}`,
      description: nft.description || metadata.description || '',

      // Media
      imageUrl,
      thumbnailUrl,
      animationUrl: metadata.animation_url || metadata.image,
      metadataUrl: '', // Alchemy provides parsed metadata directly

      // Technical details
      supply: nft.balance ? parseInt(nft.balance) : 1,
      mintDate,
      dimensions, // Include extracted dimensions

      // Metadata
      attributes,

      // Collection
      collection,

      // Creator/Artist
      creator
    };

    return minimalNFT;
  }

  /**
   * Get statistics about the indexer
   */
  getStats() {
    return {
      rateLimiter: this.rateLimiter.getStats(),
      provider: 'Alchemy',
      version: '1.0.0'
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 