import { fileTypeFromBuffer } from 'file-type';
import { fetchWithRetry } from './mediaHelpers';
import { ipfsToHttpUrl } from './mediaUtils';

export interface EnhancedArtworkData {
  // Core identification
  title: string;
  description?: string;
  contractAddress: string;
  tokenId: string;
  blockchain: string;
  tokenStandard: string;
  uid: string;
  
  // Media URLs
  imageUrl?: string;
  thumbnailUrl?: string;
  animationUrl?: string;
  generatorUrl?: string;
  metadataUrl?: string;
  
  // Technical details
  mime?: string;
  dimensions?: { width: number; height: number };
  supply?: number;
  mintDate?: string;
  
  // Metadata
  attributes?: Array<{ trait_type: string; value: any }>;
  features?: Record<string, any>;
  
  // Creator/Artist
  creator?: {
    address: string;
    username?: string;
    bio?: string;
    description?: string;
    avatarUrl?: string;
    profileUrl?: string;
    websiteUrl?: string;
    displayName?: string;
    ensName?: string;
    isVerified?: boolean;
    twitterHandle?: string;
    instagramHandle?: string;
    profileData?: Record<string, any>;
    resolutionSource?: string;
    socialLinks?: {
      twitter?: string;
      instagram?: string;
      discord?: string;
      website?: string;
    };
  };
  
  // Collection
  collection?: {
    slug: string;
    title: string;
    description?: string;
    contractAddress: string;
    websiteUrl?: string;
    imageUrl?: string;
    isGenerativeArt?: boolean;
    isSharedContract?: boolean;
  };
}

export interface MediaAnalysisResult {
  mime?: string;
  dimensions?: { width: number; height: number };
  fileSize?: number;
  isAnimated?: boolean;
  duration?: number;
}

/**
 * Enhanced Field Processor for NFT metadata and media analysis
 * 
 * Key improvements:
 * - Unified IPFS gateway list for consistent reliability across all methods
 * - Enhanced MIME type detection with multiple fallback strategies
 * - Comprehensive dimension extraction from various sources
 * - Re-enabled IPFS metadata processing with multiple gateway support
 * - Platform-specific content type guessing (Art Blocks, fxhash, etc.)
 * - Multiple image format support (PNG, JPEG, GIF, WebP)
 */
export class EnhancedFieldProcessor {
  
  /**
   * Unified list of reliable IPFS gateways
   */
  private static readonly IPFS_GATEWAYS = [
    'https://ipfs.wallacemuseum.com/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/'
  ];
  
  /**
   * Simple IPFS to HTTP conversion for internal use
   */
  private simpleIpfsToHttp(url: string): string {
    if (!url) return url;
    
    if (url.startsWith('ipfs://')) {
      const hash = url.replace('ipfs://', '');
      return `${EnhancedFieldProcessor.IPFS_GATEWAYS[0]}${hash}`;
    }
    
    return url;
  }
  
