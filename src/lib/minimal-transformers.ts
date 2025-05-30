import type { 
  MinimalNFTData, 
  MinimalOpenSeaNFT, 
  MinimalTezosToken,
  MinimalCollectionData,
  MinimalCreatorData 
} from './types/minimal-nft';
import { fetchCreatorInfo } from './openseaHelpers.js';
import { WRAPPED_TEZOS_CONTRACT, isProblematicThumbnail } from './constants/tezos';
import { detectBlockchainFromContract } from './utils/walletUtils';
import { EnhancedFieldProcessor } from './enhanced-field-processor';

/**
 * Minimal data transformer - only extracts fields we actually store in the database
 * Eliminates over-fetching and unnecessary data processing
 */
export class MinimalNFTTransformer {
  private fieldProcessor: EnhancedFieldProcessor;
  
  constructor() {
    this.fieldProcessor = new EnhancedFieldProcessor();
  }
  
  /**
   * Transform OpenSea NFT data to minimal format with enhanced field processing
   */
  async transformOpenSeaNFT(nft: any): Promise<MinimalNFTData> {
    // Validate required fields
    if (!nft.contract || !nft.identifier) {
      throw new Error('Missing required fields: contract and identifier');
    }
    
    const contractAddress = nft.contract.toLowerCase();
    const tokenId = nft.identifier;
    const blockchain = detectBlockchainFromContract(contractAddress);
    
    // Use enhanced field processor for better field extraction
    const enhancedFields = await this.fieldProcessor.processArtworkFields(nft, blockchain);
    
    // Basic fields
    const title = nft.name || nft.title || 'Untitled';
    const description = nft.description || undefined;
    
    // Enhanced mint date extraction
    let mintDate: string | undefined;
    if (nft.updated_at) {
      try {
        const parsedDate = new Date(nft.updated_at);
        if (!isNaN(parsedDate.getTime())) {
          mintDate = parsedDate.toISOString();
        }
      } catch (error) {
        console.warn(`[MinimalNFTTransformer] Failed to parse mint date for OpenSea NFT ${contractAddress}:${tokenId}: ${nft.updated_at}`, error);
      }
    }
    
    // Use enhanced fields with fallbacks to original data
    const imageUrl = enhancedFields.imageUrl || nft.image_url || nft.display_image_url;
    const animationUrl = enhancedFields.animationUrl || nft.animation_url || nft.display_animation_url;
    const thumbnailUrl = enhancedFields.thumbnailUrl || nft.image_url;
    const metadataUrl = enhancedFields.metadataUrl || nft.metadata_url;
    
    // Enhanced creator extraction
    let creator: MinimalNFTData['creator'] = undefined;
    if (nft.creator || enhancedFields.creator) {
      creator = {
        address: nft.creator || enhancedFields.creator?.address || '',
        username: enhancedFields.creator?.username,
        bio: enhancedFields.creator?.bio,
        description: enhancedFields.creator?.description,
        profileUrl: enhancedFields.creator?.profileUrl,
        avatarUrl: enhancedFields.creator?.avatarUrl,
        websiteUrl: enhancedFields.creator?.websiteUrl,
        displayName: enhancedFields.creator?.displayName,
        ensName: enhancedFields.creator?.ensName,
        isVerified: enhancedFields.creator?.isVerified,
        twitterHandle: enhancedFields.creator?.twitterHandle,
        instagramHandle: enhancedFields.creator?.instagramHandle,
        resolutionSource: 'opensea',
        socialLinks: enhancedFields.creator?.socialLinks
      };
    }
    
    // Enhanced collection extraction
    const collection = {
      slug: nft.collection || contractAddress,
      title: nft.collection_name || 'Unknown Collection',
      description: nft.collection_description,
      contractAddress: contractAddress,
      websiteUrl: nft.collection_website_url,
      imageUrl: nft.collection_image_url,
      isGenerativeArt: nft.collection_is_generative_art || false,
      isSharedContract: nft.collection_is_shared_contract || false
    };
    
    const tokenStandard = nft.token_standard || 'ERC721';
    const mime = enhancedFields.mime || nft.mime;
    const symbol = nft.symbol;
    const supply = enhancedFields.supply || nft.supply || 1;
    const dimensions = enhancedFields.dimensions;
    const attributes = enhancedFields.attributes || this.transformOpenSeaTraits(nft.traits);
    const features = enhancedFields.features;
    
    return {
      contractAddress,
      tokenId,
      blockchain: blockchain as 'ethereum' | 'tezos' | 'polygon',
      title,
      description,
      mintDate,
      imageUrl,
      thumbnailUrl,
      animationUrl,
      generatorUrl: enhancedFields.generatorUrl,
      metadataUrl,
      tokenStandard,
      mime,
      symbol,
      supply,
      dimensions,
      attributes,
      features,
      creator,
      collection
    };
  }
  
