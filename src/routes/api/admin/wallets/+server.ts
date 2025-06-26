import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWalletAddresses, addWalletAddress, removeWalletAddress } from '$lib/settingsManager';
import { prismaRead } from '$lib/prisma';
import { env } from '$env/dynamic/private';
import { AlchemyNFTIndexer } from '$lib/alchemy-nft-indexer';

// Function to get NFT count from Alchemy API (more reliable than OpenSea)
async function getAlchemyNFTCount(walletAddress: string): Promise<number> {
	try {
		const apiKey = env.ALCHEMY_API_KEY;
		if (!apiKey) {
			console.warn('Alchemy API key not configured, falling back to OpenSea');
			return getOpenSeaNFTCount(walletAddress);
		}

		const alchemyIndexer = new AlchemyNFTIndexer(apiKey);
		const count = await alchemyIndexer.getWalletNFTCount(walletAddress);
		
		console.log(`[Alchemy Count] ${walletAddress}: ${count} NFTs`);
		return count;

	} catch (error) {
		console.error(`Error fetching Alchemy NFT count for ${walletAddress}:`, error);
		// Fallback to OpenSea if Alchemy fails
		return getOpenSeaNFTCount(walletAddress);
	}
}

// Function to get NFT count from OpenSea API with enhanced pagination (simplified to prevent infinite loops)
async function getOpenSeaNFTCount(walletAddress: string): Promise<number> {
	try {
		const apiKey = env.OPENSEA_API_KEY;
		if (!apiKey) {
			console.warn('OpenSea API key not configured, falling back to indexed count');
			return 0;
		}

		let totalCount = 0;
		let nextCursor: string | undefined = undefined;
		let pageCount = 0;
		const maxPages = 200; // Reasonable limit - if we need more than 40,000 NFTs, something is wrong
		const limit = 200; // OpenSea API maximum limit per page
		let consecutiveFailures = 0;
		const maxConsecutiveFailures = 5;

		console.log(`[OpenSea Count] Starting count for ${walletAddress} (max ${maxPages} pages at ${limit} NFTs per page)`);

		while (pageCount < maxPages) {
			pageCount++;
			
			let url = `https://api.opensea.io/api/v2/chain/ethereum/account/${walletAddress}/nfts?limit=${limit}`;
			if (nextCursor) {
				url += `&next=${nextCursor}`;
			}

			try {
				const response = await fetch(url, {
					headers: { 'X-API-KEY': apiKey }
				});

				if (response.status === 429) {
					// Rate limited - wait and retry
					consecutiveFailures++;
					if (consecutiveFailures >= maxConsecutiveFailures) {
						console.warn(`[OpenSea Count] Too many rate limit failures, stopping at ${totalCount} NFTs`);
						break;
					}
					
					const backoffDelay = 5000 * consecutiveFailures;
					console.warn(`[OpenSea Count] Rate limited on page ${pageCount}, waiting ${backoffDelay}ms`);
					await new Promise(resolve => setTimeout(resolve, backoffDelay));
					pageCount--; // Don't count this as a page
					continue;
				}

				if (!response.ok) {
					console.warn(`[OpenSea Count] API error ${response.status} on page ${pageCount}, stopping at ${totalCount} NFTs`);
					break;
				}

				const data = await response.json();
				const nfts = data.nfts || [];
				
				if (nfts.length === 0) {
					console.log(`[OpenSea Count] Page ${pageCount}: No NFTs returned, ending pagination`);
					break;
				}

				totalCount += nfts.length;
				nextCursor = data.next;
				consecutiveFailures = 0; // Reset on success
				
				console.log(`[OpenSea Count] Page ${pageCount}: +${nfts.length} NFTs (total: ${totalCount}), nextCursor: ${nextCursor ? 'present' : 'null'}`);

				// If no nextCursor, we've reached the end
				if (!nextCursor) {
					console.log(`[OpenSea Count] No more pages available, ending pagination`);
					break;
				}

				// Add delay between successful requests
				await new Promise(resolve => setTimeout(resolve, 1000));

			} catch (error) {
				consecutiveFailures++;
				console.error(`[OpenSea Count] Error on page ${pageCount}:`, error);
				
				if (consecutiveFailures >= maxConsecutiveFailures) {
					console.warn(`[OpenSea Count] Too many consecutive failures, stopping at ${totalCount} NFTs`);
					break;
				}
				
				// Wait and retry
				await new Promise(resolve => setTimeout(resolve, 2000));
				pageCount--; // Don't count this as a page
				continue;
			}
		}

		if (pageCount >= maxPages) {
			console.warn(`[OpenSea Count] Hit maximum page limit (${maxPages}) for ${walletAddress}, count may be incomplete`);
		}

		console.log(`[OpenSea Count] Final count for ${walletAddress}: ${totalCount} NFTs across ${pageCount} pages`);
		return totalCount;

	} catch (error) {
		console.error(`Error fetching OpenSea NFT count for ${walletAddress}:`, error);
		return 0;
	}
}

