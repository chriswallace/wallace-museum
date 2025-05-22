import { json } from '@sveltejs/kit';
import prisma from '$lib/prisma';

// POST: Add a new address to an artist
export async function POST({ params, request }) {
	const { id } = params;
	const data = await request.json();
	const artistId = parseInt(id, 10);

	try {
		console.log('Adding address:', data, 'to artist ID:', artistId);
		
		// First check if the address already exists
		const existingAddress = await prisma.artistAddress.findFirst({
			where: {
				address: data.address,
				blockchain: data.blockchain
			}
		});

		console.log('Existing address check result:', existingAddress);
		
		let address;
		
		if (existingAddress) {
			// Update the existing address if it exists
			console.log('Updating existing address ID:', existingAddress.id);
			address = await prisma.artistAddress.update({
				where: { id: existingAddress.id },
				data: { artistId: artistId }
			});
		} else {
			// Create a new address if it doesn't exist
			console.log('Creating new address');
			address = await prisma.artistAddress.create({
				data: {
					address: data.address,
					blockchain: data.blockchain,
					artistId: artistId
				}
			});
		}

		console.log('Address operation result:', address);
		return json(address);
	} catch (error) {
		console.error('Error adding artist address:', error);
		// Return more detailed error information
		return json({ 
			error: 'Error adding artist address', 
			details: error instanceof Error ? error.message : String(error) 
		}, { status: 500 });
	}
}
