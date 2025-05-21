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

		// Log and normalize all possible image/animation IPFS URLs
		if (currentNft.image_url) {
			const orig = currentNft.image_url;
			const norm = ipfsToHttpUrl(orig);
			currentNft.image_url = norm;
		}
		if (currentNft.image) {
			const orig = currentNft.image;
			const norm = ipfsToHttpUrl(orig);
			currentNft.image = norm;
		}
		if (currentNft.image_preview_url) {
			const orig = currentNft.image_preview_url;
			const norm = ipfsToHttpUrl(orig);
			currentNft.image_preview_url = norm;
		}
		if (currentNft.image_thumbnail_url) {
			const orig = currentNft.image_thumbnail_url;
			const norm = ipfsToHttpUrl(orig);
			currentNft.image_thumbnail_url = norm;
		}
		if (currentNft.image_original_url) {
			const orig = currentNft.image_original_url;
			const norm = ipfsToHttpUrl(orig);
			currentNft.image_original_url = norm;
		}
		if (currentNft.animation_url) {
			const orig = currentNft.animation_url;
			const norm = ipfsToHttpUrl(orig);
			currentNft.animation_url = norm;
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
			if (!response.ok) throw new Error(`Failed to fetch metadata from ${url}`);
			const metadata = await response.json();
			console.log('[NFT Import] Step 5: Fetched metadata for URL:', url);
			return metadata;
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
