import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/prisma';

export const POST: RequestHandler = async ({ params }) => {
	const { id } = params;
	
	if (!id) {
		return json({ error: 'Artist ID is required' }, { status: 400 });
	}
	
	const artistId = parseInt(id, 10);
	
	try {
		// Get current artist state
		const currentArtist = await db.read.artist.findUnique({
			where: { id: artistId },
			select: { isVerified: true }
		});
		
		if (!currentArtist) {
			return json({ error: 'Artist not found' }, { status: 404 });
		}
		
		// Toggle the isVerified status
		const updatedArtist = await db.write.artist.update({
			where: { id: artistId },
			data: { isVerified: !currentArtist.isVerified }
		});
		
		return json({ 
			success: true, 
			artist: updatedArtist,
			message: `Artist ${updatedArtist.isVerified ? 'verified' : 'unverified'} successfully`
		});
	} catch (error) {
		console.error('Error toggling artist verification:', error);
		return json({ error: 'Failed to toggle artist verification' }, { status: 500 });
	}
};
