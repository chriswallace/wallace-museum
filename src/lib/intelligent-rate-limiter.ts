/**
 * Intelligent rate limiter for API calls with adaptive behavior
 * Features:
 * - Adaptive delays based on response patterns
 * - Exponential backoff for rate limits
 * - Batch processing support
 * - Real-time adjustment
 * - Global rate limit tracking
 */

interface RateLimitConfig {
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  maxRetries?: number;
  batchSize?: number;
  adaptiveThreshold?: number;
}

export interface APICallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts?: number;
  finalDelay?: number;
}

export class IntelligentRateLimiter {
  private baseDelay: number;
  private currentDelay: number;
  private maxDelay: number;
  private backoffMultiplier: number;
  private maxRetries: number;
  private consecutiveSuccesses: number = 0;
  private consecutiveFailures: number = 0;
  private responseTimeHistory: number[] = [];
  private readonly historySize = 10;
  private batchSize: number;
  private adaptiveThreshold: number;
  private lastCallTime: number = 0;
  
  // Global rate limit tracking
  private static globalRateLimitCount: number = 0;
  private static globalRateLimitResetTime: number = Date.now();
  private static readonly GLOBAL_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window

  constructor(config: RateLimitConfig = {}) {
    this.baseDelay = config.baseDelay || 1000;
    this.currentDelay = this.baseDelay;
    this.maxDelay = config.maxDelay || 10000;
    this.backoffMultiplier = config.backoffMultiplier || 1.5;
    this.maxRetries = config.maxRetries || 5;
    this.batchSize = config.batchSize || 10;
    this.adaptiveThreshold = config.adaptiveThreshold || 5;
  }

