// Advanced caching system for optimal performance
// Provides intelligent caching with TTL, memory management, and cache invalidation

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  size: number; // Estimated size in bytes for memory management
  accessCount: number;
  lastAccessed: number;
}

export interface CacheOptions {
  ttl?: number; // Default TTL in milliseconds (24 hours)
  maxSize?: number; // Maximum cache size in bytes (50MB default)
  maxEntries?: number; // Maximum number of entries (1000 default)
  cleanupInterval?: number; // Cleanup interval in milliseconds (5 minutes)
  enableMetrics?: boolean; // Enable detailed metrics tracking
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
  hitRate: number;
}

export type CacheKey = string | number;

/**
 * Advanced caching system with intelligent memory management
 */
export class AdvancedCache {
  private cache = new Map<CacheKey, CacheEntry<any>>();
  private options: Required<CacheOptions>;
  private metrics: CacheMetrics;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl || 24 * 60 * 60 * 1000, // 24 hours
      maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB
      maxEntries: options.maxEntries || 1000,
      cleanupInterval: options.cleanupInterval || 5 * 60 * 1000, // 5 minutes
      enableMetrics: options.enableMetrics || true
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0,
      hitRate: 0
    };

    // Start cleanup timer
    this.startCleanupTimer();

    console.log(`🔧 [CACHE] Advanced cache initialized with ${this.formatBytes(this.options.maxSize)} limit`);
  }

  /**
   * Get item from cache
   */
  get<T>(key: CacheKey): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.recordMiss();
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.updateMetricsAfterDelete(entry.size);
      this.recordMiss();
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.recordHit();
    return entry.data;
  }

  /**
   * Set item in cache
   */
  set<T>(key: CacheKey, data: T, customTTL?: number): void {
    const ttl = customTTL || this.options.ttl;
    const size = this.estimateSize(data);
    const timestamp = Date.now();

    // Check if we need to make room
    this.ensureSpace(size);

    // Remove existing entry if it exists
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.updateMetricsAfterDelete(existingEntry.size);
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp,
      ttl,
      size,
      accessCount: 0,
      lastAccessed: timestamp
    };

    this.cache.set(key, entry);
    this.updateMetricsAfterSet(size);
    this.recordSet();

    console.log(`💾 [CACHE] Set ${key}: ${this.formatBytes(size)}`);
  }

  /**
   * Delete item from cache
   */
  delete(key: CacheKey): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.updateMetricsAfterDelete(entry.size);
      this.recordDelete();
      console.log(`🗑️ [CACHE] Deleted ${key}: ${this.formatBytes(entry.size)}`);
      return true;
    }
    return false;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const totalSize = this.metrics.totalSize;
    this.cache.clear();
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0,
      hitRate: 0
    };
    console.log(`🧹 [CACHE] Cleared all entries: ${this.formatBytes(totalSize)} freed`);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: CacheKey): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.updateMetricsAfterDelete(entry.size);
      return false;
    }

    return true;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateHitRate();
    return { ...this.metrics };
  }

  /**
   * Get all cache keys
   */
  getKeys(): CacheKey[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entry count
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: CacheKey[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      const entry = this.cache.get(key);
      if (entry) {
        this.cache.delete(key);
        this.updateMetricsAfterDelete(entry.size);
        this.metrics.evictions++;
      }
    });

    if (expiredKeys.length > 0) {
      console.log(`🧹 [CACHE] Cleaned up ${expiredKeys.length} expired entries`);
    }

    // Also cleanup least recently used entries if we're over the limit
    this.evictLRUIfNeeded();
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
    console.log('🔧 [CACHE] Cache destroyed');
  }

  // Private methods

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private ensureSpace(newSize: number): void {
    // If adding this entry would exceed max size, remove entries
    if (this.metrics.totalSize + newSize > this.options.maxSize) {
      this.evictLRUUntilSpace(newSize);
    }

    // If we're over max entries, remove oldest entries
    if (this.cache.size >= this.options.maxEntries) {
      this.evictLRU();
    }
  }

  private evictLRUUntilSpace(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);

    let freedSpace = 0;
    const keysToRemove: CacheKey[] = [];

    for (const [key, entry] of entries) {
      keysToRemove.push(key);
      freedSpace += entry.size;

      if (freedSpace >= requiredSpace) break;
    }

    keysToRemove.forEach(key => {
      const entry = this.cache.get(key);
      if (entry) {
        this.cache.delete(key);
        this.updateMetricsAfterDelete(entry.size);
        this.metrics.evictions++;
      }
    });

    console.log(`💾 [CACHE] Evicted ${keysToRemove.length} entries to free ${this.formatBytes(freedSpace)}`);
  }

  private evictLRU(): void {
    if (this.cache.size < this.options.maxEntries) return;

    const entries = Array.from(this.cache.entries())
      .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);

    const keysToRemove = entries.slice(0, Math.ceil(this.options.maxEntries * 0.1)); // Remove 10%

    keysToRemove.forEach(([key, entry]) => {
      this.cache.delete(key);
      this.updateMetricsAfterDelete(entry.size);
      this.metrics.evictions++;
    });

    console.log(`💾 [CACHE] Evicted ${keysToRemove.length} LRU entries`);
  }

  private evictLRUIfNeeded(): void {
    if (this.cache.size >= this.options.maxEntries) {
      this.evictLRU();
    }
  }

  private estimateSize(data: any): number {
    // Rough size estimation
    if (data instanceof Array) {
      return data.length * 100; // Assume ~100 bytes per array element
    } else if (typeof data === 'object') {
      return JSON.stringify(data).length * 2; // Rough estimate
    } else if (typeof data === 'string') {
      return data.length * 2; // UTF-16 characters
    } else {
      return 8; // Number or boolean
    }
  }

  private updateMetricsAfterSet(size: number): void {
    this.metrics.totalSize += size;
    this.metrics.entryCount = this.cache.size;
    this.metrics.sets++;
  }

  private updateMetricsAfterDelete(size: number): void {
    this.metrics.totalSize -= size;
    this.metrics.entryCount = this.cache.size;
    this.metrics.totalSize = Math.max(0, this.metrics.totalSize);
  }

  private recordHit(): void {
    this.metrics.hits++;
  }

  private recordMiss(): void {
    this.metrics.misses++;
  }

  private recordSet(): void {
    this.metrics.sets++;
  }

  private recordDelete(): void {
    this.metrics.deletes++;
  }

  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * Specialized caches for different data types
 */

