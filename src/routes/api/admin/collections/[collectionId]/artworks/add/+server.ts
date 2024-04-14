import prisma from '$lib/prisma';

// POST: Add Multiple Artworks to a Collection
export async function POST({ request }) {
    try {
        // Parse the incoming request to get the JSON body
        const body = await request.json();
        const { collectionId, artworkIds } = body;

        // Validate input
        if (!collectionId || !artworkIds || !Array.isArray(artworkIds) || artworkIds.length === 0) {

            return new Response(JSON.stringify({ error: 'Missing collection ID or artwork IDs, or artwork IDs is not an array' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Update the specified artworks to set the collectionId to add them to the collection
        const promises = artworkIds.map(artworkId =>
            prisma.artwork.update({
                where: { id: parseInt(artworkId, 10) },
                data: {
                    collectionId: parseInt(collectionId, 10) // Assuming collectionId is also an integer
                }
            })
        );

        // Wait for all the updates to complete
        const artworksUpdated = await Promise.all(promises);

        // Respond with success if the artworks were updated successfully
        return new Response(JSON.stringify({ success: true, updatedArtworks: artworksUpdated }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        // Log and respond with error if something goes wrong
        console.error('Error adding artworks to collection:', error);
        return new Response(JSON.stringify({ error: 'Error adding artworks to collection' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
