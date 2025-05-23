import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { pinCidToPinata, extractCidsFromArtwork, isCidPinned } from '$lib/pinataHelpers';
import { env } from '$env/dynamic/private';

// POST endpoint to pin a single CID or multiple CIDs
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Validate API key if provided in environment
		if (env.INDEXER_API_KEY) {
			const authHeader = request.headers.get('Authorization');
			if (
				!authHeader ||
				!authHeader.startsWith('Bearer ') ||
				authHeader.replace('Bearer ', '') !== env.INDEXER_API_KEY
			) {
				return json({ success: false, error: 'Unauthorized' }, { status: 401 });
			}
		}

		const requestData = await request.json();

		// Handle single CID
		if (requestData.cid) {
			const result = await pinCidToPinata(requestData.cid, requestData.name, requestData.metadata);

			return json({
				success: !result.error,
				result
			});
		}

		// Handle multiple CIDs
		if (requestData.cids && Array.isArray(requestData.cids)) {
			const results = await Promise.all(
				requestData.cids.map((cid: string) => pinCidToPinata(cid, `Batch pin: ${cid}`))
			);

			return json({
				success: true,
				results,
				summary: {
					total: results.length,
					successful: results.filter((r) => !r.error).length,
					failed: results.filter((r) => r.error).length
				}
			});
		}

		// Handle artwork objects to extract and pin CIDs
		if (requestData.artworks && Array.isArray(requestData.artworks)) {
			// Extract unique CIDs from all artworks
			const allCids = new Set<string>();
			for (const artwork of requestData.artworks) {
				const cids = extractCidsFromArtwork(artwork);
				cids.forEach((cid) => allCids.add(cid));
			}

			// Pin all unique CIDs
			const cidsArray = Array.from(allCids);
			const results = await Promise.all(
				cidsArray.map(async (cid) => {
					// Check if already pinned to avoid duplicates
					const alreadyPinned = await isCidPinned(cid);
					if (alreadyPinned) {
						return {
							IpfsHash: cid,
							isDuplicate: true,
							Timestamp: new Date().toISOString(),
							PinSize: 0
						};
					}
					return pinCidToPinata(cid, `Artwork CID: ${cid}`);
				})
			);

			return json({
				success: true,
				results,
				summary: {
					total: results.length,
					successful: results.filter((r) => !r.error).length,
					failed: results.filter((r) => r.error).length,
					duplicates: results.filter((r) => r.isDuplicate).length
				}
			});
		}

		return json(
			{ success: false, error: 'Invalid request. Provide cid, cids, or artworks.' },
			{ status: 400 }
		);
	} catch (error) {
		console.error('Error in pin-ipfs endpoint:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// GET endpoint to list pinned CIDs
export const GET: RequestHandler = async ({ url }) => {
	try {
		// Validate API key if provided in environment
		if (env.INDEXER_API_KEY) {
			const apiKey = url.searchParams.get('key');
			if (!apiKey || apiKey !== env.INDEXER_API_KEY) {
				return json({ success: false, error: 'Unauthorized' }, { status: 401 });
			}
		}

		const limit = parseInt(url.searchParams.get('limit') || '100');
		const offset = parseInt(url.searchParams.get('offset') || '0');

		// This function is imported from pinataHelpers
		const pins = await import('$lib/pinataHelpers').then((mod) => mod.getPinataPins(limit, offset));

		return json({
			success: true,
			pins: pins.rows,
			count: pins.count
		});
	} catch (error) {
		console.error('Error fetching pins:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