// Image cache with shorter TTL for frequently changing images
export const imageCache = new AdvancedCache({
  ttl: 60 * 60 * 1000, // 1 hour
  maxSize: 100 * 1024 * 1024, // 100MB for images
  maxEntries: 500
});

// Post data cache with longer TTL for relatively stable data
export const postCache = new AdvancedCache({
  ttl: 10 * 60 * 1000, // 10 minutes
  maxSize: 20 * 1024 * 1024, // 20MB
  maxEntries: 200
});

// User data cache with medium TTL
export const userCache = new AdvancedCache({
  ttl: 30 * 60 * 1000, // 30 minutes
  maxSize: 10 * 1024 * 1024, // 10MB
  maxEntries: 300
});

// Notification cache with shorter TTL for real-time data
export const notificationCache = new AdvancedCache({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 5 * 1024 * 1024, // 5MB
  maxEntries: 100
});

/**
 * Cache key generators
 */
export const cacheKeys = {
  image: (url: string) => `img_${url}`,
  post: (postId: string) => `post_${postId}`,
  user: (userId: string) => `user_${userId}`,
  posts: (type: string, category?: string) => `posts_${type}_${category || 'all'}`,
  notifications: (userId: string) => `notifications_${userId}`,
  optimizedImage: (url: string, width: number, height: number) =>
    `opt_${url}_${width}_${height}`
};

/**
 * Cache invalidation helpers
 */
export const cacheInvalidation = {
  // Invalidate specific post and related caches
  invalidatePost: (postId: string) => {
    postCache.delete(cacheKeys.post(postId));
    // Also clear post lists that might contain this post
    postCache.delete(cacheKeys.posts('all'));
    postCache.delete(cacheKeys.posts('lost'));
    postCache.delete(cacheKeys.posts('found'));
  },

  // Invalidate user data and related caches
  invalidateUser: (userId: string) => {
    userCache.delete(cacheKeys.user(userId));
    notificationCache.delete(cacheKeys.notifications(userId));
  },

  // Invalidate all posts of a specific type
  invalidatePostsByType: (type: 'lost' | 'found' | 'all') => {
    postCache.delete(cacheKeys.posts(type));
    if (type === 'all') {
      postCache.delete(cacheKeys.posts('lost'));
      postCache.delete(cacheKeys.posts('found'));
    }
  },

  // Invalidate all notifications for a user
  invalidateNotifications: (userId: string) => {
    notificationCache.delete(cacheKeys.notifications(userId));
  },

  // Clear all caches
  clearAll: () => {
    imageCache.clear();
    postCache.clear();
    userCache.clear();
    notificationCache.clear();
  }
};

/**
 * Performance monitoring helpers
 */
export const cachePerformance = {
  getMetrics: () => ({
    imageCache: imageCache.getMetrics(),
    postCache: postCache.getMetrics(),
    userCache: userCache.getMetrics(),
    notificationCache: notificationCache.getMetrics()
  }),

  logMetrics: () => {
    const metrics = cachePerformance.getMetrics();
    console.log('📊 [CACHE] Performance Metrics:', {
      imageCache: {
        hitRate: `${(metrics.imageCache.hitRate * 100).toFixed(1)}%`,
        size: `${metrics.imageCache.totalSize / 1024 / 1024}MB`,
        entries: metrics.imageCache.entryCount
      },
      postCache: {
        hitRate: `${(metrics.postCache.hitRate * 100).toFixed(1)}%`,
        size: `${metrics.postCache.totalSize / 1024 / 1024}MB`,
        entries: metrics.postCache.entryCount
      },
      userCache: {
        hitRate: `${(metrics.userCache.hitRate * 100).toFixed(1)}%`,
        size: `${metrics.userCache.totalSize / 1024 / 1024}MB`,
        entries: metrics.userCache.entryCount
      },
      notificationCache: {
        hitRate: `${(metrics.notificationCache.hitRate * 100).toFixed(1)}%`,
        size: `${metrics.notificationCache.totalSize / 1024 / 1024}MB`,
        entries: metrics.notificationCache.entryCount
      }
    });
  }
};
