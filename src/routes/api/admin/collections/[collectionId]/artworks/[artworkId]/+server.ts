import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/prisma';
import { cachedArtworkQueries, cachedCollectionQueries } from '$lib/cache/db-cache';

// POST: Remove Artwork from a Collection
export const DELETE: RequestHandler = async ({ params }) => {
	const { collectionId, artworkId } = params;
	
	try {
		// Get the artwork first to retrieve its UID for cache invalidation
		const artwork = await db.read.artwork.findUnique({
			where: { id: parseInt(artworkId!) },
			select: { id: true, uid: true }
		});

		if (!artwork) {
			return json({ error: 'Artwork not found' }, { status: 404 });
		}

		// Remove artwork from collection
		const artworkUpdated = await db.write.artwork.update({
			where: { id: parseInt(artworkId!) },
			data: { collectionId: null }
		});

		// Invalidate artwork cache since its collection relationship changed
		await cachedArtworkQueries.invalidate(parseInt(artworkId!), artwork.uid || undefined);

		// Invalidate collection cache since its artwork list changed
		await cachedCollectionQueries.invalidate(parseInt(collectionId!));
		
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
