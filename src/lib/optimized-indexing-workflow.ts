import type { MinimalNFTData } from './types/minimal-nft';
import { OptimizedOpenSeaAPI } from './optimized-opensea-api';
import { OptimizedTezosAPI } from './indexing/tezos-optimized-api';

/**
 * Optimized Indexing Workflow with intelligent rate limiting and smart data fetching
 * Provides comprehensive data indexing with all enhancements
 */

export interface IndexingOptions {
  maxPages?: number;
  pageSize?: number;
  enableCaching?: boolean;
  enrichmentLevel?: 'minimal' | 'standard' | 'comprehensive';
}

export class OptimizedIndexingWorkflow {
  private openSeaAPI: OptimizedOpenSeaAPI;
  private tezosAPI: OptimizedTezosAPI;

  constructor(openSeaApiKey: string) {
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
  }

  /**
   * Index NFTs from a wallet address with comprehensive data fetching
   */
  async indexWalletNFTs(
    walletAddress: string,
    blockchain: 'ethereum' | 'tezos',
    type: 'owned' | 'created' = 'owned',
    options: IndexingOptions = {}
  ): Promise<MinimalNFTData[]> {
    console.log(`[OptimizedIndexingWorkflow] Starting comprehensive indexing for ${walletAddress} on ${blockchain}`);

    if (blockchain === 'ethereum') {
      return this.indexEthereumWallet(walletAddress, type, options);
    } else {
      return this.indexTezosWallet(walletAddress, type, options);
    }
  }

  /**
   * Index Ethereum wallet with comprehensive data fetching
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

    while (hasMore) {
      console.log(`[OptimizedIndexingWorkflow] Fetching Tezos NFTs: offset ${offset}, limit ${limit}`);

      const result = await this.tezosAPI.fetchWalletNFTs(walletAddress, type, limit, offset);
      allNfts.push(...result.nfts);
      hasMore = result.hasMore;
      offset += limit;

      console.log(`[OptimizedIndexingWorkflow] Tezos batch: fetched ${result.nfts.length} NFTs, total so far: ${allNfts.length}, hasMore: ${hasMore}`);

      // Add delay for Tezos API
      if (hasMore) {
        await this.sleep(1000);
      }
    }

    console.log(`[OptimizedIndexingWorkflow] Completed Tezos indexing: ${allNfts.length} total NFTs`);
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