  /**
   * Transform Tezos token data to minimal format with enhanced field processing
   */
  async transformTezosToken(token: any): Promise<MinimalNFTData> {
    // Handle nested token structure from objkt API
    const actualToken = token.token || token;
    
    // Validate required fields
    if (!actualToken.fa?.contract || !actualToken.token_id) {
      throw new Error('Missing required fields: fa.contract and token_id');
    }
    
    // Filter out wrapped Tezos tokens - these should never be indexed
    if (actualToken.fa.contract === WRAPPED_TEZOS_CONTRACT) {
      throw new Error(`Attempted to transform wrapped Tezos token from contract ${WRAPPED_TEZOS_CONTRACT} - these should be filtered out before transformation`);
    }
    
    const contractAddress = actualToken.fa.contract;
    const tokenId = actualToken.token_id;
    const blockchain = 'tezos';
    
    // Use enhanced field processor for better field extraction
    const enhancedFields = await this.fieldProcessor.processArtworkFields(actualToken, blockchain);
    
    const title = actualToken.name;
    const description = actualToken.description || undefined;
    
    // Enhanced mint date extraction and validation for Tezos
    let mintDate: string | undefined;
    if (actualToken.timestamp) {
      try {
        const parsedDate = new Date(actualToken.timestamp);
        if (isNaN(parsedDate.getTime())) {
          console.warn(`[MinimalNFTTransformer] Invalid timestamp for Tezos token ${contractAddress}:${tokenId}: ${actualToken.timestamp}`);
          mintDate = undefined;
        } else {
          mintDate = parsedDate.toISOString();
        }
      } catch (error) {
        console.warn(`[MinimalNFTTransformer] Failed to parse timestamp for Tezos token ${contractAddress}:${tokenId}: ${actualToken.timestamp}`, error);
        mintDate = undefined;
      }
    }
    
    // Use enhanced fields with fallbacks to original data
    const imageUrl = enhancedFields.imageUrl || actualToken.display_uri || actualToken.artifact_uri;
    
    // Enhanced thumbnail URL processing with problematic thumbnail detection
    let thumbnailUrl = enhancedFields.thumbnailUrl || actualToken.thumbnail_uri || actualToken.display_uri;
    
    // Check for problematic platform-specific thumbnails (Versum, Hic et Nunc)
    if (isProblematicThumbnail(thumbnailUrl)) {
      console.log(`[MinimalNFTTransformer] Detected problematic thumbnail for Tezos token ${contractAddress}:${tokenId}, using display/artifact image instead`);
      // Use display_uri or artifact_uri as fallback when problematic thumbnail is detected
      thumbnailUrl = actualToken.display_uri || actualToken.artifact_uri;
    }
    
    // Don't store thumbnail URL if it's the same as the main image URL to avoid duplication
    if (thumbnailUrl && imageUrl && thumbnailUrl === imageUrl) {
      console.log(`[MinimalNFTTransformer] Thumbnail URL is same as image URL for Tezos token ${contractAddress}:${tokenId}, storing null to avoid duplication`);
      thumbnailUrl = undefined;
    }
    
    const animationUrl = enhancedFields.animationUrl || actualToken.animation_url;
    const metadataUrl = enhancedFields.metadataUrl || actualToken.metadata_url;
    
    // Enhanced generator URL detection for Tezos
    let generatorUrl: string | undefined;
    if (enhancedFields.generatorUrl) {
      generatorUrl = enhancedFields.generatorUrl;
    } else if (actualToken.artifact_uri && this.isGenerativeArtifact(actualToken.artifact_uri)) {
      generatorUrl = actualToken.artifact_uri;
    }
    
    // Use enhanced dimensions with fallback to Tezos-specific extraction
    const dimensions = enhancedFields.dimensions || this.extractTezosSpecificDimensions(actualToken);
    
    // Enhanced attributes extraction
    const attributes = enhancedFields.attributes || actualToken.attributes?.map((attr: any) => ({
      trait_type: attr.attribute?.name || attr.name || attr.trait_type,
      value: attr.value || attr.attribute?.value
    })) || [];
    
    // Enhanced features extraction from metadata
    let features = enhancedFields.features;
    if (!features && actualToken.metadata) {
      try {
        const metadata = typeof actualToken.metadata === 'string' 
          ? JSON.parse(actualToken.metadata) 
          : actualToken.metadata;
        features = metadata.features || metadata.attributes;
      } catch (error) {
        // Ignore parsing errors for features
      }
    }
    
    // Enhanced creator extraction for Tezos
    let creator: MinimalNFTData['creator'] = undefined;
    if (actualToken.creators && actualToken.creators.length > 0) {
      const creatorData = actualToken.creators[0];
      const holderData = creatorData.holder;
      
      creator = {
        address: creatorData.creator_address || holderData?.address,
        username: holderData?.alias,
        bio: holderData?.description,
        description: holderData?.description,
        profileUrl: holderData?.website,
        avatarUrl: holderData?.logo,
        websiteUrl: holderData?.website,
        displayName: holderData?.alias,
        twitterHandle: holderData?.twitter,
        instagramHandle: holderData?.instagram,
        resolutionSource: 'objkt',
        socialLinks: {
          twitter: holderData?.twitter,
          instagram: holderData?.instagram,
          website: holderData?.website
        }
      };
    }
    
    // Enhanced collection extraction
    const collection = {
      slug: actualToken.fa.contract,
      title: actualToken.fa.name || 'Unknown Collection',
      description: actualToken.fa.description,
      contractAddress: actualToken.fa.contract,
      websiteUrl: actualToken.fa.website,
      imageUrl: actualToken.fa.logo,
      isGenerativeArt: this.isGenerativeCollection(actualToken.fa.contract),
      isSharedContract: false // Tezos doesn't have shared contracts like OpenSea
    };
    
    const tokenStandard = 'FA2'; // Tezos standard
    const mime = enhancedFields.mime || actualToken.mime;
    const symbol = actualToken.symbol || actualToken.fa?.symbol;
    const supply = enhancedFields.supply || (actualToken.supply ? parseInt(actualToken.supply.toString()) : 1);
    
    return {
      contractAddress,
      tokenId,
      blockchain,
      title,
      description,
      mintDate,
      imageUrl,
      thumbnailUrl,
      animationUrl,
      generatorUrl,
      metadataUrl,
      tokenStandard,
      mime,
      symbol,
      supply,
      dimensions,
      attributes,
      features,
      creator,
      collection
    };
  }
  
