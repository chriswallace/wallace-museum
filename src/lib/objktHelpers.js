const GRAPHQL_ENDPOINT = 'https://data.objkt.com/v3/graphql';

// Wrapped Tezos contract address - this should never be indexed as it's not a real NFT
const WRAPPED_TEZOS_CONTRACT = 'KT1TjnZYs5CGLbmV6yuW169P8Pnr9BiVwwjz';

// Rate limiting configuration
const RATE_LIMIT_DELAY = 1000; // 1 second between requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds initial retry delay

let lastRequestTime = 0;

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rate-limited GraphQL fetch with retry logic
 * @param {string} query
 * @param {number} retryCount
 */
async function graphqlFetch(query, retryCount = 0) {
	// Rate limiting: ensure we don't make requests too frequently
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;
	if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
		await sleep(RATE_LIMIT_DELAY - timeSinceLastRequest);
	}
	lastRequestTime = Date.now();

	try {
		const response = await fetch(GRAPHQL_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ query })
		});

		if (response.status === 429) {
			// Rate limited - implement exponential backoff
			if (retryCount < MAX_RETRIES) {
				const delay = RETRY_DELAY * Math.pow(2, retryCount);
				await sleep(delay);
				return graphqlFetch(query, retryCount + 1);
			} else {
				throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries`);
			}
		}

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (
			retryCount < MAX_RETRIES &&
			(errorMessage.includes('fetch') || errorMessage.includes('network'))
		) {
			// Network error - retry with exponential backoff
			const delay = RETRY_DELAY * Math.pow(2, retryCount);
			await sleep(delay);
			return graphqlFetch(query, retryCount + 1);
		}
		throw error;
	}
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
            active_auctions
            active_listing
            category
            collection_id
            collection_type
            creator_address
            description
            editions
            floor_price
            index_contract_metadata
            items
            last_metadata_update
            ledger_type
            level
            logo
            metadata
            name
            originated
            owners
            path
            short_name
            timestamp
            token_link
            twitter
            type
            tzip16_key
            updated_attributes_counts
            verified_creators
            volume_24h
            volume_total
            website
            creator {
                address
                alias
                description
                logo
                website
                twitter
                instagram
            }
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
	// Add a check to ensure holderData exists and the holder array is not empty
	if (!response || !response.data || !response.data.holder || response.data.holder.length === 0) {
		//console.warn(`[fetchArtist] No holder data found for address: ${address}`);
		// Return null or a default structure if no artist data is found
		return null;
	}
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

	// Filter out wrapped Tezos tokens - these are not real NFTs
	const originalCount = response.data.holder[0].held_tokens.length;
	response.data.holder[0].held_tokens = response.data.holder[0].held_tokens.filter(
		/** @param {any} heldToken */
		(heldToken) => {
			const contractAddress = heldToken?.token?.fa?.contract;
			if (contractAddress === WRAPPED_TEZOS_CONTRACT) {
				console.log(
					`[objktHelpers] Filtering out wrapped Tezos token from contract ${contractAddress}`
				);
				return false;
			}
			return true;
		}
	);

	const filteredCount = response.data.holder[0].held_tokens.length;
	if (originalCount !== filteredCount) {
		console.log(
			`[objktHelpers] Filtered ${originalCount - filteredCount} wrapped Tezos tokens, ${filteredCount} remaining`
		);
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

	// Filter out wrapped Tezos tokens - these are not real NFTs
	const originalCount = response.data.holder[0].created_tokens.length;
	response.data.holder[0].created_tokens = response.data.holder[0].created_tokens.filter(
		/** @param {any} createdToken */
		(createdToken) => {
			const contractAddress = createdToken?.token?.fa?.contract;
			if (contractAddress === WRAPPED_TEZOS_CONTRACT) {
				console.log(
					`[objktHelpers] Filtering out wrapped Tezos token from contract ${contractAddress}`
				);
				return false;
			}
			return true;
		}
	);

	const filteredCount = response.data.holder[0].created_tokens.length;
	if (originalCount !== filteredCount) {
		console.log(
			`[objktHelpers] Filtered ${originalCount - filteredCount} wrapped Tezos tokens, ${filteredCount} remaining`
		);
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

/**
 * Fetches details for a specific Tezos token from Objkt GraphQL API.
 * @param {string} contractAddress - The FA contract address.
 * @param {string} tokenId - The token ID.
 * @returns {Promise<TezosToken | null>} - A promise that resolves to the TezosToken object or null if not found/error.
 */
export async function fetchObjktTokenDetails(contractAddress, tokenId) {
	if (!contractAddress || !tokenId) {
		console.error('[OBJKT_HELPERS] Missing contractAddress or tokenId for fetchObjktTokenDetails.');
		return null;
	}

	const query = `
    {
      token(where: {fa_contract: {_eq: "${contractAddress}"}, token_id: {_eq: "${tokenId}"}}) {
        token_id
        name
        artifact_uri
        display_uri
        description
        mime
        supply
        symbol
        metadata
        metadata_object # Attempt to fetch pre-parsed metadata
        dimensions
        extra
        tags {
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
          creator_address
          creator {
            address
            alias
            description
          }
        }
        creators {
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
        # Add any other fields you might need from the token entity
      }
    }`;

	try {
		const response = await graphqlFetch(query);
		if (response && response.data && response.data.token && response.data.token.length > 0) {
			// If metadata_object is present, prefer it. Otherwise, the metadata string (IPFS URI) is already there.
			const tokenData = response.data.token[0];
			if (tokenData.metadata_object && typeof tokenData.metadata_object === 'object') {
				// If metadata_object exists and is an object, use it directly.
				// It might be a stringified JSON if the GraphQL schema doesn't parse it, so try parsing.
				if (typeof tokenData.metadata_object === 'string') {
					try {
						tokenData.metadata = JSON.parse(tokenData.metadata_object);
					} catch (e) {
						console.warn(
							`[OBJKT_HELPERS] Could not parse metadata_object string for ${contractAddress}:${tokenId}:`,
							e
						);
						// Fallback to raw string URI if parsing fails
						tokenData.metadata = tokenData.metadata_object;
					}
				} else {
					tokenData.metadata = tokenData.metadata_object; // It's already an object
				}
			} else if (
				tokenData.metadata &&
				typeof tokenData.metadata === 'string' &&
				tokenData.metadata.startsWith('ipfs://')
			) {
				// If only metadata string (IPFS URI) is available, it's fine, transformer handles IPFS later if needed.
				// Or, you could fetch and parse it here if always needed in raw form.
			}

			return tokenData;
		} else {
			console.warn(
				`[OBJKT_HELPERS] No token data found for ${contractAddress}:${tokenId}. Response:`,
				response
			);
			return null;
		}
	} catch (error) {
		console.error(
			`[OBJKT_HELPERS] Error fetching Objkt token details for ${contractAddress}:${tokenId}:`,
			error
		);
		return null;
	}
}
