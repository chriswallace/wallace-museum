import { db } from '$lib/prisma';

/**
 * Clean up expired sessions from the database
 * This helps maintain database performance by reducing table size
 */
export async function cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
	try {
		const result = await db.write.session.deleteMany({
			where: {
				expiresAt: {
					lt: new Date()
				}
			}
		});

		console.log(`[Session Cleanup] Deleted ${result.count} expired sessions`);
		return { deletedCount: result.count };
	} catch (error) {
		console.error('[Session Cleanup] Failed to clean up expired sessions:', error);
		throw error;
	}
}

/**
 * Start periodic session cleanup
 * Runs every 6 hours to keep the session table clean
 */
export function startSessionCleanup(): NodeJS.Timeout {
	// Clean up immediately on start
	cleanupExpiredSessions().catch(console.error);
	
	// Then clean up every 6 hours
	return setInterval(() => {
		cleanupExpiredSessions().catch(console.error);
	}, 6 * 60 * 60 * 1000); // 6 hours in milliseconds
}

/**
 * Get session statistics for monitoring
 */
export async function getSessionStats() {
	try {
		const [total, expired, active] = await Promise.all([
			db.read.session.count(),
			db.read.session.count({
				where: {
					expiresAt: {
						lt: new Date()
					}
				}
			}),
			db.read.session.count({
				where: {
					expiresAt: {
						gte: new Date()
					}
				}
			})
		]);

		return {
			total,
			expired,
			active,
			expiredPercentage: total > 0 ? Math.round((expired / total) * 100) : 0
		};
	} catch (error) {
		console.error('[Session Stats] Failed to get session statistics:', error);
		return null;
	}
} 