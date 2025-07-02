import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import bcrypt from 'bcryptjs';
import { db } from '$lib/prisma';
import crypto from 'crypto';

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username') as string;
		const password = data.get('password') as string;

		if (!username || !password) {
			return { error: 'Username and password are required' };
		}

		try {
			// Find user by username
			const user = await db.read.user.findUnique({
				where: { username }
			});

			if (!user) {
				return { error: 'Invalid username or password' };
			}

			// Verify password
			const isValidPassword = await bcrypt.compare(password, user.passwordHash);
			if (!isValidPassword) {
				return { error: 'Invalid username or password' };
			}

			// Create session
			const sessionId = crypto.randomUUID();
			const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

			const newSession = await db.write.session.create({
				data: {
					sessionId,
					userId: user.id,
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
			console.error('Login error:', error);
			return { error: 'Login failed' };
		}

		// Redirect after successful login (outside try/catch)
		throw redirect(302, '/admin');
	}
};
