import { json } from '@sveltejs/kit';
import prisma from '$lib/prisma';
import { parseWalletInput, formatWalletsForStorage } from '$lib/utils/walletUtils.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	try {
		// Check if user is authenticated
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = url.searchParams.get('userId') || locals.user.id;

		const userWallets = await prisma.userWallet.findMany({
			where: {
				userId: userId
			},
			orderBy: {
				createdAt: 'desc'
			}
		});

		return json({ userWallets });
	} catch (error) {
		console.error('Error fetching user wallets:', error);
		return json({ error: 'Failed to fetch user wallets' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		// Check if user is authenticated
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { name, wallets, userId } = await request.json();

		// Use current user if no userId specified
		const targetUserId = userId || locals.user.id;

		// Parse and validate wallet addresses
		const parsedAddresses = parseWalletInput(wallets);
		const formattedWallets = formatWalletsForStorage(parsedAddresses);

		if (formattedWallets.length === 0) {
			return json({ error: 'No valid wallet addresses provided' }, { status: 400 });
		}

		const userWallet = await prisma.userWallet.create({
			data: {
				userId: targetUserId,
				name: name || null,
				wallets: formattedWallets,
				enabled: true
			}
		});

		return json({ userWallet }, { status: 201 });
	} catch (error) {
		console.error('Error creating user wallet:', error);
		return json({ error: 'Failed to create user wallet' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PUT({ request, locals }) {
	try {
		// Check if user is authenticated
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id, name, wallets, enabled } = await request.json();

		if (!id) {
			return json({ error: 'Wallet ID is required' }, { status: 400 });
		}

		// Verify ownership
		const existingWallet = await prisma.userWallet.findUnique({
			where: { id: parseInt(id) }
		});

		if (!existingWallet || existingWallet.userId !== locals.user.id) {
			return json({ error: 'Wallet not found or access denied' }, { status: 404 });
		}

		const updateData = {};

		if (name !== undefined) {
			updateData.name = name;
		}

		if (wallets !== undefined) {
			const parsedAddresses = parseWalletInput(wallets);
			const formattedWallets = formatWalletsForStorage(parsedAddresses);

			if (formattedWallets.length === 0) {
				return json({ error: 'No valid wallet addresses provided' }, { status: 400 });
			}

			updateData.wallets = formattedWallets;
		}

		if (enabled !== undefined) {
			updateData.enabled = enabled;
		}

		const userWallet = await prisma.userWallet.update({
			where: { id: parseInt(id) },
			data: updateData
		});

		return json({ userWallet });
	} catch (error) {
		console.error('Error updating user wallet:', error);
		return json({ error: 'Failed to update user wallet' }, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ request, locals }) {
	try {
		// Check if user is authenticated
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await request.json();

		if (!id) {
			return json({ error: 'Wallet ID is required' }, { status: 400 });
		}

		// Verify ownership
		const existingWallet = await prisma.userWallet.findUnique({
			where: { id: parseInt(id) }
		});

		if (!existingWallet || existingWallet.userId !== locals.user.id) {
			return json({ error: 'Wallet not found or access denied' }, { status: 404 });
		}

		await prisma.userWallet.delete({
			where: { id: parseInt(id) }
		});

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting user wallet:', error);
		return json({ error: 'Failed to delete user wallet' }, { status: 500 });
	}
}
