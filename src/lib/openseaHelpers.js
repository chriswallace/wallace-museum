// Remove private env import - API key will be passed as parameter
// import { env } from '$env/dynamic/private';
// import { ipfsToHttpUrl } from './mediaUtils'; // Removed - not processing URLs during indexing
/**
 * @typedef {object} CollectionInfo
 * @property {string} collection - The collection slug or identifier.
 * @property {string} name - The name of the collection.
 * // Add other expected properties if known
 */

/**
 * @typedef {object} NftItem
 * @property {string | number} id
 * @property {string | null} [animation_url]
 * @property {string | null} [image_url]
 * @property {string} name
 * @property {string | null} [mime]
 * @property {string | null} [image] - Include other potential image properties
 * @property {string | null} [image_preview_url]
 * @property {string | null} [image_thumbnail_url]
 * @property {string | null} [image_original_url]
 * @property {string | null} [metadata_url]
 * // Add other relevant properties if needed
 */

/**
 * @param {string} walletAddress
 * @param {string} apiKey - OpenSea API key
 */
export async function fetchAccount(walletAddress, apiKey) {
	const url = `https://api.opensea.io/api/v2/accounts/${walletAddress}`;
	const response = await fetch(url, {
		headers: { 'X-API-KEY': apiKey }
	});
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	return await response.json();
}

/**
 * @param {string} slug
 * @param {string} apiKey - OpenSea API key
 */
export async function fetchCollection(slug, apiKey) {
	// If the input looks like an Ethereum address, try to fetch by contract address first
	if (slug.startsWith('0x') && slug.length >= 40) {
		try {
			/*console.log(
				'[OPENSEA_HELPERS] Input appears to be a contract address, trying contract endpoint first'
			);*/
			return await fetchCollectionByContract(slug, apiKey);
		} catch (error) {
			/*console.log(
				'[OPENSEA_HELPERS] Failed to fetch by contract, falling back to collections endpoint'
			);*/
			// Fall back to the regular collection endpoint if contract fetch fails
		}
	}

	// Standard collection endpoint approach
	const url = `https://api.opensea.io/api/v2/collections/${slug}`;
	// console.log('[OPENSEA_HELPERS] Fetching collection using collections endpoint:', url);

	const response = await fetch(url, {
		headers: { 'X-API-KEY': apiKey }
	});
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	const data = await response.json();

	// Extract the first contract address if available
	if (data.contracts && data.contracts.length > 0) {
		data.contract = data.contracts[0].address;
	} else {
		data.contract = '';
	}

	if (data.contracts[0] && data.contracts[0].blockchain) {
		data.blockchain = data.contracts[0].blockchain;
	}
	return data || {};
}

/**
 * Fetches collection data using the contract address endpoint
 * @param {string} contractAddress - Ethereum contract address
 * @param {string} apiKey - OpenSea API key
 * @returns {Promise<object>} Collection data
 */
export async function fetchCollectionByContract(contractAddress, apiKey) {
	// Using the contracts endpoint in the OpenSea API
	const url = `https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}`;
	// console.log('[OPENSEA_HELPERS] Fetching collection using contract endpoint:', url);

	const response = await fetch(url, {
		headers: { 'X-API-KEY': apiKey }
	});

	if (!response.ok) {
		throw new Error(`HTTP error fetching by contract! status: ${response.status}`);
	}

	const data = await response.json();

	return data;
}

/**
 * @param {string} address
 * @param {string} apiKey - OpenSea API key
 */
export async function fetchArtist(address, apiKey) {
	const url = `https://api.opensea.io/api/v2/accounts/${address}`;
	const response = await fetch(url, {
		headers: { 'X-API-KEY': apiKey }
	});
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	const data = await response.json();
	return data || [];
}

/**
 * @param {string} user
 * @param {string} apiKey - OpenSea API key
 */
export async function fetchCollections(user, apiKey) {
	const url = `https://api.opensea.io/api/v2/collections?chain=ethereum&creator_username=${user}`;
	const response = await fetch(url, {
		headers: { 'X-API-KEY': apiKey }
	});
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	const data = await response.json();
	return data.collections || [];
}

/**
 * @param {Array<CollectionInfo>} collections - Array of collection info objects.
 * @param {string} apiKey - OpenSea API key
 * @returns {Promise<Array<object>>} - Returns a promise resolving to an array of NFT objects.
 */
