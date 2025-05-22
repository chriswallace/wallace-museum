const GRAPHQL_ENDPOINT = 'https://data.objkt.com/v3/graphql';

/** @param {string} query */
async function graphqlFetch(query) {
	const response = await fetch(GRAPHQL_ENDPOINT, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ query })
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	return await response.json();
}

/** @param {string} walletAddress */
export async function fetchAccount(walletAddress) {
	const query = `
    {
        holder(where: {address: {_eq: "${walletAddress}"}}) {
            address
            held_tokens {
                token {
                    token_id
                    artifact_uri
                    name
                }
            }
        }
    }`;
	return graphqlFetch(query);
}

/** @param {string} contract */
export async function fetchCollection(contract) {
	const query = `
    {
        fa(where: {contract: {_eq: "${contract}"}}) {
            name,
			description,
			contract,
            path
        }
    }`;
	return graphqlFetch(query);
}

/** @param {string} address */
export async function fetchArtist(address) {
	const query = `
    {
        holder(where: {address: {_eq: "${address}"}}) {
            alias,
            address,
            logo,
            description,
            website,
            instagram,
            twitter
        }
    }`;

	// Fetch the data from your GraphQL endpoint
	const response = await graphqlFetch(query);

	// Assuming the response is structured as { data: { holder: [ { ...fields } ] } }
	const holderData = response.data.holder[0];

	// Transform the data to match the OpenSea structure
	const transformedData = {
		address: holderData.address,
		username: holderData.alias,
		profile_image_url: holderData.logo,
		website: holderData.website,
		social_media_accounts: [
			...(holderData.twitter ? [{ platform: 'twitter', username: holderData.twitter }] : []),
			...(holderData.instagram ? [{ platform: 'instagram', username: holderData.instagram }] : [])
		],
		bio: holderData.description
	};

	return transformedData;
}

// Define TezosToken type based on GraphQL query
/**
 * @typedef {object} TezosToken
 * @property {string} token_id
 * @property {string | null} [name]
 * @property {string | null} [artifact_uri]
 * @property {string | null} [display_uri]
 * @property {string | null} [description]
 * @property {string | null} [mime]
 * @property {number | null} [supply]
 * @property {string | null} [symbol]
 * @property {string | null} [metadata] // URI to metadata JSON
 * @property {object | null} [fa] // Collection/FA info
 * @property {Array<object> | null} [creators]
 * @property {string | null} [timestamp]
 */

/**
 * Fetches owned NFTs for a Tezos address from Objkt GraphQL API.
 * @param {string} walletAddress
 * @param {number} [limit=1000]
 * @param {number} [offset=0]
 * @param {string | null} [searchTerm=null]
 * @returns {Promise<{ data: { holder: [{ held_tokens: TezosToken[] }] } }>} // Adjust structure if needed
 */
export async function fetchOwnedNFTsByAddress(
	walletAddress,
	limit = 1000,
	offset = 0,
	searchTerm = null
) {
	// Add a condition for the token name/description search
	const searchCondition = searchTerm
		? `{_or: [{name: {_ilike: "%${searchTerm}%"}}, {description: {_ilike: "%${searchTerm}%"}}]}`
		: '';

	// Construct the where clause for held_tokens
	// Combine the search condition with potential future filters if needed
	const tokenWhereClause = searchCondition ? `where: {token: ${searchCondition}}` : '';

	// Conditionally add comma before the where clause if it exists
	const whereArgument = tokenWhereClause ? `, ${tokenWhereClause}` : '';

	const query = `
    {
        holder(where: {address: {_eq: "${walletAddress}"}}) {
            held_tokens(limit: ${limit}, offset: ${offset}${whereArgument}) {
                token {
                    token_id
                    name
                    artifact_uri
                    display_uri
                    description
                    mime
                    supply
                    symbol
                    metadata
                    dimensions
                    extra
                    tags{
                        tag {
                            name
                        }
                    }
                    fa {
                        name
                        metadata
                        description
                        website
                        twitter
                        short_name
                        contract
                        path
                    }
                    creators{
                        creator_address
                        holder {
                            alias
                            address
                            logo
                            description
                            website
                            instagram
                            twitter
                        }
                    }
                    timestamp
                }
            }
        }
    }`;

	const response = await graphqlFetch(query);

	// Basic response validation - Improved
	if (!response || !response.data || !response.data.holder) {
		console.error(
			'Invalid response structure from Objkt API: Missing data or holder field.',
			response
		);
		// Return structure consistent with expected format but empty
		return { data: { holder: [{ held_tokens: [] }] } };
	}

	// Handle case where holder array is empty
	if (!Array.isArray(response.data.holder) || response.data.holder.length === 0) {
		console.warn('Objkt API returned empty holder array for address:', walletAddress);
		// Return structure consistent with expected format but empty
		return { data: { holder: [{ held_tokens: [] }] } };
	}

	// Ensure held_tokens exists within the first holder, even if empty
	if (!response.data.holder[0].held_tokens) {
		console.warn('Holder exists but held_tokens is missing, defaulting to empty array.');
		response.data.holder[0].held_tokens = [];
	}

	return response;
}

