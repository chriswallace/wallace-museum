import type { PageServerLoad } from './$types';
import {
	getPinataPins,
	pinCidToPinata,
	extractCidFromUrl,
	getPinataGateway
} from '$lib/pinataHelpers';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	// The admin layout server already handles authentication
	// We don't need to check for user or admin status here

	try {
		// Get pagination parameters from URL
		const limit = parseInt(url.searchParams.get('limit') || '50', 10);
		const offset = parseInt(url.searchParams.get('offset') || '0', 10);

		// Get pins from Pinata
		const pinsData = await getPinataPins(limit, offset);

		// Get Pinata gateway URL
		const pinataGateway = getPinataGateway();

		return {
			pins: pinsData.rows,
			totalPins: pinsData.count,
			currentPage: Math.floor(offset / limit),
			pageSize: limit,
			pinataGateway
		};
	} catch (error) {
		console.error('Error loading Pinata pins:', error);
		return {
			pins: [],
			totalPins: 0,
			currentPage: 0,
			pageSize: 50,
			error: error instanceof Error ? error.message : 'Unknown error loading pins',
			pinataGateway: getPinataGateway()
		};
	}
};

export const actions: Actions = {
	pinCid: async ({ request }) => {
		try {
			const formData = await request.formData();
			const cid = formData.get('cid')?.toString();

			if (!cid) {
				return fail(400, { success: false, error: 'No CID provided' });
			}

			const extractedCid = extractCidFromUrl(cid);
			if (!extractedCid) {
				return fail(400, { success: false, error: 'Invalid CID or IPFS URL' });
			}

			const result = await pinCidToPinata(extractedCid);

			if (result.error) {
				return fail(500, { success: false, error: result.error });
			}

			return {
				success: true,
				result
			};
		} catch (error) {
			console.error('Error pinning CID:', error);
			return fail(500, {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error pinning CID'
			});
		}
	}
};
