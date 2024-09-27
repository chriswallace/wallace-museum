import prisma from '$lib/prisma';

// GET: Fetch Artwork Details
export async function GET({ params }) {
	const { id } = params;
	const artwork = await prisma.artwork.findUnique({
		where: { id: parseInt(id, 10) },
		include: {
			artist: true,
			collection: true
		}
	});

	if (!artwork) {
		return new Response(JSON.stringify({ error: 'Artwork not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return new Response(JSON.stringify(artwork), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

// PUT: Update Artwork Details
export async function PUT({ params, request }) {
	const { id } = params;
	const data = await request.json();

	try {
		const updatedArtwork = await prisma.artwork.update({
			where: { id: parseInt(id, 10) },
			data: {
				enabled: data.enabled,
				title: data.title,
				description: data.description,
				artistId: data.artistId,
				collectionId: data.collectionId
			}
		});

		return new Response(JSON.stringify(updatedArtwork), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Error updating artwork' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// DELETE: Delete Artwork
export async function DELETE({ params }) {
	const { id } = params;

	try {
		await prisma.artwork.delete({
			where: { id: parseInt(id, 10) }
		});

		return new Response(null, { status: 204 });
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Error deleting artwork' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
