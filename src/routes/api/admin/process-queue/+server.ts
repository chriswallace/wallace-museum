import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { UnifiedIndexer } from '$lib/indexing/unified-indexer';
import { prismaWrite } from '$lib/prisma';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { status = 'pending', limit = 50 } = body;

		const indexer = new UnifiedIndexer(prismaWrite);
		
		// Process the import queue for the specified status
		const results = await indexer.processQueue(status, limit);
		
		// Count successes and failures
		const successful = results.filter(r => r.success).length;
		const failed = results.filter(r => !r.success).length;
		const errors = results
			.filter(r => !r.success && r.errors)
			.flatMap(r => r.errors || []);

		return json({
			success: true,
			processed: results.length,
			successful,
			failed,
			errors: errors.length > 0 ? errors : undefined
		});
	} catch (error) {
		console.error('Failed to process queue:', error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}; 