  /**
   * Transform OpenSea traits to standard attributes format
   */
  private transformOpenSeaTraits(traits: any[]): Array<{ trait_type: string; value: any }> {
    if (!traits || !Array.isArray(traits)) {
      return [];
    }
    
    return traits.map(trait => ({
      trait_type: trait.trait_type || trait.name || 'Unknown',
      value: trait.value
    }));
  }
  
  /**
   * Extract minimal collection data
   */
  extractCollectionData(data: any, blockchain: string): MinimalCollectionData {
    if (blockchain === 'ethereum') {
      // Enhanced OpenSea collection data extraction
      const contractAddress = data.contract || data.contracts?.[0]?.address || '';
      
      return {
        slug: data.collection || data.slug || contractAddress,
        title: data.name || 'Unknown Collection',
        description: data.description,
        contractAddress: contractAddress.toLowerCase(),
        blockchain,
        websiteUrl: data.external_url || data.website_url,
        discordUrl: data.discord_url,
        telegramUrl: data.telegram_url,
        imageUrl: data.image_url || data.banner_image_url || data.logo,
        isGenerativeArt: this.detectGenerativeArt(data.collection || data.name),
        isSharedContract: this.isSharedContract(contractAddress, blockchain),
        projectNumber: data.project_number
      };
    } else {
      // Tezos/objkt
      return {
        slug: data.contract,
        title: data.name || 'Unknown Collection',
        description: data.description,
        contractAddress: data.contract,
        blockchain,
        websiteUrl: data.website,
        discordUrl: undefined,
        telegramUrl: undefined,
        imageUrl: data.logo,
        isGenerativeArt: this.detectGenerativeArt(data.name),
        isSharedContract: this.isSharedContract(data.contract, blockchain),
        projectNumber: undefined
      };
    }
  }
  
