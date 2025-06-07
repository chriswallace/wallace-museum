import type { IndexerData } from './unified-indexer';
import { fetchCreatorInfo, fetchCollection, fetchEnhancedNFTData } from '../openseaHelpers.js';
import { detectMintDateFromOpenSeaEvents } from './mintDateHelpers.js';
import { fetchMintDateFromEtherscan } from '../etherscanHelpers.js';
import { IntelligentRateLimiter } from '../intelligent-rate-limiter';

interface EnhancedNFTData {
  mint_date?: string;
  creator?: string;
  metadata_url?: string;
  attributes?: Array<{ trait_type: string; value: any }>;
  [key: string]: any;
}

interface CreatorInfo {
  username?: string;
  display_name?: string;
  bio?: string;
  description?: string;
  website_url?: string;
  profile_url?: string;
  profile_image_url?: string;
  ens_name?: string;
  is_verified?: boolean;
  social_media_accounts?: Array<{
    platform: string;
    username: string;
  }>;
  [key: string]: any;
}

/**
 * Enriches Ethereum NFT data with additional information from OpenSea API
 * This includes mint date from blockchain events, creator details, and collection metadata
 */
export class EthereumNFTEnricher {
  private apiKey: string;
  private rateLimiter: IntelligentRateLimiter;
  private creatorCache: Map<string, any> = new Map();
  private collectionCache: Map<string, any> = new Map();

  constructor(apiKey: string, rateLimiter?: IntelligentRateLimiter) {
    this.apiKey = apiKey;
    // Use provided rate limiter or create a new one with reasonable settings for ~1 req/sec
    this.rateLimiter = rateLimiter || new IntelligentRateLimiter({
      baseDelay: 1000,     // 1 second between calls
      maxDelay: 10000,     // Max 10 seconds (reduced from 30s)
      backoffMultiplier: 1.5, // Gentler backoff (reduced from 2.5)
      maxRetries: 5,
      batchSize: 5,
      adaptiveThreshold: 3 // Less sensitive adjustments (increased from 2)
    });
  }

