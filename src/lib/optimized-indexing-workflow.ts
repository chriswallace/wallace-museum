import type { MinimalNFTData } from './types/minimal-nft';
import { OptimizedOpenSeaAPI } from './optimized-opensea-api';
import { OptimizedTezosAPI } from './indexing/tezos-optimized-api';
import { EnhancedOpenSeaPagination } from './enhanced-opensea-pagination';
import { AlchemyNFTIndexer, type AlchemyIndexingOptions } from './alchemy-nft-indexer';

/**
 * Optimized Indexing Workflow with intelligent rate limiting and smart data fetching
 * Provides comprehensive data indexing with all enhancements
 */

export interface IndexingOptions {
  maxPages?: number;
  pageSize?: number;
  enableCaching?: boolean;
  enrichmentLevel?: 'minimal' | 'standard' | 'comprehensive';
  provider?: 'opensea' | 'alchemy' | 'hybrid'; // Add hybrid option
  useAlchemyForDiscovery?: boolean; // New option for hybrid approach
  useOpenSeaForEnrichment?: boolean; // New option for hybrid approach
}

export class OptimizedIndexingWorkflow {
  private openSeaAPI: OptimizedOpenSeaAPI;
  private tezosAPI: OptimizedTezosAPI;
  private enhancedPagination: EnhancedOpenSeaPagination;
  private alchemyIndexer?: AlchemyNFTIndexer;

  constructor(openSeaApiKey: string, alchemyApiKey?: string) {
    // Configure rate limiter for approximately 1 request per second with less aggressive backoff
    const rateLimiterConfig = {
      baseDelay: 1000,     // Start with 1 second between calls (maintains ~1 req/sec)
      maxDelay: 10000,     // Max 10 seconds (much less aggressive than 60s)
      backoffMultiplier: 1.5, // Gentler backoff (reduced from 3.0)
      maxRetries: 5,       // Reasonable retry count (reduced from 10)
      batchSize: 5,        // Slightly larger batches for efficiency (increased from 3)
      adaptiveThreshold: 3 // Less sensitive to rate limit adjustments (increased from 2)
    };

    this.openSeaAPI = new OptimizedOpenSeaAPI(openSeaApiKey, rateLimiterConfig);
    this.tezosAPI = new OptimizedTezosAPI();
    this.enhancedPagination = new EnhancedOpenSeaPagination(this.openSeaAPI);
    
    // Initialize Alchemy indexer if API key is provided
    if (alchemyApiKey) {
      this.alchemyIndexer = new AlchemyNFTIndexer(alchemyApiKey);
    }
  }

  /**
   * Index NFTs from a wallet address with comprehensive data fetching
   * Now defaults to hybrid approach: Alchemy for discovery + OpenSea for enrichment
   */
  async indexWalletNFTs(
    walletAddress: string,
    blockchain: 'ethereum' | 'tezos',
    type: 'owned' | 'created' = 'owned',
    options: IndexingOptions & { expectedNFTCount?: number; useEnhancedPagination?: boolean } = {}
  ): Promise<MinimalNFTData[]> {
    console.log(`[OptimizedIndexingWorkflow] Starting comprehensive indexing for ${walletAddress} on ${blockchain}`);

    if (blockchain === 'ethereum') {
      // Default to hybrid approach for maximum reliability and data richness
      const provider = options.provider || 'hybrid';
      
      if (provider === 'hybrid' && this.alchemyIndexer) {
        console.log(`[OptimizedIndexingWorkflow] Using hybrid approach: Alchemy for discovery + OpenSea for enrichment`);
        return this.indexEthereumWalletHybrid(walletAddress, options);
      } else if (provider === 'alchemy' && this.alchemyIndexer) {
        console.log(`[OptimizedIndexingWorkflow] Using Alchemy indexer for reliable data coverage`);
        return this.indexEthereumWalletWithAlchemy(walletAddress, options);
      } else if (provider === 'hybrid' && !this.alchemyIndexer) {
        console.warn(`[OptimizedIndexingWorkflow] Hybrid provider requested but no Alchemy API key provided, falling back to enhanced OpenSea`);
        options.provider = 'opensea';
      } else if (provider === 'alchemy' && !this.alchemyIndexer) {
        console.warn(`[OptimizedIndexingWorkflow] Alchemy provider requested but no API key provided, falling back to OpenSea`);
      }
      
      // OpenSea indexing (legacy and enhanced)
      const useEnhanced = options.useEnhancedPagination !== false; // Default to true
      
      if (useEnhanced) {
        console.log(`[OptimizedIndexingWorkflow] Using enhanced OpenSea pagination for better NFT coverage`);
        return this.indexEthereumWalletEnhanced(walletAddress, type, options);
      } else {
        console.log(`[OptimizedIndexingWorkflow] Using legacy OpenSea pagination (may miss NFTs due to API limits)`);
        return this.indexEthereumWallet(walletAddress, type, options);
      }
    } else {
      return this.indexTezosWallet(walletAddress, type, options);
    }
  }

