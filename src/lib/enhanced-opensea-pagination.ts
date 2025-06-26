import { OptimizedOpenSeaAPI } from './optimized-opensea-api';
import type { MinimalNFTData } from './types/minimal-nft';

interface PaginationStrategy {
  name: string;
  maxRetries: number;
  backoffMs: number;
  expectedMinimumNFTs?: number; // If we expect more NFTs than this, keep trying
}

interface PaginationResult {
  nfts: MinimalNFTData[];
  totalFetched: number;
  pagesProcessed: number;
  strategiesUsed: string[];
  warnings: string[];
}

export class EnhancedOpenSeaPagination {
  private openSeaAPI: OptimizedOpenSeaAPI;
  
  constructor(openSeaAPI: OptimizedOpenSeaAPI) {
    this.openSeaAPI = openSeaAPI;
  }

  /**
   * Fetch all NFTs from a wallet using multiple strategies to work around OpenSea API limitations
   */
  async fetchAllWalletNFTs(
    walletAddress: string,
    options: {
      pageSize?: number;
      maxPages?: number;
      expectedNFTCount?: number;
      enrichmentStrategy?: any;
    } = {}
  ): Promise<PaginationResult> {
    const pageSize = options.pageSize || 50;
    const maxPages = options.maxPages || 500; // Increased default
    const expectedNFTCount = options.expectedNFTCount;
    const enrichmentStrategy = options.enrichmentStrategy || {};
    
    console.log(`[EnhancedOpenSeaPagination] Starting comprehensive pagination for ${walletAddress}`);
    console.log(`[EnhancedOpenSeaPagination] Expected NFTs: ${expectedNFTCount || 'unknown'}, Page size: ${pageSize}, Max pages: ${maxPages}`);
    
    const allNFTs: MinimalNFTData[] = [];
    const strategiesUsed: string[] = [];
    const warnings: string[] = [];
    let pagesProcessed = 0;
    
    // Strategy 1: Standard cursor-based pagination (but don't trust early null cursors)
    console.log(`[EnhancedOpenSeaPagination] Strategy 1: Enhanced cursor-based pagination`);
    const strategy1Result = await this.enhancedCursorPagination(
      walletAddress, 
      pageSize, 
      maxPages, 
      enrichmentStrategy,
      expectedNFTCount
    );
    
    allNFTs.push(...strategy1Result.nfts);
    pagesProcessed += strategy1Result.pagesProcessed;
    strategiesUsed.push('enhanced-cursor');
    
    if (strategy1Result.warnings.length > 0) {
      warnings.push(...strategy1Result.warnings);
    }
    
    console.log(`[EnhancedOpenSeaPagination] Strategy 1 completed: ${strategy1Result.nfts.length} NFTs fetched`);
    
    // Strategy 2: If we didn't get expected count, try alternative approaches
    if (expectedNFTCount && allNFTs.length < expectedNFTCount * 0.8) { // If we got less than 80% of expected
      console.log(`[EnhancedOpenSeaPagination] Strategy 2: Alternative pagination (got ${allNFTs.length}/${expectedNFTCount} expected)`);
      
      // Try with different page sizes
      const strategy2Result = await this.alternativePageSizePagination(
        walletAddress,
        expectedNFTCount,
        enrichmentStrategy,
        allNFTs.length
      );
      
      // Merge results, avoiding duplicates
      const newNFTs = this.deduplicateNFTs([...allNFTs, ...strategy2Result.nfts]);
      const addedCount = newNFTs.length - allNFTs.length;
      
      if (addedCount > 0) {
        allNFTs.splice(0, allNFTs.length, ...newNFTs);
        pagesProcessed += strategy2Result.pagesProcessed;
        strategiesUsed.push('alternative-page-size');
        console.log(`[EnhancedOpenSeaPagination] Strategy 2 added ${addedCount} new NFTs`);
      }
    }
    
    // Strategy 3: If still missing NFTs, try time-based pagination (if available)
    if (expectedNFTCount && allNFTs.length < expectedNFTCount * 0.9) {
      console.log(`[EnhancedOpenSeaPagination] Strategy 3: Time-based fallback pagination`);
      warnings.push(`Still missing NFTs after standard pagination: ${allNFTs.length}/${expectedNFTCount}`);
      
      // This would require implementing time-based queries if OpenSea supports them
      // For now, just log the discrepancy
      strategiesUsed.push('time-based-attempted');
    }
    
    const finalNFTs = this.deduplicateNFTs(allNFTs);
    
    console.log(`[EnhancedOpenSeaPagination] Final result: ${finalNFTs.length} unique NFTs using strategies: ${strategiesUsed.join(', ')}`);
    
    return {
      nfts: finalNFTs,
      totalFetched: finalNFTs.length,
      pagesProcessed,
      strategiesUsed,
      warnings
    };
  }