  /**
   * Extract minimal creator data
   */
  extractCreatorData(data: any, blockchain: string): MinimalCreatorData {
    if (blockchain === 'ethereum') {
      // Handle OpenSea account data structure
      const socialLinks: Record<string, string> = {};
      
      // Extract social media accounts from OpenSea format
      if (data.social_media_accounts && Array.isArray(data.social_media_accounts)) {
        for (const account of data.social_media_accounts) {
          if (account.platform && account.username) {
            socialLinks[account.platform] = account.username;
          }
        }
      }
      
      // Also check for direct social fields
      if (data.twitter) socialLinks.twitter = data.twitter;
      if (data.instagram) socialLinks.instagram = data.instagram;
      if (data.discord) socialLinks.discord = data.discord;
      
      return {
        address: data.address?.toLowerCase() || '',
        blockchain,
        username: data.username || data.display_name || data.user?.username,
        profileUrl: data.website_url || data.profile_url || data.website || data.user?.website_url,
        avatarUrl: data.profile_image_url || data.avatar_url || data.user?.profile_image_url,
        bio: data.bio || data.description || data.user?.bio,
        socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined
      };
    } else {
      // Tezos/objkt
      return {
        address: data.address,
        blockchain,
        username: data.alias,
        profileUrl: data.website,
        avatarUrl: data.logo,
        bio: data.description,
        socialLinks: this.extractSocialLinks({
          twitter: data.twitter,
          instagram: data.instagram
        })
      };
    }
  }
  
  /**
   * Helper: Extract social links in consistent format
   */
  private extractSocialLinks(social: any): Record<string, string> {
    const links: Record<string, string> = {};
    
    if (social.twitter) links.twitter = social.twitter;
    if (social.instagram) links.instagram = social.instagram;
    if (social.discord) links.discord = social.discord;
    if (social.website) links.website = social.website;
    
    return Object.keys(links).length > 0 ? links : {};
  }
  
  /**
   * Helper: Detect generative art collections
   */
  private detectGenerativeArt(collectionName?: string): boolean {
    if (!collectionName || typeof collectionName !== 'string' || collectionName.trim() === '') return false;
    
    const generativeKeywords = [
      'art blocks', 'artblocks', 'fxhash', 'async art', 'bright moments',
      'generative', 'algorithmic', 'procedural', 'qql', 'fidenza'
    ];
    
    const name = collectionName.toLowerCase();
    return generativeKeywords.some(keyword => name.includes(keyword));
  }
  
  /**
   * Helper: Detect shared contracts
   */
  private isSharedContract(contractAddress?: string, blockchain?: string): boolean {
    if (!contractAddress || !blockchain) return false;
    
    const sharedContracts = {
      ethereum: [
        '0x495f947276749ce646f68ac8c248420045cb7b5e', // OpenSea Shared
        '0xa5409ec958c83c3f309868babaca7c86dcb077c1'  // OpenSea Collections
      ],
      tezos: [
        'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton', // hic et nunc
        'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi'  // fxhash
      ]
    };
    
    const contracts = sharedContracts[blockchain as keyof typeof sharedContracts] || [];
    return contracts.includes(contractAddress.toLowerCase());
  }
  
  /**
   * Generate unique NFT identifier
   */
  generateNftUid(contractAddress: string, tokenId: string): string {
    return `${contractAddress.toLowerCase()}:${tokenId}`;
  }

  /**
   * Guess MIME type from URL extension
   */
  private guessMimeTypeFromUrl(url: string): string | null {
    if (!url) return null;
    const extension = url.split('.').pop()?.toLowerCase();
    if (!extension) return null;

    const commonTypes: Record<string, string> = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      // Videos
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      // Interactive content
      html: 'text/html',
      htm: 'text/html',
      js: 'application/javascript',
      json: 'application/json',
      // Application types for interactive content
      pdf: 'application/pdf',
      zip: 'application/zip',
      wasm: 'application/wasm',
      swf: 'application/x-shockwave-flash',
      unity: 'application/vnd.unity',
      exe: 'application/x-msdownload',
      app: 'application/octet-stream',
      bin: 'application/octet-stream'
    };

