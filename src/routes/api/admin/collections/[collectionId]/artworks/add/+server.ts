import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/prisma';
import { cachedArtworkQueries, cachedCollectionQueries } from '$lib/cache/db-cache';

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

		// Get artwork UIDs for cache invalidation
		const artworks = await db.read.artwork.findMany({
			where: { id: { in: artworkIds.map(id => parseInt(id)) } },
			select: { id: true, uid: true }
		});
		
		// Update artworks to add them to the collection
		const updatePromises = artworkIds.map(artworkId =>
			db.write.artwork.update({
				where: { id: parseInt(artworkId) },
				data: { collectionId: parseInt(collectionId!) }
			})
		);
		
		const updatedArtworks = await Promise.all(updatePromises);

		// Invalidate artwork cache for all affected artworks since their collection relationship changed
		for (const artwork of artworks) {
			await cachedArtworkQueries.invalidate(artwork.id, artwork.uid || undefined);
		}

		// Invalidate collection cache since its artwork list changed
		await cachedCollectionQueries.invalidate(parseInt(collectionId!), collection.slug);
		
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