  /**
   * Enhanced cursor-based pagination that doesn't trust early null cursors
   */
  private async enhancedCursorPagination(
    walletAddress: string,
    pageSize: number,
    maxPages: number,
    enrichmentStrategy: any,
    expectedNFTCount?: number
  ): Promise<{ nfts: MinimalNFTData[]; pagesProcessed: number; warnings: string[] }> {
    const nfts: MinimalNFTData[] = [];
    const warnings: string[] = [];
    let nextCursor: string | undefined = undefined;
    let pageCount = 0;
    let consecutiveEmptyPages = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 10;
    const maxConsecutiveEmptyPages = 3;
    
    while (pageCount < maxPages) {
      pageCount++;
      console.log(`[EnhancedCursorPagination] Page ${pageCount}/${maxPages}${nextCursor ? ` (cursor: ${nextCursor.substring(0, 20)}...)` : ''}`);
      
      try {
        const result = await this.openSeaAPI.fetchNFTsByAddress(
          walletAddress,
          pageSize,
          nextCursor,
          enrichmentStrategy
        );
        
        if (result.nfts && result.nfts.length > 0) {
          nfts.push(...result.nfts);
          nextCursor = result.nextCursor;
          consecutiveEmptyPages = 0;
          consecutiveFailures = 0;
          
          console.log(`[EnhancedCursorPagination] Page ${pageCount}: ${result.nfts.length} NFTs, total: ${nfts.length}, nextCursor: ${result.nextCursor ? 'present' : 'null'}`);
          
          // Add delay between pages
          await this.sleep(2000);
          
        } else {
          // Empty page
          consecutiveEmptyPages++;
          console.log(`[EnhancedCursorPagination] Page ${pageCount}: empty result (${consecutiveEmptyPages}/${maxConsecutiveEmptyPages} consecutive)`);
          
          if (!result.nextCursor) {
            // OpenSea says no more data, but let's be skeptical
            if (expectedNFTCount && nfts.length < expectedNFTCount * 0.8) {
              warnings.push(`OpenSea returned null cursor early: got ${nfts.length}/${expectedNFTCount} expected NFTs`);
              console.log(`[EnhancedCursorPagination] ⚠️ OpenSea returned null cursor but we expected more NFTs (${nfts.length}/${expectedNFTCount})`);
              
              // Try a few more pages with exponential backoff to see if more data appears
              if (consecutiveEmptyPages < maxConsecutiveEmptyPages) {
                const backoffDelay = 5000 * Math.pow(2, consecutiveEmptyPages - 1);
                console.log(`[EnhancedCursorPagination] Waiting ${backoffDelay}ms before trying next page despite null cursor...`);
                await this.sleep(backoffDelay);
                
                // Continue with nextCursor = undefined to try fetching from beginning again
                nextCursor = undefined;
                continue;
              }
            }
            
            console.log(`[EnhancedCursorPagination] Null cursor received, ending pagination`);
            break;
          } else {
            // Empty result but cursor exists - might be temporary API issue
            nextCursor = result.nextCursor;
            
            if (consecutiveEmptyPages >= maxConsecutiveEmptyPages) {
              console.log(`[EnhancedCursorPagination] Too many consecutive empty pages (${consecutiveEmptyPages}), ending pagination`);
              break;
            }
            
            // Wait longer for empty pages
            await this.sleep(5000);
          }
        }
        
      } catch (error) {
        consecutiveFailures++;
        console.error(`[EnhancedCursorPagination] Error on page ${pageCount} (failure ${consecutiveFailures}/${maxConsecutiveFailures}):`, error);
        
        if (consecutiveFailures >= maxConsecutiveFailures) {
          warnings.push(`Too many consecutive failures (${consecutiveFailures}), stopping pagination`);
          break;
        }
        
        // Exponential backoff for errors
        const backoffDelay = Math.min(5000 * Math.pow(2, consecutiveFailures - 1), 60000);
        console.log(`[EnhancedCursorPagination] Waiting ${backoffDelay}ms before retry...`);
        await this.sleep(backoffDelay);
        
        // Don't increment pageCount for retries
        pageCount--;
        continue;
      }
    }
    
    return { nfts, pagesProcessed: pageCount, warnings };
  }

  /**
   * Try alternative page sizes to work around OpenSea pagination bugs
   */
  private async alternativePageSizePagination(
    walletAddress: string,
    expectedNFTCount: number,
    enrichmentStrategy: any,
    alreadyFetchedCount: number
  ): Promise<{ nfts: MinimalNFTData[]; pagesProcessed: number }> {
    console.log(`[AlternativePageSize] Trying different page sizes to find missing NFTs`);
    
    const nfts: MinimalNFTData[] = [];
    let totalPages = 0;
    
    // Try smaller page sizes - sometimes OpenSea works better with smaller requests
    const pageSizes = [20, 30, 100]; // Different from the standard 50
    
    for (const pageSize of pageSizes) {
      console.log(`[AlternativePageSize] Trying page size: ${pageSize}`);
      
      try {
        const result = await this.enhancedCursorPagination(
          walletAddress,
          pageSize,
          Math.min(50, Math.ceil((expectedNFTCount - alreadyFetchedCount) / pageSize) + 10), // Reasonable limit
          enrichmentStrategy,
          expectedNFTCount
        );
        
        nfts.push(...result.nfts);
        totalPages += result.pagesProcessed;
        
        console.log(`[AlternativePageSize] Page size ${pageSize} yielded ${result.nfts.length} NFTs`);
        
        // If we got significant new data, we can stop trying other page sizes
        if (result.nfts.length > pageSize) {
          break;
        }
        
        // Add delay between different page size attempts
        await this.sleep(3000);
        
      } catch (error) {
        console.error(`[AlternativePageSize] Error with page size ${pageSize}:`, error);
        continue;
      }
    }
    
    return { nfts, pagesProcessed: totalPages };
  }

  /**
   * Remove duplicate NFTs based on contract address and token ID
   */
  private deduplicateNFTs(nfts: MinimalNFTData[]): MinimalNFTData[] {
    const seen = new Set<string>();
    const unique: MinimalNFTData[] = [];
    
    for (const nft of nfts) {
      const key = `${nft.contractAddress}:${nft.tokenId}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(nft);
      }
    }
    
    console.log(`[DeduplicateNFTs] Removed ${nfts.length - unique.length} duplicates, ${unique.length} unique NFTs remaining`);
    return unique;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 