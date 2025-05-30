export interface NormalizedNFTData {
  // Add these to existing interface
  dimensions?: {
    width?: number;
    height?: number;
    display?: {
      width: number;
      height: number;
      mime: string;
      size: number;
    };
    artifact?: {
      width: number;
      height: number;
      mime: string;
      size: number;
    };
    thumbnail?: {
      width: number;
      height: number;
      mime: string;
      size: number;
    };
    resized?: {
      social?: { width: number; height: number };
      thumb288?: { width: number; height: number };
      thumb400?: { width: number; height: number };
    };
  };
  fxhash?: {
    projectId?: string;
    iteration?: number;
  };
  platformSpecific?: {
    objkt?: {
      artistVerified?: boolean;
    };
    fxhash?: {
      generativeToken?: boolean;
    };
  };
}

export interface TezosToken {
  token_id: string;
  name?: string;
  description?: string;
  display_uri?: string;
  artifact_uri?: string;
  thumbnail_uri?: string;
  mime?: string;
  symbol?: string;
  supply?: string;
  timestamp?: string;
  metadata?: string;
  fa?: {
    contract: string;
    name?: string;
    description?: string;
    logo?: string;
    metadata?: any;
  };
  creators?: Array<{
    holder?: {
      address: string;
      alias?: string;
      logo?: string;
      description?: string;
    };
    creator_address?: string;
  }>;
  attributes?: Array<{
    attribute: {
      name: string;
      id?: number;
    };
    value: string|number;
  }>;
  dimensions?: {
    display?: {
      mime: string;
      size: number;
      dimensions: {
        width: number;
        height: number;
      };
    };
    artifact?: {
      mime: string;
      size: number;
      dimensions: {
        width: number;
        height: number;
      };
    };
    thumbnail?: {
      mime: string;
      size: number;
      dimensions: {
        width: number;
        height: number;
      };
    };
    resized?: {
      social?: {
        width: number;
        height: number;
      };
      thumb288?: {
        width: number;
        height: number;
      };
      thumb400?: {
        width: number;
        height: number;
      };
    };
  };
  // Add fxhash-specific fields
  creator?: {
    id: string;
    name?: string;
    avatarUri?: string;
  };
} 