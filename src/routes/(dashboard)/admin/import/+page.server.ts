// src/routes/(dashboard)/admin/import/+page.server.ts
import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';
import { getWalletAddresses } from '$lib/settingsManager';
import { pinCidToPinata, isCidPinned } from '$lib/pinataHelpers';
import { extractCidsFromArtwork } from '$lib/pinataClientHelpers';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

// Import App namespace to access the Locals interface
// import type { App } from '$app/types';

export const load: PageServerLoad = async ({ locals }) => {
	// Get wallet addresses from settings
	const walletAddresses = await getWalletAddresses();

	// Get blockchains from existing artworks
	const blockchains = await prisma.artwork.findMany({
		select: { blockchain: true },
		where: { blockchain: { not: null } },
		distinct: ['blockchain']
	});

	// Get all artists
	const artists = await prisma.artist.findMany({
		select: { id: true, name: true },
		orderBy: { name: 'asc' }
	});

	// Get all collections
	const collections = await prisma.collection.findMany({
		select: { id: true, title: true, slug: true },
		orderBy: { title: 'asc' }
	});

	return {
		walletAddresses,
		blockchains: blockchains.map((b) => b.blockchain).filter(Boolean),
		artists,
		collections
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

			// Extract unique CIDs from all artworks
			const allCids = new Set<string>();
			for (const artwork of artworks) {
				const cids = extractCidsFromArtwork(artwork);
				cids.forEach((cid) => allCids.add(cid));
			}

			// Pin all unique CIDs
			const cidsArray = Array.from(allCids);
			console.log(`Pinning ${cidsArray.length} unique CIDs from ${artworks.length} artworks`);

			const results = await Promise.all(
				cidsArray.map(async (cid) => {
					// Check if already pinned to avoid duplicates
					const alreadyPinned = await isCidPinned(cid);
					if (alreadyPinned) {
						console.log(`CID ${cid} is already pinned, skipping`);
						return {
							IpfsHash: cid,
							isDuplicate: true,
							Timestamp: new Date().toISOString(),
							PinSize: 0
						};
					}
					console.log(`Pinning CID ${cid}`);
					return pinCidToPinata(cid, `Artwork CID: ${cid}`);
				})
			);

			const summary = {
				total: results.length,
				successful: results.filter((r) => !r.error).length,
				failed: results.filter((r) => r.error).length,
				duplicates: results.filter((r) => r.isDuplicate).length
			};

			console.log('Pinning summary:', summary);

			return {
				success: true,
				results,
				summary
			};
		} catch (error) {
			console.error('Error pinning artworks:', error);
			return fail(500, {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error pinning artworks'
			});
		}
	}
};
