// Standalone media utilities for dimension extraction script
// This file avoids SvelteKit dependencies like $env

interface Dimensions {
  width: number;
  height: number;
}

// Sharp is optional, so we need to handle it gracefully
let sharp: any = null;

async function initializeSharp() {
  try {
    sharp = (await import('sharp')).default;
  } catch (error) {
    console.warn('Sharp not available. Will use fallback dimension detection methods.');
  }
}

/**
 * Get image dimensions from buffer using Sharp (primary method)
 */
async function getImageDimensionsFromBuffer(buffer: Buffer): Promise<Dimensions | null> {
  try {
    if (!buffer || buffer.length === 0) {
      return null;
    }

    // Check file type first
    const { fileTypeFromBuffer } = await import('file-type');
    const fileTypeResult = await fileTypeFromBuffer(buffer);
    if (!fileTypeResult || !fileTypeResult.mime.startsWith('image/')) {
      return null;
    }

    if (sharp) {
      const metadata = await sharp(buffer).metadata();
      if (metadata.width && metadata.height) {
        return { width: metadata.width, height: metadata.height };
      }
    }

    // Fallback to manual parsing for common formats
    return parseImageDimensionsManually(buffer, fileTypeResult.mime);
  } catch (error) {
    console.error('Error getting dimensions from buffer:', error);
    return null;
  }
}

/**
 * Manual dimension parsing for common image formats (fallback when Sharp is not available)
 */
function parseImageDimensionsManually(buffer: Buffer, mimeType: string): Dimensions | null {
  try {
    switch (mimeType) {
      case 'image/png':
        return parsePngDimensions(buffer);
      case 'image/jpeg':
      case 'image/jpg':
        return parseJpegDimensions(buffer);
      case 'image/gif':
        return parseGifDimensions(buffer);
      case 'image/webp':
        return parseWebpDimensions(buffer);
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error parsing ${mimeType} dimensions manually:`, error);
    return null;
  }
}

/**
 * Parse PNG dimensions from buffer
 */
function parsePngDimensions(buffer: Buffer): Dimensions | null {
  if (buffer.length < 24) return null;
  
  // PNG signature check
  if (buffer.toString('ascii', 0, 8) !== '\x89PNG\r\n\x1a\n') return null;
  
  // Check for IHDR chunk
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Parse JPEG dimensions from buffer
 */
function parseJpegDimensions(buffer: Buffer): Dimensions | null {
  if (buffer.length < 4) return null;
  
  // JPEG signature check
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return null;
  
  let offset = 2;
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xFF) break;
    
    const marker = buffer[offset + 1];
    
    // SOF markers (Start of Frame)
    if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || 
        (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    
    // Skip to next marker
    const segmentLength = buffer.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  
  return null;
}

/**
 * Parse GIF dimensions from buffer
 */
function parseGifDimensions(buffer: Buffer): Dimensions | null {
  if (buffer.length < 10) return null;
  
  // GIF signature check
  const signature = buffer.toString('ascii', 0, 6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;
  
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Parse WebP dimensions from buffer
 */
function parseWebpDimensions(buffer: Buffer): Dimensions | null {
  if (buffer.length < 30) return null;
  
  // WebP signature check
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  
  const format = buffer.toString('ascii', 12, 16);
  
  if (format === 'VP8 ') {
    // Simple WebP
    if (buffer.length < 30) return null;
    const width = buffer.readUInt16LE(26) & 0x3FFF;
    const height = buffer.readUInt16LE(28) & 0x3FFF;
    return width > 0 && height > 0 ? { width, height } : null;
  } else if (format === 'VP8L') {
    // Lossless WebP
    if (buffer.length < 25) return null;
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 0x3FFF) + 1;
    const height = ((bits >> 14) & 0x3FFF) + 1;
    return width > 0 && height > 0 ? { width, height } : null;
  } else if (format === 'VP8X') {
    // Extended WebP
    if (buffer.length < 30) return null;
    const width = (buffer.readUInt32LE(24) & 0xFFFFFF) + 1;
    const height = (buffer.readUInt32LE(27) & 0xFFFFFF) + 1;
    return width > 0 && height > 0 ? { width, height } : null;
  }
  
  return null;
}

/**
 * Convert IPFS URLs to HTTP gateway URLs
 */
function ipfsToHttpUrl(url: string): string {
  if (!url) return url;
  
  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }
  
  // Handle /ipfs/ paths
  if (url.includes('/ipfs/') && !url.startsWith('http')) {
    const hash = url.split('/ipfs/')[1];
    return `https://ipfs.io/ipfs/${hash}`;
  }
  
  return url;
}

/**
 * Fetch with retry logic and timeout
 */
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
  let lastError: Error;
  
  for (let i = 0; i < retries; i++) {
    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Wallace Collection Dimension Scanner/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Handle abort/timeout specifically
      if (lastError.name === 'AbortError') {
        lastError = new Error(`Request timeout after 30 seconds`);
      }
      
      if (i < retries - 1) {
        console.warn(`  Attempt ${i + 1} failed for ${url}: ${lastError.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  
  throw lastError!;
}

export type { Dimensions };
export {
  initializeSharp,
  getImageDimensionsFromBuffer,
  ipfsToHttpUrl,
  fetchWithRetry
}; 