    return commonTypes[extension] || null;
  }

  /**
   * Check if URL is from a known interactive/generative art platform
   */
  private isInteractivePlatform(url: string): boolean {
    if (!url) return false;
    
    const interactivePlatforms = [
      'fxhash.xyz',
      'generator.artblocks.io',
      'artblocks.io',
      'async.art',
      'foundation.app',
      'superrare.com',
      'alba.art',
      'gmstudio.art',
      'highlight.xyz',
      'prohibition.art',
      'verse.works',
      'plottables.io',
      'tender.art',
      'objkt.com',
      'hicetnunc.art',
      'teia.art',
      'versum.xyz',
      'kalamint.io',
      'rarible.com',
      'opensea.io',
      'looksrare.org',
      'x2y2.io',
      'blur.io',
      'niftygateway.com',
      'makersplace.com',
      'knownorigin.io',
      'asyncart.com',
      'zora.co',
      'catalog.works'
    ];
    
    return interactivePlatforms.some(platform => url.includes(platform));
  }

  /**
   * Resolve creator address for different contract types
   * Fix #4: Import artist addresses from various sources
   */
  private async resolveCreatorAddress(contractAddress: string, tokenId: string, nft: any): Promise<{
    address: string;
    username?: string;
    profileUrl?: string;
    avatarUrl?: string;
    bio?: string;
    socialLinks?: Record<string, string>;
  } | null> {
    const normalizedContract = contractAddress.toLowerCase();
    
    // Art Blocks contracts
    const artBlocksContracts = [
      '0x059edd72cd353df5106d2b9cc5ab83a52287ac3a', // Art Blocks Curated
      '0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270', // Art Blocks Factory
      '0x99a9b7c1116f9ceeb1652de04d5969cce509b069', // Art Blocks Playground
      '0x0e6a21cf97d6a9d9d8f794d26dfb3e3baa49f3ac'  // Art Blocks Presents Flex
    ];
    
    if (artBlocksContracts.includes(normalizedContract)) {
      try {
        // Try Art Blocks API
        const artBlocksData = await this.fetchArtBlocksCreator(contractAddress, tokenId);
        if (artBlocksData) {
          return {
            address: artBlocksData.address,
            username: artBlocksData.username,
            profileUrl: undefined,
            avatarUrl: undefined,
            bio: undefined,
            socialLinks: {}
          };
        }
      } catch (error) {
        console.warn(`[resolveCreatorAddress] Art Blocks API failed for ${contractAddress}:${tokenId}:`, error);
      }
    }
    
    // fxhash contracts (Tezos)
    const fxhashContracts = [
      'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi', // fxhash v1
      'KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE', // fxhash v2
      'KT1AaaBSo5AE6Eo8fpEN5xhCD4w3kHStafxk', // fxhash gentk v1
      'KT1XCoGnfupWk7Sp8536EfrxcP73LmT68Nyr'  // fxhash gentk v2
    ];
    
    if (fxhashContracts.includes(contractAddress)) {
      try {
        // Try fxhash API
        const fxhashData = await this.fetchFxhashCreator(contractAddress, tokenId);
        if (fxhashData) {
          return {
            address: fxhashData.address,
            username: fxhashData.username,
            profileUrl: undefined,
            avatarUrl: undefined,
            bio: undefined,
            socialLinks: {}
          };
        }
      } catch (error) {
        console.warn(`[resolveCreatorAddress] fxhash API failed for ${contractAddress}:${tokenId}:`, error);
      }
    }
    
    // For shared minting contracts, try to get the original minter
    if (this.isSharedContract(contractAddress, 'ethereum')) {
      try {
        // Try to get minter from OpenSea events or other sources
        const minterData = await this.fetchOriginalMinter(contractAddress, tokenId);
        if (minterData) {
          return {
            address: minterData.address,
            username: undefined,
            profileUrl: undefined,
            avatarUrl: undefined,
            bio: undefined,
            socialLinks: {}
          };
        }
      } catch (error) {
        console.warn(`[resolveCreatorAddress] Minter resolution failed for ${contractAddress}:${tokenId}:`, error);
      }
    }
    
    // Fallback: try to get contract creator/deployer
    try {
      const contractCreator = await this.fetchContractCreator(contractAddress);
      if (contractCreator) {
        return {
          address: contractCreator.address,
          username: undefined,
          profileUrl: undefined,
          avatarUrl: undefined,
          bio: undefined,
          socialLinks: {}
        };
      }
    } catch (error) {
      console.warn(`[resolveCreatorAddress] Contract creator resolution failed for ${contractAddress}:`, error);
    }
    
    return null;
  }

  /**
   * Fetch creator information from Art Blocks API
   */
  private async fetchArtBlocksCreator(contractAddress: string, tokenId: string): Promise<{ address: string; username?: string } | null> {
    try {
      // Art Blocks API endpoint for token details
      const response = await fetch(`https://token.artblocks.io/${contractAddress}/${tokenId}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data.artist_address) {
        return {
          address: data.artist_address,
          username: data.artist_name
        };
      }
    } catch (error) {
      console.warn('[fetchArtBlocksCreator] API call failed:', error);
    }
    return null;
  }

  /**
   * Fetch creator information from fxhash API
   */
  private async fetchFxhashCreator(contractAddress: string, tokenId: string): Promise<{ address: string; username?: string } | null> {
    try {
      // fxhash GraphQL API
      const query = `
        query {
          generativeToken(id: "${contractAddress}_${tokenId}") {
            author {
              id
              name
            }
          }
        }
      `;
      
      const response = await fetch('https://api.fxhash.xyz/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      const author = data?.data?.generativeToken?.author;
      if (author?.id) {
        return {
          address: author.id,
          username: author.name
        };
      }
    } catch (error) {
      console.warn('[fetchFxhashCreator] API call failed:', error);
    }
    return null;
  }

  /**
   * Fetch original minter for shared contracts
   */
  private async fetchOriginalMinter(contractAddress: string, tokenId: string): Promise<{ address: string } | null> {
    // This would require access to blockchain events or specialized APIs
    // For now, return null - this can be enhanced with specific implementations
    return null;
  }

  /**
   * Fetch contract creator/deployer address
   */
  private async fetchContractCreator(contractAddress: string): Promise<{ address: string } | null> {
    // This would require access to blockchain data or specialized APIs
    // For now, return null - this can be enhanced with specific implementations
    return null;
  }

  /**
   * Check if contract is an Art Blocks contract
   */
  private isArtBlocksContract(contractAddress: string): boolean {
    const artBlocksContracts = [
      '0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270', // Art Blocks Curated
      '0x059edd72cd353df5106d2b9cc5ab83a52287ac3a', // Art Blocks Legacy
      '0x99a9b7c1116f9ceeb1652de04d5969cce509b069'  // Art Blocks Factory
    ];
    return artBlocksContracts.includes(contractAddress.toLowerCase());
  }
  
  /**
   * Check if contract is an fxhash contract
   */
  private isFxhashContract(contractAddress?: string): boolean {
    if (!contractAddress) return false;
    return contractAddress.toLowerCase().includes('kt1');
  }

  /**
   * Extract Tezos-specific dimensions from token data
   */
  private extractTezosSpecificDimensions(token: any): { width: number; height: number } | undefined {
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
      // Tezos API format
      if (token.dimensions.display?.dimensions) {
        return {
          width: token.dimensions.display.dimensions.width,
          height: token.dimensions.display.dimensions.height
        };
      }
      if (token.dimensions.artifact?.dimensions) {
        return {
          width: token.dimensions.artifact.dimensions.width,
          height: token.dimensions.artifact.dimensions.height
        };
      }
    }
    return undefined;
  }
  
  /**
   * Check if an artifact URI is likely a generative art piece
   */
  private isGenerativeArtifact(uri: string): boolean {
    return uri.includes('.html') || 
           uri.includes('generator') || 
           uri.includes('fxhash.xyz') ||
           uri.includes('interactive');
  }
  
  /**
   * Check if a collection is known to be generative art
   */
  private isGenerativeCollection(contractAddress: string): boolean {
    const generativeContracts = [
      'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi', // fxhash v1
      'KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE', // fxhash v2
      'KT1AaaBSo5AE6Eo8fpEN5xhCD4w3kHStafxk', // fxhash gentk v1
      'KT1XCoGnfupWk7Sp8536EfrxcP73LmT68Nyr'  // fxhash gentk v2
    ];
    
    return generativeContracts.includes(contractAddress);
  }
} 