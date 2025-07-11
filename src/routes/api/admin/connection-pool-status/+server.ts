import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { checkDatabaseConnection, getConnectionPoolMetrics, prismaRead } from '$lib/prisma';
import { performConnectionHealthCheck, getConnectionEvents, getConnectionHealthSummary } from '$lib/utils/connectionMonitor';

export const GET: RequestHandler = async () => {
	try {
		// Perform comprehensive health check
		const healthCheck = await performConnectionHealthCheck();
		
		// Get basic database info using the read client
		let dbInfo = null;
		try {
			// Quick count queries to test basic functionality
			const [artistCount, artworkCount] = await Promise.all([
				prismaRead.artist.count(),
				prismaRead.artwork.count()
			]);
			
			dbInfo = {
				artists: artistCount,
				artworks: artworkCount
			};
			
			// No need to disconnect - we're using the singleton
		} catch (error: any) {
			dbInfo = { error: error.message };
		}

		// Get recent connection events
		const recentEvents = getConnectionEvents(10);
		const healthSummary = getConnectionHealthSummary();
		
		return json({
			connected: healthCheck.isHealthy,
			poolMetrics: healthCheck.metrics,
			dbInfo,
			healthCheck: {
				isHealthy: healthCheck.isHealthy,
				recommendations: healthCheck.recommendations
			},
			monitoring: {
				recentEvents,
				summary: healthSummary
			},
			timestamp: new Date().toISOString()
		});
	} catch (error: any) {
		console.error('Connection pool status check failed:', error);
		return json({
			connected: false,
			error: error.message,
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
}; 