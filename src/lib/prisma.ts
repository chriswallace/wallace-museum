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

const prismaOptions: Prisma.PrismaClientOptions = {
	log: logLevels,
	datasources: {
		db: {
			url: process.env.DATABASE_URL
		}
	},
	// Error formatting for better debugging
	errorFormat: dev ? 'pretty' : 'minimal'
};

// Connection pool configuration notes:
// Connection pool settings should be configured in the DATABASE_URL
// Example: postgresql://user:password@host:port/db?connection_limit=20&pool_timeout=30&connect_timeout=30
// 
// Recommended settings for production:
// - connection_limit: 20-30 (depending on your database plan)
// - pool_timeout: 30 (seconds to wait for a connection)
// - connect_timeout: 30 (seconds to wait for initial connection)
// - statement_timeout: 30000 (30 seconds for query timeout)
// - idle_in_transaction_session_timeout: 60000 (60 seconds)

// Create a singleton instance
const createPrismaClient = () => {
	const client = new PrismaClient(prismaOptions);
	
	// Query timing middleware disabled to reduce logging
	// if (dev) {
	// 	client.$use(async (params, next) => {
	// 		const before = Date.now();
	// 		const result = await next(params);
	// 		const after = Date.now();
	// 		console.log(`Query ${params.model}.${params.action} took ${after - before}ms`);
	// 		return result;
	// 	});
	// }
	
	return client;
};

// Use global variable in development to prevent multiple instances
const prisma = global.prisma || createPrismaClient();

if (dev) {
	global.prisma = prisma;
}

// Connection health check function
export async function checkDatabaseConnection(): Promise<boolean> {
	try {
		await prisma.$queryRaw`SELECT 1`;
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

// Connection pool monitoring (only in development)
if (dev && process.env.ENABLE_POOL_MONITORING === 'true') {
	setInterval(async () => {
		const metrics = await getConnectionPoolMetrics();
		if (metrics) {
			console.log(`[Prisma] Connection pool: ${metrics.active}/${metrics.max} (${metrics.utilization}% utilization)`);
		}
	}, 60000); // Check every minute
}

// Graceful shutdown handling
const gracefulShutdown = async () => {
	console.log('[Prisma] Disconnecting from database...');
	await prisma.$disconnect();
	console.log('[Prisma] Disconnected from database');
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
