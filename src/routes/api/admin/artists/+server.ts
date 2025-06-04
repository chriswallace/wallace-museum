// src/routes/api/collections.js
import { prismaRead } from '$lib/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const artists = await prismaRead.artist.findMany({
			select: {
				avatarUrl: true,
				id: true,
				name: true
				// Add other fields you need
			},
			orderBy: {
				name: 'asc'
			}
		});

		return new Response(JSON.stringify(artists), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error: any) {
		console.error('Error in /api/artists:', error.message);
		return new Response(JSON.stringify({ error: 'A server error occurred' }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
};
