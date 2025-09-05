/**
 * Rate Limiter for Alchemy RPC calls
 * Implements exponential backoff and request pooling
 */

export class AlchemyRateLimiter {
  private requestQueue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly maxRequestsPerSecond = 5; // Conservative limit
  private readonly windowMs = 1000;
  private retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.executeWithRetry(fn);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      // Rate limiting check
      const now = Date.now();
      if (now - this.windowStart >= this.windowMs) {
        this.requestCount = 0;
        this.windowStart = now;
      }
      
      if (this.requestCount >= this.maxRequestsPerSecond) {
        const waitTime = this.windowMs - (now - this.windowStart);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      const request = this.requestQueue.shift()!;
      this.requestCount++;
      
      try {
        await request();
      } catch (error) {
        console.error('Rate limiter execution error:', error);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    this.processing = false;
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      // Check if it's a 429 error
      if (error?.status === 429 || error?.code === 'RATE_LIMIT_EXCEEDED') {
        if (attempt < this.retryDelays.length) {
          const delay = this.retryDelays[attempt];
          console.warn(`🔄 Alchemy rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeWithRetry(fn, attempt + 1);
        }
      }
      throw error;
    }
  }
}

// Global rate limiter instance
export const alchemyRateLimiter = new AlchemyRateLimiter();