import { cache, cacheKeys } from './redis.js';
import { dev } from '$app/environment';

interface CachedQueryOptions {
	ttl?: number; // Cache TTL in seconds
	skipCache?: boolean; // Skip cache for this specific query
	invalidatePatterns?: string[]; // Patterns to invalidate when this data changes
}

interface CacheResult<T> {
	data: T;
	fromCache: boolean;
	cacheKey: string;
}

/**
 * Generic cached query wrapper
 */
export async function cachedQuery<T>(
	cacheKey: string,
	queryFn: () => Promise<T>,
	options: CachedQueryOptions = {}
): Promise<CacheResult<T>> {
	const {
		ttl = 300, // 5 minutes default
		skipCache = false
	} = options;

	// Always skip cache if explicitly requested or if cache is disabled
	if (skipCache || !cache.isEnabled()) {
		const data = await queryFn();
		return {
			data,
			fromCache: false,
			cacheKey
		};
	}

	// Try to get from cache first
	const cachedData = await cache.get<T>(cacheKey);
	if (cachedData !== null) {
		if (dev) {
			console.log(`[Cache] Hit: ${cacheKey}`);
		}
		return {
			data: cachedData,
			fromCache: true,
			cacheKey
		};
	}

	// Cache miss - execute query and cache result
	const data = await queryFn();
	
	// Only cache non-null results
	if (data !== null && data !== undefined) {
		await cache.set(cacheKey, data, { ttl });
		if (dev) {
			console.log(`[Cache] Miss, cached: ${cacheKey} (TTL: ${ttl}s)`);
		}
	}

	return {
		data,
		fromCache: false,
		cacheKey
	};
}

/**
 * Cached query with automatic invalidation patterns
 */
export async function cachedQueryWithInvalidation<T>(
	cacheKey: string,
	queryFn: () => Promise<T>,
	invalidatePatterns: string[],
	options: CachedQueryOptions = {}
): Promise<CacheResult<T>> {
	return cachedQuery(cacheKey, queryFn, {
		...options,
		invalidatePatterns
	});
}

/**
 * Invalidate cache by patterns
 */
export async function invalidateCache(patterns: string[]): Promise<void> {
	if (!cache.isEnabled()) {
		return;
	}

	for (const pattern of patterns) {
		const deletedCount = await cache.delPattern(pattern);
		if (dev && deletedCount > 0) {
			console.log(`[Cache] Invalidated ${deletedCount} keys for pattern: ${pattern}`);
		}
	}
}

/**
 * Invalidate specific cache key
 */
export async function invalidateCacheKey(key: string): Promise<void> {
	if (!cache.isEnabled()) {
		return;
	}

	const deleted = await cache.del(key);
	if (dev && deleted) {
		console.log(`[Cache] Invalidated key: ${key}`);
	}
}

/**
 * Cached artwork queries
 */
export const cachedArtworkQueries = {
	/**
	 * Get artwork by ID with caching
	 */
	async getById(id: number, queryFn: () => Promise<any>, options: CachedQueryOptions = {}) {
		const cacheKey = cacheKeys.artwork(id);
		return cachedQuery(cacheKey, queryFn, {
			ttl: 600, // 10 minutes for artwork data
			...options
		});
	},

	/**
	 * Get artwork by UID with caching
	 */
	async getByUid(uid: string, queryFn: () => Promise<any>, options: CachedQueryOptions = {}) {
		const cacheKey = cacheKeys.artworkByUid(uid);
		return cachedQuery(cacheKey, queryFn, {
			ttl: 600, // 10 minutes for artwork data
			...options
		});
	},

	/**
	 * Get paginated artworks with caching
	 */
	async getPaginated(
		page: number, 
		limit: number, 
		filters: any,
		queryFn: () => Promise<any>, 
		options: CachedQueryOptions = {}
	) {
		const filtersHash = filters ? JSON.stringify(filters) : undefined;
		const cacheKey = cacheKeys.artworks(page, limit, filtersHash);
		return cachedQuery(cacheKey, queryFn, {
			ttl: 180, // 3 minutes for paginated data (shorter TTL due to frequent changes)
			...options
		});
	},

	/**
	 * Invalidate artwork-related cache
	 */
	async invalidate(artworkId?: number, uid?: string) {
		const patterns = ['artworks:*']; // Invalidate all artwork listings
		
		if (artworkId) {
			patterns.push(`artwork:${artworkId}`);
		}
		
		if (uid) {
			patterns.push(`artwork:uid:${uid}`);
		}
		
		await invalidateCache(patterns);
	}
};

/**
 * Cached collection queries
 */
