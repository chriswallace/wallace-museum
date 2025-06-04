import { fileTypeFromBuffer } from 'file-type';

export interface MediaUrlSet {
  imageUrl?: string | null;
  animationUrl?: string | null;
  thumbnailUrl?: string | null;
  generatorUrl?: string | null;
  primaryMime?: string | null;
}

export class MediaAnalyzer {
  /**
   * Analyze a set of URLs and determine the best MIME types by fetching and analyzing file buffers
   */
  static async analyzeUrlSet(nftData: any, blockchain: string): Promise<MediaUrlSet> {
    const result: MediaUrlSet = {
      imageUrl: nftData.imageUrl || nftData.image_url || null,
      animationUrl: nftData.animationUrl || nftData.animation_url || null,
      thumbnailUrl: nftData.thumbnailUrl || nftData.thumbnail_url || null,
      generatorUrl: nftData.generatorUrl || nftData.generator_url || null,
      primaryMime: null
    };

    // Determine which URL to analyze for primary MIME type
    const urlsToAnalyze = [
      { url: result.animationUrl, priority: 1 },
      { url: result.imageUrl, priority: 2 },
      { url: result.generatorUrl, priority: 3 },
      { url: result.thumbnailUrl, priority: 4 }
    ].filter(item => item.url).sort((a, b) => a.priority - b.priority);

    // Try to detect MIME type from the highest priority URL
    for (const { url } of urlsToAnalyze) {
      const mimeType = await this.detectMimeTypeFromUrl(url!);
      if (mimeType) {
        result.primaryMime = mimeType;
        break;
      }
    }

    return result;
  }

  /**
   * Detect MIME type from URL by fetching and analyzing the first chunk of the file
   */
  private static async detectMimeTypeFromUrl(url: string): Promise<string | null> {
    if (!url || typeof url !== 'string') {
      return null;
    }

    try {
      // Handle different URL types
      let fetchUrl = url;
      
      // Convert IPFS URLs to HTTP gateway URLs
      if (url.startsWith('ipfs://')) {
        const hash = url.replace('ipfs://', '');
        fetchUrl = `https://ipfs.io/ipfs/${hash}`;
      } else if (url.includes('/ipfs/') && !url.startsWith('http')) {
        fetchUrl = `https://ipfs.io/ipfs/${url.split('/ipfs/')[1]}`;
      }

      // Skip non-HTTP URLs that we can't fetch
      if (!fetchUrl.startsWith('http')) {
        return this.guessMimeFromUrl(url);
      }

      // Fetch only the first chunk of the file for analysis
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-8191' // First 8KB should be enough for file type detection
        }
      });

      if (!response.ok) {
        // If range request fails, try without range
        const fullResponse = await fetch(fetchUrl, {
          method: 'HEAD' // Just get headers
        });
        
        if (fullResponse.ok) {
          const contentType = fullResponse.headers.get('content-type');
          if (contentType) {
            return contentType.split(';')[0].trim();
          }
        }
        
        return this.guessMimeFromUrl(url);
      }

      // First try to get MIME type from Content-Type header
      const contentType = response.headers.get('content-type');
      if (contentType && contentType !== 'application/octet-stream') {
        const mimeType = contentType.split(';')[0].trim();
        if (this.isValidMimeType(mimeType)) {
          return mimeType;
        }
      }

      // If Content-Type is not reliable, analyze the buffer
      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      // Use file-type library to detect from buffer
      const fileType = await fileTypeFromBuffer(uint8Array);
      if (fileType?.mime) {
        return fileType.mime;
      }

      // Fallback to URL-based guessing
      return this.guessMimeFromUrl(url);

    } catch (error) {
      console.warn(`[MediaAnalyzer] Error detecting MIME type for ${url}:`, error);
      return this.guessMimeFromUrl(url);
    }
  }

  /**
   * Guess MIME type from URL patterns and file extensions
   */
  private static guessMimeFromUrl(url: string): string | null {
    if (!url) return null;

    const urlLower = url.toLowerCase();

    // Platform-specific patterns
    if (url.includes('generator.artblocks.io') || url.includes('fxhash.xyz')) {
      return 'text/html';
    }

    // File extension mapping
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

    // Content-based guessing for URLs without clear extensions
    if (urlLower.includes('video') || urlLower.includes('animation')) {
      return 'video/mp4';
    }
    
    if (urlLower.includes('generator') || urlLower.includes('interactive')) {
      return 'text/html';
    }

    // Default assumption for most NFT content
    return 'image/png';
  }

  /**
   * Check if a MIME type is valid/supported
   */
  private static isValidMimeType(mimeType: string): boolean {
    const validMimeTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'text/html',
      'application/javascript',
      'application/json',
      'application/pdf'
    ];
    
    return validMimeTypes.some(valid => mimeType.startsWith(valid.split('/')[0] + '/'));
  }
} 