export async function fetchNFTsFromCollections(collections, apiKey) {
	/** @type {Array<object>} */
	let allNfts = [];

	for (const collection of collections) {
		const url = `https://api.opensea.io/api/v2/collection/${collection.collection}/nfts`;

		const response = await fetch(url, {
			headers: { 'X-API-KEY': apiKey }
		});

		if (!response.ok) {
			// console.error(`Failed to fetch NFTs for collection: ${collection.name}`);
			continue;
		}

		const data = await response.json();
		allNfts = allNfts.concat(data.nfts || []);
	}

	return allNfts;
}

/**
 * Fetches NFTs for a given wallet address using OpenSea API v2 with cursor-based pagination.
 * @param {string} walletAddress - The wallet address to fetch NFTs for.
 * @param {string} apiKey - OpenSea API key
 * @param {number} [limit=50] - The maximum number of NFTs to fetch per request.
 * @param {string | null} [nextCursor=null] - The cursor for the next page of results.
 * @param {string | null} [searchTerm=null] - Optional search term to filter results by name.
 * @returns {Promise<{nfts: Array<NftItem>, nextCursor: string | null}>} - A promise that resolves to an object containing the list of NFTs and the cursor for the next page.
 */
export async function fetchNFTsByAddress(
	walletAddress,
	apiKey,
	limit = 50,
	nextCursor = null,
	searchTerm = null
) {
	let url = `https://api.opensea.io/api/v2/chain/ethereum/account/${walletAddress}/nfts?limit=${limit}`;
	if (nextCursor) {
		url += `&next=${nextCursor}`;
	}

	// console.log(`[DEBUG] Fetching NFTs from: ${url}`);
	const response = await fetch(url, { headers: { 'X-API-KEY': apiKey } });

	if (!response.ok) {
		// console.error(
		// 	`Failed to fetch NFTs for wallet: ${walletAddress}, HTTP status: ${response.status}`
		// );
		return { nfts: [], nextCursor: null };
	}

	const data = await response.json();
	// console.log(`[DEBUG] OpenSea API returned ${data.nfts?.length || 0} NFTs`);
	if (data.nfts?.length > 0) {
		// console.log(`[DEBUG] First NFT:`, JSON.stringify(data.nfts[0], null, 2));
	}

	/** @type {Array<NftItem>} */
	const fetchedNfts = [];

	for (let nft of data.nfts) {
		if (!nft || typeof nft !== 'object') continue;

		const currentNft = /** @type {any} */ (nft);

		/** @type {any} */
		const nftAny = currentNft;
		// @ts-ignore
		// console.log(
		// 	'[NFT Import] Step 1: Found metadata_url:',
		// 	nftAny['metadata_url'] ?? '[undefined]'
		// );

		if (!currentNft.id && currentNft.identifier) {
			// console.log(`[DEBUG] Setting id from identifier: ${currentNft.identifier}`);
			currentNft.id = currentNft.identifier;
		}
		if (!currentNft.id) {
			// console.log(`[DEBUG] Skipping NFT with no id`);
			continue;
		}

		// Normalize all possible image/animation URLs from metadata if present
		// NOTE: Removed URL processing - indexing should store original URLs
		// if (currentNft.metadata) {
		// 	if (currentNft.metadata.image) {
		// 		currentNft.metadata.image = ipfsToHttpUrl(currentNft.metadata.image);
		// 	}
		// 	if (currentNft.metadata.image_url) {
		// 		currentNft.metadata.image_url = ipfsToHttpUrl(currentNft.metadata.image_url);
		// 	}
		// 	if (currentNft.metadata.animation_url) {
		// 		currentNft.metadata.animation_url = ipfsToHttpUrl(currentNft.metadata.animation_url);
		// 	}
		// }

		// Log and normalize all possible image/animation IPFS URLs from NFT object
		// NOTE: Removed URL processing - indexing should store original URLs
		// if (currentNft.image_url) {
		// 	currentNft.image_url = ipfsToHttpUrl(currentNft.image_url);
		// }
		// if (currentNft.image) {
		// 	currentNft.image = ipfsToHttpUrl(currentNft.image);
		// }
		// if (currentNft.image_preview_url) {
		// 	currentNft.image_preview_url = ipfsToHttpUrl(currentNft.image_preview_url);
		// }
		// if (currentNft.image_thumbnail_url) {
		// 	currentNft.image_thumbnail_url = ipfsToHttpUrl(currentNft.image_thumbnail_url);
		// }
		// if (currentNft.image_original_url) {
		// 	currentNft.image_original_url = ipfsToHttpUrl(currentNft.image_original_url);
		// }
		// if (currentNft.animation_url) {
		// 	currentNft.animation_url = ipfsToHttpUrl(currentNft.animation_url);
		// }
		// if (currentNft.display_image_url) {
		// 	currentNft.display_image_url = ipfsToHttpUrl(currentNft.display_image_url);
		// }
		// if (currentNft.display_animation_url) {
		// 	currentNft.display_animation_url = ipfsToHttpUrl(currentNft.display_animation_url);
		// }

		fetchedNfts.push(currentNft);
	}

	// Ensure fetchedNfts contains items with valid 'id' before filtering
	let validNfts = fetchedNfts.filter((nft) => nft && nft.id !== undefined && nft.id !== null);

	let filteredNfts = validNfts;
	if (searchTerm) {
		const lowerCaseSearchTerm = searchTerm.toLowerCase();
		// Ensure nft is treated as NftItem in filter using JSDoc cast
		filteredNfts = validNfts.filter((nft) => {
			const typedNft = /** @type {NftItem} */ (nft); // Cast to NftItem for property access
			return typedNft.name && typedNft.name.toLowerCase().includes(lowerCaseSearchTerm);
		});
	}

	return { nfts: filteredNfts, nextCursor: data.next };
}

