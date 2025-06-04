import Redis from 'ioredis';
import { dev } from '$app/environment';

interface CacheOptions {
	ttl?: number; // Time to live in seconds
	skipCache?: boolean; // Skip cache for this operation
}

interface CacheConfig {
	enabled: boolean;
	defaultTTL: number;
	keyPrefix: string;
	maxRetries: number;
	retryDelayOnFailover: number;
}

class RedisCache {
	private redis: Redis | null = null;
	private config: CacheConfig;
	private isConnected = false;

	constructor() {
		// Configuration with environment-based defaults
		this.config = {
			enabled: this.shouldEnableCache(),
			defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'), // 5 minutes default
			keyPrefix: process.env.CACHE_KEY_PREFIX || 'wallace-collection:',
			maxRetries: 3,
			retryDelayOnFailover: 100
		};

		if (this.config.enabled) {
			this.initializeRedis();
		}
	}

	private shouldEnableCache(): boolean {
		// Check if cache is explicitly disabled
		if (process.env.DISABLE_CACHE === 'true') {
			return false;
		}

		// Check if we're in local dev and cache is not explicitly enabled
		if (dev && process.env.ENABLE_CACHE_IN_DEV !== 'true') {
			return false;
		}

		// Check if Redis URL is available
		return !!process.env.REDISCLOUD_URL;
	}

	private initializeRedis(): void {
		if (!process.env.REDISCLOUD_URL) {
			console.warn('[Cache] REDISCLOUD_URL not found, cache disabled');
			this.config.enabled = false;
			return;
		}

		try {
			this.redis = new Redis(process.env.REDISCLOUD_URL, {
				maxRetriesPerRequest: this.config.maxRetries,
				retryDelayOnFailover: this.config.retryDelayOnFailover,
				enableReadyCheck: true,
				lazyConnect: true,
				keepAlive: 30000, // 30 seconds
				connectTimeout: 10000, // 10 seconds
				commandTimeout: 5000, // 5 seconds
			});

			this.redis.on('connect', () => {
				console.log('[Cache] Redis connected');
				this.isConnected = true;
			});

			this.redis.on('ready', () => {
				console.log('[Cache] Redis ready');
			});

			this.redis.on('error', (error: Error) => {
				console.error('[Cache] Redis error:', error.message);
				this.isConnected = false;
			});

			this.redis.on('close', () => {
				console.warn('[Cache] Redis connection closed');
				this.isConnected = false;
			});

			this.redis.on('reconnecting', () => {
				console.log('[Cache] Redis reconnecting...');
			});

		} catch (error) {
			console.error('[Cache] Failed to initialize Redis:', error);
			this.config.enabled = false;
		}
	}

	private generateKey(key: string): string {
		return `${this.config.keyPrefix}${key}`;
	}

	/**
	 * Check if cache is enabled and connected
	 */
	isEnabled(): boolean {
		return this.config.enabled && this.isConnected && this.redis !== null;
	}

	/**
	 * Get a value from cache
	 */
	async get<T>(key: string): Promise<T | null> {
		if (!this.isEnabled()) {
			return null;
		}

		try {
			const value = await this.redis!.get(this.generateKey(key));
			if (value === null) {
				return null;
			}
			return JSON.parse(value) as T;
		} catch (error) {
			console.error(`[Cache] Error getting key ${key}:`, error);
			return null;
		}
	}

	/**
	 * Set a value in cache
	 */
	async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
		if (!this.isEnabled() || options.skipCache) {
			return false;
		}

