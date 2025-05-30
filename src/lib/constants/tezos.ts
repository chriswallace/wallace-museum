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
 * Check if a contract address should be excluded from indexing
 */
export function shouldExcludeTezosContract(contractAddress: string): boolean {
  return EXCLUDED_TEZOS_CONTRACTS.includes(contractAddress);
} 