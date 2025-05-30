/**
 * fxhash API helpers for fetching artist and token data
 * Based on fxhash API documentation
 */

const FXHASH_API_URL = 'https://api.fxhash.xyz/graphql';

/**
 * Execute a GraphQL query against the fxhash API
 */
async function executeGraphQLQuery(query: string, variables: Record<string, any> = {}) {
	try {
		const response = await fetch(FXHASH_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				query,
				variables
			})
		});

		if (!response.ok) {
			throw new Error(`fxhash API HTTP error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		if (data.errors) {
			console.error('[FXHASH_API] GraphQL errors:', data.errors);
			throw new Error(
				`fxhash API GraphQL errors: ${data.errors.map((e: any) => e.message).join(', ')}`
			);
		}

		return data.data;
	} catch (error) {
		console.error('[FXHASH_API] Query failed:', error);
		throw error;
	}
}

/**
 * Fetch artist information from fxhash API by wallet address
 */
export async function fetchArtist(address: string) {
	const query = `
    query GetUser($id: String!) {
      user(id: $id) {
        id
        name
        description
        avatarUri
        banner
        website
        metadata
        createdAt
        updatedAt
        flag
        type
        stats {
          generativeTokensCount
          ownedTokensCount
          mintedTokensCount
          collectionSize
        }
        collaborationContracts {
          id
          collaboration {
            id
            name
            description
          }
        }
      }
    }
  `;

	try {
		const data = await executeGraphQLQuery(query, { id: address });

		if (!data.user) {
			console.warn(`[FXHASH_API] No user found for address: ${address}`);
			return null;
		}

		const user = data.user;

		// Transform fxhash user data to match objkt format for compatibility
		return {
			username: user.name || undefined,
			bio: user.description || undefined,
			profile_image_url: user.avatarUri || undefined,
			banner_image_url: user.banner || undefined,
			website: user.website || undefined,
			address: address,
			metadata: user.metadata || undefined,
			// Additional fxhash-specific fields
			fxhash: {
				flag: user.flag,
				type: user.type,
				stats: user.stats,
				collaborations: user.collaborationContracts,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt
			}
		};
	} catch (error) {
		console.error(`[FXHASH_API] Error fetching artist ${address}:`, error);
		throw error;
	}
}

/**
 * Fetch token details from fxhash API
 */
export async function fetchTokenDetails(contractAddress: string, tokenId: string) {
	const query = `
    query GetObjkt($id: Float!) {
      objkt(id: $id) {
        id
        name
        description
        metadata
        metadataUri
        displayUri
        thumbnailUri
        artifactUri
        generativeToken {
          id
          name
          slug
          description
          thumbnailUri
          displayUri
          metadata
          mintOpensAt
          mintClosesAt
          supply
          balance
          enabled
          author {
            id
            name
            description
            avatarUri
            website
          }
          project {
            id
            name
            description
            metadata
          }
        }
        owner {
          id
          name
          description
          avatarUri
          website
        }
        issuer {
          id
          name
          description
          avatarUri
          website
        }
        rarity
        duplicate
        iteration
        royalties
        features
        assigned
        assignedAt
        createdAt
        updatedAt
        mintedAt
      }
    }
  `;

	try {
		// For fxhash, token ID needs to be converted to their objkt ID format
		// This is a simplified approach - you might need to adjust based on actual fxhash ID structure
		const objktId = parseInt(tokenId);

		const data = await executeGraphQLQuery(query, { id: objktId });

		if (!data.objkt) {
			console.warn(`[FXHASH_API] No token found for objkt ID: ${objktId}`);
			return null;
		}

		const objkt = data.objkt;

		// Transform fxhash objkt data to match expected format
		return {
			id: objkt.id,
			name: objkt.name,
			description: objkt.description,
			display_uri: objkt.displayUri,
			thumbnail_uri: objkt.thumbnailUri,
			artifact_uri: objkt.artifactUri,
			metadata_uri: objkt.metadataUri,
			metadata: objkt.metadata,
			rarity: objkt.rarity,
			iteration: objkt.iteration,
			features: objkt.features,
			created_at: objkt.createdAt,
			minted_at: objkt.mintedAt,

			// Creator information
			creator: objkt.issuer || objkt.generativeToken?.author,

			// Collection information
			generative_token: objkt.generativeToken
				? {
						id: objkt.generativeToken.id,
						name: objkt.generativeToken.name,
						slug: objkt.generativeToken.slug,
						description: objkt.generativeToken.description,
						thumbnail_uri: objkt.generativeToken.thumbnailUri,
						display_uri: objkt.generativeToken.displayUri,
						metadata: objkt.generativeToken.metadata,
						supply: objkt.generativeToken.supply,
						balance: objkt.generativeToken.balance,
						enabled: objkt.generativeToken.enabled,
						author: objkt.generativeToken.author,
						project: objkt.generativeToken.project,
						mint_opens_at: objkt.generativeToken.mintOpensAt,
						mint_closes_at: objkt.generativeToken.mintClosesAt
					}
				: null,

			// Owner information
			owner: objkt.owner,

			// fxhash-specific fields
			fxhash: {
				duplicate: objkt.duplicate,
				assigned: objkt.assigned,
				assigned_at: objkt.assignedAt,
				royalties: objkt.royalties,
				updated_at: objkt.updatedAt
			}
		};
	} catch (error) {
		console.error(`[FXHASH_API] Error fetching token ${contractAddress}:${tokenId}:`, error);
		throw error;
	}
}

/**
 * Fetch project/collection details from fxhash API
 */
export async function fetchProject(projectId: string) {
	const query = `
    query GetGenerativeToken($id: String!) {
      generativeToken(id: $id) {
        id
        name
        slug
        description
        metadata
        metadataUri
        thumbnailUri
        displayUri
        supply
        balance
        enabled
        mintOpensAt
        mintClosesAt
        createdAt
        updatedAt
        author {
          id
          name
          description
          avatarUri
          website
        }
        project {
          id
          name
          description
          metadata
        }
        features {
          name
          rarity
        }
        stats {
          floorPrice
          highestSold
          median
          mean
          listed
        }
      }
    }
  `;

	try {
		const data = await executeGraphQLQuery(query, { id: projectId });

		if (!data.generativeToken) {
			console.warn(`[FXHASH_API] No project found for ID: ${projectId}`);
			return null;
		}

		return data.generativeToken;
	} catch (error) {
		console.error(`[FXHASH_API] Error fetching project ${projectId}:`, error);
		throw error;
	}
}
