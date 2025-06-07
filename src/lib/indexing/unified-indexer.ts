import type { PrismaClient } from '@prisma/client';
import type { 
  DataSource, 
  Blockchain, 
  ImportStatus, 
  ImportResult 
} from '../types/indexing';
import { pinCidToPinata, extractCidsFromArtwork, convertToIpfsUrl } from '$lib/pinataHelpers';
import { isProblematicThumbnail } from '$lib/constants/tezos';
import { EnhancedFieldProcessor } from '../enhanced-field-processor';

// Unified indexer format (stored as json string in database)
export interface IndexerData {
  title: string;
  description?: string;
  imageUrl?: string; // display/artifact uri
  animationUrl?: string; // animation uri
  generatorUrl?: string; // generator uri for generative artworks
  thumbnailUrl?: string; // thumbnail uri
  metadataUrl?: string; // metadata URL
  mime?: string; // MIME type
  isGenerativeArt?: boolean;
  blockchain: string;
  tokenStandard: string;
  supply?: number;
  mintDate?: string; // Add mint date
  dimensions?: { width: number; height: number };
  attributes?: Array<{ trait_type: string; value: any }>;
  features?: Record<string, any>; // Add features field similar to attributes
  creator?: {
    address: string;
    username?: string;
    bio?: string;
    description?: string; // Different from bio
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
  collection?: {
    slug: string;
    title?: string;
    description?: string;
    websiteUrl?: string;
    contractAddress: string;
    imageUrl?: string;
    bannerImageUrl?: string;
    discordUrl?: string;
    telegramUrl?: string;
    mediumUrl?: string;
    projectUrl?: string;
    isGenerativeArt?: boolean;
    isSharedContract?: boolean;
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
  };
}

// Main unified indexer class
export class UnifiedIndexer {
  private prisma: PrismaClient;
  private fieldProcessor: EnhancedFieldProcessor;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.fieldProcessor = new EnhancedFieldProcessor();
  }

  /**
   * Index normalized NFT data
   */
  async indexNFT(
    data: IndexerData,
    source: DataSource,
    blockchain: Blockchain,
    contractAddress: string,
    tokenId: string
  ): Promise<{ indexId: number; nftUid: string }> {
    // Validate required fields
    if (!contractAddress || !tokenId) {
      throw new Error('Contract address and token ID are required');
    }

    // Use the provided contract address and token ID
    const finalContractAddress = contractAddress;
    const finalTokenId = tokenId;
    const indexerData = data;

    const nftUid = `${finalContractAddress}:${finalTokenId}`;

    // Check if record already exists
    const existingRecord = await this.prisma.artworkIndex.findUnique({
      where: { nftUid }
    });

    if (existingRecord) {
      // Record already exists - don't overwrite during import
      // Only update lastAttempt to track that we tried to import this
      await this.prisma.artworkIndex.update({
        where: { id: existingRecord.id },
        data: {
          lastAttempt: new Date()
        }
      });
      
      console.log(`[UnifiedIndexer] Skipping existing index record for ${nftUid} to preserve indexed data`);
      return { indexId: existingRecord.id, nftUid };
    }

    // Store in ArtworkIndex - only create new records
    const indexData = {
      nftUid,
      type: 'owned' as const,
      blockchain,
      dataSource: source,
      contractAddress: finalContractAddress.toLowerCase(),
      tokenId: finalTokenId,
      rawResponse: JSON.stringify(data),
      normalizedData: JSON.stringify(indexerData),
      importStatus: 'pending' as ImportStatus,
      updatedAt: new Date()
    };

    const indexed = await this.prisma.artworkIndex.create({
      data: indexData
    });

    return { indexId: indexed.id, nftUid };
  }

