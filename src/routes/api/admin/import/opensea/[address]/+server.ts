import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import {
	fetchAccount,
	fetchCollections,
	fetchNFTsByAddress,
	fetchNFTsFromCollections
} from '$lib/openseaHelpers.js';

// Define an interface for the expected result structure
interface NftFetchResult {
	nfts: object[]; // Or a more specific NFT type if defined elsewhere
	nextCursor: string | null;
}

export const GET: RequestHandler = async ({ params, url }) => {
	const { address } = params;
	const type = url.searchParams.get('type');
	const limitParam = url.searchParams.get('limit');
	const nextCursor = url.searchParams.get('next');
	const limit = limitParam ? parseInt(limitParam, 10) : 50;
	const searchTerm = url.searchParams.get('search');

	if (!address) {
		return json({ error: 'Wallet address is required' }, { status: 400 });
	}
	try {
		// Explicitly type the result variable
		let result: NftFetchResult = { nfts: [], nextCursor: null };

		if (type === 'created') {
			const account = await fetchAccount(address);
			const collections = await fetchCollections(account.username);
			const nfts: object[] = await fetchNFTsFromCollections(collections);
			result = { nfts: nfts, nextCursor: null }; // No pagination here yet
		} else {
			result = await fetchNFTsByAddress(address, limit, nextCursor, searchTerm);
		}
		return json({ success: true, nfts: result.nfts, next: result.nextCursor }, { status: 200 });
	} catch (error) {
		console.error('Failed to complete the fetch process:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		return json({ success: false, error: errorMessage }, { status: 500 });
	}
};
