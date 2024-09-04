const GRAPHQL_ENDPOINT = 'https://data.objkt.com/v3/graphql';

async function graphqlFetch(query) {
    const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

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
            ...(holderData.twitter ? [{ platform: "twitter", username: holderData.twitter }] : []),
            ...(holderData.instagram ? [{ platform: "instagram", username: holderData.instagram }] : [])
        ],
        bio: holderData.description
    };

    return transformedData;
}

export async function fetchOwnedNFTsByAddress(walletAddress, limit = 100, offset = 0) {
    const query = `
    {
        holder(where: {address: {_eq: "${walletAddress}"}}) {
            held_tokens(limit: ${limit}, offset: ${offset}) {
                token{
                    token_id
                    name
                    artifact_uri
                    display_uri
                    description
                    mime
                    supply
                    symbol
                    metadata
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
    return graphqlFetch(query);
}

export async function fetchCreatedNFTsByAddress(walletAddress, limit = 100, offset = 0) {
    const query = `
    {
        holder(where: {address: {_eq: "${walletAddress}"}}) {
            created_tokens(limit: ${limit}, offset: ${offset}) {
                token{
                    token_id
                    name
                    artifact_uri
                    display_uri
                    description
                    metadata
                    fa {
                        name,
						contract
                    }
                    timestamp
                }
            }
        }
    }`;
    return graphqlFetch(query);
}

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
