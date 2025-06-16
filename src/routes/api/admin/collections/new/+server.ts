import { prismaWrite } from '$lib/prisma';
import slugify from 'slugify';
import { cachedCollectionQueries, cachedSearchQueries } from '$lib/cache/db-cache';

// POST: Create a New Collection
export async function POST({ request }: { request: Request }): Promise<Response> {
	try {
		const { title, description, enabled } = await request.json();

		const newCollection = await prismaWrite.collection.create({
			data: {
				title,
				slug: title.toLowerCase().replace(/\s+/g, '-'),
				description,
				enabled
			}
		});

		// Invalidate collection cache since a new collection was created
		await cachedCollectionQueries.invalidate();

		// Invalidate search cache since collection data has changed
		await cachedSearchQueries.invalidate();

		// Fetch the complete collection data with all relationships for immediate use
		const completeCollection = await prismaWrite.collection.findUnique({
			where: { id: newCollection.id },
			include: {
				Artwork: true,
				Artist: true
			}
		});

		return new Response(JSON.stringify(completeCollection || newCollection), {
			status: 201,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error: any) {
		console.error('Error creating collection:', error);
		return new Response(JSON.stringify({ error: 'Failed to create collection' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
