// Enhanced Fluid DEX Quote Logging System

export interface FluidQuoteMetrics {
  method: 'direct_simulation' | 'live_price_calculation' | 'estimation_fallback';
  timestamp: number;
  inputAmount: string;
  outputAmount: string;
  exchangeRate: number;
  executionTime: number;
  priceData?: {
    centerPrice: string;
    upperRange: string;
    lowerRange: string;
    geometricMean: string;
  };
  errors?: string[];
}

export class FluidQuoteLogger {
  private static logs: FluidQuoteMetrics[] = [];
  private static readonly MAX_LOGS = 100;

  static logQuote(metrics: FluidQuoteMetrics): void {
    // Add timestamp
    metrics.timestamp = Date.now();
    
    // Store in memory (could be enhanced with localStorage or IndexedDB)
    this.logs.unshift(metrics);
    
    // Keep only last 100 entries
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS);
    }

    // Console logging with method indicator
    const methodEmoji = {
      'direct_simulation': '🎯',
      'live_price_calculation': '📊', 
      'estimation_fallback': '⚠️'
    };

    console.log(`${methodEmoji[metrics.method]} Fluid Quote [${metrics.method.toUpperCase()}]`);
    console.log(`  Input: ${metrics.inputAmount} USDe`);
    console.log(`  Output: ${metrics.outputAmount} USDT`);
    console.log(`  Rate: ${metrics.exchangeRate.toFixed(6)} USDT/USDe`);
    console.log(`  Time: ${metrics.executionTime}ms`);
    
    if (metrics.errors?.length) {
      console.log(`  Errors: ${metrics.errors.join(', ')}`);
    }
  }

  static getRecentLogs(count: number = 10): FluidQuoteMetrics[] {
    return this.logs.slice(0, count);
  }

  static getMethodStats(): Record<string, number> {
    const stats = {
      direct_simulation: 0,
      live_price_calculation: 0,
      estimation_fallback: 0
    };

    this.logs.forEach(log => {
      stats[log.method]++;
    });

    return stats;
  }

  // Expose logs globally for debugging
  static exposeGlobally(): void {
    (window as any).fluidQuoteLogs = {
      getLogs: () => this.logs,
      getStats: () => this.getMethodStats(),
      clearLogs: () => { this.logs = []; }
    };
  }
}

// Auto-expose in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  FluidQuoteLogger.exposeGlobally();
}