/**
 * In-memory rate limiter for DDoS protection
 * Uses sliding window algorithm to track requests per IP
 * 
 * Note: This is suitable for single-server deployments.
 * For multi-instance deployments, use a distributed store like Redis.
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Cleanup interval for stale entries (ms) */
  cleanupIntervalMs?: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: Required<RateLimiterConfig>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      cleanupIntervalMs: config.cleanupIntervalMs || 60000, // Default 1 minute cleanup
    };

    // Start cleanup interval to prevent memory leaks
    this.startCleanup();
  }

  private startCleanup() {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = now - this.config.windowMs * 2;
      
      for (const [key, entry] of this.store.entries()) {
        if (entry.lastRefill < staleThreshold) {
          this.store.delete(key);
        }
      }
    }, this.config.cleanupIntervalMs);

    // Don't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Check if a request should be allowed
   * @param identifier - Unique identifier (usually IP address)
   * @returns Object with allowed status and remaining tokens
   */
  check(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry) {
      // First request from this identifier
      this.store.set(identifier, {
        tokens: this.config.maxRequests - 1,
        lastRefill: now,
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetIn: this.config.windowMs,
      };
    }

    // Calculate token refill based on time passed
    const timePassed = now - entry.lastRefill;
    const tokensToAdd = Math.floor(
      (timePassed / this.config.windowMs) * this.config.maxRequests
    );

    // Refill tokens (capped at max)
    const newTokens = Math.min(
      this.config.maxRequests,
      entry.tokens + tokensToAdd
    );

    if (newTokens < 1) {
      // Rate limited
      const resetIn = Math.ceil(
        ((1 - entry.tokens) / this.config.maxRequests) * this.config.windowMs -
          timePassed
      );
      return {
        allowed: false,
        remaining: 0,
        resetIn: Math.max(0, resetIn),
      };
    }

    // Allow request and consume a token
    this.store.set(identifier, {
      tokens: newTokens - 1,
      lastRefill: now,
    });

    return {
      allowed: true,
      remaining: newTokens - 1,
      resetIn: this.config.windowMs,
    };
  }

  /**
   * Get current store size (for monitoring)
   */
  getStoreSize(): number {
    return this.store.size;
  }

  /**
   * Clear all entries (for testing)
   */
  clear() {
    this.store.clear();
  }

  /**
   * Stop the cleanup interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global rate limiter instances with different limits for different routes

// General API rate limiter: 100 requests per minute per IP
export const apiRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
});

// Strict rate limiter for sensitive endpoints: 10 requests per minute per IP
export const strictRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
});

// Chat/AI endpoints: 20 requests per minute per IP
export const chatRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000, // 1 minute
});

// Page views: 200 requests per minute per IP (more lenient for browsing)
export const pageRateLimiter = new RateLimiter({
  maxRequests: 200,
  windowMs: 60 * 1000, // 1 minute
});

export { RateLimiter };
export type { RateLimiterConfig };