/**
 * Fetches created NFTs for a Tezos address from Objkt GraphQL API.
 * @param {string} walletAddress
 * @param {number} [limit=1000]
 * @param {number} [offset=0]
 * @param {string | null} [searchTerm=null]
 * @returns {Promise<{ data: { holder: [{ created_tokens: TezosToken[] }] } }>} // Adjust structure if needed
 */
export async function fetchCreatedNFTsByAddress(
	walletAddress,
	limit = 1000,
	offset = 0,
	searchTerm = null
) {
	// Add a condition for the token name/description search
	const searchCondition = searchTerm
		? `{_or: [{name: {_ilike: "%${searchTerm}%"}}, {description: {_ilike: "%${searchTerm}%"}}]}`
		: '';

	// Construct the where clause for created_tokens - Remove extra braces around searchCondition
	const tokenWhereClause = searchCondition ? `where: {token: ${searchCondition}}` : '';

	// Conditionally add comma before the where clause if it exists
	const whereArgument = tokenWhereClause ? `, ${tokenWhereClause}` : '';

	const query = `
    {
        holder(where: {address: {_eq: "${walletAddress}"}}) {
            created_tokens(limit: ${limit}, offset: ${offset}${whereArgument}) {
                token {
                    token_id
                    name
                    artifact_uri
                    display_uri
                    description
                    mime
                    supply
                    symbol
                    metadata
                    dimensions
                    extra
                    tags{
                        tag {
                            name
                        }
                    }
                    fa {
                        name,
						contract
                        metadata
                        description
                        website
                        twitter
                        short_name
                        path
                    }
                    timestamp
                }
            }
        }
    }`;

	const response = await graphqlFetch(query);

	// Basic response validation
	if (
		!response ||
		!response.data ||
		!response.data.holder ||
		!response.data.holder[0]
		// We don't strictly need created_tokens to exist, an empty array is valid if filtered
		// !response.data.holder[0].created_tokens
	) {
		console.error('Invalid response structure from Objkt API for created NFTs');
		return { data: { holder: [{ created_tokens: [] }] } };
	}

	// Ensure created_tokens exists, even if empty after filtering
	if (!response.data.holder[0].created_tokens) {
		response.data.holder[0].created_tokens = [];
	}

	return response;
}

/**
 * Fetches metadata from IPFS or HTTP URLs.
 * @param {string} url
 * @returns {Promise<object | null>}
 */
export async function fetchMetadata(url) {
	if (url.startsWith('data:')) {
		const [, base64OrUtf8Data] = url.split(',');
		if (url.includes(';base64,')) {
			return JSON.parse(atob(base64OrUtf8Data)); // Corrected Base64 decoding
		} else {
			return JSON.parse(decodeURIComponent(base64OrUtf8Data));
		}
	} else {
		const response = await fetch(url, {
			// Remove OpenSea API key header for fetching external URLs
		});
		if (!response.ok) throw new Error(`Failed to fetch metadata from ${url}`);
		return await response.json();
	}
}
