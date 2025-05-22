import { fail, redirect } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import crypto from 'crypto'; // Ensure you import the crypto module
import type { Action, Actions } from './$types';
import prisma from '$lib/prisma';

const login: Action = async ({ cookies, request }) => {
	const data = await request.formData();
	const username = data.get('username');
	const password = data.get('password');

	if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
		return fail(400, { invalid: true });
	}

	const user = await prisma.user.findUnique({ where: { username } });

	if (!user) {
		return fail(400, { credentials: true });
	}

	const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

	if (!isPasswordValid) {
		return fail(400, { credentials: true });
	}

	// Create a new session record in the database
	const newSession = await prisma.session.create({
		data: {
			userId: user.id,
			sessionId: crypto.randomUUID(),
			createdAt: new Date(),
			expiresAt: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000) // Expires in 30 days
		}
	});

	// Set the session ID as a cookie
	cookies.set('session', newSession.sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 30 // 30 days
	});

	// Redirect the user
	throw redirect(302, '/admin');
};

export const actions: Actions = { login };
