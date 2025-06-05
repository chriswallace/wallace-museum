import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/prisma';

// POST: Add Multiple Artworks to a Collection
export const POST: RequestHandler = async ({ params, request }) => {
	const { collectionId } = params;
	
	try {
		const { artworkIds } = await request.json();
		
		if (!artworkIds || !Array.isArray(artworkIds)) {
			return json({ error: 'Artwork IDs array is required' }, { status: 400 });
		}
		
		// Validate collection exists
		const collection = await db.read.collection.findUnique({
			where: { id: parseInt(collectionId!) }
		});
		
		if (!collection) {
			return json({ error: 'Collection not found' }, { status: 404 });
		}
		
		// Update artworks to add them to the collection
		const updatePromises = artworkIds.map(artworkId =>
			db.write.artwork.update({
				where: { id: parseInt(artworkId) },
				data: { collectionId: parseInt(collectionId!) }
			})
		);
		
		const updatedArtworks = await Promise.all(updatePromises);
		
		return json({ 
			success: true, 
			message: `${updatedArtworks.length} artworks added to collection`,
			artworks: updatedArtworks
		});
	} catch (error) {
		console.error('Error adding artworks to collection:', error);
		return json({ error: 'Failed to add artworks to collection' }, { status: 500 });
	}
};
