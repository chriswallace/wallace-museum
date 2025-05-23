import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWalletAddresses, addWalletAddress, removeWalletAddress } from '$lib/settingsManager';

// GET endpoint to retrieve all wallet addresses
export const GET: RequestHandler = async ({ request }) => {
	try {
		const walletAddresses = await getWalletAddresses();
		return json({ success: true, walletAddresses });
	} catch (error) {
		console.error('Error getting wallet addresses:', error);
		return json(
			{ success: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};

// POST endpoint to add a new wallet address
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { address, blockchain, alias } = body;

		if (!address || !blockchain) {
			return json(
				{ success: false, error: 'Address and blockchain are required' },
				{ status: 400 }
			);
		}

		const walletAddresses = await addWalletAddress(address, blockchain, alias);
		return json({ success: true, walletAddresses });
	} catch (error) {
		console.error('Error adding wallet address:', error);
		return json(
			{ success: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};

// DELETE endpoint to remove a wallet address
export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { address, blockchain } = body;

		if (!address || !blockchain) {
			return json(
				{ success: false, error: 'Address and blockchain are required' },
				{ status: 400 }
			);
		}

		const walletAddresses = await removeWalletAddress(address, blockchain);
		return json({ success: true, walletAddresses });
	} catch (error) {
		console.error('Error removing wallet address:', error);
		return json(
			{ success: false, error: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
