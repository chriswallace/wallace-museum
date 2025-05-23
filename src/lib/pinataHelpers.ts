import { env } from '$env/dynamic/private';

/**
 * Interface for Pinata API pin response
 */
interface PinataResponse {
	IpfsHash: string;
	PinSize: number;
	Timestamp: string;
	isDuplicate?: boolean;
	error?: string;
}

/**
 * Interface for Pinata API pin list response
 */
interface PinataPinListResponse {
	count: number;
	rows: Array<{
		id: string;
		ipfs_pin_hash: string;
		size: number;
		user_id: string;
		date_pinned: string;
		date_unpinned: string | null;
		metadata: {
			name: string;
			keyvalues: Record<string, string>;
		};
	}>;
}

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
 * Get the Pinata gateway URL from environment variables
 * @returns The configured Pinata gateway URL
 */
export function getPinataGateway(): string {
	const gateway = env.PINATA_GATEWAY;
	if (gateway) {
		return `https://${gateway}.mypinata.cloud/ipfs/`;
	}
	return 'https://gateway.pinata.cloud/ipfs/';
}

/**
 * Pin a single CID to Pinata
 * @param cid - The CID to pin
 * @param name - Optional name for the pin
 * @param keyValues - Optional key-value metadata
 * @returns The pin response or error
 */
export async function pinCidToPinata(
	cid: string,
	name?: string,
	keyValues?: Record<string, string>
): Promise<PinataResponse> {
	try {
		const jwt = env.PINATA_JWT;

		if (!jwt) {
			throw new Error('Pinata JWT not found in environment variables');
		}

		// Extract CID if it's a URL
		const extractedCid = extractCidFromUrl(cid);
		if (!extractedCid) {
			throw new Error(`Invalid CID or IPFS URL: ${cid}`);
		}

		console.log(`Pinning CID: ${extractedCid} with name: ${name || 'unnamed'}`);

		const response = await fetch('https://api.pinata.cloud/pinning/pinByHash', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${jwt}`
			},
			body: JSON.stringify({
				hashToPin: extractedCid,
				pinataMetadata: {
					name: name || `Pinned CID ${extractedCid}`,
					keyvalues: keyValues || {}
				}
			})
		});

		const responseText = await response.text();
		console.log(`Pinata API response: ${responseText}`);

		if (!response.ok) {
			let errorData;
			try {
				errorData = JSON.parse(responseText);
			} catch (e) {
				errorData = { error: responseText };
			}

			console.error('Pinata pinning error:', errorData);
			return {
				error: `Pinata error: ${errorData.error || response.statusText}`,
				IpfsHash: extractedCid,
				PinSize: 0,
				Timestamp: new Date().toISOString()
			};
		}

		let result;
		try {
			result = JSON.parse(responseText);
		} catch (e) {
			console.error('Error parsing Pinata response:', e);
			result = {};
		}

		return {
			...result,
			IpfsHash: extractedCid,
			PinSize: result.pinSize || 0,
			Timestamp: new Date().toISOString()
		};
	} catch (error) {
		console.error('Error pinning to Pinata:', error);
		return {
			error: error instanceof Error ? error.message : String(error),
			IpfsHash: cid,
			PinSize: 0,
			Timestamp: new Date().toISOString()
		};
	}
}

/**
 * Get list of pins from Pinata
 * @param limit - Number of pins to retrieve
 * @param offset - Offset for pagination
 * @returns The list of pins or error
 */
export async function getPinataPins(
	limit: number = 100,
	offset: number = 0
): Promise<PinataPinListResponse> {
	try {
		const jwt = env.PINATA_JWT;

		if (!jwt) {
			throw new Error('Pinata JWT not found in environment variables');
		}

		console.log(`Fetching pins with limit: ${limit}, offset: ${offset}`);

		const response = await fetch(
			`https://api.pinata.cloud/pinning/pinList?status=pinned&pageLimit=${limit}&pageOffset=${offset}`,
			{
				method: 'GET',
				headers: {
					Authorization: `Bearer ${jwt}`
				}
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Pinata API error: ${response.status} ${response.statusText}`, errorText);
			throw new Error(`Pinata API error: ${response.statusText}`);
		}

		const data = await response.json();
		console.log(`Fetched ${data.count} pins from Pinata`);
		return data;
	} catch (error) {
		console.error('Error fetching Pinata pins:', error);
		throw error;
	}
}

/**
 * Check if a CID is already pinned
 * @param cid - The CID to check
 * @returns Boolean indicating if the CID is pinned
 */
export async function isCidPinned(cid: string): Promise<boolean> {
	try {
		const extractedCid = extractCidFromUrl(cid);
		if (!extractedCid) return false;

		const jwt = env.PINATA_JWT;

		if (!jwt) {
			throw new Error('Pinata JWT not found in environment variables');
		}

		console.log(`Checking if CID is pinned: ${extractedCid}`);

		const response = await fetch(
			`https://api.pinata.cloud/pinning/pinList?hashContains=${extractedCid}`,
			{
				method: 'GET',
				headers: {
					Authorization: `Bearer ${jwt}`
				}
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Pinata API error: ${response.status} ${response.statusText}`, errorText);
			throw new Error(`Pinata API error: ${response.statusText}`);
		}

		const data = await response.json();
		console.log(`CID ${extractedCid} is ${data.count > 0 ? 'already' : 'not'} pinned`);
		return data.count > 0;
	} catch (error) {
		console.error('Error checking if CID is pinned:', error);
		return false;
	}
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