// Function to get NFT count from Tezos/Objkt API
async function getTezosNFTCount(walletAddress: string): Promise<number> {
	try {
		const graphqlEndpoint = 'https://data.objkt.com/v3/graphql';
		
		// Since token_holder_aggregate doesn't exist, we need to count manually
		// We'll fetch all token_holder records and count them
		let totalCount = 0;
		let offset = 0;
		const limit = 500; // Objkt API has a hard limit of 500 results per request
		let hasMore = true;
		
		while (hasMore) {
			const query = `
				query {
					token_holder(
						where: {
							holder_address: {_eq: "${walletAddress}"}
							quantity: {_gt: "0"}
							token: {fa_contract: {_neq: "KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn"}}
						}
						limit: ${limit}
						offset: ${offset}
					) {
						quantity
					}
				}
			`;

			const response = await fetch(graphqlEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query })
			});

			if (!response.ok) {
				console.warn(`Tezos API error for ${walletAddress}: ${response.status}`);
				break;
			}

			const data = await response.json();
			
			if (data.errors) {
				console.warn(`Tezos GraphQL errors for ${walletAddress}:`, data.errors);
				break;
			}

			const tokenHolders = data?.data?.token_holder || [];
			const batchCount = tokenHolders.length;
			totalCount += batchCount;
			
			console.log(`[Tezos Count] ${walletAddress}: Batch ${Math.floor(offset/limit) + 1} - ${batchCount} NFTs (total so far: ${totalCount})`);
			
			// Check if we got fewer results than the limit (indicating we're done)
			hasMore = batchCount === limit;
			offset += limit;
			
			// Safety check to prevent infinite loops
			if (offset > 100000) {
				console.warn(`[Tezos Count] ${walletAddress}: Hit safety limit at ${totalCount} NFTs`);
				break;
			}
		}

		console.log(`[Tezos Count] ${walletAddress}: Final count ${totalCount} owned NFTs`);
		return totalCount;

	} catch (error) {
		console.error(`Error fetching Tezos NFT count for ${walletAddress}:`, error);
		return 0;
	}
}

// Function to get indexed artwork count (fallback)
async function getIndexedArtworkCount(walletAddress: string): Promise<number> {
	try {
		const artworkCount = await prismaRead.artworkIndex.count({
			where: {
				OR: [
					// Check if wallet is the creator (original case)
					{
						normalizedData: {
							path: ['creator', 'address'],
							equals: walletAddress
						}
					},
					// Check if wallet is the creator (lowercase)
					{
						normalizedData: {
							path: ['creator', 'address'],
							equals: walletAddress.toLowerCase()
						}
					},
					// Check if wallet is in the owners array (original case)
					{
						normalizedData: {
							path: ['owners'],
							array_contains: [{ address: walletAddress }]
						}
					},
					// Check if wallet is in the owners array (lowercase)
					{
						normalizedData: {
							path: ['owners'],
							array_contains: [{ address: walletAddress.toLowerCase() }]
						}
					}
				]
			}
		});
		return artworkCount;
	} catch (error) {
		console.error(`Error counting indexed artworks for wallet ${walletAddress}:`, error);
		return 0;
	}
}

// GET endpoint to retrieve all wallet addresses with artwork counts
export const GET: RequestHandler = async ({ request, url }) => {
	try {
		const searchParams = url.searchParams;
		const includeCounts = searchParams.get('includeCounts') === 'true';
		
		const walletAddresses = await getWalletAddresses();
		
		if (!includeCounts) {
			return json({ success: true, walletAddresses });
		}
		
		// Get artwork counts for each wallet address from external APIs
		const walletsWithCounts = await Promise.all(
			walletAddresses.map(async (wallet) => {
				try {
					let artworkCount = 0;
					
					if (wallet.blockchain === 'ethereum') {
						// Get real count from Alchemy API (more reliable than OpenSea)
						artworkCount = await getAlchemyNFTCount(wallet.address);
						
						// If Alchemy fails, fall back to indexed count
						if (artworkCount === 0) {
							artworkCount = await getIndexedArtworkCount(wallet.address);
						}
					} else if (wallet.blockchain === 'tezos') {
						// Get real count from Tezos/Objkt API
						artworkCount = await getTezosNFTCount(wallet.address);
						
						// If Tezos API fails, fall back to indexed count
						if (artworkCount === 0) {
							artworkCount = await getIndexedArtworkCount(wallet.address);
						}
					} else {
						// For other blockchains, use indexed count
						artworkCount = await getIndexedArtworkCount(wallet.address);
					}
					
					console.log(`[Wallet Count] ${wallet.blockchain} wallet ${wallet.address}: ${artworkCount} NFTs`);
					
					return {
						...wallet,
						artworkCount
					};
				} catch (error) {
					console.error(`Error counting artworks for wallet ${wallet.address}:`, error);
					// Fall back to indexed count on error
					const fallbackCount = await getIndexedArtworkCount(wallet.address);
					return {
						...wallet,
						artworkCount: fallbackCount
					};
				}
			})
		);
		
		return json({ success: true, walletAddresses: walletsWithCounts });
	} catch (error) {
		console.error('Error getting wallet addresses:', error);
		return json(
			{ success: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};

// POST endpoint to add a new wallet address
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { address, blockchain, alias } = body;

		if (!address || !blockchain) {
			return json(
				{ success: false, error: 'Address and blockchain are required' },
				{ status: 400 }
			);
		}

		const walletAddresses = await addWalletAddress(address, blockchain, alias);
		return json({ success: true, walletAddresses });
	} catch (error) {
		console.error('Error adding wallet address:', error);
		return json(
			{ success: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};

// DELETE endpoint to remove a wallet address
export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { address, blockchain } = body;

		if (!address || !blockchain) {
			return json(
				{ success: false, error: 'Address and blockchain are required' },
				{ status: 400 }
			);
		}

		const walletAddresses = await removeWalletAddress(address, blockchain);
		return json({ success: true, walletAddresses });
	} catch (error) {
		console.error('Error removing wallet address:', error);
		return json(
			{ success: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
