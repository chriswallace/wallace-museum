import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/prisma';

// POST: Add a new address to an artist
export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const artistId = parseInt(params.id || '');
		const data = await request.json();

		if (isNaN(artistId)) {
			return json({ error: 'Invalid artist ID' }, { status: 400 });
		}

		// Validate required fields
		if (!data.address || !data.blockchain) {
			return json({ error: 'Address and blockchain are required' }, { status: 400 });
		}

		// Check if artist exists
		const artist = await prisma.artist.findUnique({
			where: { id: artistId }
		});

		if (!artist) {
			return json({ error: 'Artist not found' }, { status: 404 });
		}

		// Get current wallet addresses from JSON field
		const currentWallets = Array.isArray((artist as any).walletAddresses) 
			? (artist as any).walletAddresses as any[]
			: [];

		// Check if address already exists for this artist and blockchain
		const addressExists = currentWallets.some((wallet: any) => 
			wallet.address?.toLowerCase() === data.address.toLowerCase() && 
			wallet.blockchain === data.blockchain
		);

		if (addressExists) {
			return json({ error: 'Address already exists for this artist and blockchain' }, { status: 409 });
		}

		// Create the new wallet object
		const newWallet = {
			address: data.address.toLowerCase(),
			blockchain: data.blockchain,
			lastIndexed: new Date().toISOString()
		};

		// Add the new wallet to the array
		const updatedWallets = [...currentWallets, newWallet];

		// Update the artist with the new wallet addresses
		await prisma.artist.update({
			where: { id: artistId },
			data: {
				walletAddresses: updatedWallets as any
			}
		});

		// Return the new address with an index-based ID for frontend compatibility
		const addressWithId = {
			id: updatedWallets.length - 1, // Use array index as ID
			address: newWallet.address,
			blockchain: newWallet.blockchain,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		return json({ success: true, address: addressWithId });
	} catch (error) {
		console.error('Error adding address:', error);
		return json({ error: 'Failed to add address' }, { status: 500 });
	}
};
