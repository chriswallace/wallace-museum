import { env } from '$env/dynamic/private';

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

	for (const nft of data.nfts) {
		if (nft.image_url && nft.image_url.startsWith('https://ipfs.io')) {
			nft.image_url = nft.image_url.replace('https://ipfs.io', 'https://cloudflare-ipfs.com');
		}
		allNfts.push(nft);
	}

	if (data.next && data.next !== cursor) {
		return fetchNFTsByAddress(walletAddress, allNfts, data.next);
	} else {
		return allNfts;
	}
}
