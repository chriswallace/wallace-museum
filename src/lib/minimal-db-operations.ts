import { PrismaClient, Prisma } from '@prisma/client';
import type { MinimalNFTData, MinimalCollectionData, MinimalCreatorData } from './types/minimal-nft';
import { detectBlockchainFromContract, detectBlockchain } from '$lib/utils/walletUtils.js';
import { cachedArtworkQueries, cachedCollectionQueries, cachedSystemQueries, cachedArtistQueries, cachedSearchQueries } from '$lib/cache/db-cache.js';

/**
 * Minimal database operations - direct mapping from minimal data to Prisma schema
 * Eliminates complex transformation layers and redundant data storage
 * Now includes Redis caching for read operations
 */
export class MinimalDBOperations {
  private prisma: PrismaClient;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  /**
   * Store NFT data in the index only - does NOT import to final models
   * This method only creates/updates ArtworkIndex records for later processing
   */
  async storeNFT(nftData: MinimalNFTData, type: 'owned' | 'created' = 'owned', indexingWalletAddress?: string): Promise<{ indexId: number }> {
    // Validate required fields
    if (!nftData.contractAddress || !nftData.tokenId) {
      throw new Error(`Missing required fields: contractAddress=${nftData.contractAddress}, tokenId=${nftData.tokenId}`);
    }

    const contractAddress = nftData.contractAddress.toLowerCase();
    const uid = `${contractAddress}:${nftData.tokenId}`;
    
    // Log NFT data structure for debugging (first few only to avoid spam)
    if (Math.random() < 0.1) { // Log 10% of NFTs for debugging
      console.log(`[MinimalDBOperations] Sample NFT data structure:`, {
        contractAddress: nftData.contractAddress,
        tokenId: nftData.tokenId,
        blockchain: nftData.blockchain,
        title: nftData.title,
        hasCreator: !!nftData.creator,
        hasCollection: !!nftData.collection,
        dataKeys: Object.keys(nftData)
      });
    }
    
    // Determine blockchain based on contract address format instead of relying on API data
    const blockchain = detectBlockchainFromContract(contractAddress);
    
    // Determine if this NFT was created by the wallet being indexed
    let nftType = type;
    if (indexingWalletAddress && nftData.creator?.address) {
      const creatorAddress = nftData.creator.address;
      const walletAddress = indexingWalletAddress;
      
      // If the creator address matches the wallet being indexed, mark as created (case-insensitive)
      if (creatorAddress.toLowerCase() === walletAddress.toLowerCase()) {
        nftType = 'created';
      }
    }

    // Create enhanced normalized data that includes ownership information
    let enhancedNormalizedData: any = { ...nftData };
    
    // If we have an indexing wallet address, ensure it's included in the owners array
    if (indexingWalletAddress) {
      // Initialize owners array if it doesn't exist
      if (!enhancedNormalizedData.owners) {
        enhancedNormalizedData.owners = [];
      }
      
      // Add the indexing wallet as an owner if it's not already there
      const existingOwner = enhancedNormalizedData.owners.find((owner: any) => 
        owner.address?.toLowerCase() === indexingWalletAddress.toLowerCase()
      );
      
      if (!existingOwner) {
        enhancedNormalizedData.owners.push({
          address: indexingWalletAddress,
          quantity: 1 // Default quantity for ERC721 tokens
        });
        console.log(`[MinimalDBOperations] Added wallet ${indexingWalletAddress} as owner for ${uid}`);
      }
    }
    
    // Check if record already exists
    const existingRecord = await this.prisma.artworkIndex.findUnique({
      where: { 
        contractAddress_tokenId: {
          contractAddress: contractAddress,
          tokenId: nftData.tokenId
        }
      }
    });

    if (existingRecord) {
      // Record already exists - update the type if it's more specific (created > owned)
      // and update lastAttempt to track that we tried to import this
      const updateData: any = {
        lastAttempt: new Date(),
        updatedAt: new Date(),
        normalizedData: enhancedNormalizedData as unknown as Prisma.InputJsonValue // Update with enhanced data
      };
      
      // Only update type if we're upgrading from 'owned' to 'created'
      if (existingRecord.type === 'owned' && nftType === 'created') {
        updateData.type = 'created';
        console.log(`[MinimalDBOperations] Upgrading type from 'owned' to 'created' for ${uid}`);
      }
      
      await this.prisma.artworkIndex.update({
        where: { id: existingRecord.id },
        data: updateData
      });
      
      console.log(`[MinimalDBOperations] Updated existing index record for ${uid} (type: ${existingRecord.type}${updateData.type ? ` -> ${updateData.type}` : ''})`);
      return { indexId: existingRecord.id };
    }

    // Validate data before creating record
    try {
      // Create new index record only - no importing to final models
      const indexRecord = await this.prisma.artworkIndex.create({
        data: {
          nftUid: uid,
          type: nftType,
          blockchain: blockchain,
          dataSource: blockchain === 'tezos' ? 'objkt' : 'opensea',
          contractAddress: contractAddress,
          tokenId: nftData.tokenId,
          rawResponse: nftData as unknown as Prisma.InputJsonValue,
          normalizedData: enhancedNormalizedData as unknown as Prisma.InputJsonValue, // Use enhanced data
          importStatus: 'pending', // Set to pending for later import
          updatedAt: new Date()
        }
      });
      
      console.log(`[MinimalDBOperations] Created new index record for ${uid} with type: ${nftType}`);
      return { indexId: indexRecord.id };
    } catch (error: any) {
      console.error(`[MinimalDBOperations] Database error creating index record for ${uid}:`, {
        error: error.message,
        code: error.code,
        nftData: {
          contractAddress,
          tokenId: nftData.tokenId,
          blockchain,
          uid,
          nftType,
          dataSource: blockchain === 'tezos' ? 'objkt' : 'opensea'
        }
      });
      throw error;
    }
  }
  
