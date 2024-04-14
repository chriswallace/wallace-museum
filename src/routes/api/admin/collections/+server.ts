import prisma from '$lib/prisma';
import { getCoverImages } from '$lib/mediaHelpers';

export async function GET({ url }) {
    try {
        const page = parseInt(url.searchParams.get('page') || '1');
        const sortColumn = url.searchParams.get('sort') || 'title'; // Default to sorting by title
        const sortOrder = url.searchParams.get('order') || 'asc';
        const limit = 24;
        const offset = (page - 1) * limit;

        let orderBy = {};
        orderBy[sortColumn] = sortOrder;

        const search = url.searchParams.get('search') || '';
        let whereClause = {};

        if (search) {
            whereClause = {
                title: { contains: search, mode: 'insensitive' },
                // Optionally include other searchable fields
            };
        }

        const totalCollections = await prisma.collection.count({ where: whereClause });
        const collections = await prisma.collection.findMany({
            where: whereClause,
            skip: offset,
            take: limit,
            orderBy: [orderBy],
            include: {
                artworks: {
                    take: 4, // Only take the first four artworks
                    select: { image: true } // Only select the image field
                }
            }
        });

        // Adding coverImages to each collection
        const defaultImage = '/images/medici-image.png'; // Default image URL

        const modifiedCollections = collections.map(collection => ({
            ...collection,
            coverImages: getCoverImages(collection.artworks, defaultImage)
        }));

        return new Response(JSON.stringify({
            collections: modifiedCollections,
            total: totalCollections,
            page,
            totalPages: Math.ceil(totalCollections / limit)
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error in GET request:', error.message);
        return new Response(JSON.stringify({ error: 'An error occurred' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