  /**
   * Enrich NFT data with additional information
   */
  async enrichNFTData(
    basicNFTData: IndexerData,
    contractAddress: string,
    tokenId: string
  ): Promise<IndexerData> {
    const enrichedData = { ...basicNFTData };

    try {
      // Skip enrichment if we already have the essential data
      const hasCompleteCreatorData = enrichedData.creator?.address && 
                                    enrichedData.creator.username && 
                                    enrichedData.creator.profileUrl;
      
      const hasCompleteCollectionData = enrichedData.collection?.slug && 
                                       enrichedData.collection.description && 
                                       enrichedData.collection.imageUrl;
      
      if (enrichedData.mintDate && hasCompleteCreatorData && hasCompleteCollectionData) {
        console.log(`[EthereumNFTEnricher] Skipping enrichment for ${contractAddress}:${tokenId} - already complete`);
        return enrichedData;
      }

      // Fetch enhanced NFT data which includes mint date and additional metadata
      if (!enrichedData.mintDate || !hasCompleteCreatorData) {
        const enhancedResult = await this.rateLimiter.executeCall(
          () => fetchEnhancedNFTData(contractAddress, tokenId, this.apiKey),
          `Enhanced NFT data for ${contractAddress}:${tokenId}`
        );
        
        if (enhancedResult.success && enhancedResult.data) {
          const enhancedData = enhancedResult.data as EnhancedNFTData;
          
          // Update mint date if found
          if (enhancedData.mint_date && !enrichedData.mintDate) {
            enrichedData.mintDate = enhancedData.mint_date;
          }

          // Update creator if more complete data is available
          if (enhancedData.creator && (!enrichedData.creator || !enrichedData.creator.username)) {
            const creatorInfo = await this.enrichCreatorData(enhancedData.creator);
            if (creatorInfo && creatorInfo.address) {
              enrichedData.creator = creatorInfo as IndexerData['creator'];
            }
          }

          // Merge any additional metadata
          if (enhancedData.metadata_url && !enrichedData.metadataUrl) {
            enrichedData.metadataUrl = enhancedData.metadata_url;
          }

          if (enhancedData.attributes && (!enrichedData.attributes || enrichedData.attributes.length === 0)) {
            enrichedData.attributes = enhancedData.attributes;
          }
        }
      }

      // Fetch mint date from blockchain events if still missing
      if (!enrichedData.mintDate) {
        console.log(`[EthereumNFTEnricher] Trying enhanced mint date detection for ${contractAddress}:${tokenId}`);
        
        // Strategy 1: Try OpenSea Events API with pagination (most reliable)
        try {
          const openSeaResult = await this.rateLimiter.executeCall(
            () => detectMintDateFromOpenSeaEvents(contractAddress, tokenId, 'ethereum'),
            `OpenSea Events mint date for ${contractAddress}:${tokenId}`
          );
          
          if (openSeaResult.success && openSeaResult.data && openSeaResult.data.mintDate) {
            console.log(`[EthereumNFTEnricher] Found mint date from OpenSea Events: ${openSeaResult.data.mintDate}`);
            
            // Validate the date
            const mintDate = new Date(openSeaResult.data.mintDate);
            const currentDate = new Date();
            
            // Reject future dates
            if (mintDate <= currentDate) {
              enrichedData.mintDate = openSeaResult.data.mintDate;
            } else {
              console.warn(`[EthereumNFTEnricher] Rejecting future mint date: ${openSeaResult.data.mintDate}`);
            }
          }
        } catch (error) {
          console.warn(`[EthereumNFTEnricher] OpenSea Events API failed for ${contractAddress}:${tokenId}:`, error);
        }

        // Strategy 2: Try Etherscan API as fallback (for older NFTs)
        if (!enrichedData.mintDate && process.env.ETHERSCAN_API_KEY) {
          try {
            const etherscanResult = await this.rateLimiter.executeCall(
              () => fetchMintDateFromEtherscan(contractAddress, tokenId, process.env.ETHERSCAN_API_KEY!),
              `Etherscan mint date for ${contractAddress}:${tokenId}`
            );
            
            if (etherscanResult.success && etherscanResult.data) {
              console.log(`[EthereumNFTEnricher] Found mint date from Etherscan: ${etherscanResult.data}`);
              
              // Validate the date
              const mintDate = new Date(etherscanResult.data);
              const currentDate = new Date();
              
              // Reject future dates
              if (mintDate <= currentDate) {
                enrichedData.mintDate = etherscanResult.data;
              } else {
                console.warn(`[EthereumNFTEnricher] Rejecting future mint date from Etherscan: ${etherscanResult.data}`);
              }
            }
          } catch (error) {
            console.warn(`[EthereumNFTEnricher] Etherscan API failed for ${contractAddress}:${tokenId}:`, error);
          }
        }
      }

      // Enrich creator data if we have an address but missing details
      if (enrichedData.creator?.address && !hasCompleteCreatorData) {
        const creatorInfo = await this.enrichCreatorData(enrichedData.creator.address);
        if (creatorInfo && creatorInfo.address) {
          enrichedData.creator = { ...enrichedData.creator, ...creatorInfo } as IndexerData['creator'];
        }
      }

      // Enrich collection data if missing or incomplete
      if (enrichedData.collection && !hasCompleteCollectionData) {
        const collectionData = await this.enrichCollectionData(
          enrichedData.collection.slug || contractAddress
        );
        if (collectionData) {
          enrichedData.collection = { ...enrichedData.collection, ...collectionData };
        }
      }

    } catch (error) {
      console.warn(`[EthereumNFTEnricher] Failed to enrich NFT ${contractAddress}:${tokenId}:`, error);
      // Return original data if enrichment fails
    }

    return enrichedData;
  }

