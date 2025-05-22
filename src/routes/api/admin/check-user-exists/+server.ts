import prisma from '$lib/prisma'; // Ensure this is the correct path to your Prisma client
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	try {
		const adminCount = await prisma.adminUser.count();
		if (adminCount === 0) {
			return new Response(JSON.stringify({ exists: false }), {
				status: 200,
				headers: {
					'Content-Type': 'application/json'
				}
			});
		} else {
			return new Response(JSON.stringify({ exists: true }), {
				status: 200,
				headers: {
					'Content-Type': 'application/json'
				}
			});
		}
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Error checking admin user' }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
};
