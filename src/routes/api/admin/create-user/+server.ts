import bcrypt from 'bcryptjs';
import { prismaWrite } from '$lib/prisma'; // Ensure this path is correct for your Prisma client
import type { RequestHandler } from '@sveltejs/kit';
import { randomUUID } from 'crypto';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse the request body
		const data = await request.json();
		const { email, username, password } = data;

		// Hash the password
		const passwordHash = await bcrypt.hash(password, 10);

		// Generate unique ID and auth token
		const userId = randomUUID();
		const userAuthToken = randomUUID();

		// Create the admin user in the database
		const user = await prismaWrite.user.create({
			data: { 
				id: userId,
				email, 
				username, 
				passwordHash,
				userAuthToken,
				updatedAt: new Date()
			}
		});

		return new Response(JSON.stringify({ message: 'Admin user created' }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		console.error('Error while creating admin user:', error);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return new Response(
			JSON.stringify({ message: 'Error creating admin user', error: errorMessage }),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}
};
