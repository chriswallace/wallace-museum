import type { 
  UnifiedNFTData, 
  RawOpenSeaNFT, 
  RawTezosNFT, 
  Blockchain 
} from './types/simplified-import';

/**
 * Simplified transformer that converts raw API data to our unified structure
 * No complex filtering or transformations - just direct mapping
 */
export class SimplifiedTransformer {
  
  /**
   * Transform OpenSea NFT data to unified structure
   */
  transformOpenSeaNFT(raw: RawOpenSeaNFT): UnifiedNFTData {
    return {
      // Core identification
      contractAddress: raw.contract.toLowerCase(),
      tokenId: raw.identifier,
      blockchain: 'ethereum' as Blockchain,
      
      // Artwork data
      title: raw.name,
      description: raw.description,
      imageUrl: this.selectBestImageUrl(raw.display_image_url, raw.image_url),
      thumbnailUrl: raw.image_url,
      animationUrl: raw.animation_url,
      tokenStandard: raw.token_standard,
      metadataUrl: raw.metadata_url,
      attributes: this.transformAttributes(raw.traits),
      
      // Creator data
      creator: raw.creator ? {
        address: raw.creator.toLowerCase(),
        username: raw.creator_username,
        profileUrl: raw.creator_profile_url,
        avatarUrl: raw.creator_avatar_url,
        bio: raw.creator_bio,
      } : undefined,
      
      // Collection data
      collection: {
        slug: raw.collection,
        title: raw.collection_name || raw.collection,
        description: raw.collection_description,
        contractAddress: raw.contract.toLowerCase(),
        enabled: true,
        imageUrl: raw.collection_image_url,
        websiteUrl: raw.collection_website_url,
        discordUrl: raw.collection_discord_url,
        isGenerativeArt: false, // Default, can be enhanced later
        isSharedContract: false, // Default, can be enhanced later
      }
    };
  }
  
  /**
   * Transform Tezos NFT data to unified structure
   */
  transformTezosNFT(raw: RawTezosNFT): UnifiedNFTData {
    // Extract creator from creators array
    const creator = raw.creators?.[0];
    const creatorAddress = creator?.creator_address || creator?.holder?.address;
    const creatorInfo = creator?.holder;
    
    return {
      // Core identification
      contractAddress: raw.fa?.contract || '',
      tokenId: raw.token_id,
      blockchain: 'tezos' as Blockchain,
      
      // Artwork data
      title: raw.name,
      description: raw.description,
      imageUrl: this.selectBestImageUrl(raw.display_uri, raw.artifact_uri, raw.thumbnail_uri),
      thumbnailUrl: raw.thumbnail_uri,
      animationUrl: this.selectAnimationUrl(raw.artifact_uri, raw.display_uri),
      mime: raw.mime,
      symbol: raw.symbol,
      tokenStandard: 'FA2', // Default for Tezos
      supply: raw.supply,
      metadataUrl: typeof raw.metadata === 'string' ? raw.metadata : undefined,
      attributes: this.transformAttributes(raw.attributes),
      dimensions: raw.dimensions,
      mintDate: raw.timestamp ? new Date(raw.timestamp) : undefined,
      
      // Creator data
      creator: creatorAddress ? {
        address: creatorAddress,
        username: creatorInfo?.alias,
        avatarUrl: creatorInfo?.logo,
        bio: creatorInfo?.description,
        websiteUrl: creatorInfo?.website,
        twitterHandle: creatorInfo?.twitter,
        instagramHandle: creatorInfo?.instagram,
      } : undefined,
      
      // Collection data
      collection: raw.fa ? {
        slug: raw.fa.contract,
        title: raw.fa.name || raw.fa.contract,
        description: raw.fa.description,
        contractAddress: raw.fa.contract,
        enabled: true,
        websiteUrl: raw.fa.website,
        isGenerativeArt: false, // Default, can be enhanced later
        isSharedContract: false, // Default, can be enhanced later
      } : undefined
    };
  }
  
  /**
   * Select the best image URL from available options
   */
  private selectBestImageUrl(...urls: (string | undefined)[]): string | undefined {
    for (const url of urls) {
      if (url && this.isValidImageUrl(url)) {
        return url;
      }
    }
    return undefined;
  }
  
  /**
   * Select animation URL if it's different from image URL and is a valid media type
   */
  private selectAnimationUrl(...urls: (string | undefined)[]): string | undefined {
    for (const url of urls) {
      if (url && this.isValidAnimationUrl(url)) {
        return url;
      }
    }
    return undefined;
  }
  
  /**
   * Check if URL is a valid image URL
   */
  private isValidImageUrl(url: string): boolean {
    if (!url) return false;
    
    // Handle IPFS URLs
    if (url.startsWith('ipfs://')) return true;
    
    // Handle data URIs
    if (url.startsWith('data:image/')) return true;
    
    // Handle HTTP URLs
    if (url.startsWith('http')) {
      const lowerUrl = url.toLowerCase();
      return lowerUrl.includes('.jpg') || 
             lowerUrl.includes('.jpeg') || 
             lowerUrl.includes('.png') || 
             lowerUrl.includes('.gif') || 
             lowerUrl.includes('.webp') || 
             lowerUrl.includes('.svg');
    }
    
    return false;
  }
  
  /**
   * Check if URL is a valid animation/media URL
   */
  private isValidAnimationUrl(url: string): boolean {
    if (!url) return false;
    
    // Handle IPFS URLs - always allow these as they may be valid media
    if (url.startsWith('ipfs://') || url.includes('/ipfs/')) return true;
    
    // Handle data URIs for video/audio
    if (url.startsWith('data:video/') || url.startsWith('data:audio/')) return true;
    
    // Handle HTTP URLs
    if (url.startsWith('http')) {
      const lowerUrl = url.toLowerCase();
      return lowerUrl.includes('.mp4') || 
             lowerUrl.includes('.webm') || 
             lowerUrl.includes('.mov') || 
             lowerUrl.includes('.avi') || 
             lowerUrl.includes('.mp3') || 
             lowerUrl.includes('.wav') || 
             lowerUrl.includes('.html') || // For interactive content
             lowerUrl.includes('generator') || // For generative art
             lowerUrl.includes('interactive') ||
             lowerUrl.includes('animation') ||
             lowerUrl.includes('video') ||
             lowerUrl.includes('gif') ||
             // URLs with dynamic content indicators
             url.includes('?') || url.includes('#');
    }
    
    return false;
  }
  
  /**
   * Transform attributes to our standard format
   */
  private transformAttributes(attributes?: Array<{ trait_type: string; value: string | number }>): Record<string, any> | undefined {
    if (!attributes || !Array.isArray(attributes)) return undefined;
    
    const result: Record<string, any> = {};
    for (const attr of attributes) {
      if (attr.trait_type && attr.value !== undefined) {
        result[attr.trait_type] = attr.value;
      }
    }
    
    return Object.keys(result).length > 0 ? result : undefined;
  }
} 