  /**
   * Upsert collection data
   */
  async upsertCollection(collectionData: MinimalCollectionData): Promise<{ id: number }> {
    const contractAddress = collectionData.contractAddress;
    
    // Determine blockchain based on contract address format
    const blockchain = detectBlockchainFromContract(contractAddress);
    
    const collection = await this.prisma.collection.upsert({
      where: { slug: collectionData.slug },
      create: {
        slug: collectionData.slug,
        title: collectionData.title,
        description: collectionData.description,
        enabled: true,
        chainIdentifier: blockchain,
        contractAddresses: [{ 
          address: contractAddress, 
          chain: blockchain 
        }] as Prisma.InputJsonValue,
        websiteUrl: collectionData.websiteUrl,
        discordUrl: collectionData.discordUrl,
        telegramUrl: collectionData.telegramUrl,
        imageUrl: collectionData.imageUrl,
        isGenerativeArt: collectionData.isGenerativeArt || false,
        isSharedContract: collectionData.isSharedContract || false,
        projectNumber: collectionData.projectNumber,
        parentContract: contractAddress
      },
      update: {
        title: collectionData.title,
        description: collectionData.description,
        websiteUrl: collectionData.websiteUrl,
        discordUrl: collectionData.discordUrl,
        telegramUrl: collectionData.telegramUrl,
        imageUrl: collectionData.imageUrl,
        isGenerativeArt: collectionData.isGenerativeArt || false,
        isSharedContract: collectionData.isSharedContract || false,
        projectNumber: collectionData.projectNumber
      }
    });
    
    // Invalidate collection cache since collection was created/updated
    await cachedCollectionQueries.invalidate(collection.id, collection.slug);
    
    // Invalidate search cache since collection data has changed
    await cachedSearchQueries.invalidate();
    
    return collection;
  }
  
