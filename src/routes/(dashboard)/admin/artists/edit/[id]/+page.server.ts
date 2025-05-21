// src/routes/(dashboard)/+layout.server.ts
import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';
import { redirect, error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ request, locals, params }) => {
	const cookies = request.headers.get('cookie') || '';
	const sessionCookie = cookies.split(';').find((c) => c.trim().startsWith('session='));
	const sessionId = sessionCookie ? sessionCookie.split('=')[1] : '';

	let user = null;
	if (sessionId) {
		const session = await prisma.session.findUnique({
			where: { sessionId },
			include: { user: true }
		});

		// Check if the session is valid and not expired
		if (session && new Date(session.expiresAt) > new Date()) {
			user = session.user;
		}
	}

	if (!user) {
		throw redirect(302, '/login');
	}

	const artistId = parseInt(params.id, 10);

	const artist = await prisma.artist.findUnique({
		where: { id: artistId },
		include: {
			addresses: true,
			ArtistArtworks: {
				include: {
					artwork: {
						select: {
							id: true,
							title: true,
							image_url: true,
							enabled: true
						}
					}
				}
			}
		}
	});

	if (!artist) {
		throw error(404, 'Artist not found');
	}

	// Set user in locals for use in layout and child pages
	locals.user = user;

	return { artist };
};
