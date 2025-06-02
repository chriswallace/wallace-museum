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
	
	// Set connection pool parameters if not already specified
	if (!url.searchParams.has('connection_limit')) {
		url.searchParams.set('connection_limit', '25'); // Increased from default 10
	}
	if (!url.searchParams.has('pool_timeout')) {
		url.searchParams.set('pool_timeout', '60'); // Increased from default 20
	}
	if (!url.searchParams.has('connect_timeout')) {
		url.searchParams.set('connect_timeout', '30');
	}
	if (!url.searchParams.has('statement_timeout')) {
		url.searchParams.set('statement_timeout', '60000'); // 60 seconds
	}
	if (!url.searchParams.has('idle_in_transaction_session_timeout')) {
		url.searchParams.set('idle_in_transaction_session_timeout', '120000'); // 2 minutes
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
// - connection_limit: 25 (increased from 10)
// - pool_timeout: 60 (increased from 20 seconds)
// - connect_timeout: 30 (seconds to wait for initial connection)
// - statement_timeout: 60000 (60 seconds for query timeout)
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
		if (metrics && metrics.utilization > 70) {
			console.warn(`[Prisma] High connection pool utilization: ${metrics.active}/${metrics.max} (${metrics.utilization}%)`);
		}
	}, 30000); // Check every 30 seconds
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
