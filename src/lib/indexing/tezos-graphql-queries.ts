/**
 * Optimized GraphQL queries for Tezos NFT data fetching
 * These queries are designed to minimize API calls while fetching all required data
 */

import { WRAPPED_TEZOS_CONTRACT } from '../constants/tezos';

/**
 * Optimized query for fetching wallet NFTs with all required data in a single request.
 * This single query fetches:
 * - Token details (name, description, URIs, metadata)
 * - Creator/artist information with profile data
 * - Collection (FA) information
 * - Mint date (timestamp)
 * - All display media URLs
 * - Dimensions data
 */
export const FETCH_WALLET_NFTS_QUERY = `
  query FetchWalletNFTs($address: String!, $limit: Int!, $offset: Int!) {
    token_holder(
      where: {
        holder_address: {_eq: $address}
        quantity: {_gt: "0"}
        token: {fa_contract: {_neq: "${WRAPPED_TEZOS_CONTRACT}"}}
      }
      limit: $limit
      offset: $offset
      order_by: {last_incremented_at: desc}
    ) {
      quantity
      last_incremented_at
      token {
        token_id
        name
        description
        display_uri
        thumbnail_uri
        artifact_uri
        metadata
        mime
        supply
        timestamp
        dimensions
        fa {
          contract
          name
          description
          logo
          website
        }
        creators {
          creator_address
          holder {
            address
            alias
            logo
            description
            website
            twitter
            instagram
          }
        }
        attributes {
          attribute {
            name
            type
            value
          }
        }
      }
    }
  }
`;

/**
 * Query to fetch NFTs created by a wallet address
 */
export const FETCH_CREATED_NFTS_QUERY = `
  query FetchCreatedNFTs($address: String!, $limit: Int!, $offset: Int!) {
    token(
      where: {
        creators: {creator_address: {_eq: $address}},
        fa_contract: {_neq: "${WRAPPED_TEZOS_CONTRACT}"}
      }
      limit: $limit
      offset: $offset
      order_by: {timestamp: desc}
    ) {
      token_id
      name
      description
      display_uri
      thumbnail_uri
      artifact_uri
      metadata
      mime
      supply
      timestamp
      dimensions
      fa {
        contract
        name
        description
        logo
        website
      }
      creators {
        creator_address
        holder {
          address
          alias
          logo
          description
          website
          twitter
          instagram
        }
      }
      attributes {
        attribute {
          name
          type
          value
        }
      }
    }
  }
`;

/**
 * Query to fetch a single token by contract and token ID with all details
 */
export const FETCH_TOKEN_DETAILS_QUERY = `
  query FetchTokenDetails($contractAddress: String!, $tokenId: String!) {
    token(where: {fa_contract: {_eq: $contractAddress}, token_id: {_eq: $tokenId}}) {
      token_id
      name
      description
      artifact_uri
      display_uri
      thumbnail_uri
      metadata
      mime
      supply
      symbol
      timestamp
      dimensions
      extra
      attributes {
        attribute {
          name
          value
        }
      }
      tags {
        tag {
          name
        }
      }
      fa {
        contract
        name
        description
        website
        twitter
        logo
        short_name
        path
        metadata
        creator_address
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
      creators {
        creator_address
        holder {
          address
          alias
          description
          logo
          website
          twitter
          instagram
        }
      }
    }
  }
`;

/**
 * Query to fetch collection details with creator information
 */
export const FETCH_COLLECTION_DETAILS_QUERY = `
  query FetchCollectionDetails($contractAddress: String!) {
    fa(where: {contract: {_eq: $contractAddress}}) {
      contract
      name
      description
      website
      twitter
      logo
      short_name
      path
      metadata
      creator_address
      creator {
        address
        alias
        description
        logo
        website
        twitter
        instagram
      }
      collection_id
      collection_type
      editions
      items
      floor_price
      volume_24h
      volume_total
      originated
      timestamp
    }
  }
`;

/**
 * Helper function to build search condition for GraphQL queries
 */
export function buildSearchCondition(searchTerm: string | null): string {
  if (!searchTerm) return '';
  return `%${searchTerm}%`;
} 