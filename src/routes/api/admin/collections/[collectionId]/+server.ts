import prisma from '$lib/prisma';

// GET: Fetch Collection Details
export async function GET({ params }) {
	const { collectionId } = params;
	const collection = await prisma.collection.findUnique({
		where: { id: parseInt(collectionId, 10) },
		include: {
			artworks: true
		}
	});

	if (!collection) {
		return new Response(JSON.stringify({ error: 'Collection not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return new Response(JSON.stringify(collection), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

// PUT: Update Collection Details
export async function PUT({ params, request }) {
	const { collectionId } = params;
	const data = await request.json();

	try {
		const updatedCollection = await prisma.collection.update({
			where: { id: parseInt(collectionId, 10) },
			data: {
				title: data.title,
				description: data.description,
				curatorNotes: data.curatorNotes,
				slug: data.slug,
				enabled: data.enabled
			}
		});

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
		await prisma.collection.delete({
			where: { id: parseInt(collectionId, 10) }
		});

		return new Response(null, { status: 204 });
	} catch (error) {
		console.error(error);
		return new Response(JSON.stringify({ error: 'Error deleting collection' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
