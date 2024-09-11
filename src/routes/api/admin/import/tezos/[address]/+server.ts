import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { fetchCreatedNFTsByAddress, fetchOwnedNFTsByAddress } from '$lib/objktHelpers';
import { fixIpfsUrl } from '$lib/mediaHelpers';

const fetchMetadataJson = async (ipfsUrl: string) => {
	try {
		const response = await fetch(fixIpfsUrl(ipfsUrl));
		if (!response.ok) throw new Error('Failed to fetch metadata');
		return await response.json();
	} catch (error) {
		console.error('Failed to fetch metadata JSON:', error);
		return {};
	}
};

export const GET: RequestHandler = async ({ params, url }) => {
	const { address } = params;
	const type = url.searchParams.get('type');
	const limit = parseInt(url.searchParams.get('limit') || '100'); // Default to 100 items per page
	const offset = parseInt(url.searchParams.get('offset') || '0'); // Default to start from 0

	if (!address) {
		return json({ error: 'Wallet address is required' }, { status: 400 });
	}

	try {
		let nfts = [];

		// Fetch NFTs based on type and pagination parameters
		if (type === 'created') {
			nfts = await fetchCreatedNFTsByAddress(address, limit, offset);
		} else {
			nfts = await fetchOwnedNFTsByAddress(address, limit, offset);
		}

		// Continue with normalization and response as before
		nfts = await Promise.all(
			nfts.data.holder[0].held_tokens.map(async ({ token }) => {
				const metadata = token.metadata ? await fetchMetadataJson(token.metadata) : {};

				const animationUri = fixIpfsUrl(
					token.artifact_uri || token.artifactUri || metadata.artifactUri || metadata.artifact_uri
				);

				const mediaUri = fixIpfsUrl(
					token.display_uri || metadata.displayUri || metadata.artifactUri || metadata.thumbnailUri
				);

				if (!animationUri && !mediaUri) {
					console.error('Both artifactUri and mediaUri are undefined or empty for token:', token);
					return null; // Skip this token
				}

				const nftObject = {
					name: metadata.name || token.name || 'No Name',
					tokenID: token.token_id,
					description: metadata.description || token.description,
					artist: {
						address: token.creators[0]?.holder.address,
						username: token.creators[0]?.holder.alias,
						bio: token.creators[0]?.holder.description,
						website: token.creators[0]?.holder.website || '',
						avatarUrl: fixIpfsUrl(token.creators[0]?.holder.logo),
						social_media_accounts: {
							twitter: token.creators[0]?.holder.twitter || '',
							instagram: token.creators[0]?.holder.instagram || ''
						}
					},
					mime: token.mime || '',
					platform: 'Tezos',
					image_url: mediaUri || '',
					animation_url: animationUri || '',
					tags: metadata.tags || [], // Use tags from metadata
					website: token.creators[0]?.holder.website || '', // If available, otherwise leave empty
					attributes: metadata.attributes || [], // Use attributes from metadata
					collection: {
						name: token.fa?.name || 'No Collection Name',
						contract: token.fa?.contract,
						blockchain: 'tezos'
					},
					symbol: token.symbol,
					updated_at: token.timestamp,
					is_disabled: false,
					is_nsfw: false
				};

				return nftObject;
			})
		);

		// Filter out null results
		nfts = nfts.filter((nft) => nft !== null);

		return json({ success: true, nfts }, { status: 200 });
	} catch (error) {
		console.error('Failed to fetch NFTs:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
