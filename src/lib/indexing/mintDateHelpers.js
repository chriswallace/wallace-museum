/**
 * Enhanced mint date detection using OpenSea Events API with pagination
 * @param {string} contractAddress - The contract address
 * @param {string} tokenId - The token ID
 * @param {string} blockchain - The blockchain (ethereum, polygon, etc.)
 * @returns {Promise<{mintDate: string|null, source: string}>} - The mint date and source
 */
export async function detectMintDateFromOpenSeaEvents(
	contractAddress,
	tokenId,
	blockchain = 'ethereum'
) {
	try {
		console.log(`[mintDateHelpers] Fetching events from OpenSea for ${contractAddress}:${tokenId}`);

		let allEvents = [];
		let cursor = null;
		let pageCount = 0;
		const maxPages = 10; // Reasonable limit to prevent infinite loops

		// Paginate through all events for this NFT
		do {
			pageCount++;
			console.log(
				`[mintDateHelpers] Fetching events page ${pageCount}${cursor ? ` (cursor: ${cursor.substring(0, 20)}...)` : ''}`
			);

			const baseUrl = `https://api.opensea.io/api/v2/events/chain/${blockchain}/contract/${contractAddress}/nfts/${tokenId}`;
			const params = new URLSearchParams({
				limit: '50', // Maximum allowed by OpenSea
				event_type: 'transfer' // Only get transfer events to find mint
			});

			if (cursor) {
				params.set('next', cursor);
			}

			const url = `${baseUrl}?${params}`;
			const response = await fetch(url, {
				headers: {
					'X-API-KEY': process.env.OPENSEA_API_KEY || ''
				}
			});

			if (!response.ok) {
				console.warn(`[mintDateHelpers] OpenSea Events API request failed: ${response.status}`);
				break;
			}

			const data = await response.json();

			if (!data.asset_events || !Array.isArray(data.asset_events)) {
				console.warn(`[mintDateHelpers] No events found in OpenSea response`);
				break;
			}

			console.log(
				`[mintDateHelpers] Found ${data.asset_events.length} events on page ${pageCount}`
			);
			allEvents.push(...data.asset_events);

			// Update cursor for next page
			cursor = data.next;

			// Safety check to prevent infinite loops
			if (pageCount >= maxPages) {
				console.warn(
					`[mintDateHelpers] Reached maximum page limit (${maxPages}), stopping pagination`
				);
				break;
			}

			// Add small delay to be respectful to the API
			await new Promise((resolve) => setTimeout(resolve, 100));
		} while (cursor);

		console.log(
			`[mintDateHelpers] Total events collected: ${allEvents.length} across ${pageCount} pages`
		);

		if (allEvents.length === 0) {
			return { mintDate: null, source: 'OpenSea Events (no events found)' };
		}

		// Look for transfer events from null address (mint events)
		const mintEvents = allEvents.filter(
			(event) =>
				event.event_type === 'transfer' &&
				(!event.from_address || event.from_address === '0x0000000000000000000000000000000000000000')
		);

		console.log(`[mintDateHelpers] Found ${mintEvents.length} potential mint events`);

		if (mintEvents.length > 0) {
			// Sort by event timestamp to get the earliest mint event
			mintEvents.sort((a, b) => parseInt(a.event_timestamp) - parseInt(b.event_timestamp));

			const earliestMint = mintEvents[0];
			// OpenSea Events API returns Unix timestamps in seconds, not milliseconds
			const mintDate = new Date(parseInt(earliestMint.event_timestamp) * 1000);

			console.log(`[mintDateHelpers] Found mint event: ${mintDate.toISOString()}`);
			console.log(`[mintDateHelpers] Transaction: ${earliestMint.transaction}`);

			return {
				mintDate: mintDate.toISOString(),
				source: 'OpenSea Events (mint transfer)'
			};
		}

		// If no mint events found, use the earliest transfer event as fallback
		const allTransfers = allEvents.filter((event) => event.event_type === 'transfer');

		if (allTransfers.length > 0) {
			allTransfers.sort((a, b) => parseInt(a.event_timestamp) - parseInt(b.event_timestamp));
			const earliestTransfer = allTransfers[0];
			// OpenSea Events API returns Unix timestamps in seconds, not milliseconds
			const transferDate = new Date(parseInt(earliestTransfer.event_timestamp) * 1000);

			console.log(
				`[mintDateHelpers] No mint events found, using earliest transfer: ${transferDate.toISOString()}`
			);

			return {
				mintDate: transferDate.toISOString(),
				source: 'OpenSea Events (earliest transfer)'
			};
		}

		// If no transfer events, use the earliest event of any type
		allEvents.sort((a, b) => parseInt(a.event_timestamp) - parseInt(b.event_timestamp));
		const earliestEvent = allEvents[0];
		// OpenSea Events API returns Unix timestamps in seconds, not milliseconds
		const eventDate = new Date(parseInt(earliestEvent.event_timestamp) * 1000);

		console.log(
			`[mintDateHelpers] Using earliest event of any type: ${eventDate.toISOString()} (${earliestEvent.event_type})`
		);

		return {
			mintDate: eventDate.toISOString(),
			source: `OpenSea Events (earliest ${earliestEvent.event_type})`
		};
	} catch (error) {
		console.error(`[mintDateHelpers] Error fetching events from OpenSea:`, error);
		return { mintDate: null, source: 'OpenSea Events (error)' };
	}
}
