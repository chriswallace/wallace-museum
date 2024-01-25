import prisma from '$lib/prisma';

export async function GET({ url }) {
    try {
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = 25;
        const offset = (page - 1) * limit;

        const totalArtworks = await prisma.artwork.count();
        const artworks = await prisma.artwork.findMany({
            skip: offset,
            take: limit,
            include: {
                artist: true, // Include artist details
                collection: true // Include collection details
            }
        });

        return new Response(JSON.stringify({
            artworks,
            total: totalArtworks,
            page,
            totalPages: Math.ceil(totalArtworks / limit)
        }), {
            status: 200, // HTTP OK
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'An error occurred' }), {
            status: 500, // HTTP Internal Server Error
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
