#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import { 
  type Dimensions, 
  initializeSharp, 
  getImageDimensionsFromBuffer, 
  ipfsToHttpUrl, 
  fetchWithRetry 
} from './media-utils.js';

// Use the write database URL for updates
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.WRITE_DATABASE_URL || process.env.DATABASE_URL
    }
  }
});

interface ProcessingResult {
  id: number;
  title: string;
  status: 'success' | 'error' | 'skipped';
  message: string;
  dimensions?: Dimensions | null;
  mediaUrl?: string;
}

interface ProcessingReport {
  totalArtworks: number;
  processed: number;
  successful: number;
  errors: number;
  skipped: number;
  results: ProcessingResult[];
  startTime: Date;
  endTime?: Date;
  duration?: string;
}

/**
 * Fetch media from URL and get dimensions
 */
async function fetchMediaAndGetDimensions(url: string): Promise<Dimensions | null> {
  try {
    // Convert IPFS URLs to HTTP
    const httpUrl = ipfsToHttpUrl(url);
    
    console.log(`  Fetching media from: ${httpUrl}`);
    
    // Fetch with retry logic
    const response = await fetchWithRetry(httpUrl, 3, 2000);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    if (buffer.length === 0) {
      throw new Error('Empty response buffer');
    }
    
    console.log(`  Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    
    return await getImageDimensionsFromBuffer(buffer);
    
  } catch (error) {
    console.error(`  Error fetching media: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Process a single artwork to extract and update dimensions
 */
async function processArtwork(artwork: any): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    id: artwork.id,
    title: artwork.title,
    status: 'error',
    message: 'Unknown error'
  };

  try {
    console.log(`\nProcessing artwork ${artwork.id}: "${artwork.title}"`);
    
    // Check if dimensions already exist
    if (artwork.dimensions && 
        typeof artwork.dimensions === 'object' && 
        artwork.dimensions.width > 0 && 
        artwork.dimensions.height > 0) {
      result.status = 'skipped';
      result.message = `Already has dimensions: ${artwork.dimensions.width}x${artwork.dimensions.height}`;
      result.dimensions = artwork.dimensions;
      console.log(`  ✓ Skipped - already has dimensions: ${artwork.dimensions.width}x${artwork.dimensions.height}`);
      return result;
    }

    // Determine which URL to use for dimension detection (priority order)
    let mediaUrl: string | null = null;
    let mediaType = '';

    if (artwork.imageUrl) {
      mediaUrl = artwork.imageUrl;
      mediaType = 'imageUrl';
    } else if (artwork.animationUrl && !artwork.animationUrl.includes('generator.artblocks.io')) {
      mediaUrl = artwork.animationUrl;
      mediaType = 'animationUrl';
    } else if (artwork.thumbnailUrl) {
      mediaUrl = artwork.thumbnailUrl;
      mediaType = 'thumbnailUrl';
    }

    if (!mediaUrl) {
      result.status = 'skipped';
      result.message = 'No suitable media URL found';
      console.log(`  ⚠ Skipped - no suitable media URL found`);
      return result;
    }

    console.log(`  Using ${mediaType}: ${mediaUrl}`);
    result.mediaUrl = mediaUrl;

    // Create timeout promise for the entire media processing operation
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Processing timeout after 60 seconds')), 60000);
    });

    // Fetch media and extract dimensions with timeout
    const dimensionsPromise = fetchMediaAndGetDimensions(mediaUrl);
    const dimensions = await Promise.race([dimensionsPromise, timeoutPromise]);

    if (!dimensions) {
      result.status = 'error';
      result.message = 'Could not extract dimensions from media';
      console.log(`  ✗ Error - could not extract dimensions`);
      return result;
    }

    console.log(`  ✓ Extracted dimensions: ${dimensions.width}x${dimensions.height}`);

    // Update artwork in database
    await prisma.artwork.update({
      where: { id: artwork.id },
      data: {
        dimensions: dimensions as any
      }
    });

    result.status = 'success';
    result.message = `Successfully updated dimensions to ${dimensions.width}x${dimensions.height}`;
    result.dimensions = dimensions;
    console.log(`  ✓ Updated database with dimensions: ${dimensions.width}x${dimensions.height}`);

    return result;

  } catch (error) {
    result.status = 'error';
    result.message = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ Error: ${result.message}`);
    return result;
  }
}

/**
 * Generate and display the final report
 */
function generateReport(report: ProcessingReport): void {
  const duration = report.endTime && report.startTime 
    ? Math.round((report.endTime.getTime() - report.startTime.getTime()) / 1000)
    : 0;
  
  report.duration = `${Math.floor(duration / 60)}m ${duration % 60}s`;

  console.log('\n' + '='.repeat(80));
  console.log('ARTWORK DIMENSIONS UPDATE REPORT');
  console.log('='.repeat(80));
  console.log(`Start Time: ${report.startTime.toISOString()}`);
  console.log(`End Time: ${report.endTime?.toISOString() || 'N/A'}`);
  console.log(`Duration: ${report.duration}`);
  console.log(`Total Artworks: ${report.totalArtworks}`);
  console.log(`Processed: ${report.processed}`);
  console.log(`Successful Updates: ${report.successful}`);
  console.log(`Errors: ${report.errors}`);
  console.log(`Skipped: ${report.skipped}`);
  console.log(`Success Rate: ${report.processed > 0 ? Math.round((report.successful / report.processed) * 100) : 0}%`);
  
  if (report.results.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('DETAILED RESULTS');
    console.log('-'.repeat(80));
    
    // Group results by status
    const successful = report.results.filter(r => r.status === 'success');
    const errors = report.results.filter(r => r.status === 'error');
    const skipped = report.results.filter(r => r.status === 'skipped');
    
    if (successful.length > 0) {
      console.log(`\n✓ SUCCESSFUL UPDATES (${successful.length}):`);
      successful.forEach(r => {
        console.log(`  ${r.id}: "${r.title}" - ${r.message}`);
      });
    }
    
    if (skipped.length > 0) {
      console.log(`\n⚠ SKIPPED (${skipped.length}):`);
      skipped.forEach(r => {
        console.log(`  ${r.id}: "${r.title}" - ${r.message}`);
      });
    }
    
    if (errors.length > 0) {
      console.log(`\n✗ ERRORS (${errors.length}):`);
      errors.forEach(r => {
        console.log(`  ${r.id}: "${r.title}" - ${r.message}`);
        if (r.mediaUrl) {
          console.log(`    Media URL: ${r.mediaUrl}`);
        }
      });
    }
  }
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Save report to file
 */
async function saveReportToFile(report: ProcessingReport): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `artwork-dimensions-report-${timestamp}.json`;
  const filepath = path.join(process.cwd(), 'reports', filename);
  
  // Ensure reports directory exists
  try {
    await fs.mkdir(path.dirname(filepath), { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  await fs.writeFile(filepath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${filepath}`);
}