/**
 * @param {string | URL | Request} url
 * @param {string} apiKey - OpenSea API key
 */
export async function fetchMetadata(url, apiKey) {
	try {
		// Check if the URL is actually a data URI - ensure it's a string first
		if (typeof url === 'string' && isDataUri(url)) {
			// Parse and return the JSON directly from the data URI
			const metadata = parseJsonFromDataUri(url);
			return metadata;
		} else if (typeof url === 'string' || url instanceof URL || url instanceof Request) {
			// Make an HTTP request to fetch the metadata from a regular URL
			const response = await fetch(url, {
				headers: { 'X-API-KEY': apiKey }
			});
			if (!response.ok) {
				return null; // Return null instead of throwing error
			}
			const metadata = await response.json();
			return metadata;
		}
		return null; // Return null for unsupported URL types
	} catch (error) {
		return null; // Return null for any errors
	}
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isDataUri(url) {
	return url.startsWith('data:');
}

/**
 * @param {string} dataUri
 */
function parseJsonFromDataUri(dataUri) {
	const [, base64OrUtf8Data] = dataUri.split(',');
	if (dataUri.includes(';base64,')) {
		return JSON.parse(Buffer.from(base64OrUtf8Data, 'base64').toString('utf8'));
	} else {
		return JSON.parse(decodeURIComponent(base64OrUtf8Data));
	}
}

/**
 * Fetches information about a creator/artist from OpenSea by address
 * @param {string} creatorAddress - The Ethereum address of the creator
 * @param {string} apiKey - OpenSea API key
 * @returns {Promise<object|null>} - Creator information or null if not found
 */
export async function fetchCreatorInfo(creatorAddress, apiKey) {
	const url = `https://api.opensea.io/api/v2/accounts/${creatorAddress}`;
	const response = await fetch(url, {
		headers: { 'X-API-KEY': apiKey }
	});
	if (!response.ok) {
		// Consider logging the error or returning a more specific error object
		// console.error(
		// 	`[OPENSEA_HELPERS] HTTP error fetching creator info for ${creatorAddress}! status: ${response.status}`
		// );
		// Return null or an empty object to indicate failure, allowing graceful handling
		return null;
	}
	try {
		const data = await response.json();

		// Enhanced data extraction for comprehensive creator information
		if (data) {
			// Extract social media accounts if available
			/** @type {Record<string, string>} */
			const socialLinks = {};
			if (data.social_media_accounts && Array.isArray(data.social_media_accounts)) {
				for (const account of data.social_media_accounts) {
					if (account.platform && account.username) {
						socialLinks[account.platform] = account.username;
					}
				}
			}

			// Return enhanced creator data structure
			return {
				address: creatorAddress.toLowerCase(),
				username: data.username || data.display_name,
				profileUrl: data.website_url || data.profile_url,
				avatarUrl: data.profile_image_url,
				bio: data.bio || data.description,
				socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
				// Additional OpenSea-specific fields
				isVerified: data.is_verified || false,
				joinedDate: data.joined_date,
				// Raw data for debugging/future use
				rawData: data
			};
		}

		return data;
	} catch (error) {
		// console.error(
		// 	`[OPENSEA_HELPERS] Error parsing JSON for creator info ${creatorAddress}:`,
		// 	error
		// );
		return null; // Or throw a custom error
	}
}

/**
 * Fetches details for a specific NFT from OpenSea API v2.
 * @param {string} chain - The blockchain chain (e.g., 'ethereum').
 * @param {string} contractAddress - The NFT's contract address.
 * @param {string} identifier - The NFT's token ID.
 * @param {string} apiKey - OpenSea API key
 * @returns {Promise<object | null>} - A promise that resolves to the NFT details object or null if not found/error.
 */
export async function fetchNFTDetails(chain, contractAddress, identifier, apiKey) {
	if (!chain || !contractAddress || !identifier) {
		// console.error(
		// 	'[OPENSEA_HELPERS] Missing chain, contractAddress, or identifier for fetchNFTDetails.'
		// );
		return null;
	}
	const url = `https://api.opensea.io/api/v2/chain/${chain}/contract/${contractAddress}/nfts/${identifier}`;
	// console.log(`[OPENSEA_HELPERS] Fetching NFT details from: ${url}`);
	try {
		const response = await fetch(url, {
			headers: { 'X-API-KEY': apiKey }
		});

		if (!response.ok) {
			if (response.status === 404) {
				// console.warn(
				// 	`[OPENSEA_HELPERS] NFT not found (404): ${chain}/${contractAddress}/${identifier}`
				// );
				return null;
			}
			throw new Error(`HTTP error! status: ${response.status}, url: ${url}`);
		}
		const data = await response.json();
		// The API response for a single NFT is typically nested under an "nft" key
		return data.nft || data; // Return the nested nft object if present, otherwise the direct data
	} catch (error) {
		// console.error(
		// 	`[OPENSEA_HELPERS] Error fetching NFT details for ${chain}/${contractAddress}/${identifier}:`,
		// 	error
		// );
		return null; // Return null on error to allow graceful handling
	}
}

/**
 * Fetches mint event for a specific NFT to get the actual minter address
 * @param {string} contractAddress - The contract address
 * @param {string} tokenId - The token ID
 * @param {string} apiKey - OpenSea API key
 * @returns {Promise<string|null>} - The minter address or null if not found
 */
export async function fetchMinterAddress(contractAddress, tokenId, apiKey) {
	try {
		const url = `https://api.opensea.io/api/v2/events/chain/ethereum/contract/${contractAddress}/nfts/${tokenId}`;
		const response = await fetch(url, {
			headers: { 'X-API-KEY': apiKey }
		});

		if (!response.ok) {
			// console.warn(`[OPENSEA_HELPERS] Failed to fetch events for ${contractAddress}/${tokenId}, status: ${response.status}`);
			return null;
		}

		const data = await response.json();
		const events = data.events || [];

		// Look for Transfer events from zero address (mint events)
		const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
		const mintEvent = events.find(
			/** @param {{event_type: string, from_address: string, to_address: string}} event */ (
				event
			) => event.event_type === 'transfer' && event.from_address === ZERO_ADDRESS
		);

		if (mintEvent && mintEvent.to_address) {
			return mintEvent.to_address;
		}

		return null;
	} catch (error) {
		// console.error(`[OPENSEA_HELPERS] Error fetching minter address for ${contractAddress}/${tokenId}:`, error);
		return null;
	}
}

/**
 * Fetches the actual mint date from blockchain events for a specific NFT
 * This is the most accurate way to get the mint date as it comes from the blockchain transfer event
 * when the NFT was minted (transferred from the zero address to the first owner)
 * @param {string} contractAddress - The contract address
 * @param {string} tokenId - The token ID
 * @param {string} apiKey - OpenSea API key
 * @returns {Promise<string|null>} - The mint date timestamp or null if not found
 */
export async function fetchMintDate(contractAddress, tokenId, apiKey) {
	try {
		const url = `https://api.opensea.io/api/v2/events/chain/ethereum/contract/${contractAddress}/nfts/${tokenId}`;
		const response = await fetch(url, {
			headers: { 'X-API-KEY': apiKey }
		});

		if (!response.ok) {
			// console.warn(`[OPENSEA_HELPERS] Failed to fetch events for ${contractAddress}/${tokenId}, status: ${response.status}`);
			return null;
		}

		const data = await response.json();
		const events = data.events || [];

		// Look for Transfer events from zero address (mint events)
		// This is the definitive way to identify when an NFT was minted
		const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
		const mintEvent = events.find(
			/** @param {{event_type: string, from_address: string, event_timestamp: string}} event */ (
				event
			) => event.event_type === 'transfer' && event.from_address === ZERO_ADDRESS
		);

		if (mintEvent && mintEvent.event_timestamp) {
			// Return the blockchain timestamp of the actual mint transaction
			return mintEvent.event_timestamp;
		}

		return null;
	} catch (error) {
		// console.error(`[OPENSEA_HELPERS] Error fetching mint date for ${contractAddress}/${tokenId}:`, error);
		return null;
	}
}

/**
 * Enhanced NFT data fetching with additional metadata
 * @param {string} contractAddress - The contract address
 * @param {string} tokenId - The token ID
 * @param {string} apiKey - OpenSea API key
 * @returns {Promise<object|null>} - Enhanced NFT data or null if not found
 */
export async function fetchEnhancedNFTData(contractAddress, tokenId, apiKey) {
	try {
		// Fetch basic NFT data
		const nftData = await fetchNFTDetails('ethereum', contractAddress, tokenId, apiKey);
		if (!nftData) return null;

		// Cast to any for property access
		/** @type {any} */
		const enhancedNftData = nftData;

		// Enhance with mint date - prioritize blockchain events over API fields
		// Always try to get the most accurate mint date from blockchain events
		if (!enhancedNftData.mint_date) {
			const blockchainMintDate = await fetchMintDate(contractAddress, tokenId, apiKey);
			if (blockchainMintDate) {
				enhancedNftData.mint_date = blockchainMintDate;
			} else if (enhancedNftData.created_date && !enhancedNftData.mint_date) {
				// Fallback to created_date if no blockchain mint date found
				enhancedNftData.mint_date = enhancedNftData.created_date;
			}
		}

		// Enhance with creator information if available
		if (enhancedNftData.creator && !enhancedNftData.creator_username) {
			const creatorInfo = await fetchCreatorInfo(enhancedNftData.creator, apiKey);
			if (creatorInfo) {
				/** @type {any} */
				const creator = creatorInfo;
				enhancedNftData.creator_username = creator.username;
				enhancedNftData.creator_profile_url = creator.profileUrl;
				enhancedNftData.creator_avatar_url = creator.avatarUrl;
				enhancedNftData.creator_bio = creator.bio;
				enhancedNftData.creator_social_links = creator.socialLinks;
				enhancedNftData.creator_is_verified = creator.isVerified;
			}
		}

		// Enhance with collection information if available
		if (
			enhancedNftData.collection &&
			typeof enhancedNftData.collection === 'string' &&
			!enhancedNftData.collection_name
		) {
			const collectionInfo = await fetchCollection(enhancedNftData.collection, apiKey);
			if (collectionInfo) {
				enhancedNftData.collection_name = collectionInfo.name;
				enhancedNftData.collection_description = collectionInfo.description;
				enhancedNftData.collection_website_url = collectionInfo.external_url;
				enhancedNftData.collection_discord_url = collectionInfo.discord_url;
				enhancedNftData.collection_telegram_url = collectionInfo.telegram_url;
				enhancedNftData.collection_image_url = collectionInfo.image_url;
			}
		}

		// Add additional computed fields
		enhancedNftData.supply =
			enhancedNftData.supply ||
			(enhancedNftData.owners && enhancedNftData.owners.length > 0
				? enhancedNftData.owners[0].quantity
				: 1);
		enhancedNftData.symbol = enhancedNftData.symbol || enhancedNftData.collection?.symbol;

		return enhancedNftData;
	} catch (error) {
		// console.error(`[OPENSEA_HELPERS] Error fetching enhanced NFT data for ${contractAddress}/${tokenId}:`, error);
		return null;
	}
}