  /**
   * Index Ethereum wallet with enhanced pagination that works around OpenSea API limitations
   */
  async indexEthereumWalletEnhanced(
    walletAddress: string,
    type: 'owned' | 'created',
    options: IndexingOptions & { expectedNFTCount?: number } = {}
  ): Promise<MinimalNFTData[]> {
    const pageSize = options.pageSize || 50;
    const maxPages = options.maxPages || 500; // Increased default
    const expectedNFTCount = options.expectedNFTCount;
    const enrichmentLevel = options.enrichmentLevel || 'standard';
    
    // Determine enrichment strategy
    let enrichmentStrategy: any;
    switch (enrichmentLevel) {
      case 'minimal':
        enrichmentStrategy = {
          fetchEnhancedData: false,
          fetchCreatorData: false,
          fetchCollectionData: false,
          batchCreators: false,
          batchCollections: false
        };
        break;
      case 'standard':
        enrichmentStrategy = {
          fetchEnhancedData: false,
          fetchCreatorData: true,
          fetchCollectionData: true,
          batchCreators: true,
          batchCollections: true
        };
        break;
      case 'comprehensive':
        enrichmentStrategy = {
          fetchEnhancedData: true,
          fetchCreatorData: true,
          fetchCollectionData: true,
          batchCreators: true,
          batchCollections: true
        };
        break;
    }

    console.log(`[OptimizedIndexingWorkflow] Using enhanced pagination for ${walletAddress} with ${enrichmentLevel} enrichment`);
    
    const result = await this.enhancedPagination.fetchAllWalletNFTs(walletAddress, {
      pageSize,
      maxPages,
      expectedNFTCount,
      enrichmentStrategy
    });

    console.log(`[OptimizedIndexingWorkflow] Enhanced pagination completed:`);
    console.log(`- Total NFTs: ${result.totalFetched}`);
    console.log(`- Pages processed: ${result.pagesProcessed}`);
    console.log(`- Strategies used: ${result.strategiesUsed.join(', ')}`);
    
    if (result.warnings.length > 0) {
      console.log(`- Warnings: ${result.warnings.join('; ')}`);
    }

    return result.nfts;
  }

