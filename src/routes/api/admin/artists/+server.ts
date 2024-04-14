// src/routes/api/collections.js
import prisma from '$lib/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    try {
        const artists = await prisma.artist.findMany({
            select: {
                id: true,
                name: true,
                // Add other fields you need
            }
        });

        return new Response(JSON.stringify(artists), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error in /api/collections:', error.message);
        return new Response(JSON.stringify({ error: 'A server error occurred' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
