import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { fetchCreatedNFTsByAddress, fetchOwnedNFTsByAddress } from '$lib/objktHelpers';
import slugify from 'slugify';

export const GET: RequestHandler = async ({ params, url }) => {
	const { address } = params;
	const type = url.searchParams.get('type');
	let nfts = [];
	if (!address) {
		return json({ error: 'Wallet address is required' }, { status: 400 });
	}
	try {
		if (type === 'created') {
			nfts = await fetchCreatedNFTsByAddress(address);
		} else {
			nfts = await fetchOwnedNFTsByAddress(address);
		}

		nfts = nfts.data.holder[0].held_tokens.map(({ token }) => ({
			identifier: token.token_id,
			token_standard: 'FA2',
			contract: token.fa?.contract,
			name: token.name || "No Name",
			description: token.description || "No Description",
			image_url: token.display_uri ? `https://ipfs.io/ipfs/${token.display_uri.slice(7)}` : (token.artifact_uri ? `https://ipfs.io/ipfs/${token.artifact_uri.slice(7)}` : ""),
			metadata_url: token.metadata ? `https://ipfs.io/ipfs/${token.metadata.slice(7)}` : "",
			collection: {
				name: token.fa?.name || "No Collection Name",
				collection: token.fa?.contract,
				blockchain: 'tezos',
				contracts: [
					{
						address: token.fa?.contract,
						chain: "tezos"
					}
				],
			},
			artist: {
				address: token.creators[0]?.holder.address,
				name: token.creators[0]?.holder.alias || "",
				bio: token.creators[0]?.holder.description || "No bio provided.",
				website: token.creators[0]?.holder.website || "",
				profile_image_url: token.creators[0]?.holder.logo,
				social_media_accounts: [
					{
						platform: "twitter",
						username: token.creators[0]?.holder.twitter
					},
					{
						platform: "instagram",
						username: token.creators[0]?.holder.instagram
					}
				]
			},
			updated_at: token.timestamp,
			is_disabled: false,
			is_nsfw: false
		}));

		return json({ success: true, nfts }, { status: 200 });
	} catch (error) {
		console.error('Failed to complete the fetch process:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};