  /**
   * Enrich creator data with profile information
   */
  private async enrichCreatorData(creatorAddress: string): Promise<Partial<IndexerData['creator']> | null> {
    // Check cache first
    const cached = this.creatorCache.get(creatorAddress.toLowerCase());
    if (cached) {
      return cached;
    }

    const result = await this.rateLimiter.executeCall(
      () => fetchCreatorInfo(creatorAddress, this.apiKey),
      `Creator info for ${creatorAddress}`
    );
    
    if (!result.success || !result.data) {
      return null;
    }

    const creatorInfo = result.data as CreatorInfo;

    // Extract social links
    const socialLinks: Record<string, string> = {};
    if (creatorInfo.social_media_accounts && Array.isArray(creatorInfo.social_media_accounts)) {
      for (const account of creatorInfo.social_media_accounts) {
        if (account.platform && account.username) {
          socialLinks[account.platform] = account.username;
        }
      }
    }

    const enrichedCreator = {
      address: creatorAddress.toLowerCase(),
      username: creatorInfo.username || creatorInfo.display_name,
      bio: creatorInfo.bio,
      description: creatorInfo.description,
      profileUrl: creatorInfo.website_url || creatorInfo.profile_url,
      avatarUrl: creatorInfo.profile_image_url,
      websiteUrl: creatorInfo.website_url,
      displayName: creatorInfo.display_name,
      ensName: creatorInfo.ens_name,
      isVerified: creatorInfo.is_verified || false,
      twitterHandle: socialLinks.twitter,
      instagramHandle: socialLinks.instagram,
      profileData: creatorInfo,
      resolutionSource: 'opensea',
      socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined
    };

    // Cache the result
    this.creatorCache.set(creatorAddress.toLowerCase(), enrichedCreator);

    return enrichedCreator;
  }

  /**
   * Enrich collection data
   */
  private async enrichCollectionData(
    collectionSlug: string
  ): Promise<Partial<IndexerData['collection']> | null> {
    // Check cache first
    const cached = this.collectionCache.get(collectionSlug);
    if (cached) {
      return cached;
    }

    const result = await this.rateLimiter.executeCall(
      () => fetchCollection(collectionSlug, this.apiKey),
      `Collection info for ${collectionSlug}`
    );
    
    if (!result.success || !result.data) {
      return null;
    }

    const collectionInfo = result.data;

    // Extract contract addresses
    const contractAddresses = collectionInfo.contracts?.map((c: any) => c.address) || [];
    const primaryContract = contractAddresses[0] || collectionInfo.contract;

    const enrichedCollection = {
      slug: collectionInfo.collection || collectionSlug,
      title: collectionInfo.name,
      description: collectionInfo.description,
      contractAddress: primaryContract,
      websiteUrl: collectionInfo.external_url,
      projectUrl: collectionInfo.project_url,
      mediumUrl: collectionInfo.medium_username ? `https://medium.com/@${collectionInfo.medium_username}` : undefined,
      imageUrl: collectionInfo.image_url,
      bannerImageUrl: collectionInfo.banner_image_url,
      discordUrl: collectionInfo.discord_url,
      telegramUrl: collectionInfo.telegram_url,
      contractAddresses,
      safelistStatus: collectionInfo.safelist_request_status,
      fees: collectionInfo.fees,
      totalSupply: collectionInfo.total_supply,
      floorPrice: collectionInfo.floor_price,
      volumeTraded: collectionInfo.total_volume,
      isGenerativeArt: this.detectGenerativeArt(collectionInfo.name),
      isSharedContract: this.isSharedContract(primaryContract)
    };

    // Cache the result
    this.collectionCache.set(collectionSlug, enrichedCollection);

    return enrichedCollection;
  }

  private detectGenerativeArt(collectionName?: string): boolean {
    if (!collectionName) return false;
    const generativeKeywords = ['art blocks', 'fxhash', 'gen.art', 'generative', 'algorithmic'];
    return generativeKeywords.some(keyword => 
      collectionName.toLowerCase().includes(keyword)
    );
  }

  private isSharedContract(contractAddress?: string): boolean {
    if (!contractAddress) return false;
    const sharedContracts = [
      '0x495f947276749ce646f68ac8c248420045cb7b5e', // OpenSea Shared
      '0xa5409ec958c83c3f309868babaca7c86dcb077c1', // OpenSea Collections
      '0x2953399124f0cbb46d2cbacd8a89cf0599974963'  // OpenSea Collections v2
    ];
    return sharedContracts.includes(contractAddress.toLowerCase());
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.creatorCache.clear();
    this.collectionCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      creatorCacheSize: this.creatorCache.size,
      collectionCacheSize: this.collectionCache.size
    };
  }
} 