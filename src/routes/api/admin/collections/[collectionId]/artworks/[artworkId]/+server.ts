import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/prisma';

// POST: Remove Artwork from a Collection
export const DELETE: RequestHandler = async ({ params }) => {
	const { collectionId, artworkId } = params;
	
	try {
		// Remove artwork from collection
		const artworkUpdated = await db.write.artwork.update({
			where: { id: parseInt(artworkId!) },
			data: { collectionId: null }
		});
		
		return json({ 
			success: true, 
			message: 'Artwork removed from collection',
			artwork: artworkUpdated
		});
	} catch (error) {
		console.error('Error removing artwork from collection:', error);
		return json({ error: 'Failed to remove artwork from collection' }, { status: 500 });
	}
};
