import prisma from '$lib/prisma';

export async function GET({ url }) {
    try {
        const page = parseInt(url.searchParams.get('page') || '1');
        const sortColumn = url.searchParams.get('sort') || null;
        const sortOrder = url.searchParams.get('order') || null;
        const limit = 25;
        const offset = (page - 1) * limit;

        // Adjusting the orderBy object for relational fields
        let orderBy = [];
        if (sortColumn && sortOrder) {
            if (sortColumn === 'artist') {
                orderBy.push({
                    artist: {
                        name: sortOrder
                    }
                });
            } else if (sortColumn === 'collection') {
                orderBy.push({
                    collection: {
                        title: sortOrder
                    }
                });
            } else {
                orderBy.push({
                    [sortColumn]: sortOrder
                });
            }
        }

        const search = url.searchParams.get('search') || '';
        let whereClause = {};

        if (search) {
            whereClause = {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { artist: { name: { contains: search, mode: 'insensitive' } } },
                    { collection: { title: { contains: search, mode: 'insensitive' } } }
                ]
            };
        }

        const totalArtworks = await prisma.artwork.count({ where: whereClause });
        const artworks = await prisma.artwork.findMany({
            where: whereClause,
            skip: offset,
            take: limit,
            orderBy: orderBy,
            include: {
                artist: true,
                collection: true
            }
        });

        return new Response(JSON.stringify({
            artworks,
            total: totalArtworks,
            page,
            totalPages: Math.ceil(totalArtworks / limit)
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'An error occurred' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
