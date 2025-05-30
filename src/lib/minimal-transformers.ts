import type { 
  MinimalNFTData, 
  MinimalOpenSeaNFT, 
  MinimalTezosToken,
  MinimalCollectionData,
  MinimalCreatorData 
} from './types/minimal-nft';
import { fetchCreatorInfo } from './openseaHelpers.js';
import { WRAPPED_TEZOS_CONTRACT } from './constants/tezos';

/**
 * Minimal data transformer - only extracts fields we actually store in the database
 * Eliminates over-fetching and unnecessary data processing
 */
export class MinimalNFTTransformer {
  
  /**
   * Transform OpenSea NFT data to minimal format
   */
  async transformOpenSeaNFT(nft: any): Promise<MinimalNFTData> {
    // Validate required fields
    if (!nft.contract || !nft.identifier) {
      throw new Error('Missing required fields: contract and identifier');
    }
    
    const contractAddress = nft.contract;
    const tokenId = nft.identifier;
    const title = nft.name;
    const description = nft.description || undefined;
    
    // Enhanced image URL extraction with fallbacks
    let imageUrl = nft.image_url || nft.display_image_url;
    let thumbnailUrl = nft.display_image_url || nft.image_url;
    let animationUrl = nft.display_animation_url || nft.animation_url;
    
    // Ensure thumbnail is different from main image
    if (thumbnailUrl === imageUrl) {
      thumbnailUrl = undefined;
    }
    
    // Enhanced dimensions extraction
    let dimensions: { width: number; height: number } | undefined;
    if (nft.image_details?.width && nft.image_details?.height) {
      dimensions = {
        width: nft.image_details.width,
        height: nft.image_details.height
      };
    } else if (nft.animation_details?.width && nft.animation_details?.height) {
      dimensions = {
        width: nft.animation_details.width,
        height: nft.animation_details.height
      };
    }
    
    // Enhanced attributes extraction
    const attributes = nft.traits?.map((trait: any) => ({
      trait_type: trait.trait_type,
      value: trait.value
    })) || [];
    
    // Enhanced features extraction
    const features = nft.features || nft.metadata?.features || undefined;
    
    // Enhanced creator extraction
    let creator: MinimalNFTData['creator'] = undefined;
    if (nft.creator) {
      creator = {
        address: nft.creator,
        username: nft.creator_username,
        bio: nft.creator_bio,
        description: nft.creator_bio, // Use bio as description fallback
        profileUrl: nft.creator_profile_url,
        avatarUrl: nft.creator_avatar_url,
        websiteUrl: nft.creator_website_url,
        displayName: nft.creator_display_name,
        ensName: nft.creator_ens_name,
        isVerified: nft.creator_is_verified || false,
        twitterHandle: nft.creator_social_links?.twitter,
        instagramHandle: nft.creator_social_links?.instagram,
        profileData: nft.creator_profile_data,
        resolutionSource: 'opensea',
        socialLinks: nft.creator_social_links
      };
    }
    
    // Enhanced generator URL detection for generative art
    let generatorUrl: string | undefined;
    if (this.detectGenerativeArt(nft.collection?.name || (typeof nft.collection === 'string' ? nft.collection : ''))) {
      // Check for generator URLs in various fields
      generatorUrl = nft.generator_url || nft.generatorUrl || nft.generator_uri || nft.generatorUri;
      
      // For Art Blocks, the generator might be in animation_url
      if (!generatorUrl && contractAddress && this.isArtBlocksContract(contractAddress)) {
        generatorUrl = animationUrl; // Art Blocks uses animation_url for generators
      }
      
      // For fxhash, check for generator URLs
      if (!generatorUrl && nft.metadata?.generatorUri) {
        generatorUrl = nft.metadata.generatorUri;
      }
    }
    
    const metadataUrl = nft.metadata_url || nft.metadataUrl;
    
    // Fix #2: Ensure token standard is captured for Ethereum NFTs
    const tokenStandard = nft.token_standard || nft.tokenStandard || 'ERC721'; // Default to ERC721 if not provided
    
    // Enhanced mint date extraction with comprehensive priority order
    let mintDate: string | undefined;
    
    // Priority order for mint date (most accurate to least accurate):
    // 1. mint_date (from enhanced data or blockchain events API)
    // 2. mintDate (alternative field name)
    // 3. created_date (creation timestamp from OpenSea)
    // 4. created_at (alternative creation timestamp)
    // 5. minted_at (another possible field)
    // Note: We intentionally exclude updated_at as it's not the mint date
    if (nft.mint_date) {
      mintDate = nft.mint_date;
    } else if (nft.mintDate) {
      mintDate = nft.mintDate;
    } else if (nft.created_date) {
      mintDate = nft.created_date;
    } else if (nft.created_at) {
      mintDate = nft.created_at;
    } else if (nft.minted_at) {
      mintDate = nft.minted_at;
    }
    
    // Validate and normalize mint date
    if (mintDate) {
      try {
        const parsedDate = new Date(mintDate);
        if (isNaN(parsedDate.getTime())) {
          console.warn(`[MinimalNFTTransformer] Invalid mint date for ${contractAddress}:${tokenId}: ${mintDate}`);
          mintDate = undefined;
        } else {
          // Ensure we have a valid ISO string
          mintDate = parsedDate.toISOString();
        }
      } catch (error) {
        console.warn(`[MinimalNFTTransformer] Failed to parse mint date for ${contractAddress}:${tokenId}: ${mintDate}`, error);
        mintDate = undefined;
      }
    }
    
    const supply = nft.supply || (nft.owners && nft.owners.length > 0 ? nft.owners[0].quantity : 1);
    const symbol = nft.symbol || nft.collection?.symbol;
    const mime = nft.mime || nft.metadata?.mime;
    
    // Fix #3: Enhanced collection data
    const collection = {
      slug: nft.collection?.slug || nft.collection?.name || (typeof nft.collection === 'string' ? nft.collection : contractAddress),
      title: nft.collection?.name || nft.collection_name || (typeof nft.collection === 'string' ? nft.collection : 'Unknown Collection'),
      description: nft.collection?.description || nft.collection_description,
      contractAddress,
      websiteUrl: nft.collection?.website_url || nft.collection_website_url,
      projectUrl: nft.collection?.project_url || nft.collection_project_url,
      mediumUrl: nft.collection?.medium_url || nft.collection_medium_url,
      imageUrl: nft.collection?.image_url || nft.collection_image_url,
      bannerImageUrl: nft.collection?.banner_image_url || nft.collection_banner_image_url,
      discordUrl: nft.collection?.discord_url || nft.collection_discord_url,
      telegramUrl: nft.collection?.telegram_url || nft.collection_telegram_url,
      chainIdentifier: nft.collection?.chain_identifier || nft.collection_chain_identifier,
      contractAddresses: nft.collection?.contract_addresses || nft.collection_contract_addresses,
      safelistStatus: nft.collection?.safelist_status || nft.collection_safelist_status,
      fees: nft.collection?.fees || nft.collection_fees,
      artBlocksProjectId: nft.collection?.art_blocks_project_id || nft.collection_art_blocks_project_id,
      fxhashProjectId: nft.collection?.fxhash_project_id || nft.collection_fxhash_project_id,
      projectNumber: nft.collection?.project_number || nft.collection_project_number,
      collectionCreator: nft.collection?.collection_creator || nft.collection_collection_creator,
      curatorAddress: nft.collection?.curator_address || nft.collection_curator_address,
      parentContract: nft.collection?.parent_contract || nft.collection_parent_contract,
      totalSupply: nft.collection?.total_supply || nft.collection_total_supply,
      currentSupply: nft.collection?.current_supply || nft.collection_current_supply,
      mintStartDate: nft.collection?.mint_start_date || nft.collection_mint_start_date,
      mintEndDate: nft.collection?.mint_end_date || nft.collection_mint_end_date,
      floorPrice: nft.collection?.floor_price || nft.collection_floor_price,
      volumeTraded: nft.collection?.volume_traded || nft.collection_volume_traded,
      externalCollectionId: nft.collection?.external_collection_id || nft.collection_external_collection_id,
      isGenerativeArt: this.detectGenerativeArt(nft.collection?.name || (typeof nft.collection === 'string' ? nft.collection : '')),
      isSharedContract: this.isSharedContract(contractAddress, 'ethereum')
    };
    
    return {
      contractAddress,
      tokenId,
      blockchain: 'ethereum',
      title,
      description,
      mintDate: mintDate ? mintDate.toString() : undefined,
      imageUrl,
      thumbnailUrl,
      animationUrl,
      generatorUrl,
      metadataUrl,
      tokenStandard,
      mime,
      symbol,
      supply,
      attributes,
      features,
      creator,
      collection
    };
  }
  
