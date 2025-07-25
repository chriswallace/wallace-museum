import type { MinimalNFTData } from '../types/minimal-nft';
import type { IndexerData } from './unified-indexer';
import { MinimalNFTTransformer } from '../minimal-transformers';
import { WRAPPED_TEZOS_CONTRACT } from '../constants/tezos';
import {
  FETCH_WALLET_NFTS_QUERY,
  FETCH_CREATED_NFTS_QUERY,
  FETCH_TOKEN_DETAILS_QUERY,
  FETCH_COLLECTION_DETAILS_QUERY,
  buildSearchCondition
} from './tezos-graphql-queries';
import { isFxhashContract } from '../utils';

const GRAPHQL_ENDPOINT = 'https://data.objkt.com/v3/graphql';

/**
 * Optimized Tezos API that uses comprehensive GraphQL queries
 * to fetch all required data in minimal API calls
 */
export class OptimizedTezosAPI {
  private transformer: MinimalNFTTransformer;
  private lastRequestTime = 0;
  private readonly rateLimit = 1000; // 1 second between requests

  constructor() {
    this.transformer = new MinimalNFTTransformer();
  }

  /**
   * Execute GraphQL query with rate limiting
   */
  private async executeQuery<T>(query: string, variables: Record<string, any>): Promise<T> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimit) {
      await this.sleep(this.rateLimit - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`GraphQL error: ${response.status}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  /**
   * Fetch NFTs by wallet address with all required data
   */
  async fetchWalletNFTs(
    walletAddress: string,
    type: 'owned' | 'created' = 'owned',
    limit: number = 500,
    offset: number = 0
  ): Promise<{ nfts: MinimalNFTData[], hasMore: boolean }> {
    const variables = {
      address: walletAddress,
      limit,
      offset
    };

    console.log(`[OptimizedTezosAPI] Fetching ${type} NFTs for ${walletAddress} (limit: ${limit}, offset: ${offset})`);

    try {
      const query = type === 'owned' ? FETCH_WALLET_NFTS_QUERY : FETCH_CREATED_NFTS_QUERY;
      const response = await this.executeQuery<any>(query, variables);
      
      console.log(`[OptimizedTezosAPI] GraphQL response received for ${walletAddress} (${type}):`, {
        hasTokenHolder: !!response.token_holder,
        hasToken: !!response.token,
        tokenHolderLength: response.token_holder?.length || 0,
        tokenLength: response.token?.length || 0
      });
      
      // Extract tokens based on query type
      let tokens: any[] = [];
      if (type === 'owned' && response.token_holder) {
        tokens = response.token_holder.map((th: any) => th.token);
        console.log(`[OptimizedTezosAPI] Extracted ${tokens.length} tokens from token_holder array`);
      } else if (type === 'created' && response.token) {
        tokens = response.token;
        console.log(`[OptimizedTezosAPI] Extracted ${tokens.length} tokens from token array`);
      } else {
        console.warn(`[OptimizedTezosAPI] No tokens found in response for ${type} query:`, Object.keys(response));
      }

      // Filter out wrapped Tezos tokens - these are not real NFTs
      const filteredTokens = tokens.filter(token => {
        const contractAddress = token?.fa?.contract;
        if (contractAddress === WRAPPED_TEZOS_CONTRACT) {
          console.log(`[OptimizedTezosAPI] Filtering out wrapped Tezos token from contract ${contractAddress}`);
          return false;
        }
        return true;
      });

      console.log(`[OptimizedTezosAPI] Filtered ${tokens.length - filteredTokens.length} wrapped Tezos tokens, ${filteredTokens.length} remaining`);

      // Transform tokens to MinimalNFTData - properly await async transformations
      const nfts = await Promise.all(
        filteredTokens.map(token => this.transformer.transformTezosToken(token))
      );

      // More robust hasMore logic:
      // 1. If we got fewer raw tokens than requested, there are no more
      // 2. If we got exactly the limit of raw tokens, there might be more
      // 3. Account for filtering that might reduce the final count
      const hasMore = tokens.length === limit && tokens.length > 0;
      
      console.log(`[OptimizedTezosAPI] Pagination check: requested ${limit}, got ${tokens.length} raw tokens, ${filteredTokens.length} after filtering, ${nfts.length} final NFTs, hasMore: ${hasMore}`);

      return {
        nfts,
        hasMore
      };
      
    } catch (error) {
      console.error(`[OptimizedTezosAPI] Error fetching ${type} NFTs for ${walletAddress}:`, error);
      throw error; // Re-throw to let the workflow handle it
    }
  }

  /**
   * Fetch single token details
   */
  async fetchTokenDetails(
    contractAddress: string,
    tokenId: string
  ): Promise<MinimalNFTData | null> {
    const variables = { contractAddress, tokenId };
    const response = await this.executeQuery<any>(FETCH_TOKEN_DETAILS_QUERY, variables);

    if (!response.token || response.token.length === 0) {
      return null;
    }

    const token = response.token[0];
    
    // Transform to MinimalNFTData with all enriched data
    return await this.transformer.transformTezosToken({
      ...token,
      fa: token.fa
    });
  }

  /**
   * Extract creator information from token data
   */
  private extractCreator(token: any): IndexerData['creator'] | undefined {
    // First try creators array
    if (token.creators && Array.isArray(token.creators) && token.creators.length > 0) {
      const firstCreator = token.creators[0];
      const holder = firstCreator.holder || {};
      
      return {
        address: firstCreator.creator_address || holder.address || '',
        username: holder.alias,
        bio: holder.description,
        profileUrl: holder.website,
        avatarUrl: holder.logo,
        websiteUrl: holder.website,
        twitterHandle: holder.twitter,
        instagramHandle: holder.instagram,
        resolutionSource: 'objkt',
        socialLinks: this.extractSocialLinks(holder)
      };
    }
    
    // Fallback to FA creator
    if (token.fa?.creator_address) {
      const creator = token.fa.creator || {};
      return {
        address: token.fa.creator_address,
        username: creator.alias,
        bio: creator.description,
        profileUrl: creator.website,
        avatarUrl: creator.logo,
        websiteUrl: creator.website,
        twitterHandle: creator.twitter,
        instagramHandle: creator.instagram,
        resolutionSource: 'fa_contract',
        socialLinks: this.extractSocialLinks(creator)
      };
    }
    
    return undefined;
  }

  /**
   * Extract collection information from token data
   * For fxhash contracts, prioritizes the FIRST gallery as the collection (original/official collection)
   * For other contracts, ignores galleries (user-generated content) and uses FA contract information
   */
  private extractCollection(token: any): IndexerData['collection'] | undefined {
    const contractAddress = token.fa?.contract;
    
    const isFxhashContractAddress = contractAddress && isFxhashContract(contractAddress);
    
    // For fxhash contracts, ONLY use the first gallery if available (original/official collection)
    if (isFxhashContractAddress && token.galleries && Array.isArray(token.galleries) && token.galleries.length > 0) {
      const firstGallery = token.galleries[0].gallery;
      
      if (firstGallery) {
        console.log(`[OptimizedTezosAPI] fxhash token - using FIRST gallery for collection: ${firstGallery.name} (${firstGallery.slug})`);
        
        return {
          slug: firstGallery.slug || firstGallery.gallery_id,
          title: firstGallery.name || 'Unknown Collection',
          description: undefined, // Gallery data doesn't typically include description
          contractAddress: contractAddress || '', // Keep the contract address from fa
          websiteUrl: undefined, // Gallery data doesn't typically include website
          imageUrl: firstGallery.logo,
          isGenerativeArt: true, // fxhash is always generative art
          isSharedContract: false, // Tezos doesn't have shared contracts like OpenSea
          // Store gallery-specific information in externalCollectionId
          externalCollectionId: firstGallery.gallery_id
        };
      }
    }
    
    // For non-fxhash contracts, SKIP gallery information entirely (can be user-generated)
    // and go directly to FA contract information
    if (!token.fa) return undefined;

    console.log(`[OptimizedTezosAPI] Using FA contract information for collection: ${token.fa.name} (${token.fa.contract})`);

    return {
      slug: token.fa.contract,
      title: token.fa.name || 'Unknown Collection',
      description: token.fa.description,
      contractAddress: token.fa.contract,
      websiteUrl: token.fa.website,
      imageUrl: token.fa.logo,
      isGenerativeArt: this.detectGenerativeArt(token),
      isSharedContract: false // Tezos doesn't have shared contracts like OpenSea
    };
  }

  /**
   * Extract dimensions from token data
   */
  private extractDimensions(token: any): { width: number; height: number } | undefined {
    if (token.dimensions) {
      // Handle different dimension formats
      if (typeof token.dimensions === 'object' && token.dimensions.width && token.dimensions.height) {
        return token.dimensions;
      }
      if (typeof token.dimensions === 'string' && token.dimensions.includes('x')) {
        const [width, height] = token.dimensions.split('x').map((n: string) => parseInt(n, 10));
        if (!isNaN(width) && !isNaN(height)) {
          return { width, height };
        }
      }
    }
    return undefined;
  }

  /**
   * Extract attributes from token data
   */
  private extractAttributes(token: any): Array<{ trait_type: string; value: any }> {
    const attributes: Array<{ trait_type: string; value: any }> = [];
    
    if (token.attributes && Array.isArray(token.attributes)) {
      token.attributes.forEach((attr: any) => {
        if (attr.attribute?.name) {
          attributes.push({
            trait_type: attr.attribute.name,
            value: attr.value || ''
          });
        }
      });
    }
    
    return attributes;
  }

  /**
   * Extract features from token metadata
   */
  private async extractFeatures(token: any): Promise<Record<string, any> | undefined> {
    if (token.metadata) {
      try {
        // If metadata is a string (IPFS URI), we would need to fetch it
        // For now, return undefined as fetching IPFS is a separate concern
        return undefined;
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Determine if artifact_uri should be included as animation URL
   */
  private shouldIncludeAnimation(token: any): boolean {
    if (!token.artifact_uri) return false;
    
    const mime = token.mime;
    if (mime) {
      if (mime.startsWith('video/') || 
          mime === 'image/gif' ||
          mime === 'text/html' ||
          mime.startsWith('application/')) {
        return true;
      }
    }
    
    // Check URL patterns
    const url = token.artifact_uri.toLowerCase();
    return url.includes('.gif') || 
           url.includes('.mp4') || 
           url.includes('.webm') ||
           url.includes('.html') ||
           url.includes('generator') ||
           url.includes('interactive');
  }

  /**
   * Detect if token is generative art
   */
  private detectGenerativeArt(token: any): boolean {
    const name = token.fa?.name || token.name || '';
    const description = token.fa?.description || token.description || '';
    
    const generativeKeywords = ['fxhash', 'gen.art', 'generative', 'algorithmic', 'code'];
    const combined = `${name} ${description}`.toLowerCase();
    
    return generativeKeywords.some(keyword => combined.includes(keyword));
  }

  /**
   * Extract social links from holder data
   */
  private extractSocialLinks(holder: any): Record<string, string> {
    const links: Record<string, string> = {};
    
    if (holder.twitter) links.twitter = holder.twitter;
    if (holder.instagram) links.instagram = holder.instagram;
    if (holder.website) links.website = holder.website;
    
    return Object.keys(links).length > 0 ? links : {};
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 