import { env } from '$env/dynamic/private';
import { fixIpfsUrl } from '$lib/mediaHelpers';

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
	const url = `https://api.opensea.io/api/v2/collections/${slug}`;
	const response = await fetch(url, {
		headers: { 'X-API-KEY': env.OPENSEA_API_KEY }
	});
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	const data = await response.json();

	if (data.contracts[0] && data.contracts[0].blockchain) {
		data.blockchain = data.contracts[0].blockchain;
	}
	return data || [];
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

		// Cast to access properties safely, assuming OpenSea NFT structure
		const currentNft = /** @type {any} */ (nft);

		// Ensure a unique 'id' property exists, mapping from 'identifier'
		if (!currentNft.id && currentNft.identifier) {
			currentNft.id = currentNft.identifier; // Use identifier as id if id is missing
		}
		// If still no id, skip? Or generate one? For now, let's rely on identifier.
		if (!currentNft.id) {
			console.warn('NFT missing identifier, skipping:', currentNft);
			continue;
		}

		if (currentNft.image)
			currentNft.image_url = fixIpfsUrl(
				currentNft.image_url ||
					currentNft.image_preview_url || // Assuming these might exist on the fetched object
					currentNft.image_thumbnail_url ||
					currentNft.image_original_url ||
					currentNft.image // Keep original image property if it exists
			);
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
 */
export async function fetchMetadata(url) {
	try {
		// Check if the URL is actually a data URI - ensure it's a string first
		if (typeof url === 'string' && isDataUri(url)) {
			// Parse and return the JSON directly from the data URI
			const metadata = parseJsonFromDataUri(url);
			return metadata;
		} else if (typeof url === 'string' || url instanceof URL || url instanceof Request) {
			// Make an HTTP request to fetch the metadata from a regular URL
			const response = await fetch(url, {
				headers: { 'X-API-KEY': env.OPENSEA_API_KEY }
			});
			if (!response.ok) throw new Error(`Failed to fetch metadata from ${url}`);
			return await response.json();
		}
	} catch (error) {
		console.error(`Error fetching metadata:`, error);
		return null;
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
