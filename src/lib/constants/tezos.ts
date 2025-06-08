/**
 * Tezos blockchain constants
 */

/**
 * Wrapped Tezos contract address - this should never be indexed as it's not a real NFT
 * Objkt.com shows this in user inventories but it has no meaningful NFT data
 */
export const WRAPPED_TEZOS_CONTRACT = 'KT1TjnZYs5CGLbmV6yuW169P8Pnr9BiVwwjz';

/**
 * List of contract addresses that should be excluded from indexing
 */
export const EXCLUDED_TEZOS_CONTRACTS = [
  WRAPPED_TEZOS_CONTRACT
];

/**
 * Versum and Hic et Nunc contract addresses that should use objkt.com thumbnails
 */
export const VERSUM_HIC_ET_NUNC_CONTRACTS = [
  'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton', // hic et nunc main
  'KT1Hkg5qeNhfwpKW4fXvq7HGZB9z2EnmCCA9', // hic et nunc v2
  'KT1LjmAdYQCLBjwv4S2oFkEzyHVkomAf5MrW'  // Versum
];

/**
 * Problematic thumbnail IPFS hashes that should be filtered out
 * These are generic/default thumbnails that don't represent the actual artwork
 */
export const PROBLEMATIC_THUMBNAIL_HASHES = [
  'ipfs://QmNrhZHUaEqxhyLfqoq1mtHSipkWHeT31LNHb1QEbDHgnc', // Generic circle thumbnail from hic et nunc
  'ipfs://QmY7npznSASiN61trocXBbYe43iRKKicx2ZtZgQZNJRjtA'  // Generic Versum thumbnail
];

/**
 * Check if a contract address should be excluded from indexing
 */
export function shouldExcludeTezosContract(contractAddress: string): boolean {
  return EXCLUDED_TEZOS_CONTRACTS.includes(contractAddress);
}

/**
 * Check if a contract is from Versum or Hic et Nunc and should use objkt.com thumbnails
 */
export function isVersumOrHicEtNuncContract(contractAddress: string): boolean {
  if (!contractAddress) return false;
  return VERSUM_HIC_ET_NUNC_CONTRACTS.includes(contractAddress);
}

/**
 * Generate objkt.com thumbnail URL for Versum and Hic et Nunc NFTs
 * Format: https://assets.objkt.media/file/assets-003/{contractAddress}/{tokenId}/thumb288
 */
export function generateObjktThumbnailUrl(contractAddress: string, tokenId: string | number): string {
  return `https://assets.objkt.media/file/assets-003/${contractAddress}/${tokenId}/thumb288`;
}

/**
 * Check if a thumbnail URL is a problematic generic thumbnail that should be filtered out
 */
export function isProblematicThumbnail(thumbnailUrl: string | null | undefined): boolean {
  if (!thumbnailUrl) return false;
  return PROBLEMATIC_THUMBNAIL_HASHES.includes(thumbnailUrl);
} 