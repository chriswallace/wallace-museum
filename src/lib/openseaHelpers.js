import { env } from '$env/dynamic/private';
import { fixIpfsUrl } from '$lib/mediaHelpers';

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

export async function fetchNFTsFromCollections(collections) {
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

export async function fetchNFTsByAddress(walletAddress, allNfts = [], cursor = null) {
	let url = `https://api.opensea.io/api/v2/chain/ethereum/account/${walletAddress}/nfts?limit=200`;
	if (cursor) {
		url += `&next=${cursor}`;
	}

	const response = await fetch(url, { headers: { 'X-API-KEY': env.OPENSEA_API_KEY } });

	if (!response.ok) {
		console.error(
			`Failed to fetch NFTs for wallet: ${walletAddress}, HTTP status: ${response.status}`
		);
		return allNfts;
	}

	const data = await response.json();

	for (let nft of data.nfts) {
		if(nft.image)
			nft.image_url = fixIpfsUrl(nft.image);
		allNfts.push(nft);
	}

	if (data.next && data.next !== cursor) {
		return fetchNFTsByAddress(walletAddress, allNfts, data.next);
	} else {
		return allNfts;
	}
}

/**
 * @param {string | URL | Request} url
 */
export async function fetchMetadata(url) {
	try {
		// Check if the URL is actually a data URI
		if (isDataUri(url)) {
			// Parse and return the JSON directly from the data URI
			const metadata = parseJsonFromDataUri(url);
			return metadata;
		} else {
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

function isDataUri(url) {
	return url.startsWith('data:');
}

function parseJsonFromDataUri(dataUri) {
	const [, base64OrUtf8Data] = dataUri.split(',');
	if (dataUri.includes(';base64,')) {
		return JSON.parse(Buffer.from(base64OrUtf8Data, 'base64').toString('utf8'));
	} else {
		return JSON.parse(decodeURIComponent(base64OrUtf8Data));
	}
}