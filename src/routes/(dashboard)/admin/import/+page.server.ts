// src/routes/(dashboard)/admin/import/+page.server.ts
import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';
import { getWalletAddresses } from '$lib/settingsManager';
import { pinCidToPinata, isCidPinned } from '$lib/pinataHelpers';
import { extractCidsFromArtwork } from '$lib/pinataHelpers';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

// Import App namespace to access the Locals interface
// import type { App } from '$app/types';

export const load: PageServerLoad = async ({ locals }) => {
	// Get wallet addresses from settings
	const walletAddresses = await getWalletAddresses();

	return {
		walletAddresses,
	};
};

export const actions: Actions = {
	pinArtworks: async ({ request }) => {
		try {
			const formData = await request.formData();
			const artworksJson = formData.get('artworks')?.toString();

			if (!artworksJson) {
				return fail(400, { success: false, error: 'No artworks provided' });
			}

			const artworks = JSON.parse(artworksJson);

			if (!Array.isArray(artworks) || artworks.length === 0) {
				return fail(400, { success: false, error: 'Invalid artworks data' });
			}

			console.log(`[PIN_BATCH] Processing ${artworks.length} artworks for pinning`);

			const results = [];
			const processedCids = new Set<string>(); // To track already processed CIDs and avoid duplicate processing in this run
			const failedCids = new Set<string>(); // Track failed CIDs for debugging

			for (let i = 0; i < artworks.length; i++) {
				const artwork = artworks[i];
				const artworkName = artwork.title || artwork.name || `Artwork CID`;
				
				console.log(`[PIN_BATCH] Processing artwork ${i + 1}/${artworks.length}: "${artworkName}"`);
				
				const cids = extractCidsFromArtwork(artwork);
				console.log(`[PIN_BATCH] Found ${cids.length} CIDs for artwork "${artworkName}": ${cids.join(', ')}`);

				for (const cid of cids) {
					if (processedCids.has(cid)) {
						// If we've already processed this CID in this batch, skip to avoid redundant checks/pins
						// Pinata itself handles duplicate pins gracefully, but this saves API calls if the same CID appears multiple times
						// in the input `artworks` array under potentially different names.
						// We will pin it once with the first encountered name for that CID.
						console.log(`[PIN_BATCH] CID ${cid} already processed in this batch, skipping.`);
						continue;
					}

					try {
						const alreadyPinned = await isCidPinned(cid);
						if (alreadyPinned) {
							console.log(`[PIN_BATCH] CID ${cid} is already pinned, skipping`);
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
						console.log(`[PIN_BATCH] Pinning CID ${cid} with name: ${pinName}`);
						const result = await pinCidToPinata(cid, pinName);
						
						if (result.error) {
							console.error(`[PIN_BATCH] Failed to pin CID ${cid}: ${result.error}`);
							failedCids.add(cid);
						} else {
							console.log(`[PIN_BATCH] Successfully pinned CID ${cid}`);
						}
						
						results.push(result);
						processedCids.add(cid);
					} catch (error) {
						console.error(`[PIN_BATCH] Error processing CID ${cid}:`, error);
						failedCids.add(cid);
						results.push({
							IpfsHash: cid,
							error: error instanceof Error ? error.message : String(error),
							PinSize: 0,
							Timestamp: new Date().toISOString()
						});
						processedCids.add(cid);
					}
				}
			}

			// Consider any status as success as long as there's no error
			// The 'prechecking' status means the pin request is valid and being processed
			const summary = {
				total: results.length,
				successful: results.filter((r) => !r.error).length,
				failed: results.filter((r) => !!r.error).length,
				duplicates: results.filter((r) => r.isDuplicate).length
			};

			console.log(`[PIN_BATCH] Pinning summary:`, summary);
			
			if (failedCids.size > 0) {
				console.log(`[PIN_BATCH] Failed CIDs:`, Array.from(failedCids));
			}

			// Return simple plain object that SvelteKit can serialize
			return {
				success: true,
				summary: {
					total: summary.total,
					successful: summary.successful,
					failed: summary.failed,
					duplicates: summary.duplicates
				},
				failedCids: Array.from(failedCids) // Include failed CIDs for debugging
			};
		} catch (error) {
			console.error('[PIN_BATCH] Error pinning artworks:', error);
			return fail(500, {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error pinning artworks'
			});
		}
	}
};