  /**
   * Enhanced MIME type detection with multiple fallback strategies
   */
  async detectMimeType(url: string, metadata?: any): Promise<string | null> {
    if (!url) return null;
    
    // Strategy 1: Check if mime is already provided in metadata
    if (metadata?.mime) {
      return metadata.mime;
    }
    
    // Strategy 2: Extract MIME from Tezos dimensions data (high priority)
    if (metadata?.dimensions) {
      const tezosMime = this.extractMimeFromTezosDimensions(metadata.dimensions);
      if (tezosMime) {
        return tezosMime;
      }
    }
    
    // Strategy 3: Platform-specific fallbacks (before trying to fetch)
    const platformMime = this.guessMimeFromPlatform(url);
    if (platformMime) {
      return platformMime;
    }
    
    // Strategy 4: Enhanced IPFS MIME detection
    if (url.startsWith('ipfs://') || url.includes('/ipfs/')) {
      const ipfsMime = await this.detectMimeFromIpfs(url);
      if (ipfsMime) {
        return ipfsMime;
      }
    }
    
    // Strategy 5: Try to fetch and analyze the actual file (only for HTTP URLs)
    if (url.startsWith('http')) {
      try {
        const response = await fetchWithRetry(url, 1, 500); // Reduced retries for faster processing
        if (!response.ok) {
          console.warn(`[EnhancedFieldProcessor] Failed to fetch ${url} for mime detection`);
          return null;
        }
        
        // Check Content-Type header first
        const contentType = response.headers.get('content-type');
        if (contentType) {
          const mimeType = contentType.split(';')[0].trim();
          if (this.isValidMimeType(mimeType)) {
            return mimeType;
          }
        }
        
        // For small files, analyze the buffer
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) < 1024 * 1024) { // Only for files < 1MB
          const buffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(buffer);
          const fileType = await fileTypeFromBuffer(uint8Array);
          
          if (fileType?.mime) {
            return fileType.mime;
          }
        }
        
      } catch (error) {
        console.warn(`[EnhancedFieldProcessor] Error analyzing file for mime type: ${error}`);
      }
    }
    
    return null;
  }
  
  /**
   * Extract MIME type from Tezos dimensions data structure
   */
  private extractMimeFromTezosDimensions(dimensionsData: any): string | null {
    if (!dimensionsData || typeof dimensionsData !== 'object') return null;
    
    // Priority 1: Artifact MIME (original/highest quality)
    if (dimensionsData.artifact?.mime) {
      const mime = dimensionsData.artifact.mime;
      if (this.isValidMimeType(mime)) {
        return mime;
      }
    }
    
    // Priority 2: Display MIME (processed version)
    if (dimensionsData.display?.mime) {
      const mime = dimensionsData.display.mime;
      if (this.isValidMimeType(mime)) {
        return mime;
      }
    }
    
    // Priority 3: Thumbnail MIME (fallback)
    if (dimensionsData.thumbnail?.mime) {
      const mime = dimensionsData.thumbnail.mime;
      if (this.isValidMimeType(mime)) {
        return mime;
      }
    }
    
    return null;
  }
  
  /**
   * Enhanced IPFS MIME type detection with multiple fallback strategies
   */
  private async detectMimeFromIpfs(url: string): Promise<string | null> {
    try {
      // Convert IPFS URL to HTTP gateway URL
      const httpUrl = this.simpleIpfsToHttp(url);
      
      const cid = this.extractCidFromUrl(url);
      if (!cid) return null;
      
      for (const gateway of EnhancedFieldProcessor.IPFS_GATEWAYS) {
        try {
          const testUrl = `${gateway}${cid}`;
          const response = await fetchWithRetry(testUrl, 1, 1000);
          
          if (response.ok) {
            // Check Content-Type header first
            const contentType = response.headers.get('content-type');
            if (contentType && contentType !== 'application/octet-stream') {
              const mimeType = contentType.split(';')[0].trim();
              if (this.isValidMimeType(mimeType)) {
                console.log(`[EnhancedFieldProcessor] Detected MIME type from IPFS header: ${mimeType} for ${url}`);
                return mimeType;
              }
            }
            
            // For small files, analyze the buffer to detect file type
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) < 1024 * 1024) { // Only for files < 1MB
              const buffer = await response.arrayBuffer();
              const uint8Array = new Uint8Array(buffer.slice(0, 8192)); // Read first 8KB for analysis
              const fileType = await fileTypeFromBuffer(uint8Array);
              
              if (fileType?.mime) {
                console.log(`[EnhancedFieldProcessor] Detected MIME type from IPFS buffer analysis: ${fileType.mime} for ${url}`);
                return fileType.mime;
              }
            }
            
            // If we got a successful response but no clear MIME type, make educated guesses
            return this.guessIpfsMimeFromContext(url);
          }
        } catch (error) {
          // Try next gateway
          continue;
        }
      }
      
      // If all gateways fail, make educated guesses
      return this.guessIpfsMimeFromContext(url);
      
    } catch (error) {
      console.warn(`[EnhancedFieldProcessor] Error detecting MIME from IPFS: ${error}`);
      return this.guessIpfsMimeFromContext(url);
    }
  }
  
  /**
   * Extract CID from IPFS URL
   */
  private extractCidFromUrl(url: string): string | null {
    if (!url) return null;

    // Clean the URL by removing any leading/trailing whitespace
    url = url.trim();

    // If it's already just a CID (starts with Qm or bafy), extract only the CID part
    if (url.startsWith('Qm') || url.startsWith('bafy')) {
      // Remove any query parameters or fragments that might be appended
      const cidMatch = url.match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{55})/);
      return cidMatch ? cidMatch[1] : null;
    }

    // Handle ipfs:// protocol
    if (url.startsWith('ipfs://')) {
      const withoutProtocol = url.replace('ipfs://', '');
      // Extract only the CID part, removing any path, query params, or fragments
      const cidMatch = withoutProtocol.match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{55})/);
      return cidMatch ? cidMatch[1] : null;
    }

    // Handle gateway URLs
    const gatewayRegex = /https?:\/\/[^/]+\/ipfs\/([^/?#]+)/;
    const match = url.match(gatewayRegex);
    if (match && match[1]) {
      // Extract only the CID part from the matched group
      const cidMatch = match[1].match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{55})/);
      return cidMatch ? cidMatch[1] : null;
    }

    return null;
  }
  
  /**
   * Make educated guesses about IPFS MIME types based on context
   */
  private guessIpfsMimeFromContext(url: string): string | null {
    // Check if URL contains hints about the content type
    const urlLower = url.toLowerCase();
    
    // Video indicators
    if (urlLower.includes('video') || urlLower.includes('animation') || urlLower.includes('mp4')) {
      return 'video/mp4';
    }
    
    // Interactive/HTML indicators
    if (urlLower.includes('generator') || urlLower.includes('interactive') || urlLower.includes('html')) {
      return 'text/html';
    }
    
    // Image indicators (default assumption for most NFTs)
    if (urlLower.includes('image') || urlLower.includes('display') || urlLower.includes('artifact')) {
      return 'image/png'; // Safe default for most NFT images
    }
    
    // Default to image for most NFT content
    return 'image/png';
  }
  
  /**
   * Enhanced dimensions extraction with multiple strategies
   */
  async extractDimensions(
    imageUrl?: string, 
    metadata?: any, 
    rawData?: any
  ): Promise<{ width: number; height: number } | null> {
    // Strategy 1: Check metadata for dimensions (highest priority)
    if (metadata?.dimensions) {
      const dims = this.parseDimensionsFromMetadata(metadata.dimensions);
      if (dims) return dims;
    }
    
    // Strategy 2: Check raw data for dimensions (Tezos API data - high priority)
    if (rawData?.dimensions) {
      const dims = this.parseDimensionsFromMetadata(rawData.dimensions);
      if (dims) return dims;
    }
    
    // Strategy 3: Check for Tezos-specific dimension fields
    if (rawData?.fa?.dimensions || rawData?.token?.dimensions) {
      const tezosData = rawData.fa?.dimensions || rawData.token?.dimensions;
      const dims = this.parseDimensionsFromMetadata(tezosData);
      if (dims) return dims;
    }
    
    // Strategy 4: Check metadata for image_details (Art Blocks style)
    if (metadata?.image_details) {
      const dims = this.extractArtBlocksDimensions(metadata.image_details);
      if (dims) return dims;
    }
    
    // Strategy 5: Extract from attributes if they contain dimension info
    if (rawData?.attributes || metadata?.attributes) {
      const dims = this.extractDimensionsFromAttributes(rawData?.attributes || metadata?.attributes);
      if (dims) return dims;
    }
    
    // Strategy 6: Check for common dimension patterns in metadata
    const dims = this.extractDimensionsFromAnyField(metadata, rawData);
    if (dims) return dims;
    
    // Strategy 7: Try to get dimensions from the actual image (last resort, skip for Tezos if we have API data)
    if (imageUrl && !rawData?.fa?.contract) {
      // Only try IPFS dimension extraction for non-Tezos tokens or when no other data is available
      const dims = await this.getDimensionsFromUrl(imageUrl);
      if (dims) return dims;
    }
    
    return null;
  }
  
  /**
   * Parse dimensions from various metadata formats
   */
  private parseDimensionsFromMetadata(dimensionData: any): { width: number; height: number } | null {
    if (!dimensionData) return null;
    
    // Handle Tezos API nested dimensions structure
    if (typeof dimensionData === 'object') {
      // Priority 1: Artifact dimensions (original/highest quality)
      if (dimensionData.artifact?.dimensions) {
        const artifactDims = dimensionData.artifact.dimensions;
        if (artifactDims.width && artifactDims.height) {
          const width = parseInt(artifactDims.width, 10);
          const height = parseInt(artifactDims.height, 10);
          if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
            return { width, height };
          }
        }
      }
      
      // Priority 2: Display dimensions (processed version)
      if (dimensionData.display?.dimensions) {
        const displayDims = dimensionData.display.dimensions;
        if (displayDims.width && displayDims.height) {
          const width = parseInt(displayDims.width, 10);
          const height = parseInt(displayDims.height, 10);
          if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
            return { width, height };
          }
        }
      }
      
      // Priority 3: Thumbnail dimensions (fallback)
      if (dimensionData.thumbnail?.dimensions) {
        const thumbDims = dimensionData.thumbnail.dimensions;
        if (thumbDims.width && thumbDims.height) {
          const width = parseInt(thumbDims.width, 10);
          const height = parseInt(thumbDims.height, 10);
          if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
            return { width, height };
          }
        }
      }
      
      // Handle direct object format: { width: number, height: number }
      if (dimensionData.width && dimensionData.height) {
        const width = parseInt(dimensionData.width, 10);
        const height = parseInt(dimensionData.height, 10);
        if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
          return { width, height };
        }
      }
    }
    
    // Handle string format: "1920x1080" or "1920 x 1080"
    if (typeof dimensionData === 'string') {
      const match = dimensionData.match(/(\d+)\s*[x×]\s*(\d+)/i);
      if (match) {
        const width = parseInt(match[1], 10);
        const height = parseInt(match[2], 10);
        if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
          return { width, height };
        }
      }
    }
    
    // Handle nested formats (legacy Tezos API style)
    if (dimensionData.display?.dimensions) {
      return this.parseDimensionsFromMetadata(dimensionData.display.dimensions);
    }
    
    if (dimensionData.artifact?.dimensions) {
      return this.parseDimensionsFromMetadata(dimensionData.artifact.dimensions);
    }
    
    return null;
  }
  
  /**
   * Extract Art Blocks style dimensions
   */
  private extractArtBlocksDimensions(imageDetails: any): { width: number; height: number } | null {
    if (imageDetails.width && imageDetails.height) {
      const width = parseInt(imageDetails.width, 10);
      const height = parseInt(imageDetails.height, 10);
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        return { width, height };
      }
    }
    return null;
  }
  
  /**
   * Extract dimensions from attributes array
   */
  private extractDimensionsFromAttributes(attributes: any[]): { width: number; height: number } | null {
    if (!Array.isArray(attributes)) return null;
    
    let width: number | null = null;
    let height: number | null = null;
    
    for (const attr of attributes) {
      const traitType = (attr.trait_type || attr.name || '').toLowerCase();
      const value = attr.value;
      
      if (traitType.includes('width') && typeof value === 'number') {
        width = value;
      } else if (traitType.includes('height') && typeof value === 'number') {
        height = value;
      } else if (traitType.includes('dimension') && typeof value === 'string') {
        const dims = this.parseDimensionsFromMetadata(value);
        if (dims) return dims;
      }
    }
    
    if (width && height && width > 0 && height > 0) {
      return { width, height };
    }
    
    return null;
  }
  
  /**
   * Search for dimensions in any field of metadata or raw data
   */
  private extractDimensionsFromAnyField(metadata?: any, rawData?: any): { width: number; height: number } | null {
    const searchObjects = [metadata, rawData].filter(Boolean);
    
    for (const obj of searchObjects) {
      if (typeof obj !== 'object') continue;
      
      // Search for common dimension field names
      const dimensionFields = [
        'image_width', 'image_height',
        'width', 'height',
        'size', 'resolution',
        'canvas_width', 'canvas_height'
      ];
      
      let width: number | null = null;
      let height: number | null = null;
      
      for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        
        if (keyLower.includes('width') && typeof value === 'number') {
          width = value;
        } else if (keyLower.includes('height') && typeof value === 'number') {
          height = value;
        }
      }
      
      if (width && height && width > 0 && height > 0) {
        return { width, height };
      }
    }
    
    return null;
  }
  
  /**
   * Get dimensions by fetching and analyzing the image (enhanced for IPFS)
   */
  private async getDimensionsFromUrl(url: string): Promise<{ width: number; height: number } | null> {
    try {
      // Handle IPFS URLs
      if (url.startsWith('ipfs://') || url.includes('/ipfs/')) {
        return await this.getDimensionsFromIpfs(url);
      }
      
      // Handle HTTP URLs
      if (url.startsWith('http')) {
        return await this.getDimensionsFromHttp(url);
      }
      
      return null;
    } catch (error) {
      console.warn(`[EnhancedFieldProcessor] Error getting dimensions from URL: ${error}`);
      return null;
    }
  }
  
  /**
   * Enhanced dimension extraction from IPFS URLs with multiple gateway support
   */
  private async getDimensionsFromIpfs(url: string): Promise<{ width: number; height: number } | null> {
    const cid = this.extractCidFromUrl(url);
    if (!cid) return null;
    
    for (const gateway of EnhancedFieldProcessor.IPFS_GATEWAYS) {
      try {
        const testUrl = `${gateway}${cid}`;
        const dims = await this.getDimensionsFromHttp(testUrl);
        if (dims) {
          console.log(`[EnhancedFieldProcessor] Extracted dimensions from IPFS: ${dims.width}x${dims.height} for ${url}`);
          return dims;
        }
      } catch (error) {
        // Try next gateway
        continue;
      }
    }
    
    return null;
  }
  
  /**
   * Get dimensions from HTTP URL
   */
  private async getDimensionsFromHttp(url: string): Promise<{ width: number; height: number } | null> {
    try {
      const response = await fetchWithRetry(url, 1, 500); // Reduced timeout to 500ms
      if (!response.ok) return null;
      
      // Check if it's an image
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        return null;
      }
      
      // Only process reasonably sized images
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) { // Reduced to 2MB limit
        return null;
      }
      
      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      // Use file-type to verify it's actually an image
      const fileType = await fileTypeFromBuffer(uint8Array);
      if (!fileType || !fileType.mime.startsWith('image/')) {
        return null;
      }
      
      // Extract dimensions using a simple image header parser
      return this.extractDimensionsFromImageBuffer(uint8Array, fileType.mime);
      
    } catch (error: unknown) {
      // Don't log timeout errors as warnings since they're expected for slow IPFS gateways
      if (error instanceof Error && (error.name === 'TimeoutError' || error.message.includes('timeout'))) {
        return null;
      }
      console.warn(`[EnhancedFieldProcessor] Error getting dimensions from HTTP: ${error}`);
      return null;
    }
  }
  
  /**
   * Extract dimensions from image buffer using simple header parsing
   */
  private extractDimensionsFromImageBuffer(buffer: Uint8Array, mimeType: string): { width: number; height: number } | null {
    try {
      if (mimeType === 'image/png') {
        return this.extractPngDimensions(buffer);
      } else if (mimeType === 'image/jpeg') {
        return this.extractJpegDimensions(buffer);
      } else if (mimeType === 'image/gif') {
        return this.extractGifDimensions(buffer);
      } else if (mimeType === 'image/webp') {
        return this.extractWebpDimensions(buffer);
      }
      
      return null;
    } catch (error) {
      console.warn(`[EnhancedFieldProcessor] Error extracting dimensions from image buffer: ${error}`);
      return null;
    }
  }
  
  /**
   * Extract PNG dimensions from buffer
   */
  private extractPngDimensions(buffer: Uint8Array): { width: number; height: number } | null {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer.length < 24) return null;
    
    // Check PNG signature
    if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
      return null;
    }
    
    // IHDR chunk starts at byte 8, dimensions at bytes 16-23
    const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
    const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
    
    if (width > 0 && height > 0) {
      return { width, height };
    }
    
    return null;
  }
  
  /**
   * Extract JPEG dimensions from buffer
   */
  private extractJpegDimensions(buffer: Uint8Array): { width: number; height: number } | null {
    // JPEG signature: FF D8
    if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
      return null;
    }
    
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xFF) break;
      
      const marker = buffer[offset + 1];
      
      // SOF markers (Start of Frame)
      if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || 
          (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
        
        const height = (buffer[offset + 5] << 8) | buffer[offset + 6];
        const width = (buffer[offset + 7] << 8) | buffer[offset + 8];
        
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
      
      // Skip to next marker
      const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
      offset += 2 + length;
    }
    
    return null;
  }
  
  /**
   * Extract GIF dimensions from buffer
   */
  private extractGifDimensions(buffer: Uint8Array): { width: number; height: number } | null {
    // GIF signature: "GIF87a" or "GIF89a"
    if (buffer.length < 10) return null;
    
    const signature = String.fromCharCode(...buffer.slice(0, 6));
    if (signature !== 'GIF87a' && signature !== 'GIF89a') {
      return null;
    }
    
    // Dimensions are at bytes 6-9 (little-endian)
    const width = buffer[6] | (buffer[7] << 8);
    const height = buffer[8] | (buffer[9] << 8);
    
    if (width > 0 && height > 0) {
      return { width, height };
    }
    
    return null;
  }
  
  /**
   * Extract WebP dimensions from buffer
   */
  private extractWebpDimensions(buffer: Uint8Array): { width: number; height: number } | null {
    // WebP signature: "RIFF" + 4 bytes + "WEBP"
    if (buffer.length < 30) return null;
    
    const riff = String.fromCharCode(...buffer.slice(0, 4));
    const webp = String.fromCharCode(...buffer.slice(8, 12));
    
    if (riff !== 'RIFF' || webp !== 'WEBP') {
      return null;
    }
    
    // VP8 format
    if (String.fromCharCode(...buffer.slice(12, 16)) === 'VP8 ') {
      const width = ((buffer[26] | (buffer[27] << 8)) & 0x3fff);
      const height = ((buffer[28] | (buffer[29] << 8)) & 0x3fff);
      
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }
    
    return null;
  }
  
  /**
   * Enhanced metadata URL extraction and processing
   */
  async processMetadataUrl(metadataUrl: string): Promise<any> {
    if (!metadataUrl) return null;
    
    // Handle IPFS metadata URLs
    if (metadataUrl.startsWith('ipfs://') || metadataUrl.includes('/ipfs/')) {
      return await this.processIpfsMetadata(metadataUrl);
    }
    
    // Process HTTP URLs
    if (metadataUrl.startsWith('http')) {
      return await this.processHttpMetadata(metadataUrl);
    }
    
    return null;
  }
  
  /**
   * Process IPFS metadata URLs
   */
  private async processIpfsMetadata(metadataUrl: string): Promise<any> {
    try {
      const cid = this.extractCidFromUrl(metadataUrl);
      if (!cid) return null;
      
      for (const gateway of EnhancedFieldProcessor.IPFS_GATEWAYS) {
        try {
          const testUrl = `${gateway}${cid}`;
          const response = await fetchWithRetry(testUrl, 1, 2000);
          
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            
            // Check if it's JSON metadata
            if (contentType && (contentType.includes('application/json') || contentType.includes('text/plain'))) {
              const metadata = await response.json();
              console.log(`[EnhancedFieldProcessor] Successfully fetched IPFS metadata from ${gateway} for ${metadataUrl}`);
              return metadata;
            }
          }
        } catch (error) {
          // Try next gateway
          continue;
        }
      }
      
      console.warn(`[EnhancedFieldProcessor] Failed to fetch IPFS metadata from all gateways for: ${metadataUrl}`);
      return null;
      
    } catch (error) {
      console.warn(`[EnhancedFieldProcessor] Error processing IPFS metadata ${metadataUrl}:`, error);
      return null;
    }
  }
  
  /**
   * Process HTTP metadata URLs
   */
  private async processHttpMetadata(metadataUrl: string): Promise<any> {
    try {
      const response = await fetchWithRetry(metadataUrl, 2, 1000);
      
      if (!response.ok) {
        console.warn(`[EnhancedFieldProcessor] Failed to fetch metadata from ${metadataUrl}: ${response.status}`);
        return null;
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const metadata = await response.json();
        console.log(`[EnhancedFieldProcessor] Successfully fetched HTTP metadata from ${metadataUrl}`);
        return metadata;
      } else {
        console.warn(`[EnhancedFieldProcessor] Metadata URL returned non-JSON content: ${contentType}`);
        return null;
      }
      
    } catch (error) {
      console.warn(`[EnhancedFieldProcessor] Error processing HTTP metadata ${metadataUrl}:`, error);
      return null;
    }
  }
  
  /**
   * Enhanced features extraction from multiple sources
   */
  extractFeatures(metadata?: any, rawData?: any): Record<string, any> | null {
    // Strategy 1: Direct features field
    if (metadata?.features && typeof metadata.features === 'object') {
      return metadata.features;
    }
    
    // Strategy 2: Art Blocks style features
    if (rawData?.features && typeof rawData.features === 'object') {
      return rawData.features;
    }
    
    // Strategy 3: Extract from attributes if they look like features
    if (metadata?.attributes && Array.isArray(metadata.attributes)) {
      const features: Record<string, any> = {};
      let hasFeatures = false;
      
      metadata.attributes.forEach((attr: any) => {
        if (attr.trait_type && attr.value !== undefined) {
          // Convert trait-style attributes to features if they seem feature-like
          if (typeof attr.value === 'string' || typeof attr.value === 'number') {
            features[attr.trait_type] = attr.value;
            hasFeatures = true;
          }
        }
      });
      
      return hasFeatures ? features : null;
    }
    
    return null;
  }
  
  /**
   * Enhanced attributes normalization
   */
  normalizeAttributes(rawAttributes?: any): Array<{ trait_type: string; value: any }> {
    if (!rawAttributes) return [];
    
    // Handle array format
    if (Array.isArray(rawAttributes)) {
      return rawAttributes
        .map((attr: any) => {
          // Handle different attribute formats
          if (attr.trait_type && attr.value !== undefined) {
            return { trait_type: attr.trait_type, value: attr.value };
          }
          
          // Tezos format: attribute.name and value
          if (attr.attribute?.name && attr.value !== undefined) {
            return { trait_type: attr.attribute.name, value: attr.value };
          }
          
          // Handle name/value format
          if (attr.name && attr.value !== undefined) {
            return { trait_type: attr.name, value: attr.value };
          }
          
          return null;
        })
        .filter((attr): attr is { trait_type: string; value: any } => attr !== null);
    }
    
    // Handle object format (convert to array)
    if (typeof rawAttributes === 'object') {
      return Object.entries(rawAttributes).map(([key, value]) => ({
        trait_type: key,
        value: value
      }));
    }
    
    return [];
  }
  
  /**
   * Enhanced supply extraction
   */
  extractSupply(rawData?: any, metadata?: any): number | null {
    // Check multiple possible sources
    const sources = [
      rawData?.supply,
      metadata?.supply,
      rawData?.total_supply,
      metadata?.total_supply,
      rawData?.edition_size,
      metadata?.edition_size
    ];
    
    for (const source of sources) {
      if (source !== undefined && source !== null) {
        const parsed = typeof source === 'string' ? parseInt(source, 10) : source;
        if (typeof parsed === 'number' && !isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    
    // Default to 1 for most NFTs
    return 1;
  }
  
  /**
   * Enhanced generator URL detection
   */
  extractGeneratorUrl(rawData?: any, metadata?: any): string | null {
    // Check multiple possible sources
    const sources = [
      rawData?.generator_url,
      metadata?.generator_url,
      rawData?.generatorUrl,
      metadata?.generatorUrl,
      rawData?.animation_url,
      metadata?.animation_url
    ];
    
    for (const source of sources) {
      if (source && typeof source === 'string') {
        // Check if this looks like a generator URL
        if (this.isGeneratorUrl(source)) {
          return source;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Process all artwork fields with enhanced extraction
   */
  async processArtworkFields(rawData: any, blockchain: string): Promise<Partial<EnhancedArtworkData>> {
    const result: Partial<EnhancedArtworkData> = {};
    
    // Extract basic media URLs
    const imageUrl = this.extractImageUrl(rawData, blockchain);
    const animationUrl = this.extractAnimationUrl(rawData, blockchain);
    const thumbnailUrl = this.extractThumbnailUrl(rawData, blockchain);
    const metadataUrl = this.extractMetadataUrl(rawData);
    
    // Process metadata if available (now includes IPFS support)
    let metadata = rawData.metadata;
    if (metadataUrl && !metadata) {
      metadata = await this.processMetadataUrl(metadataUrl);
    }
    
    // Enhanced field extraction
    result.imageUrl = imageUrl || undefined;
    result.animationUrl = animationUrl || undefined;
    result.thumbnailUrl = thumbnailUrl || undefined;
    result.metadataUrl = metadataUrl || undefined;
    result.generatorUrl = this.extractGeneratorUrl(rawData, metadata) || undefined;
    
    // Technical details with enhanced detection
    // Always prioritize animation URL if it's clearly a video
    let primaryUrl: string | null = null;
    
    if (animationUrl && this.isVideoUrl(animationUrl)) {
      primaryUrl = animationUrl;
    } else if (this.shouldPrioritizeAnimationForMime(rawData, animationUrl, imageUrl)) {
      primaryUrl = animationUrl || imageUrl;
    } else {
      primaryUrl = imageUrl || animationUrl;
    }
    
    result.mime = await this.detectMimeType(primaryUrl || '', metadata || rawData) || undefined;
    result.dimensions = await this.extractDimensions(imageUrl || undefined, metadata, rawData) || undefined;
    result.supply = this.extractSupply(rawData, metadata) || undefined;
    
    // Metadata processing
    result.attributes = this.normalizeAttributes(rawData.attributes || metadata?.attributes);
    result.features = this.extractFeatures(metadata, rawData) || undefined;
    
    return result;
  }
  
  /**
   * Extract image URL with blockchain-specific prioritization
   */
  private extractImageUrl(rawData: any, blockchain: string): string | null {
    if (blockchain === 'tezos') {
      // Tezos prioritization: display_uri > artifact_uri > image_url
      return rawData.display_uri || 
             rawData.artifact_uri || 
             rawData.image_url || 
             rawData.imageUrl || 
             null;
    } else {
      // Ethereum prioritization: image_url > display_image_url > image
      return rawData.image_url || 
             rawData.imageUrl || 
             rawData.display_image_url || 
             rawData.image || 
             null;
    }
  }
  
  /**
   * Extract animation URL with blockchain-specific prioritization
   */
  private extractAnimationUrl(rawData: any, blockchain: string): string | null {
    if (blockchain === 'tezos') {
      // For Tezos, animation might be in artifact_uri if it's not an image
      return rawData.animation_url || 
             rawData.animationUrl || 
             (rawData.artifact_uri && this.isAnimationUrl(rawData.artifact_uri) ? rawData.artifact_uri : null) ||
             null;
    } else {
      // Ethereum prioritization
      return rawData.animation_url || 
             rawData.animationUrl || 
             rawData.display_animation_url || 
             null;
    }
  }
  
  /**
   * Extract thumbnail URL with blockchain-specific prioritization
   */
  private extractThumbnailUrl(rawData: any, blockchain: string): string | null {
    if (blockchain === 'tezos') {
      return rawData.thumbnail_uri || 
             rawData.thumbnailUrl || 
             rawData.display_uri || 
             null;
    } else {
      return rawData.thumbnail_url || 
             rawData.thumbnailUrl || 
             rawData.image_thumbnail_url || 
             null;
    }
  }
  
  /**
   * Extract metadata URL
   */
  private extractMetadataUrl(rawData: any): string | null {
    return rawData.metadata_url || 
           rawData.metadataUrl || 
           rawData.token_uri || 
           rawData.tokenUri || 
           null;
  }
  
  /**
   * Check if a URL looks like a generator/interactive URL
   */
  private isGeneratorUrl(url: string): boolean {
    const generatorPatterns = [
      /generator/i,
      /artblocks\.io\/generator/i,
      /fxhash\.xyz.*\/gentk/i,
      /\.html$/i,
      /interactive/i,
      /live/i
    ];
    
    return generatorPatterns.some(pattern => pattern.test(url));
  }
  
  /**
   * Check if a URL looks like an animation
   */
  private isAnimationUrl(url: string): boolean {
    const animationPatterns = [
      /\.(mp4|webm|mov|gif|avi|ogv)$/i,
      /video/i,
      /animation/i,
      /\.mp4/i,
      /openseauserdata\.com.*\.mp4/i,
      /raw\.seadn\.io.*\.mp4/i,
      /cloudfront\.net.*\.mp4/i,
      /\.gif$/i
    ];
    
    return animationPatterns.some(pattern => pattern.test(url));
  }
  
  /**
   * Check if a URL is specifically a video (not just any animation)
   */
  private isVideoUrl(url: string): boolean {
    const videoPatterns = [
      /\.(mp4|webm|mov|avi|ogv)$/i,
      /openseauserdata\.com.*\.mp4/i,
      /raw\.seadn\.io.*\.mp4/i,
      /cloudfront\.net.*\.mp4/i,
      /\.mp4/i,
      /video/i
    ];
    
    return videoPatterns.some(pattern => pattern.test(url));
  }
  
  /**
   * Check if a MIME type is valid
   */
  private isValidMimeType(mimeType: string): boolean {
    const validMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
      'text/html', 'text/javascript', 'application/javascript',
      'application/pdf', 'application/json'
    ];
    
    return validMimeTypes.includes(mimeType.toLowerCase());
  }
  
  /**
   * Guess MIME type based on platform patterns (enhanced)
   */
  private guessMimeFromPlatform(url: string): string | null {
    // Art Blocks generators
    if (url.includes('artblocks.io/generator') || url.includes('generator.artblocks.io')) {
      return 'text/html';
    }
    
    // fxhash generators
    if (url.includes('fxhash.xyz') && url.includes('gentk')) {
      return 'text/html';
    }
    
    // Video platform detection (before file extension check)
    if (url.includes('openseauserdata.com') && url.includes('.mp4')) {
      return 'video/mp4';
    }
    
    if (url.includes('raw.seadn.io') && url.includes('.mp4')) {
      return 'video/mp4';
    }
    
    if (url.includes('cloudfront.net') && url.includes('.mp4')) {
      return 'video/mp4';
    }
    
    // Check for video indicators in URL path
    if (url.includes('/video/') || url.includes('video') && url.includes('.mp4')) {
      return 'video/mp4';
    }
    
    // Check file extensions more thoroughly
    const extensionMatch = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
    if (extensionMatch) {
      const ext = extensionMatch[1].toLowerCase();
      const mimeMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'ogv': 'video/ogg',
        'html': 'text/html',
        'htm': 'text/html',
        'js': 'application/javascript',
        'json': 'application/json',
        'pdf': 'application/pdf'
      };
      
      if (mimeMap[ext]) {
        return mimeMap[ext];
      }
    }
    
    // IPFS with no extension - make educated guesses based on context
    if (url.includes('ipfs')) {
      // If it's in an animation_url field, likely video
      if (url.includes('animation') || url.includes('video')) {
        return 'video/mp4';
      }
      // Default assumption for IPFS without extension
      return 'image/png';
    }
    
    return null;
  }
  
  /**
   * Check if we should prioritize animation URL for MIME detection
   */
  private shouldPrioritizeAnimationForMime(rawData: any, animationUrl: string | null, imageUrl: string | null): boolean {
    // For Art Blocks and other generative art, prioritize animation/generator URL for MIME detection
    if (rawData.is_generative_art === true) {
      return true;
    }
    
    // If animation URL exists and looks like a generator URL, prioritize it
    if (animationUrl && this.isGeneratorUrl(animationUrl)) {
      return true;
    }
    
    // If animation URL exists and looks like a video, prioritize it
    if (animationUrl && this.isAnimationUrl(animationUrl)) {
      return true;
    }
    
    // If image URL looks like a generator URL, prioritize it
    if (imageUrl && this.isGeneratorUrl(imageUrl)) {
      return true;
    }
    
    return false;
  }
} 