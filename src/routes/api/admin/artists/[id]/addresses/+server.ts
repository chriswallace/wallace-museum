import { json } from '@sveltejs/kit';
import prisma from '$lib/prisma';

// POST: Add a new address to an artist
export async function POST({ params, request }) {
	const { id } = params;
	const data = await request.json();

	try {
		const address = await prisma.artistAddress.create({
			data: {
				address: data.address,
				blockchain: data.blockchain,
				artistId: parseInt(id, 10)
			}
		});

		return json(address);
	} catch (error) {
		console.error('Error adding artist address:', error);
		return json({ error: 'Error adding artist address' }, { status: 500 });
	}
}
