import type { IndexerData } from './indexing/unified-indexer';

export interface NormalizedNFT extends IndexerData {
  contractAddress: string;
  tokenId: string;
}

/**
 * Import normalized NFT data using the unified endpoint
 */
export async function importNormalizedNFTs(
  nfts: NormalizedNFT[],
  source: string = 'unified'
): Promise<{
  success: boolean;
  imported: number;
  failed: number;
  total: number;
  details?: any;
  error?: string;
}> {
  try {
    const response = await fetch('/api/admin/import-nft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nfts,
        source
      })
    });

    if (!response.ok) {
      throw new Error(`Import failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      imported: 0,
      failed: 0,
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Convert your normalized data format to the expected format
 * This is the main function you'll use to prepare data for import
 */
export function convertToNormalizedNFT(
  normalizedData: any,
  contractAddress: string,
  tokenId: string
): NormalizedNFT {
  return {
    title: normalizedData.title,
    description: normalizedData.description,
    imageUrl: normalizedData.imageUrl,
    animationUrl: normalizedData.animationUrl,
    thumbnailUrl: normalizedData.thumbnailUrl,
    metadataUrl: normalizedData.metadataUrl,
    mime: normalizedData.mime,
    blockchain: normalizedData.blockchain,
    tokenStandard: normalizedData.tokenStandard,
    supply: normalizedData.supply,
    mintDate: normalizedData.mintDate,
    dimensions: normalizedData.dimensions,
    attributes: normalizedData.attributes,
    isGenerativeArt: normalizedData.isGenerativeArt,
    creator: normalizedData.creator,
    collection: normalizedData.collection,
    contractAddress,
    tokenId
  };
}

/**
 * Helper to import a single NFT from your normalized data examples
 */
export async function importSingleNFT(
  normalizedData: any,
  contractAddress: string,
  tokenId: string,
  source: string = 'unified'
) {
  const nft = convertToNormalizedNFT(normalizedData, contractAddress, tokenId);
  return await importNormalizedNFTs([nft], source);
} 