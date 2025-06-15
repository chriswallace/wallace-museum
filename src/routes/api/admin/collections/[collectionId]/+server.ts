import { prismaRead, prismaWrite } from '$lib/prisma';
import { cachedCollectionQueries, cachedArtworkQueries, cachedSearchQueries } from '$lib/cache/db-cache';

// GET: Fetch Collection Details
export async function GET({ params }) {
	const { collectionId } = params;
	const collection = await prismaRead.collection.findUnique({
		where: { id: parseInt(collectionId, 10) },
		include: {
			Artwork: true,
			Artist: true
		}
	});

	if (!collection) {
		return new Response(JSON.stringify({ error: 'Collection not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Transform the response to match frontend expectations
	const transformedCollection = {
		...collection,
		artworks: collection.Artwork,
		artists: collection.Artist,
		// Remove the original capitalized properties
		Artwork: undefined,
		Artist: undefined
	};

	return new Response(JSON.stringify(transformedCollection), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

// PUT: Update Collection Details
export async function PUT({ params, request }) {
	const { collectionId } = params;
	const data = await request.json();

	try {
		const updateData: any = {
			title: data.title,
			description: data.description,
			curatorNotes: data.curatorNotes,
			slug: data.slug,
			enabled: data.enabled
		};
		if (data.artistIds && Array.isArray(data.artistIds)) {
			updateData.artists = { set: data.artistIds.map((id: number) => ({ id })) };
		}
		const updatedCollection = await prismaWrite.collection.update({
			where: { id: parseInt(collectionId, 10) },
			data: updateData
		});

		// Invalidate collection-related cache after update
		await cachedCollectionQueries.invalidate(parseInt(collectionId, 10), updatedCollection.slug);

		return new Response(JSON.stringify(updatedCollection), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Error updating collection' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

export async function DELETE({ params }) {
	const { collectionId } = params;

	try {
		// First, get the collection to retrieve its slug and related data for cache invalidation
		const collection = await prismaRead.collection.findUnique({
			where: { id: parseInt(collectionId, 10) },
			select: {
				id: true,
				slug: true,
				Artwork: {
					select: { id: true, uid: true }
				}
			}
		});

		if (!collection) {
			return new Response(JSON.stringify({ error: 'Collection not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Delete the collection
		await prismaWrite.collection.delete({
			where: { id: parseInt(collectionId, 10) }
		});

		// Invalidate collection-related cache
		await cachedCollectionQueries.invalidate(parseInt(collectionId, 10), collection.slug);

		// Invalidate artwork cache for all artworks that were in this collection
		// since their collection relationship has changed
		for (const artwork of collection.Artwork) {
			await cachedArtworkQueries.invalidate(artwork.id, artwork.uid || undefined);
		}

		// Invalidate search cache since collection data has changed
		await cachedSearchQueries.invalidate();

		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Error deleting collection:', error);
		return new Response(JSON.stringify({ error: 'Error deleting collection' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
