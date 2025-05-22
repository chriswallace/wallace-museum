// src/routes/api/collections.js
import prisma from '$lib/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const collections = await prisma.collection.findMany({
			select: {
				id: true,
				title: true,
				slug: true
				// Add other fields you need
			},
			where: {
				enabled: true
			},
			orderBy: {
				title: 'asc' // Sorts by title in ascending order
			}
		});

		return new Response(JSON.stringify(collections), {
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
};