export const cachedCollectionQueries = {
	/**
	 * Get collection by ID with caching
	 */
	async getById(id: number, queryFn: () => Promise<any>, options: CachedQueryOptions = {}) {
		const cacheKey = cacheKeys.collection(id);
		return cachedQuery(cacheKey, queryFn, {
			ttl: 900, // 15 minutes for collection data
			...options
		});
	},

	/**
	 * Get collection by slug with caching
	 */
	async getBySlug(slug: string, queryFn: () => Promise<any>, options: CachedQueryOptions = {}) {
		const cacheKey = cacheKeys.collectionBySlug(slug);
		return cachedQuery(cacheKey, queryFn, {
			ttl: 900, // 15 minutes for collection data
			...options
		});
	},

	/**
	 * Get paginated collections with caching
	 */
	async getPaginated(
		page: number, 
		limit: number, 
		search: string | undefined,
		queryFn: () => Promise<any>, 
		options: CachedQueryOptions = {}
	) {
		const cacheKey = cacheKeys.collections(page, limit, search);
		return cachedQuery(cacheKey, queryFn, {
			ttl: 300, // 5 minutes for collection listings
			...options
		});
	},

	/**
	 * Invalidate collection-related cache
	 */
	async invalidate(collectionId?: number, slug?: string) {
		const patterns = ['collections:*']; // Invalidate all collection listings
		
		if (collectionId) {
			patterns.push(`collection:${collectionId}`);
		}
		
		if (slug) {
			patterns.push(`collection:slug:${slug}`);
		}
		
		await invalidateCache(patterns);
	}
};

/**
 * Cached artist queries
 */
export const cachedArtistQueries = {
	/**
	 * Get artist by ID with caching
	 */
	async getById(id: number, queryFn: () => Promise<any>, options: CachedQueryOptions = {}) {
		const cacheKey = cacheKeys.artist(id);
		return cachedQuery(cacheKey, queryFn, {
			ttl: 600, // 10 minutes for artist data
			...options
		});
	},

	/**
	 * Get artist artworks with caching
	 */
	async getArtworks(
		artistId: number, 
		page: number, 
		limit: number,
		queryFn: () => Promise<any>, 
		options: CachedQueryOptions = {}
	) {
		const cacheKey = cacheKeys.artistArtworks(artistId, page, limit);
		return cachedQuery(cacheKey, queryFn, {
			ttl: 300, // 5 minutes for artist artwork listings
			...options
		});
	},

	/**
	 * Invalidate artist-related cache
	 */
	async invalidate(artistId?: number) {
		const patterns = ['artist:*']; // Invalidate all artist data
		
		if (artistId) {
			patterns.push(`artist:${artistId}:*`);
		}
		
		await invalidateCache(patterns);
	}
};

/**
 * Cached search queries
 */
export const cachedSearchQueries = {
	/**
	 * Cache search results
	 */
	async search(
		query: string, 
		type: string, 
		page: number,
		queryFn: () => Promise<any>, 
		options: CachedQueryOptions = {}
	) {
		const cacheKey = cacheKeys.search(query, type, page);
		return cachedQuery(cacheKey, queryFn, {
			ttl: 120, // 2 minutes for search results (shorter due to dynamic nature)
			...options
		});
	},

	/**
	 * Invalidate search cache
	 */
	async invalidate(type?: string) {
		const patterns = type ? [`search:${type}:*`] : ['search:*'];
		await invalidateCache(patterns);
	}
};

/**
 * Cache statistics and system queries
 */
export const cachedSystemQueries = {
	/**
	 * Get indexing stats with caching
	 */
	async getIndexStats(queryFn: () => Promise<any>, options: CachedQueryOptions = {}) {
		const cacheKey = cacheKeys.indexStats();
		return cachedQuery(cacheKey, queryFn, {
			ttl: 60, // 1 minute for stats
			...options
		});
	},

	/**
	 * Get connection pool metrics with caching
	 */
	async getConnectionPoolMetrics(queryFn: () => Promise<any>, options: CachedQueryOptions = {}) {
		const cacheKey = cacheKeys.connectionPoolMetrics();
		return cachedQuery(cacheKey, queryFn, {
			ttl: 30, // 30 seconds for connection metrics
			...options
		});
	}
};

/**
 * Utility to check if a query should use cache based on URL parameters
 */
export function shouldSkipCache(url?: URL): boolean {
	if (!url) return false;
	
	// Skip cache if ?nocache=true or ?skipCache=true
	return url.searchParams.get('nocache') === 'true' || 
		   url.searchParams.get('skipCache') === 'true' ||
		   url.searchParams.get('refresh') === 'true';
}

/**
 * Middleware to add cache control headers
 */
export function getCacheHeaders(fromCache: boolean, ttl: number = 300): Record<string, string> {
	if (fromCache) {
		return {
			'Cache-Control': `public, max-age=${ttl}`,
			'X-Cache': 'HIT'
		};
	} else {
		return {
			'Cache-Control': `public, max-age=${ttl}`,
			'X-Cache': 'MISS'
		};
	}
} 