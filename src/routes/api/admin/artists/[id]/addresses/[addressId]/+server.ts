import { json } from '@sveltejs/kit';
import prisma from '$lib/prisma';

// DELETE: Remove an address from an artist
export async function DELETE({ params }) {
	const { addressId } = params;

	try {
		await prisma.artistAddress.delete({
			where: {
				id: parseInt(addressId, 10)
			}
		});

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting artist address:', error);
		return json({ error: 'Error deleting artist address' }, { status: 500 });
	}
}
