import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { UnifiedIndexer } from '$lib/indexing/unified-indexer';
import prisma from '$lib/prisma';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { status = 'pending', limit = 50 } = body;

		const indexer = new UnifiedIndexer(prisma);
		
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
		console.error('Failed to run indexer:', error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const status = url.searchParams.get('status') || undefined;
		
		// Get queue statistics
		const pendingCount = await prisma.artworkIndex.count({
			where: { importStatus: 'pending' }
		});
		
		const normalizedCount = await prisma.artworkIndex.count({
			where: { importStatus: 'normalized' }
		});
		
		const referencedCount = await prisma.artworkIndex.count({
			where: { importStatus: 'referenced' }
		});
		
		const importedCount = await prisma.artworkIndex.count({
			where: { importStatus: 'imported' }
		});
		
		const failedCount = await prisma.artworkIndex.count({
			where: { importStatus: 'failed' }
		});
		
		const totalCount = await prisma.artworkIndex.count();
		
		// Get recent errors if requested
		let recentErrors: Array<{
			id: number;
			nftUid: string;
			errorMessage: string | null;
			lastAttempt: Date;
		}> = [];
		if (status === 'failed' || !status) {
			const failedRecords = await prisma.artworkIndex.findMany({
				where: { 
					importStatus: 'failed',
					errorMessage: { not: null }
				},
				select: {
					id: true,
					nftUid: true,
					errorMessage: true,
					lastAttempt: true
				},
				orderBy: { lastAttempt: 'desc' },
				take: 10
			});
			recentErrors = failedRecords;
		}

		return json({
			success: true,
			stats: {
				total: totalCount,
				pending: pendingCount,
				normalized: normalizedCount,
				referenced: referencedCount,
				imported: importedCount,
				failed: failedCount
			},
			recentErrors
		});
	} catch (error) {
		console.error('Failed to get indexer stats:', error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}; 