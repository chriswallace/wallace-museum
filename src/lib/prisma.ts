import { PrismaClient, Prisma } from '@prisma/client';
import { dev } from '$app/environment'; // Import dev environment check from SvelteKit
import { browser } from '$app/environment';

// Ensure we're not trying to use Prisma in the browser
if (browser) {
	throw new Error('Prisma client cannot be used in the browser');
}

declare global {
	var prismaRead: PrismaClient | undefined;
	var prismaWrite: PrismaClient | undefined;
}

// Configure logging based on environment
const logLevels: Prisma.LogLevel[] = dev 
	? ['error', 'warn'] 
	: ['error'];

// Enhanced connection pool configuration for read database
const getReadDatabaseUrl = () => {
	const baseUrl = process.env.DATABASE_URL;
	if (!baseUrl) {
		throw new Error('DATABASE_URL environment variable is not set');
	}

	// Parse the URL to add connection pool parameters if not already present
	const url = new URL(baseUrl);
	
	// Add application name for better connection tracking
	if (!url.searchParams.has('application_name')) {
		url.searchParams.set('application_name', 'wallace-collection-read');
	}
	
	// Connection pool parameters optimized for read operations
	if (!url.searchParams.has('connection_limit')) {
		url.searchParams.set('connection_limit', '15'); // Increased from 10 for better throughput
	}
	if (!url.searchParams.has('pool_timeout')) {
		url.searchParams.set('pool_timeout', '30'); // Increased timeout
	}
	if (!url.searchParams.has('connect_timeout')) {
		url.searchParams.set('connect_timeout', '15'); // Increased connect timeout
	}
	if (!url.searchParams.has('statement_timeout')) {
		url.searchParams.set('statement_timeout', '45000'); // Increased statement timeout
	}
	if (!url.searchParams.has('idle_in_transaction_session_timeout')) {
		url.searchParams.set('idle_in_transaction_session_timeout', '30000'); // Reduced idle timeout
	}

	return url.toString();
};

// Enhanced connection pool configuration for write database
const getWriteDatabaseUrl = () => {
	const baseUrl = process.env.WRITE_DATABASE_URL || process.env.DATABASE_URL;
	if (!baseUrl) {
		throw new Error('WRITE_DATABASE_URL or DATABASE_URL environment variable is not set');
	}

	// Parse the URL to add connection pool parameters if not already present
	const url = new URL(baseUrl);
	
	// Add application name for better connection tracking
	if (!url.searchParams.has('application_name')) {
		url.searchParams.set('application_name', 'wallace-collection-write');
	}
	
	// Connection pool parameters optimized for write operations
	if (!url.searchParams.has('connection_limit')) {
		url.searchParams.set('connection_limit', '8'); // Increased from 6 for better write performance
	}
	if (!url.searchParams.has('pool_timeout')) {
		url.searchParams.set('pool_timeout', '35'); // Increased timeout for writes
	}
	if (!url.searchParams.has('connect_timeout')) {
		url.searchParams.set('connect_timeout', '20'); // Increased timeout for writes
	}
	if (!url.searchParams.has('statement_timeout')) {
		url.searchParams.set('statement_timeout', '60000'); // Increased timeout for complex writes
	}
	if (!url.searchParams.has('idle_in_transaction_session_timeout')) {
		url.searchParams.set('idle_in_transaction_session_timeout', '90000'); // Increased for transactions
	}

	return url.toString();
};

const readPrismaOptions: Prisma.PrismaClientOptions = {
	log: logLevels,
	datasources: {
		db: {
			url: getReadDatabaseUrl()
		}
	},
	// Error formatting for better debugging
	errorFormat: dev ? 'pretty' : 'minimal'
};

const writePrismaOptions: Prisma.PrismaClientOptions = {
	log: logLevels,
	datasources: {
		db: {
			url: getWriteDatabaseUrl()
		}
	},
	// Error formatting for better debugging
	errorFormat: dev ? 'pretty' : 'minimal'
};

// Create a Prisma client with retry logic
const createPrismaClient = (options: Prisma.PrismaClientOptions, type: 'read' | 'write') => {
	const client = new PrismaClient(options);
	
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
					console.warn(`[Prisma ${type}] Connection pool timeout, retrying (${retries}/${maxRetries})...`);
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
				console.log(`[Prisma ${type}] Slow query ${params.model}.${params.action} took ${after - before}ms`);
			}
			return result;
		});
	}
	
	return client;
};

// Use global variables in development to prevent multiple instances
const prismaRead = global.prismaRead || createPrismaClient(readPrismaOptions, 'read');
const prismaWrite = global.prismaWrite || createPrismaClient(writePrismaOptions, 'write');

