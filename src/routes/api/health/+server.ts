import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { checkDatabaseConnection, getConnectionPoolMetrics } from '$lib/prisma';

export const GET: RequestHandler = async () => {
	const startTime = Date.now();
	
	try {
		// Check database connection
		const dbConnected = await checkDatabaseConnection();
		
		// Get connection pool metrics
		const poolMetrics = await getConnectionPoolMetrics();
		
		// Calculate response time
		const responseTime = Date.now() - startTime;
		
		// Determine overall health status
		const isHealthy = dbConnected && (!poolMetrics || poolMetrics.utilization < 90);
		const status = isHealthy ? 'healthy' : 'unhealthy';
		
		// Build health response
		const healthResponse = {
			status,
			timestamp: new Date().toISOString(),
			responseTime: `${responseTime}ms`,
			checks: {
				database: {
					status: dbConnected ? 'up' : 'down',
					message: dbConnected ? 'Database connection is active' : 'Database connection failed'
				},
				connectionPool: poolMetrics ? {
					status: poolMetrics.utilization > 90 ? 'warning' : 'healthy',
					active: poolMetrics.active,
					max: poolMetrics.max,
					utilization: `${poolMetrics.utilization}%`
				} : {
					status: 'unknown',
					message: 'Connection pool metrics unavailable'
				}
			},
			environment: {
				nodeVersion: process.version,
				env: process.env.NODE_ENV || 'development'
			}
		};
		
		return json(healthResponse, { 
			status: isHealthy ? 200 : 503,
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Pragma': 'no-cache',
				'Expires': '0'
			}
		});
		
	} catch (error) {
		console.error('[Health Check] Error:', error);
		
		return json({
			status: 'error',
			timestamp: new Date().toISOString(),
			responseTime: `${Date.now() - startTime}ms`,
			error: error instanceof Error ? error.message : 'Unknown error occurred',
			checks: {
				database: {
					status: 'error',
					message: 'Failed to check database connection'
				}
			}
		}, { 
			status: 503,
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Pragma': 'no-cache',
				'Expires': '0'
			}
		});
	}
}; 