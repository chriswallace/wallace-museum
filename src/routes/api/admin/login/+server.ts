import bcrypt from 'bcryptjs';
import prisma from '$lib/prisma';
import { handleSession } from '$lib/sessionHandler';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const user = await prisma.adminUser.findUnique({
			where: { username: data.username }
		});

		if (user && (await bcrypt.compare(data.password, user.passwordHash))) {
			const session = await handleSession(request);
			// Set session data here, like session ID or user info

			return new Response(JSON.stringify({ message: 'Logged in successfully' }), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Set-Cookie': `session=${session.id}; Path=/; HttpOnly` // Set the session cookie
				}
			});
		} else {
			return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Login error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
