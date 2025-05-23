import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import prisma from '$lib/prisma';
import { getWalletAddresses } from '$lib/settingsManager';
import { fetchNFTsByAddress } from '$lib/openseaHelpers';
import { fetchOwnedNFTsByAddress, fetchCreatedNFTsByAddress } from '$lib/objktHelpers';
import { ipfsToHttpUrl } from '$lib/mediaUtils';
import type { ArtworkIndex } from '@prisma/client';
import { redirect } from '@sveltejs/kit';

// Cache duration in milliseconds (24 hours)
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Rate limiting delay between API calls in milliseconds
const API_RATE_LIMIT_DELAY = 1000; // 1 second delay between wallet processing

/**
 * Sleep function for rate limiting
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * API endpoint to index all registered wallet addresses
 * This endpoint can be called by a cron job (with API key) or by an authenticated admin user
 * It will fetch all NFTs for each registered wallet and store them in the database
 */
export const GET: RequestHandler = async ({ url, request, cookies, locals }) => {
	// Check for API key for cron jobs
	const apiKey = url.searchParams.get('key');
	const envApiKey = process.env.INDEXER_API_KEY;

	// Check for force refresh parameter
	const forceRefresh = url.searchParams.get('force') === 'true';

	// Check for user authentication for manual runs
	let isAuthenticated = false;

	// First check if API key is valid (for cron jobs)
	if (envApiKey && apiKey === envApiKey) {
		isAuthenticated = true;
	}
	// If no valid API key, check for user session
	else {
		const cookieHeader = request.headers.get('cookie') || '';
		const sessionCookie = cookieHeader.split(';').find((c) => c.trim().startsWith('session='));
		const sessionId = sessionCookie ? sessionCookie.split('=')[1] : '';

		if (sessionId) {
			const session = await prisma.session.findUnique({
				where: { sessionId },
				include: { user: true }
			});

			// Check if the session is valid and not expired
			if (session && new Date(session.expiresAt) > new Date()) {
				isAuthenticated = true;
			}
		}
	}

	// Return error if not authenticated
	if (!isAuthenticated) {
		return json(
			{ success: false, error: 'Unauthorized. Please log in to run the indexer.' },
			{ status: 401 }
		);
	}

	try {
		// Get all registered wallet addresses
		const walletAddresses = await getWalletAddresses();

		if (walletAddresses.length === 0) {
			return json({ success: true, message: 'No wallet addresses to index' });
		}

		const results = [];

		// Process each wallet address with rate limiting
		for (const [index, wallet] of walletAddresses.entries()) {
			// Add delay between wallet processing (except for the first one)
			if (index > 0) {
				await sleep(API_RATE_LIMIT_DELAY);
			}

			const result: any = {
				address: wallet.address,
				blockchain: wallet.blockchain,
				indexed: 0,
				errors: [],
				cached: 0,
				new: 0
			};

			try {
				// Determine which indexing function to use based on blockchain
				if (wallet.blockchain === 'ethereum' || wallet.blockchain === 'polygon') {
					// Handle OpenSea compatible chains with pagination
					console.log(`[DEBUG] Processing ${wallet.blockchain} wallet: ${wallet.address}`);

					let allNfts: any[] = [];
					let nextCursor: string | null = null;
					let pageCount = 0;

					// Fetch all pages of NFTs
					do {
						console.log(`[DEBUG] Fetching page ${pageCount + 1} for wallet ${wallet.address}`);
						const nftData = await fetchNFTsByAddress(wallet.address, 50, nextCursor);

						if (nftData.nfts && nftData.nfts.length > 0) {
							allNfts = [...allNfts, ...nftData.nfts];
							console.log(
								`[DEBUG] Added ${nftData.nfts.length} NFTs, total now: ${allNfts.length}`
							);
						} else {
							console.log(`[DEBUG] No NFTs returned in this page, ending pagination`);
							break; // Exit if we get an empty page
						}

						nextCursor = nftData.nextCursor;
						pageCount++;

						// Add delay between pagination requests
						if (nextCursor) {
							await sleep(API_RATE_LIMIT_DELAY);
						} else {
							console.log(`[DEBUG] No next cursor returned, ending pagination`);
						}
					} while (nextCursor); // Continue as long as there's a next cursor

					console.log(`[DEBUG] Total NFTs fetched for ${wallet.address}: ${allNfts.length}`);

					const indexResult = await processNFTs(
						wallet.address,
						allNfts,
						wallet.blockchain,
						forceRefresh
					);
					result.indexed = indexResult.total;
					result.cached = indexResult.cached;
					result.new = indexResult.new;
				} else if (wallet.blockchain === 'tezos') {
					// Handle Tezos with proper pagination
					console.log(`[DEBUG] Processing Tezos wallet: ${wallet.address}`);

					// For owned NFTs
					let allOwnedTokens: any[] = [];
					let offset = 0;
					const limit = 500; // Fetch in larger batches
					let hasMore = true;

					// Fetch all pages of owned NFTs
					while (hasMore) {
						console.log(
							`[DEBUG] Fetching owned NFTs page with offset ${offset} for wallet ${wallet.address}`
						);
						const fetchedData = await fetchOwnedNFTsByAddress(wallet.address, limit, offset);
						const tokens = fetchedData?.data?.holder?.[0]?.held_tokens || [];

						if (tokens.length > 0) {
							allOwnedTokens = [...allOwnedTokens, ...tokens];
							console.log(
								`[DEBUG] Added ${tokens.length} owned NFTs, total now: ${allOwnedTokens.length}`
							);
							offset += tokens.length;

							// Add delay between pagination requests
							await sleep(API_RATE_LIMIT_DELAY);
						} else {
							hasMore = false;
							console.log(`[DEBUG] No more owned NFTs to fetch`);
						}
					}

					console.log(
						`[DEBUG] Total owned NFTs fetched for ${wallet.address}: ${allOwnedTokens.length}`
					);
					const ownedResult = await processTezosNFTs(
						wallet.address,
						allOwnedTokens,
						'tezos',
						false,
						forceRefresh
					);
					result.indexed = ownedResult.total;
					result.cached = ownedResult.cached;
					result.new = ownedResult.new;

					// Add delay before fetching created NFTs
					await sleep(API_RATE_LIMIT_DELAY);

					// For created NFTs
					let allCreatedTokens: any[] = [];
					offset = 0;
					hasMore = true;

					// Fetch all pages of created NFTs
					while (hasMore) {
						console.log(
							`[DEBUG] Fetching created NFTs page with offset ${offset} for wallet ${wallet.address}`
						);
						const createdData = await fetchCreatedNFTsByAddress(wallet.address, limit, offset);
						const createdTokens = createdData?.data?.holder?.[0]?.created_tokens || [];

						if (createdTokens.length > 0) {
							allCreatedTokens = [...allCreatedTokens, ...createdTokens];
							console.log(
								`[DEBUG] Added ${createdTokens.length} created NFTs, total now: ${allCreatedTokens.length}`
							);
							offset += createdTokens.length;

							// Add delay between pagination requests
							await sleep(API_RATE_LIMIT_DELAY);
						} else {
							hasMore = false;
							console.log(`[DEBUG] No more created NFTs to fetch`);
						}
					}

					console.log(
						`[DEBUG] Total created NFTs fetched for ${wallet.address}: ${allCreatedTokens.length}`
					);
					const createdResult = await processTezosNFTs(
						wallet.address,
						allCreatedTokens,
						'tezos',
						true,
						forceRefresh
					);
					result.indexed += createdResult.total;
					result.cached += createdResult.cached;
					result.new += createdResult.new;
				}
			} catch (error) {
				console.error(`Error indexing wallet ${wallet.address}:`, error);
				result.errors.push(error instanceof Error ? error.message : String(error));
			}

			results.push(result);
		}

		return json({ success: true, results });
	} catch (error) {
		console.error('Error in index-wallets endpoint:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};

/**
 * Process and store NFTs from Ethereum/Polygon chains
 */
async function processNFTs(
	walletAddress: string,
	nfts: any[],
	blockchain: string,
	forceRefresh = false,
	isCreated = false
): Promise<{ total: number; cached: number; new: number }> {
	let count = 0;
	let cached = 0;
	let newItems = 0;

	for (const nft of nfts) {
		try {
			// Normalize the NFT data
			const normalizedNFT = {
				title: nft.name || '',
				description: nft.description || '',
				image_url: nft.image_url || nft.image_original_url || '',
				animation_url: nft.animation_url || null,
				contractAddr: nft.contract || '',
				contractAlias: nft.collection?.name || '',
				tokenID: nft.identifier || nft.token_id || '',
				blockchain: blockchain,
				attributes: nft.traits || [],
				mintDate: nft.created_date ? new Date(nft.created_date) : null,
				tokenStandard: nft.contract_standard || '',
				enabled: true,
				tags: []
			};

			// Check if this NFT already exists in ArtworkIndex
			const existingIndexes = (await prisma.artworkIndex.findMany({
				where: {
					indexedData: {
						path: ['contractAddr'],
						equals: normalizedNFT.contractAddr
					},
					AND: {
						indexedData: {
							path: ['tokenID'],
							equals: normalizedNFT.tokenID
						}
					}
				},
				take: 1
			})) as any[];

			const existingIndex = existingIndexes.length > 0 ? existingIndexes[0] : null;

			if (existingIndex) {
				// Check if the entry was updated recently and should be skipped
				const lastUpdated = new Date(existingIndex.updatedAt);
				const now = new Date();
				const isCacheValid =
					!forceRefresh && now.getTime() - lastUpdated.getTime() < CACHE_DURATION;

				if (isCacheValid) {
					// Skip this item as it was recently updated
					cached++;
					count++;
					continue;
				}

				// Update existing index
				await prisma.artworkIndex.update({
					where: { id: existingIndex.id },
					data: {
						indexedData: {
							...existingIndex.indexedData,
							...normalizedNFT,
							ownerAddresses: [
								...(existingIndex.indexedData.ownerAddresses || []),
								walletAddress.toLowerCase()
							].filter((addr, i, arr) => arr.indexOf(addr) === i),
							isCreatedBy: isCreated
								? walletAddress.toLowerCase()
								: existingIndex.indexedData.isCreatedBy
						},
						updatedAt: new Date()
					}
				});
			} else {
				// Create a new index entry without creating an artwork
				await prisma.artworkIndex.create({
					data: {
						artworkId: null, // No artwork reference
						indexedData: {
							...normalizedNFT,
							id: null, // No artwork ID
							ownerAddresses: [walletAddress.toLowerCase()],
							isCreatedBy: isCreated ? walletAddress.toLowerCase() : null
						}
					}
				});
				newItems++;
			}

			count++;
		} catch (error) {
			console.error(`Error processing NFT:`, error, nft);
		}
	}

	return { total: count, cached, new: newItems };
}

/**
 * Process and store NFTs from Tezos chain
 */
async function processTezosNFTs(
	walletAddress: string,
	tokens: any[],
	blockchain: string,
	isCreated = false,
	forceRefresh = false
): Promise<{ total: number; cached: number; new: number }> {
	let count = 0;
	let cached = 0;
	let newItems = 0;

	for (const tokenData of tokens) {
		try {
			const token = tokenData.token || tokenData;

			// Normalize the NFT data
			const normalizedNFT = {
				title: token.name || token.title || '',
				description: token.description || '',
				image_url: ipfsToHttpUrl(token.display_uri || token.artifact_uri || ''),
				animation_url:
					token.formats?.find((f: { mimeType?: string }) => f.mimeType?.startsWith('video/'))
						?.uri || null,
				contractAddr: token.fa?.contract || token.contract,
				contractAlias: token.fa?.name || '',
				tokenID: token.token_id || '',
				blockchain: blockchain,
				attributes: token.attributes || [],
				mintDate: token.minted_at ? new Date(token.minted_at) : null,
				tokenStandard: 'FA2',
				enabled: true,
				tags: []
			};

			// Convert IPFS URLs to HTTP URLs
			if (normalizedNFT.animation_url) {
				normalizedNFT.animation_url = ipfsToHttpUrl(normalizedNFT.animation_url);
			}

			// Check if this NFT already exists in ArtworkIndex
			const existingIndexes = (await prisma.artworkIndex.findMany({
				where: {
					indexedData: {
						path: ['contractAddr'],
						equals: normalizedNFT.contractAddr
					},
					AND: {
						indexedData: {
							path: ['tokenID'],
							equals: normalizedNFT.tokenID
						}
					}
				},
				take: 1
			})) as any[];

			const existingIndex = existingIndexes.length > 0 ? existingIndexes[0] : null;

			if (existingIndex) {
				// Check if the entry was updated recently and should be skipped
				const lastUpdated = new Date(existingIndex.updatedAt);
				const now = new Date();
				const isCacheValid =
					!forceRefresh && now.getTime() - lastUpdated.getTime() < CACHE_DURATION;

				if (isCacheValid) {
					// Skip this item as it was recently updated
					cached++;
					count++;
					continue;
				}

				// Update existing index
				await prisma.artworkIndex.update({
					where: { id: existingIndex.id },
					data: {
						indexedData: {
							...existingIndex.indexedData,
							...normalizedNFT,
							ownerAddresses: [
								...(existingIndex.indexedData.ownerAddresses || []),
								walletAddress.toLowerCase()
							].filter((addr, i, arr) => arr.indexOf(addr) === i),
							isCreatedBy: isCreated
								? walletAddress.toLowerCase()
								: existingIndex.indexedData.isCreatedBy
						},
						updatedAt: new Date()
					}
				});
			} else {
				// Create a new index entry without creating an artwork
				await prisma.artworkIndex.create({
					data: {
						artworkId: null, // No artwork reference
						indexedData: {
							...normalizedNFT,
							id: null, // No artwork ID
							ownerAddresses: [walletAddress.toLowerCase()],
							isCreatedBy: isCreated ? walletAddress.toLowerCase() : null
						}
					}
				});
				newItems++;
			}

			count++;
		} catch (error) {
			console.error(`Error processing Tezos NFT:`, error, tokenData);
		}
	}

	return { total: count, cached, new: newItems };
}
