import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import prisma, { checkDatabaseConnection, getConnectionPoolMetrics } from '$lib/prisma';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		// Check if user is authenticated (optional - remove if you want public access)
		// Note: Remove this check if you want public access to metrics
		// if (!locals.user) {
		// 	return json({ error: 'Unauthorized' }, { status: 401 });
		// }

		// Check database connection health
		const isConnected = await checkDatabaseConnection();
		
		if (!isConnected) {
			return json({
				error: 'Database connection failed',
				timestamp: new Date().toISOString(),
				connectionPool: {
					status: 'disconnected',
					message: 'Unable to connect to database'
				}
			}, { status: 503 });
		}

		// Get connection pool metrics
		const poolMetrics = await getConnectionPoolMetrics();
		
		if (!poolMetrics) {
			// Fallback: Check if Prisma metrics are available
			if (!('$metrics' in prisma)) {
				return json({
					error: 'Metrics not available',
					message: 'Prisma metrics feature is not enabled. Add "metrics" to previewFeatures in your schema.',
					timestamp: new Date().toISOString(),
					connectionPool: {
						status: 'unknown',
						message: 'Enable Prisma metrics to monitor connection pool'
					}
				});
			}

			// Try to get Prisma metrics
			const metrics = await (prisma as any).$metrics.json();
			
			// Extract connection pool specific metrics with proper type handling
			const connectionMetrics = {
				open: metrics.gauges?.find((g: any) => g.key === 'prisma_pool_connections_open')?.value || 0,
				busy: metrics.gauges?.find((g: any) => g.key === 'prisma_pool_connections_busy')?.value || 0,
				idle: metrics.gauges?.find((g: any) => g.key === 'prisma_pool_connections_idle')?.value || 0,
				opened_total: metrics.gauges?.find((g: any) => g.key === 'prisma_pool_connections_opened_total')?.value || 0,
			};

			// Calculate utilization percentage
			const utilization = connectionMetrics.open > 0 
				? Math.round((connectionMetrics.busy / connectionMetrics.open) * 100) 
				: 0;

			// Get query metrics
			const queryMetrics = {
				total: metrics.counters?.find((c: any) => c.key === 'prisma_client_queries_total')?.value || 0,
				duration_histogram: metrics.histograms?.find((h: any) => h.key === 'prisma_client_queries_duration_histogram')?.buckets || [],
			};

			// Determine health status
			const status = utilization > 80 
				? 'warning' 
				: utilization > 95 
					? 'critical' 
					: 'healthy';

			const message = utilization > 80 
				? 'Connection pool utilization is very high - consider increasing connection_limit'
				: 'Connection pool is operating normally';

			return json({
				timestamp: new Date().toISOString(),
				connectionPool: {
					status,
					message,
					metrics: {
						connections: connectionMetrics,
						utilization: `${utilization}%`
					}
				},
				queries: queryMetrics,
				// Include raw metrics for debugging
				_raw: process.env.NODE_ENV === 'development' ? metrics : undefined
			});
		}

		// Use the pool metrics from our helper function
		const status = poolMetrics.utilization > 80 
			? 'warning' 
			: poolMetrics.utilization > 95 
				? 'critical' 
				: 'healthy';

		const message = poolMetrics.utilization > 80 
			? 'Connection pool utilization is very high - consider increasing connection_limit'
			: 'Connection pool is operating normally';

		return json({
			timestamp: new Date().toISOString(),
			connectionPool: {
				status,
				message,
				metrics: {
					active: poolMetrics.active,
					max: poolMetrics.max,
					utilization: `${poolMetrics.utilization}%`
				}
			},
			health: {
				database: isConnected ? 'connected' : 'disconnected'
			}
		});

	} catch (error) {
		console.error('Failed to get connection pool status:', error);
		return json({
			error: 'Failed to retrieve connection pool status',
			message: error instanceof Error ? error.message : 'Unknown error',
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
}; 