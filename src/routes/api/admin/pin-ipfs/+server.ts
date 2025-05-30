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
			const artworksToProcess = requestData.artworks;
			console.log(`Processing ${artworksToProcess.length} artworks for pinning via API`);

			const results = [];
			const processedCids = new Set<string>(); // To track already processed CIDs

			for (const artwork of artworksToProcess) {
				const cids = extractCidsFromArtwork(artwork);
				const artworkName = artwork.title || artwork.name || `Artwork CID`;

				for (const cid of cids) {
					// If processing multiple artworks and a CID appears in more than one,
					// we pin it once with the name from the first artwork it was found in.
					if (processedCids.has(cid)) {
						console.log(`CID ${cid} already processed in this API batch, skipping.`);
						continue;
					}

					const alreadyPinned = await isCidPinned(cid);
					if (alreadyPinned) {
						results.push({
							IpfsHash: cid,
							isDuplicate: true,
							Timestamp: new Date().toISOString(),
							PinSize: 0
						});
						processedCids.add(cid);
						continue;
					}

					const pinName = artworkName === 'Artwork CID' ? `${artworkName}: ${cid}` : artworkName;
					console.log(`Pinning CID ${cid} with name: ${pinName} via API`);
					const result = await pinCidToPinata(cid, pinName);
					results.push(result);
					processedCids.add(cid);
				}
			}

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
