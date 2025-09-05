/**
 * Logging Service
 * Provides detailed error logging throughout the application
 */

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
} as const;

export type LogLevel = 0 | 1 | 2 | 3;

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: any;
  error?: Error;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory
  private minLevel: LogLevel = LogLevel.INFO; // Only log INFO and above by default

  constructor(minLevel?: LogLevel) {
    if (minLevel !== undefined) {
      this.minLevel = minLevel;
    }
  }

  private createLogEntry(level: LogLevel, service: string, message: string, data?: any, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      data,
      error
    };
  }

  private addLog(entry: LogEntry) {
    if (entry.level >= this.minLevel) {
      this.logs.push(entry);
      
      // Keep only the last N logs to prevent memory bloat
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }
      
      // Always console log for debugging
      this.consoleLog(entry);
    }
  }

  private consoleLog(entry: LogEntry) {
    const levelName = Object.entries(LogLevel).find(([, val]) => val === entry.level)?.[0] || 'UNKNOWN';
    const prefix = `[${entry.timestamp}] [${levelName}] [${entry.service}]`;
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`🔍 ${prefix} ${entry.message}`, entry.data);
        break;
      case LogLevel.INFO:
        console.info(`ℹ️ ${prefix} ${entry.message}`, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${prefix} ${entry.message}`, entry.data || '');
        break;
      case LogLevel.ERROR:
        console.error(`❌ ${prefix} ${entry.message}`, entry.error || entry.data || '');
        if (entry.error?.stack) {
          console.error('Stack trace:', entry.error.stack);
        }
        break;
    }
  }

  debug(service: string, message: string, data?: any) {
    this.addLog(this.createLogEntry(LogLevel.DEBUG, service, message, data));
  }

  info(service: string, message: string, data?: any) {
    this.addLog(this.createLogEntry(LogLevel.INFO, service, message, data));
  }

  warn(service: string, message: string, data?: any) {
    this.addLog(this.createLogEntry(LogLevel.WARN, service, message, data));
  }

  error(service: string, message: string, error?: Error | any, data?: any) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.addLog(this.createLogEntry(LogLevel.ERROR, service, message, data, errorObj));
  }

  // Get recent logs for debugging
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Get logs by service
  getLogsByService(service: string, count: number = 50): LogEntry[] {
    return this.logs
      .filter(log => log.service === service)
      .slice(-count);
  }

  // Get error logs only
  getErrorLogs(count: number = 50): LogEntry[] {
    return this.logs
      .filter(log => log.level === LogLevel.ERROR)
      .slice(-count);
  }

  // Clear all logs
  clearLogs() {
    this.logs = [];
    this.info('Logger', 'Logs cleared');
  }

  // Get log summary
  getLogSummary(): {
    total: number;
    byLevel: Record<string, number>;
    byService: Record<string, number>;
    recentErrors: LogEntry[];
  } {
    const byLevel: Record<string, number> = {};
    const byService: Record<string, number> = {};

    this.logs.forEach(log => {
      const levelName = Object.entries(LogLevel).find(([, val]) => val === log.level)?.[0] || 'UNKNOWN';
      byLevel[levelName] = (byLevel[levelName] || 0) + 1;
      byService[log.service] = (byService[log.service] || 0) + 1;
    });

    return {
      total: this.logs.length,
      byLevel,
      byService,
      recentErrors: this.getErrorLogs(10)
    };
  }
}

// Global logger instance
export const logger = new Logger(LogLevel.INFO);

// Helper functions for common patterns
export const logApiCall = (service: string, endpoint: string, method: string = 'GET') => {
  logger.info(service, `API call: ${method} ${endpoint}`);
};

export const logApiSuccess = (service: string, endpoint: string, duration: number, resultCount?: number) => {
  const message = `API success: ${endpoint} (${duration}ms)`;
  const data = resultCount !== undefined ? { resultCount } : undefined;
  logger.info(service, message, data);
};

export const logApiError = (service: string, endpoint: string, error: any, duration?: number) => {
  const message = `API error: ${endpoint}${duration ? ` (${duration}ms)` : ''}`;
  logger.error(service, message, error);
};

export const logPoolDiscovery = (service: string, pairName: string, poolsFound: number) => {
  logger.info(service, `Pool discovery: ${pairName} - found ${poolsFound} pools`);
};

export const logQuoteAttempt = (service: string, poolAddress: string, dex: string) => {
  logger.debug(service, `Quote attempt: ${dex} pool ${poolAddress}`);
};

export const logQuoteSuccess = (service: string, poolAddress: string, dex: string, outputAmount: string) => {
  logger.info(service, `Quote success: ${dex} pool ${poolAddress}`, { outputAmount });
};

export const logQuoteError = (service: string, poolAddress: string, dex: string, error: any) => {
  logger.warn(service, `Quote failed: ${dex} pool ${poolAddress}`, error);
};

export default logger;