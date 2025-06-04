import { prismaWrite } from '$lib/prisma';
import slugify from 'slugify';

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

		return new Response(JSON.stringify(newCollection), {
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