  /**
   * Index Ethereum wallet with comprehensive data fetching (legacy method)
   */
  private async indexEthereumWallet(
    walletAddress: string,
    type: 'owned' | 'created',
    options: IndexingOptions
  ): Promise<MinimalNFTData[]> {
    const allNfts: MinimalNFTData[] = [];
    let nextCursor: string | undefined = undefined;
    let pageCount = 0;
    const maxPages = options.maxPages || 200;
    const pageSize = options.pageSize || 50;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 50;

    // Determine enrichment strategy based on options
    const enrichmentLevel = options.enrichmentLevel || 'standard';
    let enrichmentStrategy: any;
    
    switch (enrichmentLevel) {
      case 'minimal':
        // Only fetch basic NFT data, no enrichment
        enrichmentStrategy = {
          fetchEnhancedData: false,
          fetchCreatorData: false,
          fetchCollectionData: false,
          batchCreators: false,
          batchCollections: false
        };
        break;
      case 'standard':
        // Fetch creator and collection data but not enhanced NFT data
        enrichmentStrategy = {
          fetchEnhancedData: false,
          fetchCreatorData: true,
          fetchCollectionData: true,
          batchCreators: true,
          batchCollections: true
        };
        break;
      case 'comprehensive':
        // Fetch all available data
        enrichmentStrategy = {
          fetchEnhancedData: true,
          fetchCreatorData: true,
          fetchCollectionData: true,
          batchCreators: true,
          batchCollections: true
        };
        break;
    }

    console.log(`[OptimizedIndexingWorkflow] Using ${enrichmentLevel} enrichment strategy`);

    do {
      console.log(`[OptimizedIndexingWorkflow] Fetching page ${pageCount + 1} for wallet ${walletAddress}${nextCursor ? ` (cursor: ${nextCursor.substring(0, 20)}...)` : ''}`);

      try {
        const result = await this.openSeaAPI.fetchNFTsByAddress(
          walletAddress,
          pageSize,
          nextCursor,
          enrichmentStrategy
        );

        // Check if we got a successful result
        if (result.nfts && result.nfts.length > 0) {
          console.log(`[OptimizedIndexingWorkflow] Page ${pageCount + 1}: fetched ${result.nfts.length} NFTs, nextCursor: ${result.nextCursor ? 'present' : 'null'}`);

          allNfts.push(...result.nfts);
          nextCursor = result.nextCursor;
          pageCount++;
          consecutiveFailures = 0; // Reset failure counter on success

          // Log progress and stats
          const stats = this.openSeaAPI.getStats();
          console.log(`[OptimizedIndexingWorkflow] Progress: ${allNfts.length} total NFTs, Rate limiter stats:`, stats.rateLimiter);

          // Add intelligent delay between pages
          if (nextCursor && pageCount < maxPages) {
            const pageDelay = this.calculatePageDelay(stats.rateLimiter.currentDelay);
            if (pageDelay > 0) {
              console.log(`[OptimizedIndexingWorkflow] Waiting ${pageDelay}ms before next page...`);
              await this.sleep(pageDelay);
            }
          } else if (!nextCursor) {
            console.log(`[OptimizedIndexingWorkflow] No more pages available (nextCursor is null)`);
            break; // Exit the loop - we've reached the end
          }

        } else {
          // Empty result - could be rate limited or end of data
          console.log(`[OptimizedIndexingWorkflow] Page ${pageCount + 1}: received empty result`);
          
          if (!result.nextCursor) {
            console.log(`[OptimizedIndexingWorkflow] No nextCursor in empty result - assuming end of data`);
            break; // No more data available
          } else {
            // Empty result but there's a nextCursor - this might be a rate limit issue
            console.log(`[OptimizedIndexingWorkflow] Empty result but nextCursor present - treating as rate limit`);
            throw new Error('Empty result with nextCursor - likely rate limited');
          }
        }

      } catch (error) {
        consecutiveFailures++;
        console.error(`[OptimizedIndexingWorkflow] Error on page ${pageCount + 1} (failure ${consecutiveFailures}/${maxConsecutiveFailures}):`, error);
        
        // Check if we've hit too many consecutive failures
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.error(`[OptimizedIndexingWorkflow] Too many consecutive failures (${consecutiveFailures}), stopping pagination`);
          break;
        }

        // For rate limit errors, wait longer and retry the same page
        if (this.isRateLimitError(error)) {
          // Exponential backoff based on consecutive failures - more conservative
          const backoffDelay = Math.min(5000 * Math.pow(2, consecutiveFailures - 1), 60000); // Increased from 2000 to 5000, max 60s
          console.log(`[OptimizedIndexingWorkflow] Rate limited, waiting ${backoffDelay}ms before retry ${consecutiveFailures}/${maxConsecutiveFailures}...`);
          await this.sleep(backoffDelay);
          // Don't increment pageCount or change nextCursor - retry the same page
          continue;
        } else {
          // For other errors, wait a bit and try to continue
          console.log(`[OptimizedIndexingWorkflow] Non-rate-limit error, waiting 10000ms before continuing...`); // Increased from 5000 to 10000
          await this.sleep(10000);
          // Try to continue with the next page
          pageCount++;
          continue;
        }
      }

    } while ((nextCursor || consecutiveFailures > 0) && pageCount < maxPages);

