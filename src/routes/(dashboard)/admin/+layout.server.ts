// src/routes/(dashboard)/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/prisma'; // Use read/write clients
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ request, locals }) => {
	const cookies = request.headers.get('cookie') || '';
	const sessionCookie = cookies.split(';').find((c) => c.trim().startsWith('session='));
	const sessionId = sessionCookie ? sessionCookie.split('=')[1] : '';

	let user = null;
	if (sessionId) {
		try {
			// Use read client for better performance and add expiration filter at DB level
			const session = await db.read.session.findFirst({
				where: { 
					sessionId,
					expiresAt: {
						gt: new Date() // Only fetch non-expired sessions
					}
				},
				include: { User: true }
			});

			if (session) {
				user = session.User;
			}
		} catch (error) {
			console.error('Session lookup failed:', error);
			// Don't crash the app on session lookup failures
		}
	}

	if (!user) {
		throw redirect(302, '/login');
	}

	// Set user in locals for use in layout and child pages
	locals.user = user;
};
