import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { checkDatabaseConnection, getConnectionPoolMetrics } from '$lib/prisma';
import { cache } from '$lib/cache/redis.js';

export const GET: RequestHandler = async () => {
	const startTime = Date.now();
	
	try {
		// Check database connection and cache status in parallel
		const [dbConnected, poolMetrics, cacheStats] = await Promise.all([
			checkDatabaseConnection(),
			getConnectionPoolMetrics(),
			cache.stats()
		]);
		
		// Calculate response time
		const responseTime = Date.now() - startTime;
		
		// Determine overall health status
		const isDbHealthy = dbConnected && (!poolMetrics || poolMetrics.utilization < 90);
		const isCacheHealthy = !cacheStats.enabled || cacheStats.connected; // Cache is healthy if disabled or connected
		const isHealthy = isDbHealthy && isCacheHealthy;
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
				},
				cache: {
					status: cacheStats.enabled ? (cacheStats.connected ? 'up' : 'down') : 'disabled',
					enabled: cacheStats.enabled,
					connected: cacheStats.connected,
					keyCount: cacheStats.keyCount,
					prefix: cacheStats.prefix,
					memoryUsage: cacheStats.memoryUsage || 'unknown'
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
		
	} catch (error: any) {
		console.error('Health check failed:', error);
		
		const responseTime = Date.now() - startTime;
		
		return json({
			status: 'unhealthy',
			timestamp: new Date().toISOString(),
			responseTime: `${responseTime}ms`,
			error: error.message || 'Health check failed',
			checks: {
				database: { status: 'unknown', message: 'Health check failed' },
				connectionPool: { status: 'unknown', message: 'Health check failed' },
				cache: { status: 'unknown', message: 'Health check failed' }
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