/**
 * Main execution function
 */
async function main() {
  const report: ProcessingReport = {
    totalArtworks: 0,
    processed: 0,
    successful: 0,
    errors: 0,
    skipped: 0,
    results: [],
    startTime: new Date()
  };

  try {
    console.log('🎨 Starting Artwork Dimensions Update Script');
    console.log('='.repeat(50));
    
    // Initialize Sharp if available
    await initializeSharp();
    
    // Get all artworks from database
    console.log('Fetching artworks from database...');
    const artworks = await prisma.artwork.findMany({
      select: {
        id: true,
        title: true,
        dimensions: true,
        imageUrl: true,
        animationUrl: true,
        thumbnailUrl: true,
        mime: true
      },
      orderBy: {
        id: 'asc'
      }
    });

    report.totalArtworks = artworks.length;
    console.log(`Found ${artworks.length} artworks to process\n`);

    if (artworks.length === 0) {
      console.log('No artworks found in database.');
      return;
    }

    // Process each artwork
    for (let i = 0; i < artworks.length; i++) {
      const artwork = artworks[i];
      console.log(`Progress: ${i + 1}/${artworks.length} (${Math.round(((i + 1) / artworks.length) * 100)}%)`);
      
      const result = await processArtwork(artwork);
      report.results.push(result);
      report.processed++;
      
      switch (result.status) {
        case 'success':
          report.successful++;
          break;
        case 'error':
          report.errors++;
          break;
        case 'skipped':
          report.skipped++;
          break;
      }
      
      // Small delay to avoid overwhelming external services
      if (result.status === 'success' || result.status === 'error') {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

  } catch (error) {
    console.error('Fatal error during execution:', error);
  } finally {
    report.endTime = new Date();
    
    // Generate and display report
    generateReport(report);
    
    // Save report to file
    try {
      await saveReportToFile(report);
    } catch (error) {
      console.error('Error saving report to file:', error);
    }
    
    // Close database connection
    await prisma.$disconnect();
  }
}

// Run the script
main().catch(console.error);

export { main }; 