  /**
   * Process indexed data to create final models
   */
  async processIndexedData(indexId: number): Promise<ImportResult> {
    const indexRecord = await this.prisma.artworkIndex.findUnique({
      where: { id: indexId },
      include: {
        Artwork: true
      }
    });

    if (!indexRecord) {
      throw new Error(`Index record ${indexId} not found`);
    }

    const result: ImportResult = {
      success: false,
      errors: [],
      createdRecords: {}
    };

    try {
      // Get the normalized data with proper type conversion
      const indexerData = indexRecord.normalizedData as unknown as IndexerData;
      
      if (!indexerData) {
        throw new Error('No normalized data found in index record');
      }

      // Use enhanced field processor to extract missing fields with error handling
      let enhancedFields: Partial<any> = {};
      try {
        enhancedFields = await this.fieldProcessor.processArtworkFields(
          indexRecord.rawResponse, 
          indexRecord.blockchain,
          indexRecord.contractAddress,
          indexRecord.tokenId
        );
      } catch (enhancedError) {
        console.warn(`[UnifiedIndexer] Enhanced field processing failed for index ${indexId}:`, enhancedError);
        // Continue with empty enhanced fields if processing fails
        enhancedFields = {};
      }

      // Merge enhanced fields with existing indexer data, filtering out undefined values
      const mergedData = {
        ...indexerData,
        // Override with enhanced fields if they provide better data (and are not undefined)
        ...(enhancedFields.mime && { mime: enhancedFields.mime }),
        ...(enhancedFields.dimensions && { dimensions: enhancedFields.dimensions }),
        ...(enhancedFields.attributes && { attributes: enhancedFields.attributes }),
        ...(enhancedFields.features && { features: enhancedFields.features }),
        ...(enhancedFields.supply && { supply: enhancedFields.supply }),
        ...(enhancedFields.generatorUrl && { generatorUrl: enhancedFields.generatorUrl }),
        // Ensure we have the best media URLs (only if they exist)
        ...(enhancedFields.imageUrl && { imageUrl: enhancedFields.imageUrl }),
        ...(enhancedFields.animationUrl && { animationUrl: enhancedFields.animationUrl }),
        ...(enhancedFields.thumbnailUrl && { thumbnailUrl: enhancedFields.thumbnailUrl }),
        ...(enhancedFields.metadataUrl && { metadataUrl: enhancedFields.metadataUrl })
      };

      // Step 1: Create/update Artist with wallet addresses stored as JSON
      let artistId: number | undefined;

      if (mergedData.creator?.address) {
        try {
          // Create or find artist by wallet address
          const creatorAddress = mergedData.creator.address;
          const baseArtistName = mergedData.creator.username || `Artist_${creatorAddress.slice(-8)}`;
          
          // First, search all artists to find one with this wallet address
          let artist: any = null;
          const allArtists: any[] = await this.prisma.artist.findMany();

          // Check if any artist has this wallet address (case-insensitive comparison)
          artist = allArtists.find(a => {
            if (!a.walletAddresses || !Array.isArray(a.walletAddresses)) return false;
            return (a.walletAddresses as any[]).some((w: any) => 
              w.address?.toLowerCase() === creatorAddress.toLowerCase()
            );
          }) || null;

          if (!artist) {
            // Try to find by exact name match as fallback
            try {
              artist = await this.prisma.artist.findUnique({
                where: { name: baseArtistName }
              });
            } catch (error) {
              // Ignore errors from name lookup
              console.log(`[UnifiedIndexer] Could not find artist by name: ${baseArtistName}`);
            }
          }

          if (!artist) {
            // Create new artist with wallet address
            const walletAddresses = [{
              address: creatorAddress,
              blockchain: indexRecord.blockchain,
              lastIndexed: new Date().toISOString()
            }];

            // Try to create with the base name first
            let artistName = baseArtistName;
            let counter = 1;
            while (await this.prisma.artist.findUnique({ where: { name: artistName } })) {
              artistName = `${baseArtistName} (${counter})`;
              counter++;
            }

            // Create the artist
            try {
              artist = await this.prisma.artist.create({
                data: {
                  name: artistName,
                  bio: mergedData.creator.bio,
                  description: mergedData.creator.description,
                  username: mergedData.creator.username,
                  displayName: mergedData.creator.displayName,
                  ensName: mergedData.creator.ensName,
                  isVerified: mergedData.creator.isVerified || false,
                  avatarUrl: mergedData.creator.avatarUrl,
                  profileUrl: mergedData.creator.profileUrl,
                  websiteUrl: mergedData.creator.websiteUrl,
                  twitterHandle: mergedData.creator.twitterHandle || mergedData.creator.socialLinks?.twitter,
                  instagramHandle: mergedData.creator.instagramHandle || mergedData.creator.socialLinks?.instagram,
                  profileData: mergedData.creator.profileData as any,
                  resolutionSource: mergedData.creator.resolutionSource,
                  resolvedAt: mergedData.creator.resolutionSource ? new Date() : undefined,
                  socialLinks: mergedData.creator.socialLinks as any,
                  walletAddresses: walletAddresses as any,
                  updatedAt: new Date()
                }
              });
              
              console.log(`[UnifiedIndexer] Created new artist: ${artist.name} (ID: ${artist.id})`);
            } catch (createError) {
              console.error(`[UnifiedIndexer] Failed to create artist:`, createError);
              throw new Error(`Failed to create artist: ${createError instanceof Error ? createError.message : 'Unknown error'}`);
            }

            if (artist && artist.id) {
              artistId = artist.id;
              result.artistId = artist.id;
              result.createdRecords.artist = true;
            } else {
              console.error(`[UnifiedIndexer] Artist object is missing id property:`, artist);
              throw new Error('Artist creation failed - missing id property');
            }
          } else {
            // Update existing artist and merge wallet addresses if needed
            const existingWallets = Array.isArray(artist.walletAddresses) ? artist.walletAddresses as any[] : [];
            const addressExists = existingWallets.some((w: any) => 
              w.address?.toLowerCase() === creatorAddress.toLowerCase()
            );
            
            let updatedWallets = existingWallets;
            if (!addressExists) {
              updatedWallets = [...existingWallets, {
                address: creatorAddress,
                blockchain: indexRecord.blockchain,
                lastIndexed: new Date().toISOString()
              }];
            }

            // Update the artist with new information
            artist = await this.prisma.artist.update({
              where: { id: artist.id },
              data: {
                updatedAt: new Date(),
                bio: mergedData.creator.bio || artist.bio,
                description: mergedData.creator.description || artist.description,
                username: mergedData.creator.username || artist.username,
                displayName: mergedData.creator.displayName || artist.displayName,
                ensName: mergedData.creator.ensName || artist.ensName,
                isVerified: mergedData.creator.isVerified ?? artist.isVerified,
                avatarUrl: mergedData.creator.avatarUrl || artist.avatarUrl,
                profileUrl: mergedData.creator.profileUrl || artist.profileUrl,
                websiteUrl: mergedData.creator.websiteUrl || artist.websiteUrl,
                twitterHandle: mergedData.creator.twitterHandle || mergedData.creator.socialLinks?.twitter || artist.twitterHandle,
                instagramHandle: mergedData.creator.instagramHandle || mergedData.creator.socialLinks?.instagram || artist.instagramHandle,
                profileData: (mergedData.creator.profileData || artist.profileData) as any,
                resolutionSource: mergedData.creator.resolutionSource || artist.resolutionSource,
                resolvedAt: mergedData.creator.resolutionSource && !artist.resolvedAt ? new Date() : artist.resolvedAt,
                socialLinks: (mergedData.creator.socialLinks || artist.socialLinks) as any,
                walletAddresses: updatedWallets as any
              }
            });

            if (!artist || !artist.id) {
              throw new Error('Failed to update artist - no ID returned');
            }

            artistId = artist.id;
            result.artistId = artist.id;
            result.createdRecords.artist = true;
            console.log(`[UnifiedIndexer] Updated artist with ID: ${artistId}`);
          }
        } catch (artistError) {
          console.error(`[UnifiedIndexer] Error in artist processing:`, artistError);
          throw new Error(`Artist processing failed: ${artistError instanceof Error ? artistError.message : 'Unknown error'}`);
        }
      }

      // Step 2: Create/update Collection
      let collectionId: number | undefined;
      
      if (mergedData.collection) {
        try {
          const collectionSlug = mergedData.collection.slug;
          const collection = await this.prisma.collection.upsert({
            where: { slug: collectionSlug },
            update: {
              title: mergedData.collection.title || collectionSlug,
              description: mergedData.collection.description,
              websiteUrl: mergedData.collection.websiteUrl,
              projectUrl: mergedData.collection.projectUrl,
              mediumUrl: mergedData.collection.mediumUrl,
              imageUrl: mergedData.collection.imageUrl,
              bannerImageUrl: mergedData.collection.bannerImageUrl,
              discordUrl: mergedData.collection.discordUrl,
              telegramUrl: mergedData.collection.telegramUrl,
              chainIdentifier: mergedData.collection.chainIdentifier,
              contractAddresses: mergedData.collection.contractAddresses as any,
              safelistStatus: mergedData.collection.safelistStatus,
              fees: mergedData.collection.fees as any,
              artBlocksProjectId: mergedData.collection.artBlocksProjectId,
              fxhashProjectId: mergedData.collection.fxhashProjectId,
              projectNumber: mergedData.collection.projectNumber,
              collectionCreator: mergedData.collection.collectionCreator,
              curatorAddress: mergedData.collection.curatorAddress,
              parentContract: mergedData.collection.parentContract || mergedData.collection.contractAddress,
              totalSupply: mergedData.collection.totalSupply,
              currentSupply: mergedData.collection.currentSupply,
              mintStartDate: mergedData.collection.mintStartDate ? new Date(mergedData.collection.mintStartDate) : undefined,
              mintEndDate: mergedData.collection.mintEndDate ? new Date(mergedData.collection.mintEndDate) : undefined,
              floorPrice: mergedData.collection.floorPrice,
              volumeTraded: mergedData.collection.volumeTraded,
              externalCollectionId: mergedData.collection.externalCollectionId,
              isGenerativeArt: mergedData.collection.isGenerativeArt || false,
              isSharedContract: mergedData.collection.isSharedContract || false,
              lastSyncedAt: new Date()
            },
            create: {
              slug: collectionSlug,
              title: mergedData.collection.title || collectionSlug,
              description: mergedData.collection.description,
              websiteUrl: mergedData.collection.websiteUrl,
              projectUrl: mergedData.collection.projectUrl,
              mediumUrl: mergedData.collection.mediumUrl,
              imageUrl: mergedData.collection.imageUrl,
              bannerImageUrl: mergedData.collection.bannerImageUrl,
              discordUrl: mergedData.collection.discordUrl,
              telegramUrl: mergedData.collection.telegramUrl,
              chainIdentifier: mergedData.collection.chainIdentifier,
              contractAddresses: mergedData.collection.contractAddresses as any,
              safelistStatus: mergedData.collection.safelistStatus,
              fees: mergedData.collection.fees as any,
              artBlocksProjectId: mergedData.collection.artBlocksProjectId,
              fxhashProjectId: mergedData.collection.fxhashProjectId,
              projectNumber: mergedData.collection.projectNumber,
              collectionCreator: mergedData.collection.collectionCreator,
              curatorAddress: mergedData.collection.curatorAddress,
              parentContract: mergedData.collection.parentContract || mergedData.collection.contractAddress,
              totalSupply: mergedData.collection.totalSupply,
              currentSupply: mergedData.collection.currentSupply,
              mintStartDate: mergedData.collection.mintStartDate ? new Date(mergedData.collection.mintStartDate) : undefined,
              mintEndDate: mergedData.collection.mintEndDate ? new Date(mergedData.collection.mintEndDate) : undefined,
              floorPrice: mergedData.collection.floorPrice,
              volumeTraded: mergedData.collection.volumeTraded,
              externalCollectionId: mergedData.collection.externalCollectionId,
              enabled: true,
              isGenerativeArt: mergedData.collection.isGenerativeArt || false,
              isSharedContract: mergedData.collection.isSharedContract || false,
              lastSyncedAt: new Date()
            }
          });
          collectionId = collection.id;
          result.collectionId = collection.id;
          result.createdRecords.collection = true;
        } catch (error) {
          // Silently continue if collection creation fails
        }
      }

      // Step 3: Link artist to collection if both exist
      if (artistId && collectionId) {
        try {
          await this.prisma.artist.update({
            where: { id: artistId },
            data: {
              Collection: {
                connect: { id: collectionId }
              }
            }
          });
          result.createdRecords.artistCollection = true;
        } catch (error) {
          // Silently continue if linking fails
        }
      }

      // Step 4: For imported artworks, pass through original IPFS URLs without modification
      // Only pin the CIDs to Pinata without uploading/transforming the media files
      let processedImageUrl = mergedData.imageUrl;
      let processedThumbnailUrl = mergedData.thumbnailUrl;
      let processedAnimationUrl = mergedData.animationUrl;

      // Only process media uploads for imported artworks, not indexed ones
      // This ensures media files are uploaded to Pinata with the group ID during import
      if (indexRecord.dataSource !== 'indexer') {
        // For imports, we now pass through original URLs without modification
        // The media processing and upload to Pinata is skipped to preserve original IPFS URLs
        
        // Keep original URLs as-is
        processedImageUrl = mergedData.imageUrl;
        processedThumbnailUrl = mergedData.thumbnailUrl;
        processedAnimationUrl = mergedData.animationUrl;
      }

      // Step 5: Create/update Artwork (this is the import step)
      // Parse mint date if available
      let mintDate: Date | undefined;
      if (mergedData.mintDate) {
        console.log(`[UnifiedIndexer] Processing mint date for ${indexRecord.contractAddress}:${indexRecord.tokenId}: ${mergedData.mintDate}`);
        try {
          mintDate = new Date(mergedData.mintDate);
          if (isNaN(mintDate.getTime())) {
            console.warn(`[UnifiedIndexer] Invalid mint date (NaN) for ${indexRecord.contractAddress}:${indexRecord.tokenId}: ${mergedData.mintDate}`);
            mintDate = undefined;
          } else {
            console.log(`[UnifiedIndexer] Successfully parsed mint date: ${mintDate.toISOString()}`);
          }
        } catch (error) {
          console.error(`[UnifiedIndexer] Failed to parse mint date for ${indexRecord.contractAddress}:${indexRecord.tokenId}: ${mergedData.mintDate}`, error);
          mintDate = undefined;
        }
      } else {
        console.log(`[UnifiedIndexer] No mint date provided for ${indexRecord.contractAddress}:${indexRecord.tokenId}`);
      }

      // Create artwork data object, filtering out undefined values
      const baseArtworkData: any = {
        title: mergedData.title,
        contractAddress: indexRecord.contractAddress,
        tokenId: indexRecord.tokenId,
        blockchain: indexRecord.blockchain,
        tokenStandard: mergedData.tokenStandard,
        uid: indexRecord.nftUid
      };

      // Add optional fields only if they have values
      if (mergedData.description !== undefined) {
        baseArtworkData.description = mergedData.description;
      }
      
      if (processedImageUrl !== undefined) {
        baseArtworkData.imageUrl = processedImageUrl;
      }
      
      if (processedAnimationUrl !== undefined) {
        baseArtworkData.animationUrl = processedAnimationUrl;
      }
      
      if (mergedData.generatorUrl !== undefined) {
        baseArtworkData.generatorUrl = mergedData.generatorUrl;
      }
      
      if (mergedData.metadataUrl !== undefined) {
        baseArtworkData.metadataUrl = mergedData.metadataUrl;
      }
      
      if (mergedData.mime !== undefined) {
        baseArtworkData.mime = mergedData.mime;
      }
      
      if (mergedData.supply !== undefined) {
        baseArtworkData.supply = mergedData.supply;
      }
      
      if (mintDate !== undefined) {
        baseArtworkData.mintDate = mintDate;
      }
      
      if (mergedData.dimensions !== undefined) {
        baseArtworkData.dimensions = mergedData.dimensions;
      }
      
      if (mergedData.attributes !== undefined) {
        baseArtworkData.attributes = mergedData.attributes;
      }
      
      if (mergedData.features !== undefined) {
        baseArtworkData.features = mergedData.features;
      }

      // Handle thumbnail URL with special logic
      const thumbnailUrl = (() => {
        // If we have a problematic thumbnail, use the display/artifact image instead
        if (isProblematicThumbnail(processedThumbnailUrl) || 
            isProblematicThumbnail(mergedData.thumbnailUrl)) {
          console.log(`[UnifiedIndexer] Detected problematic thumbnail for ${indexRecord.contractAddress}:${indexRecord.tokenId}, using display/artifact image instead`);
          return processedImageUrl || mergedData.imageUrl;
        }
        
        // Don't store thumbnail URL if it's the same as the image URL
        if (processedThumbnailUrl && processedImageUrl && processedThumbnailUrl === processedImageUrl) {
          console.log(`[UnifiedIndexer] Thumbnail URL is same as image URL for ${indexRecord.contractAddress}:${indexRecord.tokenId}, storing null to avoid duplication`);
          return null;
        }
        
        // Don't store thumbnail URL if it's the same as the original image URL
        if (processedThumbnailUrl && mergedData.imageUrl && processedThumbnailUrl === mergedData.imageUrl) {
          console.log(`[UnifiedIndexer] Thumbnail URL is same as original image URL for ${indexRecord.contractAddress}:${indexRecord.tokenId}, storing null to avoid duplication`);
          return null;
        }
        
        // Return the thumbnail URL if it's different from the image URL, or null if no thumbnail
        return processedThumbnailUrl || null;
      })();

      if (thumbnailUrl !== undefined) {
        baseArtworkData.thumbnailUrl = thumbnailUrl;
      }

      // Step 6: Create/update Artwork (this is the import step)
      const artwork = await this.prisma.artwork.upsert({
        where: {
          contractAddress_tokenId: {
            contractAddress: indexRecord.contractAddress,
            tokenId: indexRecord.tokenId
          }
        },
        update: baseArtworkData,
        create: {
          ...baseArtworkData,
          ...(collectionId ? { collectionId } : {})
        }
      });

      result.artworkId = artwork.id;
      result.createdRecords.artwork = true;

      // Step 7: Link artist to artwork using direct many-to-many relationship
      if (artistId) {
        try {
          await this.prisma.artwork.update({
            where: { id: artwork.id },
            data: {
              Artist: {
                connect: { id: artistId }
              }
            } as any
          });
        } catch (error) {
          // Silently continue if linking fails
        }
      }

      // Update index record
      await this.prisma.artworkIndex.update({
        where: { id: indexId },
        data: {
          artworkId: artwork.id,
          importStatus: 'imported'
        }
      });

      // Step 8: Pin any remaining IPFS URLs that weren't uploaded to Pinata
      // This is for cases where media processing failed or for metadata URLs
      try {
        const { extractCidsFromArtwork, pinCidToPinata } = await import('$lib/pinataHelpers');
        
        const artworkForPinning = {
          title: artwork.title,
          imageUrl: artwork.imageUrl,
          thumbnailUrl: artwork.thumbnailUrl,
          animationUrl: artwork.animationUrl,
          metadataUrl: artwork.metadataUrl
        };
        
        const cids = extractCidsFromArtwork(artworkForPinning);
        if (cids.length > 0) {
          
          for (const cid of cids) {
            try {
              const pinName = `${artwork.title} - ${cid}`;
              await pinCidToPinata(cid, pinName);
            } catch (pinError) {
              console.error(`Failed to pin CID ${cid} for artwork ${artwork.title}:`, pinError);
              // Continue with other CIDs even if one fails
            }
          }
        }
      } catch (pinningError) {
        console.error(`Error during Pinata pinning for artwork ${artwork.title}:`, pinningError);
        // Don't fail the import if pinning fails
      }

      result.success = true;

    } catch (error) {
      console.error(`[UnifiedIndexer] Error processing index ${indexId}:`, error);
      if (result.errors) {
        result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
      
      // Update index record with error
      await this.prisma.artworkIndex.update({
        where: { id: indexId },
        data: {
          importStatus: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }

    return result;
  }

  /**
   * Process import queue by status
   */
  async processQueue(
    status: ImportStatus = 'pending',
    limit: number = 50
  ): Promise<ImportResult[]> {
    const records = await this.prisma.artworkIndex.findMany({
      where: { importStatus: status },
      take: limit,
      orderBy: { createdAt: 'asc' }
    });

    const results: ImportResult[] = [];

    for (const record of records) {
      try {
        const result = await this.processIndexedData(record.id);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          createdRecords: {}
        });
      }
    }

    return results;
  }
} 