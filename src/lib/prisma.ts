import { PrismaClient, Prisma } from '@prisma/client';
import { dev } from '$app/environment'; // Import dev environment check from SvelteKit
import { browser } from '$app/environment';

// Ensure we're not trying to use Prisma in the browser
if (browser) {
	throw new Error('Prisma client cannot be used in the browser');
}

declare global {
	var prisma: PrismaClient | undefined;
}

// Configure logging based on environment
const logLevels: Prisma.LogLevel[] = dev 
	? ['error', 'warn'] 
	: ['error'];

// Enhanced connection pool configuration
const getDatabaseUrl = () => {
	const baseUrl = process.env.DATABASE_URL;
	if (!baseUrl) {
		throw new Error('DATABASE_URL environment variable is not set');
	}

	// Parse the URL to add connection pool parameters if not already present
	const url = new URL(baseUrl);
	
	// Set more appropriate connection pool parameters for the application's usage patterns
	if (!url.searchParams.has('connection_limit')) {
		url.searchParams.set('connection_limit', '15'); // Increased from 10 to handle concurrent operations
	}
	if (!url.searchParams.has('pool_timeout')) {
		url.searchParams.set('pool_timeout', '30'); // Increased from 20 to reduce timeout errors
	}
	if (!url.searchParams.has('connect_timeout')) {
		url.searchParams.set('connect_timeout', '15'); // Increased from 10 for better reliability
	}
	if (!url.searchParams.has('statement_timeout')) {
		url.searchParams.set('statement_timeout', '45000'); // Increased from 30s to 45s for complex queries
	}
	if (!url.searchParams.has('idle_in_transaction_session_timeout')) {
		url.searchParams.set('idle_in_transaction_session_timeout', '120000'); // Increased from 1 to 2 minutes
	}

	return url.toString();
};

const prismaOptions: Prisma.PrismaClientOptions = {
	log: logLevels,
	datasources: {
		db: {
			url: getDatabaseUrl()
		}
	},
	// Error formatting for better debugging
	errorFormat: dev ? 'pretty' : 'minimal'
};

// Connection pool configuration notes:
// Connection pool settings are now automatically configured in getDatabaseUrl()
// 
// Current settings:
// - connection_limit: 15 (increased from 10)
// - pool_timeout: 30 (increased from 20 seconds)
// - connect_timeout: 15 (seconds to wait for initial connection)
// - statement_timeout: 45000 (45 seconds for query timeout)
// - idle_in_transaction_session_timeout: 120000 (2 minutes)

// Create a singleton instance with retry logic
const createPrismaClient = () => {
	const client = new PrismaClient(prismaOptions);
	
	// Add connection retry middleware
	client.$use(async (params, next) => {
		const maxRetries = 3;
		let retries = 0;
		
		while (retries < maxRetries) {
			try {
				return await next(params);
			} catch (error: any) {
				// Check if it's a connection pool timeout error
				if (error?.code === 'P2024' && retries < maxRetries - 1) {
					retries++;
					console.warn(`[Prisma] Connection pool timeout, retrying (${retries}/${maxRetries})...`);
					// Wait before retrying with exponential backoff
					await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
					continue;
				}
				throw error;
			}
		}
	});
	
	// Query timing middleware for development
	if (dev) {
		client.$use(async (params, next) => {
			const before = Date.now();
			const result = await next(params);
			const after = Date.now();
			
			// Only log slow queries (>1000ms) to reduce noise
			if (after - before > 1000) {
				console.log(`[Prisma] Slow query ${params.model}.${params.action} took ${after - before}ms`);
			}
			return result;
		});
	}
	
	return client;
};

// Use global variable in development to prevent multiple instances
const prisma = global.prisma || createPrismaClient();

if (dev) {
	global.prisma = prisma;
}

// Connection health check function with timeout
export async function checkDatabaseConnection(): Promise<boolean> {
	try {
		// Use a timeout to prevent hanging
		const timeoutPromise = new Promise((_, reject) => 
			setTimeout(() => reject(new Error('Database health check timeout')), 5000)
		);
		
		const healthCheck = prisma.$queryRaw`SELECT 1`;
		
		await Promise.race([healthCheck, timeoutPromise]);
		return true;
	} catch (error) {
		console.error('[Prisma] Database connection check failed:', error);
		return false;
	}
}

// Get connection pool metrics (if available)
export async function getConnectionPoolMetrics() {
	try {
		// Check current connections (PostgreSQL specific)
		const poolInfo = await prisma.$queryRaw<Array<{ count: bigint }>>`
			SELECT count(*) 
			FROM pg_stat_activity 
			WHERE datname = current_database()
		`;
		
		const activeConnections = Number(poolInfo[0]?.count || 0);
		
		// Get max connections setting
		const maxConnInfo = await prisma.$queryRaw<Array<{ setting: string }>>`
			SELECT setting 
			FROM pg_settings 
			WHERE name = 'max_connections'
		`;
		
		const maxConnections = parseInt(maxConnInfo[0]?.setting || '100');
		
		return {
			active: activeConnections,
			max: maxConnections,
			utilization: Math.round((activeConnections / maxConnections) * 100)
		};
	} catch (error) {
		console.error('[Prisma] Failed to get pool metrics:', error);
		return null;
	}
}

// Enhanced connection pool monitoring
if (dev && process.env.ENABLE_POOL_MONITORING === 'true') {
	setInterval(async () => {
		const metrics = await getConnectionPoolMetrics();
		if (metrics) {
			// Log connection pool status more frequently in development
			console.log(`[Prisma] Connection pool status: ${metrics.active}/${metrics.max} (${metrics.utilization}%)`);
			
			if (metrics.utilization > 80) {
				console.warn(`[Prisma] HIGH connection pool utilization: ${metrics.active}/${metrics.max} (${metrics.utilization}%)`);
			} else if (metrics.utilization > 60) {
				console.warn(`[Prisma] Elevated connection pool utilization: ${metrics.active}/${metrics.max} (${metrics.utilization}%)`);
			}
		}
	}, 15000); // Check every 15 seconds instead of 30
}

// Add production monitoring as well
if (!dev) {
	setInterval(async () => {
		const metrics = await getConnectionPoolMetrics();
		if (metrics && metrics.utilization > 85) {
			console.error(`[Prisma] CRITICAL connection pool utilization in production: ${metrics.active}/${metrics.max} (${metrics.utilization}%)`);
		}
	}, 30000); // Check every 30 seconds in production
}

// Graceful shutdown handling with timeout
const gracefulShutdown = async () => {
	console.log('[Prisma] Disconnecting from database...');
	try {
		// Set a timeout for disconnection
		const disconnectPromise = prisma.$disconnect();
		const timeoutPromise = new Promise((_, reject) => 
			setTimeout(() => reject(new Error('Disconnect timeout')), 10000)
		);
		
		await Promise.race([disconnectPromise, timeoutPromise]);
		console.log('[Prisma] Disconnected from database');
	} catch (error) {
		console.error('[Prisma] Error during disconnect:', error);
	}
};

// Register shutdown handlers
process.on('beforeExit', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
	console.error('[Prisma] Uncaught exception:', error);
	await gracefulShutdown();
	process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
	console.error('[Prisma] Unhandled rejection at:', promise, 'reason:', reason);
	await gracefulShutdown();
	process.exit(1);
});

export default prisma;
