import { checkDatabaseConnection, getConnectionPoolMetrics } from '$lib/prisma';

interface ConnectionEvent {
	timestamp: string;
	type: 'connection_check' | 'pool_warning' | 'pool_critical' | 'connection_error';
	message: string;
	metrics?: {
		active: number;
		max: number;
		utilization: number;
	};
}

class ConnectionMonitor {
	private events: ConnectionEvent[] = [];
	private maxEvents = 100; // Keep last 100 events
	private monitoringInterval?: NodeJS.Timeout;

	constructor() {
		// Start monitoring in development
		if (process.env.NODE_ENV === 'development') {
			this.startMonitoring();
		}
	}

	private addEvent(event: Omit<ConnectionEvent, 'timestamp'>) {
		const fullEvent: ConnectionEvent = {
			...event,
			timestamp: new Date().toISOString()
		};

		this.events.push(fullEvent);
		
		// Keep only the last maxEvents
		if (this.events.length > this.maxEvents) {
			this.events = this.events.slice(-this.maxEvents);
		}

		// Log critical events
		if (event.type === 'pool_critical' || event.type === 'connection_error') {
			console.error(`[ConnectionMonitor] ${event.type}: ${event.message}`, event.metrics);
		} else if (event.type === 'pool_warning') {
			console.warn(`[ConnectionMonitor] ${event.type}: ${event.message}`, event.metrics);
		}
	}

	async checkConnection(): Promise<boolean> {
		try {
			const isConnected = await checkDatabaseConnection();
			
			if (isConnected) {
				this.addEvent({
					type: 'connection_check',
					message: 'Database connection successful'
				});
			} else {
				this.addEvent({
					type: 'connection_error',
					message: 'Database connection failed'
				});
			}
			
			return isConnected;
		} catch (error) {
			this.addEvent({
				type: 'connection_error',
				message: `Database connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
			return false;
		}
	}

	async checkPoolHealth(): Promise<void> {
		try {
			const metrics = await getConnectionPoolMetrics();
			
			if (!metrics) {
				this.addEvent({
					type: 'connection_error',
					message: 'Unable to retrieve connection pool metrics'
				});
				return;
			}

			const { active, max, utilization } = metrics;

			if (utilization > 90) {
				this.addEvent({
					type: 'pool_critical',
					message: `Critical connection pool utilization: ${utilization}%`,
					metrics: { active, max, utilization }
				});
			} else if (utilization > 70) {
				this.addEvent({
					type: 'pool_warning',
					message: `High connection pool utilization: ${utilization}%`,
					metrics: { active, max, utilization }
				});
			}
		} catch (error) {
			this.addEvent({
				type: 'connection_error',
				message: `Error checking pool health: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	}

	startMonitoring(intervalMs = 30000): void {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
		}

		this.monitoringInterval = setInterval(async () => {
			await this.checkPoolHealth();
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
		return this.events.slice(-limit);
	}

	getEventsByType(type: ConnectionEvent['type'], limit = 10): ConnectionEvent[] {
		return this.events
			.filter(event => event.type === type)
			.slice(-limit);
	}

	getHealthSummary(): {
		totalEvents: number;
		recentErrors: number;
		recentWarnings: number;
		lastConnectionCheck?: string;
		recommendations: string[];
	} {
		const recentEvents = this.getRecentEvents(10);
		const recentErrors = recentEvents.filter(e => e.type === 'connection_error').length;
		const recentWarnings = recentEvents.filter(e => e.type === 'pool_warning' || e.type === 'pool_critical').length;
		
		const lastConnectionCheck = recentEvents
			.filter(e => e.type === 'connection_check')
			.pop()?.timestamp;

		const recommendations: string[] = [];
		
		if (recentErrors > 3) {
			recommendations.push('High number of connection errors detected. Check database connectivity.');
		}
		
		if (recentWarnings > 2) {
			recommendations.push('Frequent connection pool warnings. Consider increasing connection_limit.');
		}
		
		if (!lastConnectionCheck) {
			recommendations.push('No recent connection checks. Monitor database health regularly.');
		}

		return {
			totalEvents: this.events.length,
			recentErrors,
			recentWarnings,
			lastConnectionCheck,
			recommendations
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