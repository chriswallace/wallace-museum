import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cache } from '$lib/cache/redis.js';
import { invalidateCache } from '$lib/cache/db-cache.js';

export const GET: RequestHandler = async () => {
	try {
		const stats = await cache.stats();
		
		return json({
			cache: stats,
			timestamp: new Date().toISOString()
		});
	} catch (error: any) {
		console.error('Cache status check failed:', error);
		return json({
			error: error.message,
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const pattern = url.searchParams.get('pattern');
		
		if (pattern) {
			// Clear specific pattern
			const deletedCount = await cache.delPattern(pattern);
			return json({
				message: `Cleared ${deletedCount} cache entries matching pattern: ${pattern}`,
				deletedCount,
				pattern,
				timestamp: new Date().toISOString()
			});
		} else {
			// Clear all cache for this app
			const deletedCount = await cache.clear();
			return json({
				message: `Cleared all cache entries (${deletedCount})`,
				deletedCount,
				timestamp: new Date().toISOString()
			});
		}
	} catch (error: any) {
		console.error('Cache clear failed:', error);
		return json({
			error: error.message,
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { action, patterns } = body;
		
		if (action === 'invalidate' && patterns) {
			await invalidateCache(patterns);
			return json({
				message: `Invalidated cache patterns: ${patterns.join(', ')}`,
				patterns,
				timestamp: new Date().toISOString()
			});
		}
		
		return json({
			error: 'Invalid action or missing parameters',
			timestamp: new Date().toISOString()
		}, { status: 400 });
	} catch (error: any) {
		console.error('Cache operation failed:', error);
		return json({
			error: error.message,
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
}; 