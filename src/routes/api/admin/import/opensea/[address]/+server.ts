import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { fetchAccount, fetchCollections, fetchNFTsByAddress, fetchNFTsFromCollections } from '$lib/openseaHelpers';

export const GET: RequestHandler = async ({ params, url }) => {
	const { address } = params;
	const type = url.searchParams.get('type');
	let nfts = [];
	if (!address) {
		return json({ error: 'Wallet address is required' }, { status: 400 });
	}
	try {
		if (type === 'created') {
			const account = await fetchAccount(address);
			const collections = await fetchCollections(account.username);
			nfts = await fetchNFTsFromCollections(collections);
		} else {
			nfts = await fetchNFTsByAddress(address);
		}
		return json({ success: true, nfts }, { status: 200 });
	} catch (error) {
		console.error('Failed to complete the fetch process:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};