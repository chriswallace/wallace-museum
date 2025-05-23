import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { fetchCreatedNFTsByAddress, fetchOwnedNFTsByAddress } from '$lib/objktHelpers';
import { convertIpfsToHttpsUrl } from '$lib/mediaUtils';

const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/'; // Define gateway here

// This constant is defined locally, but convertIpfsToHttpsUrl in mediaUtils now uses its own internal constant.
// We might need to remove this local one if it causes conflicts or isn't used elsewhere in this file.
// For now, keeping it commented out to avoid potential conflicts.
// const ipfsGateways = ['https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/'];

// Define Metadata interface based on usage
interface Metadata {
	name?: string;
	description?: string;
	artifactUri?: string;
	artifact_uri?: string;
	displayUri?: string;
	thumbnailUri?: string;
	tags?: string[];
	attributes?: object[];
	// Add other potential fields if known
}

/* // Temporarily comment out as it's not called and causes errors due to refactoring
// Define using standard function syntax
async function fetchMetadataJson(ipfsUrl: string, retries: number = 3): Promise<Metadata | null> {
	for (const gateway of ipfsGateways) { // <-- Uses ipfsGateways
		try {
			const fixedUrl = fixIpfsUrl(ipfsUrl, gateway); // <-- Uses fixIpfsUrl with 2 args
			console.log('Trying IPFS URL:', fixedUrl);
			const response = await fetch(fixedUrl);
			if (response.ok) {
				return await response.json();
			}
		} catch (error) {
			console.error(`Failed to fetch metadata JSON from ${gateway}:`, error);
		}
	}

	if (retries > 0) {
		console.log(`Retrying... (${3 - retries + 1})`);
		// Ensure the recursive call matches the declared type (retries is optional)
		return await fetchMetadataJson(ipfsUrl, retries - 1);
	}

	return null; // Return null to indicate failure to fetch metadata
}
*/

export const GET: RequestHandler = async ({ params, url }) => {
	const { address } = params;
	const type = url.searchParams.get('type');
	const limit = parseInt(url.searchParams.get('limit') || '1000');
	const offset = parseInt(url.searchParams.get('offset') || '0');
	const searchTerm = url.searchParams.get('search');

	if (!address) {
		return json({ error: 'Wallet address is required' }, { status: 400 });
	}

	try {
		let fetchedData;
		let tokens: any[] = []; // Initialize tokens array

		// Fetch NFTs based on type and pagination parameters
		if (type === 'created') {
			fetchedData = await fetchCreatedNFTsByAddress(address, limit, offset, searchTerm);
			// Access tokens specific to this block
			tokens = fetchedData?.data?.holder?.[0]?.created_tokens || [];
		} else {
			fetchedData = await fetchOwnedNFTsByAddress(address, limit, offset, searchTerm);
			// Access tokens specific to this block
			tokens = fetchedData?.data?.holder?.[0]?.held_tokens || [];
		}

		// Process tokens into normalized NFTs with unique IDs
		let normalizedNfts = tokens.map(({ token }: { token: any }) => {
			// Prioritize artifact_uri for both image and animation
			// Never use display_uri (thumbnails)
			let artifactUriResult = convertIpfsToHttpsUrl(token.artifact_uri);

			// Function to prepend gateway if needed
			const ensureHttpsUrl = (uri: string | unknown): string => {
				if (typeof uri === 'string' && !uri.startsWith('http') && !uri.startsWith('/ipfs/')) {
					return `${DEFAULT_IPFS_GATEWAY}${uri}`;
				}
				return typeof uri === 'string' ? uri : ''; // Return string or empty string
			};

			// Ensure it's a valid URL
			const finalArtifactUri = ensureHttpsUrl(artifactUriResult);

			// Always use artifact_uri for both image_url and animation_url
			const imageUrl = finalArtifactUri;
			const animationUrl = finalArtifactUri;

			// Create a consistent unique ID for this NFT
			const uniqueId = `tezos/${token.fa?.contract}/${token.token_id}`;

			// Extract attributes from token metadata if available
			let attributes = [];
			if (token.metadata && Array.isArray(token.metadata.attributes)) {
				attributes = token.metadata.attributes;
			}

			return {
				id: uniqueId,
				name: token.name || 'No Name (Metadata Skipped)',
				tokenID: token.token_id,
				description: token.description || '(Metadata Skipped)',
				artist: {
					address: token.creators?.[0]?.creator_address || '',
					username: token.creators?.[0]?.holder?.alias || '(Metadata Skipped)'
				},
				mime: token.mime || '',
				platform: 'Tezos',
				image_url: imageUrl,
				animation_url: animationUrl,
				tags: token.tags || [], // Use token.tags if available
				website: token.creators?.[0]?.holder?.website || '',
				attributes: attributes, // Use extracted attributes
				collection: {
					name: token.fa?.name || '(Metadata Skipped)',
					contract: token.fa?.contract,
					blockchain: 'tezos'
				},
				symbol: token.symbol,
				updated_at: token.timestamp,
				is_disabled: false,
				is_nsfw: false
			};
		});

		// Ensure NFTs have unique IDs to prevent duplicates when client loads more
		const uniqueNfts = normalizedNfts;
		const hasMoreItems = normalizedNfts.length >= limit;

		// Return normalized NFTs along with pagination info
		return json(
			{
				success: true,
				nfts: uniqueNfts,
				limit: limit,
				offset: offset,
				hasMore: hasMoreItems // Add explicit hasMore flag
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error('Failed to fetch NFTs:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		return json({ success: false, error: errorMessage }, { status: 500 });
	}
};
