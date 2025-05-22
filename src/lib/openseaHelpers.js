import { env } from '$env/dynamic/private';
import { ipfsToHttpUrl } from './mediaUtils';
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
 */
export async function fetchAccount(walletAddress) {
	const url = `https://api.opensea.io/api/v2/accounts/${walletAddress}`;
	const response = await fetch(url, {
		headers: { 'X-API-KEY': env.OPENSEA_API_KEY }
	});
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	return await response.json();
}

/**
 * @param {string} slug
 */
export async function fetchCollection(slug) {
	// If the input looks like an Ethereum address, try to fetch by contract address first
	if (slug.startsWith('0x') && slug.length >= 40) {
		try {
			console.log(
				'[OPENSEA_HELPERS] Input appears to be a contract address, trying contract endpoint first'
			);
			return await fetchCollectionByContract(slug);
		} catch (error) {
			console.log(
				'[OPENSEA_HELPERS] Failed to fetch by contract, falling back to collections endpoint'
			);
			// Fall back to the regular collection endpoint if contract fetch fails
		}
	}

	// Standard collection endpoint approach
	const url = `https://api.opensea.io/api/v2/collections/${slug}`;
	console.log('[OPENSEA_HELPERS] Fetching collection using collections endpoint:', url);

	const response = await fetch(url, {
		headers: { 'X-API-KEY': env.OPENSEA_API_KEY }
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
 * @returns {Promise<object>} Collection data
 */
export async function fetchCollectionByContract(contractAddress) {
	// Using the contracts endpoint in the OpenSea API
	const url = `https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}`;
	console.log('[OPENSEA_HELPERS] Fetching collection using contract endpoint:', url);

	const response = await fetch(url, {
		headers: { 'X-API-KEY': env.OPENSEA_API_KEY }
	});

	if (!response.ok) {
		throw new Error(`HTTP error fetching by contract! status: ${response.status}`);
	}

	const data = await response.json();

	// Map the contract response to match the format expected from the collections endpoint
	return {
		collection: data.collection || contractAddress,
		name: data.name || data.collection || 'Unknown Collection',
		description: data.description || '',
		contracts: [
			{
				address: contractAddress,
				chain: data.chain || 'ethereum'
			}
		],
		contract: contractAddress,
		blockchain: data.chain || 'ethereum'
	};
}

/**
 * @param {string} address
 */
export async function fetchArtist(address) {
	const url = `https://api.opensea.io/api/v2/accounts/${address}`;
	const response = await fetch(url, {
		headers: { 'X-API-KEY': env.OPENSEA_API_KEY }
	});
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	const data = await response.json();
	return data || [];
}

/**
 * @param {string} user
 */
export async function fetchCollections(user) {
	const url = `https://api.opensea.io/api/v2/collections?chain=ethereum&creator_username=${user}`;
	const response = await fetch(url, {
		headers: { 'X-API-KEY': env.OPENSEA_API_KEY }
	});
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	const data = await response.json();
	return data.collections || [];
}

/**
 * @param {Array<CollectionInfo>} collections - Array of collection info objects.
 * @returns {Promise<Array<object>>} - Returns a promise resolving to an array of NFT objects.
 */
export async function fetchNFTsFromCollections(collections) {
	/** @type {Array<object>} */
	let allNfts = [];

	for (const collection of collections) {
		const url = `https://api.opensea.io/api/v2/collection/${collection.collection}/nfts`;

		const response = await fetch(url, {
			headers: { 'X-API-KEY': env.OPENSEA_API_KEY }
		});

		if (!response.ok) {
			console.error(`Failed to fetch NFTs for collection: ${collection.name}`);
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
 * @param {number} [limit=50] - The maximum number of NFTs to fetch per request.
 * @param {string | null} [nextCursor=null] - The cursor for the next page of results.
 * @param {string | null} [searchTerm=null] - Optional search term to filter results by name.
 * @returns {Promise<{nfts: Array<NftItem>, nextCursor: string | null}>} - A promise that resolves to an object containing the list of NFTs and the cursor for the next page.
 */
export async function fetchNFTsByAddress(
	walletAddress,
	limit = 50,
	nextCursor = null,
	searchTerm = null
) {
	let url = `https://api.opensea.io/api/v2/chain/ethereum/account/${walletAddress}/nfts?limit=${limit}`;
	if (nextCursor) {
		url += `&next=${nextCursor}`;
	}

	const response = await fetch(url, { headers: { 'X-API-KEY': env.OPENSEA_API_KEY } });

	if (!response.ok) {
		console.error(
			`Failed to fetch NFTs for wallet: ${walletAddress}, HTTP status: ${response.status}`
		);
		return { nfts: [], nextCursor: null };
	}

	const data = await response.json();
	/** @type {Array<NftItem>} */
	const fetchedNfts = [];

	for (let nft of data.nfts) {
		if (!nft || typeof nft !== 'object') continue;

		const currentNft = /** @type {any} */ (nft);

		/** @type {any} */
		const nftAny = currentNft;
		// @ts-ignore
		console.log(
			'[NFT Import] Step 1: Found metadata_url:',
			nftAny['metadata_url'] ?? '[undefined]'
		);

		if (!currentNft.id && currentNft.identifier) {
			currentNft.id = currentNft.identifier;
		}
		if (!currentNft.id) {
			continue;
		}

		// Normalize all possible image/animation URLs from metadata if present
		if (currentNft.metadata) {
			if (currentNft.metadata.image) {
				currentNft.metadata.image = ipfsToHttpUrl(currentNft.metadata.image);
			}
			if (currentNft.metadata.image_url) {
				currentNft.metadata.image_url = ipfsToHttpUrl(currentNft.metadata.image_url);
			}
			if (currentNft.metadata.animation_url) {
				currentNft.metadata.animation_url = ipfsToHttpUrl(currentNft.metadata.animation_url);
			}
		}

		// Log and normalize all possible image/animation IPFS URLs from NFT object
		if (currentNft.image_url) {
			currentNft.image_url = ipfsToHttpUrl(currentNft.image_url);
		}
		if (currentNft.image) {
			currentNft.image = ipfsToHttpUrl(currentNft.image);
		}
		if (currentNft.image_preview_url) {
			currentNft.image_preview_url = ipfsToHttpUrl(currentNft.image_preview_url);
		}
		if (currentNft.image_thumbnail_url) {
			currentNft.image_thumbnail_url = ipfsToHttpUrl(currentNft.image_thumbnail_url);
		}
		if (currentNft.image_original_url) {
			currentNft.image_original_url = ipfsToHttpUrl(currentNft.image_original_url);
		}
		if (currentNft.animation_url) {
			currentNft.animation_url = ipfsToHttpUrl(currentNft.animation_url);
		}
		if (currentNft.display_image_url) {
			currentNft.display_image_url = ipfsToHttpUrl(currentNft.display_image_url);
		}
		if (currentNft.display_animation_url) {
			currentNft.display_animation_url = ipfsToHttpUrl(currentNft.display_animation_url);
		}

		fetchedNfts.push(currentNft);
	}

	// Ensure fetchedNfts contains items with valid 'id' before filtering
	let validNfts = fetchedNfts.filter((nft) => nft && nft.id !== undefined && nft.id !== null);

	// Log metadata_url before normalization
	validNfts.forEach((nft) => {
		// eslint-disable-next-line
		console.log(
			'[NFT Import] Step 2: Before normalization, metadata_url:',
			nft && nft['metadata_url'] !== undefined ? nft['metadata_url'] : '[undefined]'
		);
	});

	let filteredNfts = validNfts;
	if (searchTerm) {
		const lowerCaseSearchTerm = searchTerm.toLowerCase();
		// Ensure nft is treated as NftItem in filter using JSDoc cast
		filteredNfts = validNfts.filter((nft) => {
			const typedNft = /** @type {NftItem} */ (nft); // Cast to NftItem for property access
			return typedNft.name && typedNft.name.toLowerCase().includes(lowerCaseSearchTerm);
		});
	}

	// Log metadata_url after normalization/filtering
	filteredNfts.forEach((nft) => {
		console.log(
			'[NFT Import] Step 3: After normalization/filtering, metadata_url:',
			nft && nft['metadata_url'] !== undefined ? nft['metadata_url'] : '[undefined]'
		);
	});

	return { nfts: filteredNfts, nextCursor: data.next };
}

/**
 * @param {string | URL | Request} url
 */
export async function fetchMetadata(url) {
	try {
		console.log('[NFT Import] Step 4: About to fetch metadata for metadata_url:', url);
		// Check if the URL is actually a data URI - ensure it's a string first
		if (typeof url === 'string' && isDataUri(url)) {
			// Parse and return the JSON directly from the data URI
			const metadata = parseJsonFromDataUri(url);
			console.log('[NFT Import] Step 5: Fetched metadata for data URI:', url);
			return metadata;
		} else if (typeof url === 'string' || url instanceof URL || url instanceof Request) {
			// Make an HTTP request to fetch the metadata from a regular URL
			const response = await fetch(url, {
				headers: { 'X-API-KEY': env.OPENSEA_API_KEY }
			});
			if (!response.ok) {
				console.warn(
					`[NFT Import] Failed to fetch metadata from ${url}, status: ${response.status}`
				);
				return null; // Return null instead of throwing error
			}
			const metadata = await response.json();
			console.log('[NFT Import] Step 5: Fetched metadata for URL:', url);
			return metadata;
		}
		return null; // Return null for unsupported URL types
	} catch (error) {
		console.error(`[NFT Import] Error fetching metadata:`, error);
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
 * @returns {Promise<object|null>} - Creator information or null if not found
 */
export async function fetchCreatorInfo(creatorAddress) {
	// Clean up and validate the address
	if (!creatorAddress) {
		console.log('[OPENSEA_HELPERS] No creator address provided');
		return null;
	}

	// Normalize the address format and check for invalid addresses
	creatorAddress = creatorAddress.trim();
	if (creatorAddress === '0x0000000000000000000000000000000000000000') {
		console.log('[OPENSEA_HELPERS] Zero address provided, skipping creator lookup');
		return null;
	}

	// Ensure proper Ethereum address format
	if (!creatorAddress.startsWith('0x') || creatorAddress.length < 40) {
		console.log(`[OPENSEA_HELPERS] Invalid Ethereum address format: ${creatorAddress}`);
		return {
			address: creatorAddress,
			username: creatorAddress, // Use the value as username
			bio: null,
			avatarUrl: null,
			social_links: {}
		};
	}

	try {
		console.log(`[OPENSEA_HELPERS] Fetching creator info for address: ${creatorAddress}`);
		const url = `https://api.opensea.io/api/v2/accounts/${creatorAddress}`;

		const response = await fetch(url, {
			headers: { 'X-API-KEY': env.OPENSEA_API_KEY }
		});

		if (!response.ok) {
			console.warn(
				`[OPENSEA_HELPERS] Failed to fetch creator info for: ${creatorAddress}, Status: ${response.status}`
			);
			return {
				address: creatorAddress,
				username: null,
				bio: null,
				avatarUrl: null,
				social_links: {}
			};
		}

		const data = await response.json();

		// Log the raw creator data for debugging
		console.log(
			`[OPENSEA_HELPERS] Raw creator data for ${creatorAddress}:`,
			JSON.stringify(data, null, 2)
		);

		// Extract social media accounts from various possible sources
		/** @type {{twitter?: string, instagram?: string, website?: string, discord?: string, github?: string, linkedin?: string}} */
		let socialLinks = {};

		// Twitter handle
		if (data.twitter_username) {
			socialLinks.twitter = `https://twitter.com/${data.twitter_username}`;
		} else if (
			data.social_links?.find((/** @type {string} */ link) => link.includes('twitter.com'))
		) {
			const twitterLink = data.social_links.find((/** @type {string} */ link) =>
				link.includes('twitter.com')
			);
			socialLinks.twitter = twitterLink;
		}

		// Instagram handle
		if (data.instagram_username) {
			socialLinks.instagram = `https://instagram.com/${data.instagram_username}`;
		} else if (
			data.social_links?.find((/** @type {string} */ link) => link.includes('instagram.com'))
		) {
			const instagramLink = data.social_links.find((/** @type {string} */ link) =>
				link.includes('instagram.com')
			);
			socialLinks.instagram = instagramLink;
		}

		// Website
		if (data.website) {
			socialLinks.website = data.website;
		} else if (data.external_url) {
			socialLinks.website = data.external_url;
		}

		// Check for additional social links in the array
		if (Array.isArray(data.social_links)) {
			// Extract Discord
			const discordLink = data.social_links.find(
				(/** @type {string} */ link) =>
					typeof link === 'string' && (link.includes('discord.gg') || link.includes('discord.com'))
			);
			if (discordLink) {
				socialLinks.discord = discordLink;
			}

			// Extract GitHub
			const githubLink = data.social_links.find(
				(/** @type {string} */ link) => typeof link === 'string' && link.includes('github.com')
			);
			if (githubLink) {
				socialLinks.github = githubLink;
			}

			// Extract LinkedIn
			const linkedinLink = data.social_links.find(
				(/** @type {string} */ link) => typeof link === 'string' && link.includes('linkedin.com')
			);
			if (linkedinLink) {
				socialLinks.linkedin = linkedinLink;
			}
		}

		// Extract and normalize useful creator information
		const creatorInfo = {
			address: creatorAddress,
			username: data.username || data.display_name || null,
			displayName: data.display_name || data.username || null,
			bio: data.bio || null,
			avatarUrl: data.profile_img_url || null,
			social_links: socialLinks
		};

		console.log(
			`[OPENSEA_HELPERS] Processed creator info for ${creatorAddress}:`,
			JSON.stringify(creatorInfo, null, 2)
		);

		return creatorInfo;
	} catch (error) {
		console.error(`[OPENSEA_HELPERS] Error fetching creator info: ${error}`);
		return {
			address: creatorAddress,
			username: null,
			bio: null,
			avatarUrl: null,
			social_links: {}
		};
	}
}