  /**
   * Execute a single API call with intelligent rate limiting
   */
  async executeCall<T>(
    apiCall: () => Promise<T>,
    context: string = 'API call'
  ): Promise<APICallResult<T>> {
    // Check global rate limit
    this.checkGlobalRateLimit();
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Wait before making the call
        await this.delay(this.currentDelay);
        
        console.log(`[IntelligentRateLimiter] Executing ${context} (attempt ${attempt}/${this.maxRetries})`);
        
        const startTime = Date.now();
        const result = await apiCall();
        const responseTime = Date.now() - startTime;
        
        // Update metrics on success
        this.updateMetrics(true, responseTime);
        
        return {
          success: true,
          data: result,
          attempts: attempt,
          finalDelay: this.currentDelay
        };
        
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          console.log(`[IntelligentRateLimiter] Rate limited on ${context}, attempt ${attempt}`);
          this.handleRateLimit();
          
          // More aggressive backoff for rate limits
          const backoffDelay = Math.min(
            this.currentDelay * Math.pow(this.backoffMultiplier, attempt),
            this.maxDelay
          );
          
          console.log(`[IntelligentRateLimiter] Waiting ${backoffDelay}ms before retry`);
          await this.delay(backoffDelay);
          
        } else {
          // For other errors, use normal backoff
          this.updateMetrics(false, 0);
          console.error(`[IntelligentRateLimiter] Error on ${context}, attempt ${attempt}:`, error);
          
          if (attempt < this.maxRetries) {
            await this.delay(this.currentDelay);
          }
        }
      }
    }
    
    return {
      success: false,
      error: lastError?.message || 'Max retries exceeded',
      attempts: this.maxRetries,
      finalDelay: this.currentDelay
    };
  }

  /**
   * Check and update global rate limit tracking
   */
  private checkGlobalRateLimit(): void {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - IntelligentRateLimiter.globalRateLimitResetTime > IntelligentRateLimiter.GLOBAL_RATE_LIMIT_WINDOW) {
      IntelligentRateLimiter.globalRateLimitCount = 0;
      IntelligentRateLimiter.globalRateLimitResetTime = now;
    }
    
    // If we've hit too many rate limits globally, add extra delay
    if (IntelligentRateLimiter.globalRateLimitCount > 10) {
      console.log(`[IntelligentRateLimiter] Global rate limit threshold reached (${IntelligentRateLimiter.globalRateLimitCount} in window)`);
      this.currentDelay = Math.min(this.currentDelay * 1.5, this.maxDelay); // Reduced from 2x to 1.5x
    }
  }

  /**
   * Handle rate limit by updating global counter and delays
   */
  private handleRateLimit(): void {
    IntelligentRateLimiter.globalRateLimitCount++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    
    // Increase delay using the configured backoff multiplier (removed aggressive doubling)
    this.currentDelay = Math.min(this.currentDelay * this.backoffMultiplier, this.maxDelay);
    
    console.log(`[IntelligentRateLimiter] Rate limit handled - global count: ${IntelligentRateLimiter.globalRateLimitCount}, new delay: ${this.currentDelay}ms`);
  }

  /**
   * Execute multiple API calls in intelligent batches
   */
  async executeBatch<T>(
    apiCalls: (() => Promise<T>)[],
    context: string = 'Batch API calls'
  ): Promise<APICallResult<T>[]> {
    const results: APICallResult<T>[] = [];
    
    console.log(`[IntelligentRateLimiter] Executing batch of ${apiCalls.length} calls in batches of ${this.batchSize}`);

    for (let i = 0; i < apiCalls.length; i += this.batchSize) {
      const batch = apiCalls.slice(i, i + this.batchSize);
      
      console.log(`[IntelligentRateLimiter] Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(apiCalls.length / this.batchSize)}`);

      // Execute batch sequentially with adaptive delays
      for (const call of batch) {
        const result = await this.executeCall(call, `${context} - call ${results.length + 1}`);
        results.push(result);
        
        // If we hit a rate limit, increase delays for subsequent calls
        if (!result.success && result.error?.includes('rate limit')) {
          console.log(`[IntelligentRateLimiter] Rate limit detected in batch, adjusting delays`);
          this.increaseDelay();
        }
      }

      // Add inter-batch delay if there are more batches
      if (i + this.batchSize < apiCalls.length) {
        const batchDelay = this.calculateBatchDelay();
        console.log(`[IntelligentRateLimiter] Waiting ${batchDelay}ms between batches`);
        await this.delay(batchDelay);
      }
    }

    return results;
  }

  /**
   * Wait for appropriate rate limit delay
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    if (timeSinceLastCall < this.currentDelay) {
      const waitTime = this.currentDelay - timeSinceLastCall;
      console.log(`[IntelligentRateLimiter] Waiting ${waitTime}ms for rate limit`);
      await this.delay(waitTime);
    }
    
    this.lastCallTime = Date.now();
  }

  /**
   * Record a successful API call and adapt delays
   */
  private recordSuccess(responseTime: number): void {
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.responseTimeHistory.push(responseTime);
    
    if (this.responseTimeHistory.length > this.historySize) {
      this.responseTimeHistory.shift();
    }

    // Decrease delay after consecutive successes
    if (this.consecutiveSuccesses >= this.adaptiveThreshold) {
      this.decreaseDelay();
      this.consecutiveSuccesses = 0;
    }
  }

  /**
   * Record a failed API call and adapt delays
   */
  private recordFailure(): void {
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;

    // Increase delay after consecutive failures
    if (this.consecutiveFailures >= this.adaptiveThreshold) {
      this.increaseDelay();
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Decrease delay when API is responsive
   */
  private decreaseDelay(): void {
    const newDelay = Math.max(
      this.baseDelay,
      this.currentDelay * 0.8
    );
    
    if (newDelay !== this.currentDelay) {
      console.log(`[IntelligentRateLimiter] Decreasing delay from ${this.currentDelay}ms to ${newDelay}ms`);
      this.currentDelay = newDelay;
    }
  }

  /**
   * Increase delay when hitting rate limits
   */
  private increaseDelay(): void {
    const newDelay = Math.min(
      this.maxDelay,
      this.currentDelay * this.backoffMultiplier
    );
    
    if (newDelay !== this.currentDelay) {
      console.log(`[IntelligentRateLimiter] Increasing delay from ${this.currentDelay}ms to ${newDelay}ms`);
      this.currentDelay = newDelay;
    }
  }

  /**
   * Calculate delay between batches based on recent performance
   */
  private calculateBatchDelay(): number {
    if (this.responseTimeHistory.length === 0) {
      return this.currentDelay * 1.2; // Modest 20% increase instead of doubling
    }

    const avgResponseTime = this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length;
    
    // Moderate delays for slower responses - less aggressive than before
    if (avgResponseTime > 2000) {
      return this.currentDelay * 1.5; // Reduced from 3x to 1.5x
    } else if (avgResponseTime > 1000) {
      return this.currentDelay * 1.2; // Reduced from 2x to 1.2x
    } else {
      return this.currentDelay; // No change for fast responses
    }
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    if (error?.status === 429) return true;
    if (error?.message?.includes('429')) return true;
    if (error?.message?.toLowerCase().includes('rate limit')) return true;
    if (error?.message?.toLowerCase().includes('too many requests')) return true;
    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limiter stats
   */
  getStats(): {
    currentDelay: number;
    consecutiveSuccesses: number;
    consecutiveFailures: number;
    avgResponseTime: number;
  } {
    const avgResponseTime = this.responseTimeHistory.length > 0
      ? this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length
      : 0;

    return {
      currentDelay: this.currentDelay,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      avgResponseTime
    };
  }

  /**
   * Update metrics based on the result of an API call
   */
  private updateMetrics(success: boolean, responseTime: number): void {
    if (success) {
      this.recordSuccess(responseTime);
    } else {
      this.recordFailure();
    }
  }
} 