if (dev) {
	global.prismaRead = prismaRead;
	global.prismaWrite = prismaWrite;
}

// Default export for backward compatibility (uses read client)
const prisma = prismaRead;

// Connection health check function with timeout
export async function checkDatabaseConnection(): Promise<boolean> {
	try {
		// Use a timeout to prevent hanging
		const timeoutPromise = new Promise((_, reject) => 
			setTimeout(() => reject(new Error('Database health check timeout')), 5000)
		);
		
		const healthCheck = prismaRead.$queryRaw`SELECT 1`;
		
		await Promise.race([healthCheck, timeoutPromise]);
		return true;
	} catch (error) {
		console.error('[Prisma] Database connection check failed:', error);
		return false;
	}
}

// Get connection pool metrics for a specific client
async function getConnectionPoolMetricsForClient(client: PrismaClient, type: string) {
	try {
		// Check current connections (PostgreSQL specific)
		const poolInfo = await client.$queryRaw<Array<{ count: bigint }>>`
			SELECT count(*) 
			FROM pg_stat_activity 
			WHERE datname = current_database()
		`;
		
		const activeConnections = Number(poolInfo[0]?.count || 0);
		
		// Get max connections setting
		const maxConnInfo = await client.$queryRaw<Array<{ setting: string }>>`
			SELECT setting 
			FROM pg_settings 
			WHERE name = 'max_connections'
		`;
		
		const maxConnections = parseInt(maxConnInfo[0]?.setting || '100');
		
		return {
			type,
			active: activeConnections,
			max: maxConnections,
			utilization: Math.round((activeConnections / maxConnections) * 100)
		};
	} catch (error) {
		console.error(`[Prisma ${type}] Failed to get pool metrics:`, error);
		return null;
	}
}

// Get connection pool metrics (if available)
export async function getConnectionPoolMetrics() {
	try {
		const [readMetrics, writeMetrics] = await Promise.all([
			getConnectionPoolMetricsForClient(prismaRead, 'read'),
			getConnectionPoolMetricsForClient(prismaWrite, 'write')
		]);
		
		return {
			read: readMetrics,
			write: writeMetrics
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
			if (metrics.read) {
				console.log(`[Prisma Read] Connection pool status: ${metrics.read.active}/${metrics.read.max} (${metrics.read.utilization}%)`);
			}
			if (metrics.write) {
				console.log(`[Prisma Write] Connection pool status: ${metrics.write.active}/${metrics.write.max} (${metrics.write.utilization}%)`);
			}
			
			if (metrics.read && metrics.read.utilization > 80) {
				console.warn(`[Prisma Read] HIGH connection pool utilization: ${metrics.read.active}/${metrics.read.max} (${metrics.read.utilization}%)`);
			}
			if (metrics.write && metrics.write.utilization > 80) {
				console.warn(`[Prisma Write] HIGH connection pool utilization: ${metrics.write.active}/${metrics.write.max} (${metrics.write.utilization}%)`);
			}
		}
	}, 15000); // Check every 15 seconds instead of 30
}

// Add production monitoring as well
if (!dev) {
	setInterval(async () => {
		const metrics = await getConnectionPoolMetrics();
		if (metrics) {
			if (metrics.read && metrics.read.utilization > 85) {
				console.error(`[Prisma Read] CRITICAL connection pool utilization in production: ${metrics.read.active}/${metrics.read.max} (${metrics.read.utilization}%)`);
			}
			if (metrics.write && metrics.write.utilization > 85) {
				console.error(`[Prisma Write] CRITICAL connection pool utilization in production: ${metrics.write.active}/${metrics.write.max} (${metrics.write.utilization}%)`);
			}
		}
	}, 30000); // Check every 30 seconds in production
}

// Graceful shutdown handling with timeout
const gracefulShutdown = async () => {
	console.log('[Prisma] Disconnecting from databases...');
	try {
		// Set a timeout for disconnection
		const disconnectPromises = [
			prismaRead.$disconnect(),
			prismaWrite.$disconnect()
		];
		const timeoutPromise = new Promise((_, reject) => 
			setTimeout(() => reject(new Error('Disconnect timeout')), 10000)
		);
		
		await Promise.race([Promise.all(disconnectPromises), timeoutPromise]);
		console.log('[Prisma] Disconnected from databases');
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

// Export both clients and default for backward compatibility
export { prismaRead, prismaWrite };

// Helper functions for cleaner code
export const db = {
	// Read operations
	read: prismaRead,
	// Write operations  
	write: prismaWrite,
	// Transactions (use write client for transactions)
	transaction: prismaWrite.$transaction.bind(prismaWrite)
};

export default prisma;
