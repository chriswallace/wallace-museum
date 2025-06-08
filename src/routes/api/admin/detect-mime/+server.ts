import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MediaAnalyzer } from '$lib/utils/mediaAnalyzer';

/**
 * Fast header-only MIME type detection
 * Much faster than buffer analysis, works for most cases
 */
async function detectMimeFromHeaders(url: string): Promise<string | null> {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Convert IPFS URLs to HTTP gateway URLs
    let fetchUrl = url;
    if (url.startsWith('ipfs://')) {
      const hash = url.replace('ipfs://', '');
      fetchUrl = `https://ipfs.io/ipfs/${hash}`;
    } else if (url.includes('/ipfs/') && !url.startsWith('http')) {
      fetchUrl = `https://ipfs.io/ipfs/${url.split('/ipfs/')[1]}`;
    }

    if (!fetchUrl.startsWith('http')) {
      return null;
    }

    // Try HEAD request first (fastest - no body download)
    const headResponse = await fetch(fetchUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (headResponse.ok) {
      const contentType = headResponse.headers.get('content-type');
      if (contentType && contentType !== 'application/octet-stream') {
        const mimeType = contentType.split(';')[0].trim();
        if (isValidMimeType(mimeType)) {
          console.log(`[FastMimeDetection] Header detection successful: ${mimeType} for ${url}`);
          return mimeType;
        }
      }
    }

    // If HEAD fails, try a small range request
    const rangeResponse = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'Range': 'bytes=0-1023' // Just 1KB for headers
      },
      signal: AbortSignal.timeout(5000)
    });

    if (rangeResponse.ok) {
      const contentType = rangeResponse.headers.get('content-type');
      if (contentType && contentType !== 'application/octet-stream') {
        const mimeType = contentType.split(';')[0].trim();
        if (isValidMimeType(mimeType)) {
          console.log(`[FastMimeDetection] Range header detection successful: ${mimeType} for ${url}`);
          return mimeType;
        }
      }
    }

    return null;
  } catch (error) {
    console.warn(`[FastMimeDetection] Header detection failed for ${url}:`, error);
    return null;
  }
}

/**
 * Check if a MIME type is valid/supported
 */
function isValidMimeType(mimeType: string): boolean {
  if (!mimeType || typeof mimeType !== 'string') {
    return false;
  }

  const validMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    'text/html', 'application/javascript', 'application/json', 'application/pdf'
  ];
  
  return validMimeTypes.some(valid => mimeType.startsWith(valid.split('/')[0] + '/'));
}

/**
 * API endpoint to detect MIME types for artwork URLs
 * Used by the import process to properly identify video vs image content
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { artworks } = await request.json();
    
    if (!Array.isArray(artworks)) {
      return json({ error: 'Invalid request: artworks must be an array' }, { status: 400 });
    }

    const results: Array<{ id: number; mime: string | null; method: string }> = [];

    // Process artworks in small batches to avoid overwhelming IPFS gateways
    const BATCH_SIZE = 5; // Increased since header requests are faster
    for (let i = 0; i < artworks.length; i += BATCH_SIZE) {
      const batch = artworks.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (artwork: any) => {
        try {
          // Determine the best URL to check (prioritize animation_url for videos)
          const urlsToCheck = [
            artwork.animation_url,
            artwork.image_url,
            artwork.thumbnailUrl
          ].filter(Boolean);

          if (urlsToCheck.length === 0) {
            return { id: artwork.id, mime: null, method: 'no-urls' };
          }

          // Try fast header-based detection first
          for (const url of urlsToCheck) {
            const headerMime = await detectMimeFromHeaders(url);
            if (headerMime) {
              return { id: artwork.id, mime: headerMime, method: 'headers' };
            }
          }

          // Fallback to full MediaAnalyzer if headers fail
          console.log(`[MimeDetection] Header detection failed for artwork ${artwork.id}, falling back to buffer analysis`);
          const mediaUrlSet = await MediaAnalyzer.analyzeUrlSet({
            imageUrl: artwork.image_url || null,
            animationUrl: artwork.animation_url || null,
            thumbnailUrl: artwork.thumbnailUrl || null
          }, 'ethereum');

          return {
            id: artwork.id,
            mime: mediaUrlSet.primaryMime || null,
            method: 'buffer-analysis'
          };
        } catch (error) {
          console.warn(`[MimeDetection] Error detecting MIME for artwork ${artwork.id}:`, error);
          return {
            id: artwork.id,
            mime: null,
            method: 'error'
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect results from this batch
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });

      // Smaller delay since header requests are faster
      if (i + BATCH_SIZE < artworks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Log detection method statistics
    const methodStats = results.reduce((acc, result) => {
      acc[result.method] = (acc[result.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`[MimeDetection] Detection methods used:`, methodStats);

    return json({ 
      results: results.map(r => ({ id: r.id, mime: r.mime })),
      stats: methodStats
    });
  } catch (error) {
    console.error('[MimeDetection] Error in MIME detection endpoint:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 