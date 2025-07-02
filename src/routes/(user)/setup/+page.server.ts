import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import bcrypt from 'bcryptjs';
import { db } from '$lib/prisma';
import crypto from 'crypto';

export const actions: Actions = {
	register: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username') as string;
		const email = data.get('email') as string;
		const password = data.get('password') as string;

		if (!username || !email || !password) {
			return { error: 'All fields are required' };
		}

		try {
			// Check if user already exists
			const existingUser = await db.read.user.findFirst({
				where: {
					OR: [{ username }, { email }]
				}
			});

			if (existingUser) {
				return { error: 'Username or email already exists' };
			}

			// Hash password
			const passwordHash = await bcrypt.hash(password, 12);
			const userAuthToken = crypto.randomUUID();
			const userId = crypto.randomUUID();

			// Create user
			const newUser = await db.write.user.create({
				data: {
					id: userId,
					username,
					email,
					passwordHash,
					userAuthToken,
					updatedAt: new Date()
				}
			});

			// Create session
			const sessionId = crypto.randomUUID();
			const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

			await db.write.session.create({
				data: {
					sessionId,
					userId: newUser.id,
					expiresAt
				}
			});

			// Set session cookie
			cookies.set('session', sessionId, {
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'strict',
				expires: expiresAt
			});
		} catch (error) {
			console.error('Setup error:', error);
			return { error: 'Failed to create user account' };
		}

		// Redirect after successful user creation (outside try/catch)
		throw redirect(302, '/admin');
	}
};