		try {
			const ttl = options.ttl || this.config.defaultTTL;
			const serializedValue = JSON.stringify(value);
			
			if (ttl > 0) {
				await this.redis!.setex(this.generateKey(key), ttl, serializedValue);
			} else {
				await this.redis!.set(this.generateKey(key), serializedValue);
			}
			
			return true;
		} catch (error) {
			console.error(`[Cache] Error setting key ${key}:`, error);
			return false;
		}
	}

	/**
	 * Delete a key from cache
	 */
	async del(key: string): Promise<boolean> {
		if (!this.isEnabled()) {
			return false;
		}

		try {
			const result = await this.redis!.del(this.generateKey(key));
			return result > 0;
		} catch (error) {
			console.error(`[Cache] Error deleting key ${key}:`, error);
			return false;
		}
	}

	/**
	 * Delete multiple keys with pattern
	 */
	async delPattern(pattern: string): Promise<number> {
		if (!this.isEnabled()) {
			return 0;
		}

		try {
			const keys = await this.redis!.keys(this.generateKey(pattern));
			if (keys.length === 0) {
				return 0;
			}
			
			const result = await this.redis!.del(...keys);
			return result;
		} catch (error) {
			console.error(`[Cache] Error deleting pattern ${pattern}:`, error);
			return 0;
		}
	}

	/**
	 * Check if a key exists
	 */
	async exists(key: string): Promise<boolean> {
		if (!this.isEnabled()) {
			return false;
		}

		try {
			const result = await this.redis!.exists(this.generateKey(key));
			return result === 1;
		} catch (error) {
			console.error(`[Cache] Error checking existence of key ${key}:`, error);
			return false;
		}
	}

	/**
	 * Get cache statistics
	 */
	async getStats(): Promise<{
		enabled: boolean;
		connected: boolean;
		keyCount: number;
		prefix: string;
		defaultTTL: number;
		memoryUsage?: string;
	}> {
		const stats = {
			enabled: this.config.enabled,
			connected: this.isConnected,
			keyCount: 0,
			prefix: this.config.keyPrefix,
			defaultTTL: this.config.defaultTTL,
		};

		if (!this.isEnabled()) {
			return stats;
		}

		try {
			// Get keys with our prefix
			const keys = await this.redis!.keys(this.generateKey('*'));
			stats.keyCount = keys.length;

			// Get memory usage info
			const info = await this.redis!.info('memory');
			const memoryMatch = info.match(/used_memory_human:(.+)/);
			if (memoryMatch) {
				return { ...stats, memoryUsage: memoryMatch[1].trim() };
			}
		} catch (error) {
			console.error('[Cache] Error getting stats:', error);
		}

		return stats;
	}

	/**
	 * Clear all cache entries for this app
	 */
	async clear(): Promise<number> {
		if (!this.isEnabled()) {
			return 0;
		}

		try {
			return await this.delPattern('*');
		} catch (error) {
			console.error('[Cache] Error clearing cache:', error);
			return 0;
		}
	}

	/**
	 * Graceful shutdown
	 */
	async disconnect(): Promise<void> {
		if (this.redis) {
			try {
				await this.redis.disconnect();
				console.log('[Cache] Redis disconnected');
			} catch (error) {
				console.error('[Cache] Error disconnecting Redis:', error);
			}
		}
	}
}

// Export singleton instance
export const redisCache = new RedisCache();

// Export cache utility functions for easy use
export const cache = {
	get: <T>(key: string) => redisCache.get<T>(key),
	set: (key: string, value: any, options?: CacheOptions) => redisCache.set(key, value, options),
	del: (key: string) => redisCache.del(key),
	delPattern: (pattern: string) => redisCache.delPattern(pattern),
	exists: (key: string) => redisCache.exists(key),
	clear: () => redisCache.clear(),
	stats: () => redisCache.getStats(),
	isEnabled: () => redisCache.isEnabled(),
};

// Cache key generators for consistent naming
export const cacheKeys = {
	artwork: (id: number | string) => `artwork:${id}`,
	artworkByUid: (uid: string) => `artwork:uid:${uid}`,
	artworks: (page: number, limit: number, filters?: string) => 
		`artworks:page:${page}:limit:${limit}${filters ? `:filters:${filters}` : ''}`,
	collection: (id: number | string) => `collection:${id}`,
	collectionBySlug: (slug: string) => `collection:slug:${slug}`,
	collections: (page: number, limit: number, search?: string) => 
		`collections:page:${page}:limit:${limit}${search ? `:search:${search}` : ''}`,
	artist: (id: number | string) => `artist:${id}`,
	artistArtworks: (artistId: number, page: number, limit: number) => 
		`artist:${artistId}:artworks:page:${page}:limit:${limit}`,
	search: (query: string, type: string, page: number) => 
		`search:${type}:${encodeURIComponent(query)}:page:${page}`,
	indexStats: () => 'index:stats',
	connectionPoolMetrics: () => 'db:pool:metrics',
}; 