  /**
   * Transform Tezos token data to minimal format
   */
  transformTezosToken(token: any): MinimalNFTData {
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
          // Ensure we have a valid ISO string
          mintDate = parsedDate.toISOString();
        }
      } catch (error) {
        console.warn(`[MinimalNFTTransformer] Failed to parse timestamp for Tezos token ${contractAddress}:${tokenId}: ${actualToken.timestamp}`, error);
        mintDate = undefined;
      }
    }
    
    // Enhanced image URL extraction with proper prioritization for Tezos
    let imageUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    let animationUrl: string | undefined;
    
    // For Tezos, prioritize display_uri for main image, artifact_uri for animation
    imageUrl = actualToken.display_uri || actualToken.artifact_uri;
    
    // Use thumbnail_uri if available and different from main image
    if (actualToken.thumbnail_uri && actualToken.thumbnail_uri !== imageUrl) {
      thumbnailUrl = actualToken.thumbnail_uri;
    }
    
    // Check if thumbnail is the generic circle image from Tezos
    const GENERIC_CIRCLE_IPFS = 'ipfs://QmNrhZHUaEqxhyLfqoq1mtHSipkWHeT31LNHb1QEbDHgnc';
    if (thumbnailUrl === GENERIC_CIRCLE_IPFS) {
      console.log(`[transformTezosToken] Detected generic circle thumbnail for token ${tokenId}, will generate from display/artifact image`);
      thumbnailUrl = undefined; // Clear it so we can generate a proper thumbnail
    }
    
    // If no valid thumbnail, try to use display_uri or artifact_uri as fallback
    if (!thumbnailUrl) {
      // Prefer display_uri for thumbnails, fallback to artifact_uri if needed
      const fallbackUrl = actualToken.display_uri || actualToken.artifact_uri;
      if (fallbackUrl && fallbackUrl !== imageUrl) {
        // Only use as thumbnail if it's different from the main image
        thumbnailUrl = fallbackUrl;
        console.log(`[transformTezosToken] Using ${fallbackUrl === actualToken.display_uri ? 'display_uri' : 'artifact_uri'} as thumbnail for token ${tokenId}`);
      }
    }
    
    // Use artifact_uri for animation if it's different from display_uri
    if (actualToken.artifact_uri && actualToken.artifact_uri !== actualToken.display_uri) {
      animationUrl = actualToken.artifact_uri;
    }
    
    // Enhanced generator URL detection for Tezos generative art
    let generatorUrl: string | undefined;
    
    // Check if this is a generative art piece
    const isGenerative = this.detectGenerativeArt(actualToken.fa?.name || '');
    if (isGenerative) {
      // For fxhash and other Tezos generative platforms
      if (actualToken.generator_uri) {
        generatorUrl = actualToken.generator_uri;
      } else if (actualToken.metadata) {
        try {
          const metadata = typeof actualToken.metadata === 'string' 
            ? JSON.parse(actualToken.metadata) 
            : actualToken.metadata;
          
          generatorUrl = metadata.generatorUri || metadata.generator_uri || metadata.generator_url;
          
          // For fxhash, the generator might be in the artifact_uri
          if (!generatorUrl && contractAddress.startsWith('KT1') && actualToken.artifact_uri) {
            // Check if artifact_uri looks like a generator URL
            if (actualToken.artifact_uri.includes('generator') || 
                actualToken.artifact_uri.includes('fxhash') ||
                actualToken.artifact_uri.includes('html')) {
              generatorUrl = actualToken.artifact_uri;
            }
          }
        } catch (error) {
          console.warn(`[MinimalNFTTransformer] Failed to parse metadata for generator URL: ${error}`);
        }
      }
    }
    
    // Enhanced metadata URL extraction
    let metadataUrl: string | undefined;
    if (actualToken.metadata) {
      if (typeof actualToken.metadata === 'string' && actualToken.metadata.startsWith('ipfs://')) {
        metadataUrl = actualToken.metadata;
      } else if (actualToken.metadata_url) {
        metadataUrl = actualToken.metadata_url;
      }
    }
    
    // Enhanced dimensions extraction from Tezos data
    let dimensions: { width: number; height: number } | undefined;
    if (actualToken.dimensions?.display?.dimensions) {
      dimensions = {
        width: actualToken.dimensions.display.dimensions.width,
        height: actualToken.dimensions.display.dimensions.height
      };
    } else if (actualToken.dimensions?.artifact?.dimensions) {
      dimensions = {
        width: actualToken.dimensions.artifact.dimensions.width,
        height: actualToken.dimensions.artifact.dimensions.height
      };
    }
    
    // Enhanced attributes extraction
    const attributes = actualToken.attributes?.map((attr: any) => ({
      trait_type: attr.attribute?.name || attr.name || attr.trait_type,
      value: attr.value || attr.attribute?.value
    })) || [];
    
    // Enhanced features extraction from metadata
    let features: Record<string, any> | undefined;
    if (actualToken.metadata) {
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
      isGenerativeArt: isGenerative,
      isSharedContract: false // Tezos doesn't have shared contracts like OpenSea
    };
    
    const tokenStandard = 'FA2'; // Tezos standard
    const mime = actualToken.mime;
    const symbol = actualToken.symbol || actualToken.fa?.symbol;
    const supply = actualToken.supply ? parseInt(actualToken.supply.toString()) : 1;
    
    return {
      contractAddress,
      tokenId,
      blockchain: 'tezos',
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
} 