import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import prisma from '$lib/prisma';

/**
 * API endpoint to manually trigger the indexer
 * This endpoint requires authentication and will redirect to the indexer endpoint
 */
export const GET: RequestHandler = async ({ url, request, cookies, locals }) => {
	try {
		// Check for user authentication
		const cookieHeader = request.headers.get('cookie') || '';
		const sessionCookie = cookieHeader.split(';').find((c) => c.trim().startsWith('session='));
		const sessionId = sessionCookie ? sessionCookie.split('=')[1] : '';

		if (!sessionId) {
			return json(
				{ success: false, error: 'Unauthorized. Please log in to run the indexer.' },
				{ status: 401 }
			);
		}

		const session = await prisma.session.findUnique({
			where: { sessionId },
			include: { user: true }
		});

		// Check if the session is valid and not expired
		if (!session || new Date(session.expiresAt) <= new Date()) {
			return json(
				{ success: false, error: 'Unauthorized. Session expired or invalid.' },
				{ status: 401 }
			);
		}

		// Check if user is admin (based on username for now - you may want to add an isAdmin field to User model)
		// Assuming admin users have specific usernames like 'admin'
		const isAdmin = session.user.username === 'admin';
		if (!isAdmin) {
			return json(
				{ success: false, error: 'Unauthorized. Admin access required.' },
				{ status: 401 }
			);
		}

		// Get force refresh parameter
		const forceRefresh = url.searchParams.get('force') === 'true';

		// Call the indexer endpoint
		const baseUrl = request.url.split('/api/admin/run-indexer')[0];
		const indexerUrl = `${baseUrl}/api/admin/index-wallets${forceRefresh ? '?force=true' : ''}`;

		// Call the indexer endpoint
		const response = await fetch(indexerUrl, {
			headers: {
				cookie: cookieHeader
			}
		});

		const result = await response.json();

		return json(result);
	} catch (error) {
		console.error('Error in run-indexer endpoint:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};
