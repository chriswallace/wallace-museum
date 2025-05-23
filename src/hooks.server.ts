import type { Handle } from '@sveltejs/kit';
import { initCronJobs } from '$lib/server/cron';

// Initialize cron jobs when the server starts
if (process.env.NODE_ENV === 'production') {
	initCronJobs();
}

export const handle: Handle = async ({ event, resolve }) => {
	// Process the request
	const response = await resolve(event);
	return response;
};