    console.log(`[OptimizedIndexingWorkflow] Completed comprehensive indexing for wallet ${walletAddress}: ${allNfts.length} total NFTs across ${pageCount} pages (${consecutiveFailures} final consecutive failures)`);

    // Final stats
    const finalStats = this.openSeaAPI.getStats();
    console.log(`[OptimizedIndexingWorkflow] Final stats:`, finalStats);

    return allNfts;
  }

  /**
   * Index Ethereum wallet using Alchemy API for reliable data coverage
   */
  async indexEthereumWalletWithAlchemy(
    walletAddress: string,
    options: IndexingOptions = {}
  ): Promise<MinimalNFTData[]> {
    if (!this.alchemyIndexer) {
      throw new Error('Alchemy indexer not initialized - API key required');
    }

    const alchemyOptions: AlchemyIndexingOptions = {
      includeMetadata: true,
      includeSpam: false,
      pageSize: options.pageSize || 100, // Alchemy supports up to 100 per page
      maxPages: options.maxPages || 1000,
      enrichmentLevel: options.enrichmentLevel || 'standard'
    };

    console.log(`[OptimizedIndexingWorkflow] Starting Alchemy indexing for ${walletAddress}`);
    console.log(`[OptimizedIndexingWorkflow] Options:`, alchemyOptions);

    try {
      const nfts = await this.alchemyIndexer.getWalletNFTs(walletAddress, alchemyOptions);
      
      // Set the owner address for each NFT since Alchemy doesn't include it
      const nftsWithOwner = nfts.map(nft => ({
        ...nft,
        owners: [{ address: walletAddress, quantity: 1 }]
      }));

      console.log(`[OptimizedIndexingWorkflow] Alchemy indexing completed: ${nftsWithOwner.length} NFTs`);
      
      // Get indexer stats for logging
      const stats = this.alchemyIndexer.getStats();
      console.log(`[OptimizedIndexingWorkflow] Alchemy indexer stats:`, stats);

      return nftsWithOwner;

    } catch (error) {
      console.error(`[OptimizedIndexingWorkflow] Error during Alchemy indexing:`, error);
      throw error;
    }
  }

  /**
   * Hybrid indexing: Use Alchemy for discovery + OpenSea for enrichment
   * This provides the best of both worlds: complete NFT coverage + rich metadata
   */
  async indexEthereumWalletHybrid(
    walletAddress: string,
    options: IndexingOptions = {}
  ): Promise<MinimalNFTData[]> {
    if (!this.alchemyIndexer) {
      throw new Error('Alchemy indexer not initialized - API key required for hybrid approach');
    }

    console.log(`[OptimizedIndexingWorkflow] Starting hybrid indexing for ${walletAddress}`);
    console.log(`[OptimizedIndexingWorkflow] Phase 1: Alchemy discovery`);

    // Phase 1: Use Alchemy to discover all NFTs (100% reliable)
    const alchemyOptions: AlchemyIndexingOptions = {
      includeMetadata: true,
      includeSpam: false,
      pageSize: options.pageSize || 100,
      maxPages: options.maxPages || 1000,
      enrichmentLevel: 'minimal' // Get basic data from Alchemy
    };

    const alchemyNFTs = await this.alchemyIndexer.getWalletNFTs(walletAddress, alchemyOptions);
    console.log(`[OptimizedIndexingWorkflow] Phase 1 complete: Discovered ${alchemyNFTs.length} NFTs via Alchemy`);

    if (alchemyNFTs.length === 0) {
      console.log(`[OptimizedIndexingWorkflow] No NFTs found via Alchemy, returning empty result`);
      return [];
    }

    // Phase 2: Use OpenSea to enrich the discovered NFTs
    console.log(`[OptimizedIndexingWorkflow] Phase 2: OpenSea enrichment for ${alchemyNFTs.length} NFTs`);
    
    const enrichmentLevel = options.enrichmentLevel || 'comprehensive';
    const enrichedNFTs: MinimalNFTData[] = [];
    
    // Process NFTs in batches to avoid overwhelming OpenSea API
    const batchSize = 5; // Conservative batch size for enrichment
    
    for (let i = 0; i < alchemyNFTs.length; i += batchSize) {
      const batch = alchemyNFTs.slice(i, i + batchSize);
      console.log(`[OptimizedIndexingWorkflow] Enriching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(alchemyNFTs.length / batchSize)} (${batch.length} NFTs)`);
      
      const batchPromises = batch.map(async (nft) => {
                          try {
           // For now, just use Alchemy data with enhanced dimensions
           // TODO: Implement proper OpenSea enrichment integration
           const mergedNFT: MinimalNFTData = {
             ...nft, // Start with Alchemy data as base
             // Enhanced dimension handling
             dimensions: await this.extractBestDimensions(nft)
           };
           
           console.log(`[OptimizedIndexingWorkflow] Successfully processed ${nft.contractAddress}:${nft.tokenId}`);
           return mergedNFT;
         } catch (error) {
           console.warn(`[OptimizedIndexingWorkflow] Error processing ${nft.contractAddress}:${nft.tokenId}:`, error);
           // Fallback to original Alchemy data
           return nft;
         }
      });
      
      const enrichedBatch = await Promise.all(batchPromises);
      enrichedNFTs.push(...enrichedBatch);
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < alchemyNFTs.length) {
        const delay = 2000; // 2 second delay between enrichment batches
        console.log(`[OptimizedIndexingWorkflow] Waiting ${delay}ms before next enrichment batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log(`[OptimizedIndexingWorkflow] Hybrid indexing completed:`);
    console.log(`- Discovery: ${alchemyNFTs.length} NFTs found via Alchemy`);
    console.log(`- Enrichment: ${enrichedNFTs.length} NFTs processed via OpenSea`);
    
    // Get final stats
    const alchemyStats = this.alchemyIndexer.getStats();
    const openSeaStats = this.openSeaAPI.getStats();
    console.log(`[OptimizedIndexingWorkflow] Alchemy stats:`, alchemyStats);
    console.log(`[OptimizedIndexingWorkflow] OpenSea stats:`, openSeaStats);

    return enrichedNFTs;
  }

  /**
   * Extract the best available dimensions from multiple sources
   */
  private async extractBestDimensions(
    nft: MinimalNFTData
  ): Promise<{ width: number; height: number } | undefined> {
    // Priority 1: Use existing dimensions if available
    if (nft.dimensions && nft.dimensions.width > 0 && nft.dimensions.height > 0) {
      console.log(`[OptimizedIndexingWorkflow] Using existing dimensions for ${nft.contractAddress}:${nft.tokenId}: ${nft.dimensions.width}x${nft.dimensions.height}`);
      return nft.dimensions;
    }
    
    // Priority 2: Try to extract from image URL if available
    const imageUrl = nft.imageUrl || nft.animationUrl;
    if (imageUrl) {
      try {
        console.log(`[OptimizedIndexingWorkflow] Attempting to extract dimensions from image URL for ${nft.contractAddress}:${nft.tokenId}`);
        // Use enhanced field processor to get dimensions from the actual image
        const { EnhancedFieldProcessor } = await import('./enhanced-field-processor');
        const fieldProcessor = new EnhancedFieldProcessor();
        const dimensions = await fieldProcessor.extractDimensions(imageUrl);
        if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
          console.log(`[OptimizedIndexingWorkflow] Extracted dimensions from image for ${nft.contractAddress}:${nft.tokenId}: ${dimensions.width}x${dimensions.height}`);
          return dimensions;
        }
      } catch (error) {
        console.warn(`[OptimizedIndexingWorkflow] Failed to extract dimensions from image for ${nft.contractAddress}:${nft.tokenId}:`, error);
      }
    }
    
    console.log(`[OptimizedIndexingWorkflow] No dimensions available for ${nft.contractAddress}:${nft.tokenId}`);
    return undefined;
  }

  /**
   * Index Tezos wallet with comprehensive data fetching
   */
  private async indexTezosWallet(
    walletAddress: string,
    type: 'owned' | 'created',
    options: IndexingOptions
  ): Promise<MinimalNFTData[]> {
    const allNfts: MinimalNFTData[] = [];
    let offset = 0;
    const limit = options.pageSize || 500;
    let hasMore = true;
    let pageCount = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 10; // Allow up to 10 consecutive failures for Tezos

    while (hasMore) { // Removed maxPages limit - run until no more data
      console.log(`[OptimizedIndexingWorkflow] Fetching Tezos NFTs page ${pageCount + 1}: offset ${offset}, limit ${limit}`);

      try {
        const result = await this.tezosAPI.fetchWalletNFTs(walletAddress, type, limit, offset);
        
        // Check if we got a successful result
        if (result.nfts && result.nfts.length > 0) {
          allNfts.push(...result.nfts);
          hasMore = result.hasMore;
          offset += limit;
          pageCount++;
          consecutiveFailures = 0; // Reset failure counter on success

          console.log(`[OptimizedIndexingWorkflow] Tezos page ${pageCount}: fetched ${result.nfts.length} NFTs, total so far: ${allNfts.length}, hasMore: ${hasMore}`);

          // Add delay for Tezos API
          if (hasMore) {
            await this.sleep(1000);
          }
        } else {
          // Empty result - could be end of data or API issue
          console.log(`[OptimizedIndexingWorkflow] Tezos page ${pageCount + 1}: received empty result`);
          
          if (!result.hasMore) {
            console.log(`[OptimizedIndexingWorkflow] No more Tezos NFTs available (hasMore is false)`);
            break; // No more data available
          } else {
            // Empty result but hasMore is true - this might be an API issue
            console.log(`[OptimizedIndexingWorkflow] Empty result but hasMore is true - treating as API error`);
            throw new Error('Empty result with hasMore true - likely API issue');
          }
        }

      } catch (error) {
        consecutiveFailures++;
        console.error(`[OptimizedIndexingWorkflow] Tezos error on page ${pageCount + 1} (failure ${consecutiveFailures}/${maxConsecutiveFailures}):`, error);
        
        // Check if we've hit too many consecutive failures
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.error(`[OptimizedIndexingWorkflow] Too many consecutive Tezos failures (${consecutiveFailures}), stopping pagination`);
          break;
        }

        // For Tezos API errors, wait and retry
        const backoffDelay = Math.min(2000 * Math.pow(1.5, consecutiveFailures - 1), 30000); // More conservative backoff for Tezos
        console.log(`[OptimizedIndexingWorkflow] Tezos API error, waiting ${backoffDelay}ms before retry ${consecutiveFailures}/${maxConsecutiveFailures}...`);
        await this.sleep(backoffDelay);
        
        // Don't increment pageCount or offset - retry the same page
        continue;
      }
    }

    console.log(`[OptimizedIndexingWorkflow] Completed Tezos indexing: ${allNfts.length} total NFTs across ${pageCount} pages (${consecutiveFailures} final consecutive failures)`);
    return allNfts;
  }

  /**
   * Calculate delay between pages based on current rate limiter state
   */
  private calculatePageDelay(currentDelay: number): number {
    // More conservative delay for page requests to avoid rate limits
    // Minimum 3 seconds between requests, with 50% buffer on current delay
    return Math.max(3000, currentDelay * 1.5); // Increased from 2000ms to 3000ms for better rate limit handling
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    if (error?.status === 429) return true;
    if (error?.message?.includes('429')) return true;
    if (error?.message?.toLowerCase().includes('rate limit')) return true;
    if (error?.message?.toLowerCase().includes('too many requests')) return true;
    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get comprehensive stats from all APIs
   */
  getStats() {
    return {
      openSea: this.openSeaAPI.getStats(),
      // Add Tezos stats if needed
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.openSeaAPI.clearCache();
  }

  /**
   * Get single NFT data with optimized fetching
   */
  async getNFTData(
    contractAddress: string,
    tokenId: string,
    blockchain: 'ethereum' | 'tezos'
  ): Promise<MinimalNFTData | null> {
    if (blockchain === 'ethereum') {
      // Use the optimized API for single NFT fetching
      // This would need to be implemented in OptimizedOpenSeaAPI
      console.log(`[OptimizedIndexingWorkflow] Single NFT fetch not yet implemented for optimized API`);
      return null;
    } else {
      return this.tezosAPI.fetchTokenDetails(contractAddress, tokenId);
    }
  }
} 