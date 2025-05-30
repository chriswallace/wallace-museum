import type { PrismaClient } from '@prisma/client';
import type { 
  DataSource, 
  Blockchain, 
  ImportStatus, 
  ImportResult 
} from '../types/indexing';
import { pinCidToPinata, extractCidsFromArtwork, convertToIpfsUrl } from '$lib/pinataHelpers';

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

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
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

    // Store in ArtworkIndex
    const indexData = {
      nftUid,
      blockchain,
      dataSource: source,
      contractAddress: finalContractAddress.toLowerCase(),
      tokenId: finalTokenId,
      rawResponse: JSON.stringify(data),
      normalizedData: JSON.stringify(indexerData),
      importStatus: 'pending' as ImportStatus
    };

    // Upsert the index record
    const indexed = await this.prisma.artworkIndex.upsert({
      where: { nftUid },
      update: {
        rawResponse: indexData.rawResponse,
        normalizedData: indexData.normalizedData,
        dataSource: source,
        blockchain,
        lastAttempt: new Date()
      },
      create: indexData
    });

    return { indexId: indexed.id, nftUid };
  }

  /**
   * Process indexed data to create final models
   */
  async processIndexedData(indexId: number): Promise<ImportResult> {
    const indexRecord = await this.prisma.artworkIndex.findUnique({
      where: { id: indexId }
    });

    if (!indexRecord) {
      throw new Error('Index record not found');
    }

    // Parse the normalized data properly
    let indexerData: IndexerData;
    try {
      if (typeof indexRecord.normalizedData === 'string') {
        indexerData = JSON.parse(indexRecord.normalizedData);
      } else {
        indexerData = indexRecord.normalizedData as unknown as IndexerData;
      }
    } catch (error) {
      throw new Error('Failed to parse normalized data');
    }

    const result: ImportResult = {
      success: true,
      errors: [],
      createdRecords: {}
    };

    try {
      // Step 1: Create/update Artist with wallet addresses stored as JSON
      let artistId: number | undefined;

      if (indexerData.creator?.address) {
        try {
          // Create or find artist by wallet address
          const creatorAddress = indexerData.creator.address.toLowerCase();
          const baseArtistName = indexerData.creator.username || `Artist_${creatorAddress.slice(-8)}`;
          
          // First, search all artists to find one with this wallet address
          let artist: any = null;
          const allArtists: any[] = await this.prisma.artist.findMany();

          // Check if any artist has this wallet address
          artist = allArtists.find(a => {
            if (!a.walletAddresses || !Array.isArray(a.walletAddresses)) return false;
            return (a.walletAddresses as any[]).some((w: any) => 
              w.address?.toLowerCase() === creatorAddress
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
                  bio: indexerData.creator.bio,
                  description: indexerData.creator.description,
                  username: indexerData.creator.username,
                  displayName: indexerData.creator.displayName,
                  ensName: indexerData.creator.ensName,
                  isVerified: indexerData.creator.isVerified || false,
                  avatarUrl: indexerData.creator.avatarUrl,
                  profileUrl: indexerData.creator.profileUrl,
                  websiteUrl: indexerData.creator.websiteUrl,
                  twitterHandle: indexerData.creator.twitterHandle || indexerData.creator.socialLinks?.twitter,
                  instagramHandle: indexerData.creator.instagramHandle || indexerData.creator.socialLinks?.instagram,
                  profileData: indexerData.creator.profileData as any,
                  resolutionSource: indexerData.creator.resolutionSource,
                  resolvedAt: indexerData.creator.resolutionSource ? new Date() : undefined,
                  socialLinks: indexerData.creator.socialLinks as any,
                  walletAddresses: walletAddresses as any
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
            try {
              console.log(`[UnifiedIndexer] Found existing artist with ID: ${artist.id}`);
              
              const existingWallets = Array.isArray(artist.walletAddresses) ? artist.walletAddresses as any[] : [];
              const addressExists = existingWallets.some((w: any) => 
                w.address?.toLowerCase() === creatorAddress
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
                  bio: indexerData.creator.bio || artist.bio,
                  description: indexerData.creator.description || artist.description,
                  username: indexerData.creator.username || artist.username,
                  displayName: indexerData.creator.displayName || artist.displayName,
                  ensName: indexerData.creator.ensName || artist.ensName,
                  isVerified: indexerData.creator.isVerified ?? artist.isVerified,
                  avatarUrl: indexerData.creator.avatarUrl || artist.avatarUrl,
                  profileUrl: indexerData.creator.profileUrl || artist.profileUrl,
                  websiteUrl: indexerData.creator.websiteUrl || artist.websiteUrl,
                  twitterHandle: indexerData.creator.twitterHandle || indexerData.creator.socialLinks?.twitter || artist.twitterHandle,
                  instagramHandle: indexerData.creator.instagramHandle || indexerData.creator.socialLinks?.instagram || artist.instagramHandle,
                  profileData: (indexerData.creator.profileData || artist.profileData) as any,
                  resolutionSource: indexerData.creator.resolutionSource || artist.resolutionSource,
                  resolvedAt: indexerData.creator.resolutionSource && !artist.resolvedAt ? new Date() : artist.resolvedAt,
                  socialLinks: (indexerData.creator.socialLinks || artist.socialLinks) as any,
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
            } catch (updateError) {
              console.error(`[UnifiedIndexer] Failed to update artist:`, updateError);
              throw new Error(`Failed to update artist: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
            }
          }
        } catch (artistError) {
          console.error(`[UnifiedIndexer] Error in artist processing:`, artistError);
          throw new Error(`Artist processing failed: ${artistError instanceof Error ? artistError.message : 'Unknown error'}`);
        }
      }

      // Step 2: Create/update Collection
      let collectionId: number | undefined;
      
      if (indexerData.collection) {
        try {
          const collectionSlug = indexerData.collection.slug;
          const collection = await this.prisma.collection.upsert({
            where: { slug: collectionSlug },
            update: {
              title: indexerData.collection.title || collectionSlug,
              description: indexerData.collection.description,
              websiteUrl: indexerData.collection.websiteUrl,
              projectUrl: indexerData.collection.projectUrl,
              mediumUrl: indexerData.collection.mediumUrl,
              imageUrl: indexerData.collection.imageUrl,
              bannerImageUrl: indexerData.collection.bannerImageUrl,
              discordUrl: indexerData.collection.discordUrl,
              telegramUrl: indexerData.collection.telegramUrl,
              chainIdentifier: indexerData.collection.chainIdentifier,
              contractAddresses: indexerData.collection.contractAddresses as any,
              safelistStatus: indexerData.collection.safelistStatus,
              fees: indexerData.collection.fees as any,
              artBlocksProjectId: indexerData.collection.artBlocksProjectId,
              fxhashProjectId: indexerData.collection.fxhashProjectId,
              projectNumber: indexerData.collection.projectNumber,
              collectionCreator: indexerData.collection.collectionCreator,
              curatorAddress: indexerData.collection.curatorAddress,
              parentContract: indexerData.collection.parentContract || indexerData.collection.contractAddress,
              totalSupply: indexerData.collection.totalSupply,
              currentSupply: indexerData.collection.currentSupply,
              mintStartDate: indexerData.collection.mintStartDate ? new Date(indexerData.collection.mintStartDate) : undefined,
              mintEndDate: indexerData.collection.mintEndDate ? new Date(indexerData.collection.mintEndDate) : undefined,
              floorPrice: indexerData.collection.floorPrice,
              volumeTraded: indexerData.collection.volumeTraded,
              externalCollectionId: indexerData.collection.externalCollectionId,
              isGenerativeArt: indexerData.collection.isGenerativeArt || false,
              isSharedContract: indexerData.collection.isSharedContract || false,
              lastSyncedAt: new Date()
            },
            create: {
              slug: collectionSlug,
              title: indexerData.collection.title || collectionSlug,
              description: indexerData.collection.description,
              websiteUrl: indexerData.collection.websiteUrl,
              projectUrl: indexerData.collection.projectUrl,
              mediumUrl: indexerData.collection.mediumUrl,
              imageUrl: indexerData.collection.imageUrl,
              bannerImageUrl: indexerData.collection.bannerImageUrl,
              discordUrl: indexerData.collection.discordUrl,
              telegramUrl: indexerData.collection.telegramUrl,
              chainIdentifier: indexerData.collection.chainIdentifier,
              contractAddresses: indexerData.collection.contractAddresses as any,
              safelistStatus: indexerData.collection.safelistStatus,
              fees: indexerData.collection.fees as any,
              artBlocksProjectId: indexerData.collection.artBlocksProjectId,
              fxhashProjectId: indexerData.collection.fxhashProjectId,
              projectNumber: indexerData.collection.projectNumber,
              collectionCreator: indexerData.collection.collectionCreator,
              curatorAddress: indexerData.collection.curatorAddress,
              parentContract: indexerData.collection.parentContract || indexerData.collection.contractAddress,
              totalSupply: indexerData.collection.totalSupply,
              currentSupply: indexerData.collection.currentSupply,
              mintStartDate: indexerData.collection.mintStartDate ? new Date(indexerData.collection.mintStartDate) : undefined,
              mintEndDate: indexerData.collection.mintEndDate ? new Date(indexerData.collection.mintEndDate) : undefined,
              floorPrice: indexerData.collection.floorPrice,
              volumeTraded: indexerData.collection.volumeTraded,
              externalCollectionId: indexerData.collection.externalCollectionId,
              enabled: true,
              isGenerativeArt: indexerData.collection.isGenerativeArt || false,
              isSharedContract: indexerData.collection.isSharedContract || false,
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
              collections: {
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
      let processedImageUrl = indexerData.imageUrl;
      let processedThumbnailUrl = indexerData.thumbnailUrl;
      let processedAnimationUrl = indexerData.animationUrl;

      // Only process media uploads for imported artworks, not indexed ones
      // This ensures media files are uploaded to Pinata with the group ID during import
      if (indexRecord.dataSource !== 'indexer') {
        // For imports, we now pass through original URLs without modification
        // The media processing and upload to Pinata is skipped to preserve original IPFS URLs
        
        // Keep original URLs as-is
        processedImageUrl = indexerData.imageUrl;
        processedThumbnailUrl = indexerData.thumbnailUrl;
        processedAnimationUrl = indexerData.animationUrl;
      }

      // Step 5: Create/update Artwork (this is the import step)
      // Parse mint date if available
      let mintDate: Date | undefined;
      if (indexerData.mintDate) {
        console.log(`[UnifiedIndexer] Processing mint date for ${indexRecord.contractAddress}:${indexRecord.tokenId}: ${indexerData.mintDate}`);
        try {
          mintDate = new Date(indexerData.mintDate);
          if (isNaN(mintDate.getTime())) {
            console.warn(`[UnifiedIndexer] Invalid mint date (NaN) for ${indexRecord.contractAddress}:${indexRecord.tokenId}: ${indexerData.mintDate}`);
            mintDate = undefined;
          } else {
            console.log(`[UnifiedIndexer] Successfully parsed mint date: ${mintDate.toISOString()}`);
          }
        } catch (error) {
          console.error(`[UnifiedIndexer] Failed to parse mint date for ${indexRecord.contractAddress}:${indexRecord.tokenId}: ${indexerData.mintDate}`, error);
          mintDate = undefined;
        }
      } else {
        console.log(`[UnifiedIndexer] No mint date provided for ${indexRecord.contractAddress}:${indexRecord.tokenId}`);
      }

      const baseArtworkData = {
        title: indexerData.title,
        description: indexerData.description,
        contractAddress: indexRecord.contractAddress,
        tokenId: indexRecord.tokenId,
        blockchain: indexRecord.blockchain,
        tokenStandard: indexerData.tokenStandard,
        imageUrl: processedImageUrl,
        thumbnailUrl: (() => {
          // Check if thumbnail is the generic circle image from Tezos
          const GENERIC_CIRCLE_IPFS = 'ipfs://QmNrhZHUaEqxhyLfqoq1mtHSipkWHeT31LNHb1QEbDHgnc';
          
          // If we have the generic circle thumbnail, use the display/artifact image instead
          if (processedThumbnailUrl === GENERIC_CIRCLE_IPFS || 
              indexerData.thumbnailUrl === GENERIC_CIRCLE_IPFS) {
            console.log(`[UnifiedIndexer] Detected generic circle thumbnail for ${indexRecord.contractAddress}:${indexRecord.tokenId}, using display/artifact image instead`);
            return processedImageUrl || indexerData.imageUrl;
          }
          
          // Don't store thumbnail URL if it's the same as the image URL
          if (processedThumbnailUrl && processedImageUrl && processedThumbnailUrl === processedImageUrl) {
            console.log(`[UnifiedIndexer] Thumbnail URL is same as image URL for ${indexRecord.contractAddress}:${indexRecord.tokenId}, storing null to avoid duplication`);
            return null;
          }
          
          // Don't store thumbnail URL if it's the same as the original image URL
          if (processedThumbnailUrl && indexerData.imageUrl && processedThumbnailUrl === indexerData.imageUrl) {
            console.log(`[UnifiedIndexer] Thumbnail URL is same as original image URL for ${indexRecord.contractAddress}:${indexRecord.tokenId}, storing null to avoid duplication`);
            return null;
          }
          
          // Return the thumbnail URL if it's different from the image URL, or null if no thumbnail
          return processedThumbnailUrl || null;
        })(),
        animationUrl: processedAnimationUrl,
        generatorUrl: indexerData.generatorUrl,
        metadataUrl: indexerData.metadataUrl,
        mime: indexerData.mime,
        supply: indexerData.supply,
        mintDate: mintDate,
        dimensions: indexerData.dimensions ? indexerData.dimensions : undefined,
        attributes: indexerData.attributes || undefined,
        features: indexerData.features || undefined,
        uid: indexRecord.nftUid
      };

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

      // Step 6: Link artist to artwork using direct many-to-many relationship
      if (artistId) {
        try {
          await this.prisma.artwork.update({
            where: { id: artwork.id },
            data: {
              artists: {
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

      // Step 7: Pin any remaining IPFS URLs that weren't uploaded to Pinata
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

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.prisma.artworkIndex.update({
        where: { id: indexId },
        data: {
          importStatus: 'failed',
          errorMessage
        }
      });

      return {
        success: false,
        errors: [errorMessage],
        createdRecords: {}
      };
    }
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