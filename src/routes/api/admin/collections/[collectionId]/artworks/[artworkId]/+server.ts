import prisma from '$lib/prisma';

// POST: Remove Artwork from a Collection
export async function DELETE({ params }) {
	const { collectionId, artworkId } = params;

	try {
		// Set collectionId to null for the specified artwork to remove it from the collection
		const artworkUpdated = await prisma.artwork.update({
			where: { id: parseInt(artworkId, 10) },
			data: {
				collectionId: null
			}
		});

		if (artworkUpdated) {
			console.log(artworkUpdated);
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	} catch (error) {
		console.error('Error removing artwork from collection:', error);
		return new Response(JSON.stringify({ error: 'Error removing artwork from collection' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
