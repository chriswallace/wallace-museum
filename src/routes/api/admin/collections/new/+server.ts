import prisma from '$lib/prisma';
import slugify from 'slugify';

// POST: Create a New Collection
export async function POST({ request }: { request: Request }): Promise<Response> {
	const data = await request.json();

	try {
		const newCollection = await prisma.collection.create({
			data: {
				title: data.title,
				description: data.description,
				curatorNotes: data.curatorNotes,
				slug: slugify(data.title, { lower: true, strict: true }),
				enabled: data.enabled,
				artists:
					data.artistIds && Array.isArray(data.artistIds) && data.artistIds.length > 0
						? { connect: data.artistIds.map((id: number) => ({ id })) }
						: undefined
			}
		});

		return new Response(JSON.stringify(newCollection), {
			status: 201, // HTTP 201 Created
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error: any) {
		console.error(error);
		return new Response(JSON.stringify({ error: 'Error creating new collection' }), {
			status: 500, // HTTP 500 Internal Server Error
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
