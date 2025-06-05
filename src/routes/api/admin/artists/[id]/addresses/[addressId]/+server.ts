import { json } from '@sveltejs/kit';
import { prismaWrite } from '$lib/prisma';

// DELETE: Remove an address from an artist
export async function DELETE({ params }: { params: { id: string, addressId: string } }) {
	const { id, addressId } = params;
	const artistId = parseInt(id, 10);
	const addressIndex = parseInt(addressId, 10);

	try {
		// Get the current artist
		const artist = await prismaWrite.artist.findUnique({
			where: { id: artistId }
		});

		if (!artist) {
			return json({ error: 'Artist not found' }, { status: 404 });
		}

		// Get current wallet addresses from JSON field
		const currentWallets = Array.isArray((artist as any).walletAddresses) 
			? (artist as any).walletAddresses as any[]
			: [];

		// Check if the address index is valid
		if (addressIndex < 0 || addressIndex >= currentWallets.length) {
			return json({ error: 'Address not found' }, { status: 404 });
		}

		// Remove the address at the specified index
		const updatedWallets = currentWallets.filter((_, index) => index !== addressIndex);

		// Update the artist with the new wallet addresses
		await prismaWrite.artist.update({
			where: { id: artistId },
			data: {
				walletAddresses: updatedWallets as any
			}
		});

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting artist address:', error);
		return json({ error: 'Error deleting artist address' }, { status: 500 });
	}
}
