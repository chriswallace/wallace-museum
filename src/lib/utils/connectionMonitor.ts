import { checkDatabaseConnection, getConnectionPoolMetrics } from '$lib/prisma';

interface ConnectionEvent {
	timestamp: string;
	type: 'connection_check' | 'pool_warning' | 'pool_critical' | 'connection_error' | 'pool_recovery';
	message: string;
	metrics?: {
		active: number;
		max: number;
		utilization: number;
	};
}

class ConnectionMonitor {
	private events: ConnectionEvent[] = [];
	private maxEvents = 100;
	private lastCriticalAlert = 0;
	private alertCooldown = 60000; // 1 minute cooldown between critical alerts
	private monitoringInterval?: NodeJS.Timeout;

	constructor() {
		// Start monitoring in development
		if (process.env.NODE_ENV === 'development') {
			this.startMonitoring();
		}
	}

	private addEvent(type: ConnectionEvent['type'], message: string, metrics?: any) {
		const event: ConnectionEvent = {
			timestamp: new Date().toISOString(),
			type,
			message,
			metrics
		};

		this.events.unshift(event);
		
		// Keep only the most recent events
		if (this.events.length > this.maxEvents) {
			this.events = this.events.slice(0, this.maxEvents);
		}

		// Log based on severity
		if (type === 'pool_critical' || type === 'connection_error') {
			console.error(`[ConnectionMonitor] ${message}`, metrics);
		} else if (type === 'pool_warning') {
			console.warn(`[ConnectionMonitor] ${message}`, metrics);
		} else if (type === 'pool_recovery') {
			console.log(`[ConnectionMonitor] ${message}`, metrics);
		}
	}

	async checkConnectionHealth(): Promise<{
		isHealthy: boolean;
		metrics?: any;
		recommendations: string[];
	}> {
		const recommendations: string[] = [];
		let isHealthy = true;

		try {
			// Check basic connectivity
			const isConnected = await checkDatabaseConnection();
			if (!isConnected) {
				isHealthy = false;
				recommendations.push('Database connection is down - check network connectivity and database server status');
				this.addEvent('connection_error', 'Database connection failed');
				return { isHealthy, recommendations };
			}

			// Check connection pool metrics
			const metrics = await getConnectionPoolMetrics();
			if (metrics) {
				const now = Date.now();
				
				if (metrics.utilization > 90) {
					isHealthy = false;
					recommendations.push('CRITICAL: Connection pool utilization > 90% - immediate action required');
					recommendations.push('Consider restarting the application or scaling the database');
					
					// Rate-limited critical alerts
					if (now - this.lastCriticalAlert > this.alertCooldown) {
						this.addEvent('pool_critical', `Critical pool utilization: ${metrics.utilization}%`, metrics);
						this.lastCriticalAlert = now;
					}
				} else if (metrics.utilization > 75) {
					recommendations.push('WARNING: High connection pool utilization - monitor closely');
					recommendations.push('Consider optimizing long-running queries or reducing batch sizes');
					this.addEvent('pool_warning', `High pool utilization: ${metrics.utilization}%`, metrics);
				} else if (metrics.utilization < 50 && this.events.some(e => e.type === 'pool_critical' || e.type === 'pool_warning')) {
					// Pool has recovered
					this.addEvent('pool_recovery', `Pool utilization normalized: ${metrics.utilization}%`, metrics);
				}

				// Additional recommendations based on utilization patterns
				if (metrics.utilization > 60) {
					recommendations.push('Recommendations:');
					recommendations.push('- Reduce batch sizes in long-running operations');
					recommendations.push('- Add delays between database operations');
					recommendations.push('- Check for connection leaks in API endpoints');
					recommendations.push('- Consider increasing connection_limit if database can handle it');
				}

				return { isHealthy, metrics, recommendations };
			}

			return { isHealthy: true, recommendations: ['Connection pool metrics unavailable'] };
		} catch (error) {
			isHealthy = false;
			recommendations.push(`Error checking connection health: ${error instanceof Error ? error.message : 'Unknown error'}`);
			this.addEvent('connection_error', `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return { isHealthy, recommendations };
		}
	}

	startMonitoring(intervalMs = 30000): void {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
		}

		this.monitoringInterval = setInterval(async () => {
			await this.checkConnectionHealth();
		}, intervalMs);

		console.log('[ConnectionMonitor] Started monitoring connection pool health');
	}

	stopMonitoring(): void {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = undefined;
			console.log('[ConnectionMonitor] Stopped monitoring connection pool health');
		}
	}

	getRecentEvents(limit = 20): ConnectionEvent[] {
		return this.events.slice(0, limit);
	}

	getHealthSummary() {
		const recentEvents = this.events.slice(0, 10);
		const criticalCount = recentEvents.filter(e => e.type === 'pool_critical').length;
		const warningCount = recentEvents.filter(e => e.type === 'pool_warning').length;
		const errorCount = recentEvents.filter(e => e.type === 'connection_error').length;

		return {
			recentCritical: criticalCount,
			recentWarnings: warningCount,
			recentErrors: errorCount,
			lastEvent: this.events[0] || null,
			totalEvents: this.events.length
		};
	}

	// Cleanup method for graceful shutdown
	cleanup(): void {
		this.stopMonitoring();
		this.events = [];
	}
}

// Export singleton instance
export const connectionMonitor = new ConnectionMonitor();

// Cleanup on process exit
process.on('beforeExit', () => {
	connectionMonitor.cleanup();
});

export default connectionMonitor;

// Export utility functions
export async function performConnectionHealthCheck() {
	return await connectionMonitor.checkConnectionHealth();
}

export function getConnectionEvents(limit?: number) {
	return connectionMonitor.getRecentEvents(limit);
}

export function getConnectionHealthSummary() {
	return connectionMonitor.getHealthSummary();
} 