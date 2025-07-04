// Minimal NFT data types - only fields we actually store in the database

export interface MinimalNFTData {
  // Core identification
  contractAddress: string;
  tokenId: string;
  blockchain: 'ethereum' | 'base' | 'shape' | 'polygon' | 'tezos';
  
  // Basic metadata (for Artwork table)
  title: string;
  description?: string;
  mintDate?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  animationUrl?: string;
  generatorUrl?: string;  // Generator URI for generative artworks
  mime?: string;
  dimensions?: { width: number; height: number };
  symbol?: string;
  tokenStandard?: string;
  supply?: number;
  metadataUrl?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  features?: Record<string, any>;
  
  // Creator information (for CreatorAddress table)
  creator?: {
    address: string;
    username?: string;
    bio?: string;
    description?: string;
    profileUrl?: string;
    avatarUrl?: string;
    websiteUrl?: string;
    displayName?: string;
    ensName?: string;
    isVerified?: boolean;
    twitterHandle?: string;
    instagramHandle?: string;
    profileData?: Record<string, any>;
    resolutionSource?: string;
    socialLinks?: Record<string, string>;
  };
  
  // Collection information (for Collection table)
  collection?: {
    slug: string;
    title: string;
    description?: string;
    contractAddress: string;
    websiteUrl?: string;
    projectUrl?: string;
    mediumUrl?: string;
    imageUrl?: string;
    bannerImageUrl?: string;
    discordUrl?: string;
    telegramUrl?: string;
    chainIdentifier?: string;
    contractAddresses?: string[];
    safelistStatus?: string;
    fees?: Record<string, any>;
    artBlocksProjectId?: number;
    fxhashProjectId?: number;
    projectNumber?: number;
    collectionCreator?: string;
    curatorAddress?: string;
    parentContract?: string;
    totalSupply?: number;
    currentSupply?: number;
    mintStartDate?: string;
    mintEndDate?: string;
    floorPrice?: number;
    volumeTraded?: number;
    externalCollectionId?: string;
    isGenerativeArt?: boolean;
    isSharedContract?: boolean;
  };
}

// Minimal API response types - only extract what we need
export interface MinimalOpenSeaNFT {
  identifier: string;
  collection: string;
  contract: string;
  token_standard: string;
  name: string;
  description?: string;
  image_url?: string;
  display_image_url?: string;
  animation_url?: string;
  metadata_url?: string;
  creator?: string;
  traits?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface MinimalTezosToken {
  token_id: string;
  name?: string;
  description?: string;
  artifact_uri?: string;
  display_uri?: string;
  thumbnail_uri?: string;
  mime?: string;
  symbol?: string;
  supply?: number;
  metadata?: string;
  fa?: {
    contract: string;
    name?: string;
    description?: string;
    website?: string;
  };
  galleries?: Array<{
    gallery: {
      gallery_id: string;
      logo?: string;
      name: string;
      slug: string;
      pk: number;
      registry: {
        type: string;
        name: string;
        slug: string;
        __typename: string;
      };
      __typename: string;
    };
    __typename: string;
  }>;
  creators?: Array<{
    creator_address?: string;
    holder?: {
      address: string;
      alias?: string;
      logo?: string;
      description?: string;
      website?: string;
      twitter?: string;
      instagram?: string;
    };
  }>;
  dimensions?: {
    display?: {
      dimensions?: { width: number; height: number };
    };
  };
}

// Minimal collection data
export interface MinimalCollectionData {
  slug: string;
  title: string;
  description?: string;
  contractAddress: string;
  blockchain: string;
  websiteUrl?: string;
  discordUrl?: string;
  telegramUrl?: string;
  imageUrl?: string;
  isGenerativeArt?: boolean;
  isSharedContract?: boolean;
  projectNumber?: number;
}

// Minimal artist/creator data
export interface MinimalCreatorData {
  address: string;
  blockchain: string;
  username?: string;
  profileUrl?: string;
  avatarUrl?: string;
  bio?: string;
  socialLinks?: Record<string, string>;
} 