import type { MinimalNFTData, MinimalCollectionData, MinimalCreatorData } from './types/minimal-nft';
import { MinimalNFTTransformer } from './minimal-transformers';
import { IntelligentRateLimiter, type APICallResult } from './intelligent-rate-limiter';
import { EthereumNFTEnricher } from './indexing/ethereum-enrichment';
import type { IndexerData } from './indexing/unified-indexer';

/**
 * Optimized OpenSea API with intelligent rate limiting and smart data fetching
 * Balances speed with accuracy by:
 * 1. Using adaptive rate limiting
 * 2. Implementing smart caching
 * 3. Batching similar requests
 * 4. Prioritizing essential data over nice-to-have data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface EnrichmentStrategy {
  fetchEnhancedData: boolean;
  fetchCreatorData: boolean;
  fetchCollectionData: boolean;
  batchCreators: boolean;
  batchCollections: boolean;
}

export class OptimizedOpenSeaAPI {
  private apiKey: string;
  private rateLimiter: IntelligentRateLimiter;
  private transformer: MinimalNFTTransformer;
  private enricher: EthereumNFTEnricher;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly defaultCacheTTL = 5 * 60 * 1000; // 5 minutes
  private creatorCache: Map<string, any> = new Map();
  private collectionCache: Map<string, any> = new Map();
  private stats = {
    totalRequests: 0,
    creatorRequests: 0,
    collectionRequests: 0,
    enrichmentRequests: 0,
    rateLimiter: {} as any
  };

  constructor(apiKey: string, rateLimiterConfig?: any) {
    this.apiKey = apiKey;
    this.rateLimiter = new IntelligentRateLimiter(rateLimiterConfig);
    this.transformer = new MinimalNFTTransformer();
    this.enricher = new EthereumNFTEnricher(apiKey, this.rateLimiter);
  }

  /**
   * Fetch NFTs by wallet address with intelligent optimization
   */
  async fetchNFTsByAddress(
    walletAddress: string,
    limit: number = 50,
    next?: string,
    enrichmentStrategy: any = {}
  ): Promise<{ nfts: MinimalNFTData[], nextCursor?: string }> {
    console.log(`[OptimizedOpenSeaAPI] Fetching NFTs for ${walletAddress} with strategy:`, enrichmentStrategy);

    // Step 1: Fetch basic NFT list
    const basicNFTsResult = await this.rateLimiter.executeCall(
      () => this.fetchBasicNFTList(walletAddress, limit, next),
      `NFT list for ${walletAddress}`
    );

    if (!basicNFTsResult.success || !basicNFTsResult.data) {
      console.error(`[OptimizedOpenSeaAPI] Failed to fetch basic NFT list:`, basicNFTsResult.error);
      return { nfts: [] };
    }

    const basicNFTs = basicNFTsResult.data.nfts;
    console.log(`[OptimizedOpenSeaAPI] Fetched ${basicNFTs.length} basic NFTs`);

    // Step 2: Transform to minimal format
    const transformedNFTs = await Promise.all(
      basicNFTs.map((nft: any) => this.transformer.transformOpenSeaNFT(nft))
    );

    // Step 3: Apply enrichment strategy
    let enrichedNFTs = transformedNFTs;
    
    // Check if enrichment is requested
    if (enrichmentStrategy.fetchEnhancedData || enrichmentStrategy.fetchCreatorData || enrichmentStrategy.fetchCollectionData) {
      enrichedNFTs = await this.enhanceNFTsWithAdditionalData(transformedNFTs, enrichmentStrategy);
    } else if (enrichmentStrategy.batchCreators || enrichmentStrategy.batchCollections) {
      // Fallback to existing batch enrichment
      const { creatorAddresses, collectionSlugs } = this.extractUniqueIdentifiers(transformedNFTs);

      // Batch fetch creators and collections if requested
      if (enrichmentStrategy.batchCreators && creatorAddresses.length > 0) {
        console.log(`[OptimizedOpenSeaAPI] Batch fetching ${creatorAddresses.length} creators`);
        await this.batchFetchCreators(creatorAddresses);
      }

      if (enrichmentStrategy.batchCollections && collectionSlugs.length > 0) {
        console.log(`[OptimizedOpenSeaAPI] Batch fetching ${collectionSlugs.length} collections`);
        await this.batchFetchCollections(collectionSlugs);
      }

      // Apply enrichment from cache
      enrichedNFTs = transformedNFTs.map((nft: MinimalNFTData) => ({
        ...nft,
        creator: nft.creator?.address ? this.creatorCache.get(nft.creator.address) || nft.creator : nft.creator,
        collection: nft.collection?.slug ? this.collectionCache.get(nft.collection.slug) || nft.collection : nft.collection
      }));
    }

    console.log(`[OptimizedOpenSeaAPI] Enriched ${enrichedNFTs.length} NFTs with creator/collection data`);

    // Step 4: Fetch enhanced data if requested (deprecated - now handled by enhanceNFTsWithAdditionalData)
    if (enrichmentStrategy.fetchEnhancedData && !enrichmentStrategy.fetchCreatorData) {
      console.log(`[OptimizedOpenSeaAPI] Fetching enhanced data for ${enrichedNFTs.length} NFTs`);
      enrichedNFTs = await this.enhanceNFTsWithAdditionalData(enrichedNFTs, enrichmentStrategy);
    }

    return {
      nfts: enrichedNFTs,
      nextCursor: basicNFTsResult.data.nextCursor
    };
  }

  /**
   * Fetch basic NFT list without enrichment
   */
  private async fetchBasicNFTList(
    walletAddress: string,
    limit: number,
    nextCursor?: string
  ): Promise<{ nfts: any[]; nextCursor?: string }> {
    let url = `https://api.opensea.io/api/v2/chain/ethereum/account/${walletAddress}/nfts?limit=${limit}`;
    if (nextCursor) url += `&next=${nextCursor}`;

    const response = await fetch(url, {
      headers: { 'X-API-KEY': this.apiKey }
    });

    if (response.status === 429) {
      throw new Error('Rate limited');
    }

    if (!response.ok) {
      throw new Error(`OpenSea API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      nfts: data.nfts || [],
      nextCursor: data.next
    };
  }

  /**
   * Batch fetch creator data with intelligent caching
   */
  private async batchFetchCreators(
    creatorAddresses: string[],
    enableBatching: boolean = true
  ): Promise<Map<string, MinimalCreatorData | null>> {
    const creatorDataMap = new Map<string, MinimalCreatorData | null>();

    if (!enableBatching || creatorAddresses.length === 0) {
      return creatorDataMap;
    }

    console.log(`[OptimizedOpenSeaAPI] Batch fetching ${creatorAddresses.length} creators`);

    // Check cache first
    const uncachedCreators: string[] = [];
    for (const address of creatorAddresses) {
      const cached = this.getFromCache<MinimalCreatorData | null>(`creator:${address}`);
      if (cached !== null) {
        creatorDataMap.set(address, cached);
      } else {
        uncachedCreators.push(address);
      }
    }

    if (uncachedCreators.length === 0) {
      console.log(`[OptimizedOpenSeaAPI] All creators found in cache`);
      return creatorDataMap;
    }

    console.log(`[OptimizedOpenSeaAPI] Fetching ${uncachedCreators.length} uncached creators`);

    // Create API calls for uncached creators
    const creatorCalls = uncachedCreators.map(address => 
      () => this.fetchSingleCreator(address)
    );

    // Execute in batches with rate limiting
    const results = await this.rateLimiter.executeBatch(
      creatorCalls,
      'Creator data batch'
    );

    // Process results and update cache
    results.forEach((result, index) => {
      const address = uncachedCreators[index];
      if (result.success && result.data) {
        creatorDataMap.set(address, result.data);
        this.setCache(`creator:${address}`, result.data);
      } else {
        creatorDataMap.set(address, null);
        // Cache null results for a shorter time to avoid repeated failures
        this.setCache(`creator:${address}`, null, 60000); // 1 minute
      }
    });

    return creatorDataMap;
  }

  /**
   * Batch fetch collection data with intelligent caching
   */
  private async batchFetchCollections(
    collectionSlugs: string[],
    enableBatching: boolean = true
  ): Promise<Map<string, MinimalCollectionData | null>> {
    const collectionDataMap = new Map<string, MinimalCollectionData | null>();

    if (!enableBatching || collectionSlugs.length === 0) {
      return collectionDataMap;
    }

    console.log(`[OptimizedOpenSeaAPI] Batch fetching ${collectionSlugs.length} collections`);

    // Check cache first
    const uncachedCollections: string[] = [];
    for (const slug of collectionSlugs) {
      const cached = this.getFromCache<MinimalCollectionData | null>(`collection:${slug}`);
      if (cached !== null) {
        collectionDataMap.set(slug, cached);
      } else {
        uncachedCollections.push(slug);
      }
    }

    if (uncachedCollections.length === 0) {
      console.log(`[OptimizedOpenSeaAPI] All collections found in cache`);
      return collectionDataMap;
    }

    console.log(`[OptimizedOpenSeaAPI] Fetching ${uncachedCollections.length} uncached collections`);

    // Create API calls for uncached collections
    const collectionCalls = uncachedCollections.map(slug => 
      () => this.fetchSingleCollection(slug)
    );

    // Execute in batches with rate limiting
    const results = await this.rateLimiter.executeBatch(
      collectionCalls,
      'Collection data batch'
    );

    // Process results and update cache
    results.forEach((result, index) => {
      const slug = uncachedCollections[index];
      if (result.success && result.data) {
        collectionDataMap.set(slug, result.data);
        this.setCache(`collection:${slug}`, result.data);
      } else {
        collectionDataMap.set(slug, null);
        // Cache null results for a shorter time
        this.setCache(`collection:${slug}`, null, 60000); // 1 minute
      }
    });

    return collectionDataMap;
  }

  /**
   * Fetch single creator data
   */
  private async fetchSingleCreator(address: string): Promise<MinimalCreatorData | null> {
    const url = `https://api.opensea.io/api/v2/accounts/${address}`;
    
    const response = await fetch(url, {
      headers: { 'X-API-KEY': this.apiKey }
    });

    if (response.status === 429) {
      throw new Error('Rate limited');
    }

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`OpenSea API error: ${response.status}`);
    }

    const data = await response.json();
    return this.transformer.extractCreatorData(data, 'ethereum');
  }

  /**
   * Fetch single collection data
   */
  private async fetchSingleCollection(slug: string): Promise<MinimalCollectionData | null> {
    const url = `https://api.opensea.io/api/v2/collections/${slug}`;
    
    const response = await fetch(url, {
      headers: { 'X-API-KEY': this.apiKey }
    });

    if (response.status === 429) {
      throw new Error('Rate limited');
    }

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`OpenSea API error: ${response.status}`);
    }

    const data = await response.json();
    return this.transformer.extractCollectionData(data, 'ethereum');
  }

  /**
   * Batch enhance NFTs with additional data (mint dates, etc.)
   * Only used when explicitly requested due to high API cost
   */
  private async batchEnhanceNFTs(nfts: MinimalNFTData[]): Promise<void> {
    console.log(`[OptimizedOpenSeaAPI] Enhancing ${nfts.length} NFTs with additional data`);

    const enhancementCalls = nfts.map((nft, index) => 
      () => this.enhanceSingleNFT(nft, index)
    );

    const results = await this.rateLimiter.executeBatch(
      enhancementCalls,
      'NFT enhancement batch'
    );

    // Apply enhancements back to NFTs
    results.forEach((result, index) => {
      if (result.success && result.data) {
        Object.assign(nfts[index], result.data);
      }
    });
  }

  /**
   * Enhance single NFT with additional data
   */
  private async enhanceSingleNFT(nft: MinimalNFTData, index: number): Promise<Partial<MinimalNFTData> | null> {
    if (!nft.contractAddress || !nft.tokenId) {
      return null;
    }

    try {
      // Import the enhanced helper function
      const { fetchEnhancedNFTData } = await import('./openseaHelpers.js');
      const enhancedData = await fetchEnhancedNFTData(nft.contractAddress, nft.tokenId, this.apiKey);
      
      if (enhancedData && typeof enhancedData === 'object') {
        return {
          mintDate: (enhancedData as any).mint_date,
          // Add other enhanced fields as needed
        };
      }
    } catch (error) {
      console.warn(`[OptimizedOpenSeaAPI] Failed to enhance NFT ${index}:`, error);
    }

    return null;
  }

  /**
   * Cache management
   */
  private setCache<T>(key: string, data: T, ttl: number = this.defaultCacheTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Get rate limiter statistics
   */
  getStats() {
    return {
      rateLimiter: this.rateLimiter.getStats(),
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Enhanced data enrichment using the EthereumNFTEnricher
   */
  private async enhanceNFTsWithAdditionalData(
    nfts: MinimalNFTData[],
    enrichmentStrategy: any
  ): Promise<MinimalNFTData[]> {
    console.log(`[OptimizedOpenSeaAPI] Enhancing ${nfts.length} NFTs with additional data`);
    
    const enhancedNFTs: MinimalNFTData[] = [];
    
    // Process in smaller batches to avoid overwhelming the API
    const batchSize = 2; // Reduced from 5 to 2 for more conservative rate limiting
    for (let i = 0; i < nfts.length; i += batchSize) {
      const batch = nfts.slice(i, i + batchSize);
      console.log(`[OptimizedOpenSeaAPI] Processing enrichment batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(nfts.length / batchSize)} (${batch.length} NFTs)`);
      
      const enhancedBatch = await Promise.all(
        batch.map(async (nft: MinimalNFTData) => {
          try {
            // Convert MinimalNFTData to IndexerData format
            const indexerData: IndexerData = {
              title: nft.title,
              description: nft.description,
              imageUrl: nft.imageUrl,
              thumbnailUrl: nft.thumbnailUrl,
              animationUrl: nft.animationUrl,
              generatorUrl: nft.generatorUrl,
              metadataUrl: nft.metadataUrl,
              tokenStandard: nft.tokenStandard || 'ERC721', // Default to ERC721 if undefined
              supply: nft.supply,
              mintDate: nft.mintDate,
              dimensions: nft.dimensions,
              attributes: nft.attributes,
              features: nft.features,
              mime: nft.mime,
              blockchain: nft.blockchain,
              creator: nft.creator,
              collection: nft.collection ? {
                ...nft.collection,
                title: nft.collection.title || 'Unknown Collection' // Ensure title is always a string
              } : undefined
            };
            
            // Use the enricher to fetch additional data
            const enrichedData = await this.enricher.enrichNFTData(
              indexerData,
              nft.contractAddress,
              nft.tokenId
            );
            
            this.stats.enrichmentRequests++;
            
            // Convert back to MinimalNFTData ensuring required fields
            const result: MinimalNFTData = {
              ...nft,
              mintDate: enrichedData.mintDate,
              creator: enrichedData.creator,
              collection: enrichedData.collection ? {
                slug: enrichedData.collection.slug || nft.contractAddress,
                title: enrichedData.collection.title || 'Unknown Collection',
                description: enrichedData.collection.description,
                contractAddress: enrichedData.collection.contractAddress || nft.contractAddress,
                websiteUrl: enrichedData.collection.websiteUrl,
                projectUrl: enrichedData.collection.projectUrl,
                mediumUrl: enrichedData.collection.mediumUrl,
                imageUrl: enrichedData.collection.imageUrl,
                bannerImageUrl: enrichedData.collection.bannerImageUrl,
                discordUrl: enrichedData.collection.discordUrl,
                telegramUrl: enrichedData.collection.telegramUrl,
                chainIdentifier: enrichedData.collection.chainIdentifier,
                contractAddresses: enrichedData.collection.contractAddresses,
                safelistStatus: enrichedData.collection.safelistStatus,
                fees: enrichedData.collection.fees,
                artBlocksProjectId: enrichedData.collection.artBlocksProjectId,
                fxhashProjectId: enrichedData.collection.fxhashProjectId,
                projectNumber: enrichedData.collection.projectNumber,
                collectionCreator: enrichedData.collection.collectionCreator,
                curatorAddress: enrichedData.collection.curatorAddress,
                parentContract: enrichedData.collection.parentContract,
                totalSupply: enrichedData.collection.totalSupply,
                currentSupply: enrichedData.collection.currentSupply,
                mintStartDate: enrichedData.collection.mintStartDate,
                mintEndDate: enrichedData.collection.mintEndDate,
                floorPrice: enrichedData.collection.floorPrice,
                volumeTraded: enrichedData.collection.volumeTraded,
                externalCollectionId: enrichedData.collection.externalCollectionId,
                isGenerativeArt: enrichedData.collection.isGenerativeArt,
                isSharedContract: enrichedData.collection.isSharedContract
              } : nft.collection,
              attributes: enrichedData.attributes || nft.attributes,
              features: enrichedData.features || nft.features
            };
            
            return result;
          } catch (error) {
            console.warn(`[OptimizedOpenSeaAPI] Failed to enhance NFT ${nft.contractAddress}:${nft.tokenId}:`, error);
            return nft; // Return original if enhancement fails
          }
        })
      );
      
      enhancedNFTs.push(...enhancedBatch);
      
      // Add longer delay between batches to respect rate limits
      if (i + batchSize < nfts.length) {
        const delay = Math.max(1000, this.rateLimiter.getStats().currentDelay);
        console.log(`[OptimizedOpenSeaAPI] Waiting ${delay}ms before next enrichment batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return enhancedNFTs;
  }

  /**
   * Extract unique creator addresses and collection slugs from NFTs
   */
  private extractUniqueIdentifiers(nfts: MinimalNFTData[]): { 
    creatorAddresses: string[]; 
    collectionSlugs: string[] 
  } {
    const creatorAddresses = new Set<string>();
    const collectionSlugs = new Set<string>();

    nfts.forEach(nft => {
      if (nft.creator?.address) {
        creatorAddresses.add(nft.creator.address);
      }
      if (nft.collection?.slug) {
        collectionSlugs.add(nft.collection.slug);
      }
    });

    return {
      creatorAddresses: Array.from(creatorAddresses),
      collectionSlugs: Array.from(collectionSlugs)
    };
  }
} 