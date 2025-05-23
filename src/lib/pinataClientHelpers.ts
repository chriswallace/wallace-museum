/**
 * Client-side version of Pinata helpers
 * This file contains only functions that don't require server-side environment variables
 */

/**
 * Extract CID from various IPFS URL formats
 * @param url - The URL or CID string to extract from
 * @returns The extracted CID or null if not found
 */
export function extractCidFromUrl(url: string): string | null {
	if (!url) return null;

	// If it's already just a CID (starts with Qm or bafy)
	if (url.startsWith('Qm') || url.startsWith('bafy')) {
		return url;
	}

	// Handle ipfs:// protocol
	if (url.startsWith('ipfs://')) {
		return url.replace('ipfs://', '');
	}

	// Handle gateway URLs
	const gatewayRegex = /https?:\/\/[^/]+\/ipfs\/([^/?#]+)/;
	const match = url.match(gatewayRegex);
	if (match && match[1]) {
		return match[1];
	}

	return null;
}

/**
 * Extract all IPFS CIDs from an artwork object
 * @param artwork - The artwork object to extract CIDs from
 * @returns Array of unique CIDs found in the artwork
 */
export function extractCidsFromArtwork(artwork: any): string[] {
	const cids = new Set<string>();

	// Common fields that might contain IPFS URLs
	const fieldsToCheck = [
		'image_url',
		'animation_url',
		'metadata_url',
		'image_original_url',
		'display_uri',
		'artifact_uri',
		'thumbnail_uri'
	];

	// Check main fields
	for (const field of fieldsToCheck) {
		if (artwork[field]) {
			const cid = extractCidFromUrl(artwork[field]);
			if (cid) cids.add(cid);
		}
	}

	// Check nested metadata if available
	if (artwork.metadata && typeof artwork.metadata === 'object') {
		for (const field of fieldsToCheck) {
			if (artwork.metadata[field]) {
				const cid = extractCidFromUrl(artwork.metadata[field]);
				if (cid) cids.add(cid);
			}
		}
	}

	// Check indexed data if available
	if (artwork.indexedData && typeof artwork.indexedData === 'object') {
		for (const field of fieldsToCheck) {
			if (artwork.indexedData[field]) {
				const cid = extractCidFromUrl(artwork.indexedData[field]);
				if (cid) cids.add(cid);
			}
		}
	}

	return Array.from(cids);
}

/**
 * Get IPFS gateway URL for a CID
 * @param cid - The CID to get a gateway URL for
 * @param gateway - Optional gateway to use (defaults to ipfs.io)
 * @returns Full gateway URL for the CID
 */
export function getIpfsGatewayUrl(cid: string, gateway?: string): string {
	// Extract CID if it's a URL
	const extractedCid = extractCidFromUrl(cid);
	if (!extractedCid) return '';

	// Default gateway if not provided
	const gatewayUrl = gateway || 'https://ipfs.io/ipfs/';

	// Ensure gateway URL ends with /
	const normalizedGateway = gatewayUrl.endsWith('/') ? gatewayUrl : `${gatewayUrl}/`;

	return `${normalizedGateway}${extractedCid}`;
}
