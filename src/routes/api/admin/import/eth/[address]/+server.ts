import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Recursively fetches all NFTs from OpenSea for a given wallet address.
 *
 * @param walletAddress The wallet address to fetch NFTs for.
 * @param assets Accumulated list of assets.
 * @param cursor Pagination cursor for fetching next set of results.
 * @returns All NFT data from OpenSea.
 */
async function fetchAllNFTs(
	walletAddress: string,
	assets = [],
	cursor: string | null = null
): Promise<any[]> {
	const apiKey = env.OPENSEA_API_KEY; // Assuming you have an OpenSea API key
	let url = `https://api.opensea.io/api/v2/chain/ethereum/account/${walletAddress}/nfts?limit=200`;
	if (cursor) {
		url += `&next=${cursor}`;
	}

	try {
		const response = await fetch(url, {
			headers: {
				'X-API-KEY': apiKey
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		const fetchedAssets = data.nfts.map((asset) => ({
			id: asset.identifier,
			name: asset.name,
			imageUrl: asset.image_url,
			permalink: asset.permalink,
			metadataUrl: asset.metadata_url
			// Add any other fields you need from the asset
		}));

		const newAssets = assets.concat(fetchedAssets);

		// Check if there's a next page
		if (data.next) {
			return fetchAllNFTs(walletAddress, newAssets, data.next);
		} else {
			return newAssets;
		}
	} catch (error) {
		console.error('Error fetching NFTs:', error);
		throw error; // Rethrow to handle it in the GET request handler
	}
}

// SvelteKit GET request handler
export const GET: RequestHandler = async ({ params }) => {
	const { address } = params;

	if (!address) {
		return json({ error: 'Wallet address is required' }, { status: 400 });
	}

	try {
		const assets = await fetchAllNFTs(address);
		return json({ success: true, assets }, { status: 200 });
	} catch (error) {
		console.error('Failed to fetch all NFTs:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
