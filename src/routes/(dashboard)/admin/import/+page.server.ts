// src/routes/(dashboard)/+layout.server.ts
import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ request, locals }) => {
	const cookies = request.headers.get('cookie') || '';
	const sessionCookie = cookies.split(';').find((c) => c.trim().startsWith('session='));
	const sessionId = sessionCookie ? sessionCookie.split('=')[1] : '';

	let user = null;
	if (sessionId) {
		const session = await prisma.session.findUnique({
			where: { sessionId },
			include: { user: true }
		});

		if (session && new Date(session.expiresAt) > new Date()) {
			user = session.user;
		}
	}

	if (!user) {
		throw redirect(302, '/login');
	}

	// Set user in locals for use in layout and child pages
	locals.user = user;
};
