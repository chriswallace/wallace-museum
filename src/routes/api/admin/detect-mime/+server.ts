import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MediaAnalyzer } from '$lib/utils/mediaAnalyzer';

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

    const results: Array<{ id: number; mime: string | null }> = [];

    // Process artworks in small batches to avoid overwhelming IPFS gateways
    const BATCH_SIZE = 3;
    for (let i = 0; i < artworks.length; i += BATCH_SIZE) {
      const batch = artworks.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (artwork: any) => {
        try {
          // Use MediaAnalyzer to detect MIME type
          const mediaUrlSet = await MediaAnalyzer.analyzeUrlSet({
            imageUrl: artwork.image_url || null,
            animationUrl: artwork.animation_url || null,
            thumbnailUrl: artwork.thumbnailUrl || null
          }, 'ethereum');

          return {
            id: artwork.id,
            mime: mediaUrlSet.primaryMime || null
          };
        } catch (error) {
          console.warn(`[DetectMime] Error detecting MIME for artwork ${artwork.id}:`, error);
          return {
            id: artwork.id,
            mime: null
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

      // Small delay between batches to be respectful to IPFS gateways
      if (i + BATCH_SIZE < artworks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return json({ results });
  } catch (error) {
    console.error('[DetectMime] Error in MIME detection endpoint:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 