  /**
   * Upsert wallet address data (requires artist to be created first)
   */
  async upsertWalletAddress(creatorData: MinimalCreatorData): Promise<{ id: number }> {
    const walletAddress = creatorData.address;
    
    // Determine blockchain based on wallet address format
    const blockchain = detectBlockchain(walletAddress);
    
    // Check if walletAddress table exists, if not use a fallback approach
    try {
      // First create or find the artist
      const artistName = `${creatorData.username}`;
      const artist = await this.prisma.artist.upsert({
        where: { name: artistName },
        update: { updatedAt: new Date() },
        create: {
          name: artistName,
          updatedAt: new Date()
        }
      });

      // Then create the wallet address with the artist ID
      return await (this.prisma as any).walletAddress.upsert({
        where: { 
          address_blockchain: {
            address: walletAddress,
            blockchain: blockchain
          }
        },
        create: {
          address: walletAddress,
          blockchain: blockchain,
          artistId: artist.id,
          enabled: true,
          lastIndexed: new Date()
        },
        update: {
          lastIndexed: new Date()
        }
      });
    } catch (error) {
      // Fallback: just return a mock ID for now
      console.warn('WalletAddress table not yet available, using fallback');
      return { id: 1 };
    }
  }
  
  /**
   * Batch store NFTs with connection management
   */
  async batchStoreNFTs(
    nfts: MinimalNFTData[],
    type: 'owned' | 'created' = 'owned',
    indexingWalletAddress?: string
  ): Promise<{
    stored: number;
    errors: Array<{ index: number; error: string; nft: MinimalNFTData }>;
  }> {
    const stored: number[] = [];
    const errors: Array<{ index: number; error: string; nft: MinimalNFTData }> = [];
    let skipped = 0;

    console.log(`[MinimalDBOperations] Storing batch of ${nfts.length} NFTs with type: ${type}${indexingWalletAddress ? ` for wallet: ${indexingWalletAddress}` : ''}`);

    // Process in smaller batches to avoid connection pool exhaustion
    const batchSize = 5; // Reduced from 10 to be more conservative
    for (let i = 0; i < nfts.length; i += batchSize) {
      const batch = nfts.slice(i, i + batchSize);
      
      console.log(`[MinimalDBOperations] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(nfts.length / batchSize)} (${batch.length} items)`);
      
      // Store batch with retry logic
      for (let j = 0; j < batch.length; j++) {
        const nft = batch[j];
        const index = i + j;
        
        // Validate NFT data before attempting to store
        if (!nft.contractAddress || !nft.tokenId) {
          console.warn(`[MinimalDBOperations] Skipping NFT ${index} due to missing required fields:`, {
            contractAddress: nft.contractAddress,
            tokenId: nft.tokenId,
            title: nft.title
          });
          skipped++;
          continue;
        }
        
        let retries = 3;
        let lastError: Error | null = null;
        let stored_successfully = false;
        
        while (retries > 0) {
          try {
            const result = await this.storeNFT(nft, type, indexingWalletAddress);
            stored.push(result.indexId);
            stored_successfully = true;
            console.log(`[MinimalDBOperations] Successfully stored NFT ${nft.contractAddress}:${nft.tokenId} with index ID: ${result.indexId}`);
            break; // Success, exit retry loop
          } catch (error: any) {
            lastError = error;
            
            // Log the specific error details for debugging
            console.error(`[MinimalDBOperations] Error storing NFT ${nft.contractAddress}:${nft.tokenId} (attempt ${4 - retries}/3):`, {
              error: error.message,
              code: error.code,
              nftData: {
                contractAddress: nft.contractAddress,
                tokenId: nft.tokenId,
                blockchain: nft.blockchain,
                title: nft.title
              }
            });
            
            // Check if it's a connection pool error
            if (error.code === 'P2024' || error.message?.includes('connection pool')) {
              console.warn(`[MinimalDBOperations] Connection pool error, retrying in 2s... (${retries} retries left)`);
              await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay
              retries--;
            } else {
              // Non-connection pool error, don't retry
              console.error(`[MinimalDBOperations] Non-retryable error for NFT ${nft.contractAddress}:${nft.tokenId}:`, error.message);
              break;
            }
          }
        }
        
        if (!stored_successfully) {
          errors.push({
            index,
            error: lastError?.message || 'Unknown error',
            nft
          });
          console.error(`[MinimalDBOperations] Failed to store NFT ${nft.contractAddress}:${nft.tokenId} after all retries:`, lastError?.message);
        }
      }
      
      // Add longer delay between batches to prevent overwhelming the connection pool
      if (i + batchSize < nfts.length) {
        console.log(`[MinimalDBOperations] Waiting 1s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Increased from 100ms
      }
    }

    console.log(`[MinimalDBOperations] Batch complete: ${stored.length} stored, ${errors.length} errors, ${skipped} skipped due to missing data (total processed: ${stored.length + errors.length + skipped}/${nfts.length})`);
    return { stored: stored.length, errors };
  }
  
  /**
   * Get NFT by contract and token ID with caching
   */
  async getNFT(contractAddress: string, tokenId: string, skipCache = false) {
    const uid = `${contractAddress.toLowerCase()}:${tokenId}`;
    
    return cachedArtworkQueries.getByUid(
      uid,
      async () => {
        return this.prisma.artwork.findUnique({
          where: { uid },
          include: {
            Collection: true,
            ArtworkIndex: true,
            Artist: true
          }
        });
      },
      { skipCache }
    );
  }
  
  /**
   * Search NFTs by various criteria with caching
   */
  async searchNFTs(params: {
    title?: string;
    walletAddress?: string;
    collectionSlug?: string;
    blockchain?: string;
    limit?: number;
    offset?: number;
  }, skipCache = false) {
    const where: any = {};
    
    if (params.title) {
      where.title = { contains: params.title, mode: 'insensitive' };
    }
    
    if (params.blockchain) {
      where.blockchain = params.blockchain;
    }
    
    if (params.collectionSlug) {
      where.Collection = { slug: params.collectionSlug };
    }

    // Create cache key based on search parameters
    const page = Math.floor((params.offset || 0) / (params.limit || 50)) + 1;
    const limit = params.limit || 50;
    
    return cachedArtworkQueries.getPaginated(
      page,
      limit,
      params,
      async () => {
        const results = await this.prisma.artwork.findMany({
          where,
          include: {
            Collection: true
          },
          take: params.limit || 50,
          skip: params.offset || 0,
          orderBy: { id: 'desc' }
        });
        
        return {
          artworks: results,
          totalCount: await this.prisma.artwork.count({ where }),
          page,
          limit
        };
      },
      { skipCache }
    );
  }
  
  /**
   * Get indexing statistics with caching
   */
  async getIndexingStats(skipCache = false) {
    return cachedSystemQueries.getIndexStats(
      async () => {
        const [
          totalArtworks,
          totalCollections,
          pendingIndexes,
          failedIndexes
        ] = await Promise.all([
          this.prisma.artwork.count(),
          this.prisma.collection.count(),
          this.prisma.artworkIndex.count({ where: { importStatus: 'pending' } }),
          this.prisma.artworkIndex.count({ where: { importStatus: 'failed' } })
        ]);

        return {
          totalArtworks,
          totalCollections,
          pendingIndexes,
          failedIndexes
        };
      },
      { skipCache }
    );
  }

  /**
   * Invalidate cache after data modifications
   */
  async invalidateRelatedCache(type: 'artwork' | 'collection' | 'artist', id?: number | string) {
    switch (type) {
      case 'artwork':
        await cachedArtworkQueries.invalidate(
          typeof id === 'number' ? id : undefined,
          typeof id === 'string' ? id : undefined
        );
        break;
      case 'collection':
        await cachedCollectionQueries.invalidate(
          typeof id === 'number' ? id : undefined,
          typeof id === 'string' ? id : undefined
        );
        break;
      case 'artist':
        await cachedArtistQueries.invalidate(
          typeof id === 'number' ? id : undefined
        );
        break;
    }
  }
} 