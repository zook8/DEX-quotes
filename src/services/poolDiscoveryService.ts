/**
 * Pool Discovery Service
 * Background service for periodically updating pool addresses
 * Runs daily/weekly to refresh hardcoded pool registry from CoinGecko
 */

import CoinGeckoPoolService, { type PoolInfo } from './coinGeckoPoolService';
import HardcodedPoolService from './hardcodedPoolService';
import { TOKEN_PAIRS } from '../config/tokenPairs';
import { logger } from './logger';

export interface PoolDiscoveryResult {
  timestamp: number;
  pairsProcessed: number;
  newPoolsFound: number;
  totalPoolsAfterUpdate: number;
  errors: string[];
  duration: number;
}

export interface PoolDiscoverySchedule {
  enabled: boolean;
  intervalHours: number; // Default: 120 hours (5 days)
  lastRun: Date | null;
  nextRun: Date | null;
}

class PoolDiscoveryService {
  private coinGeckoService: CoinGeckoPoolService;
  private hardcodedService: HardcodedPoolService;
  private isRunning = false;
  private schedule: PoolDiscoverySchedule = {
    enabled: true,
    intervalHours: 120, // 5 days as requested by user
    lastRun: null,
    nextRun: null
  };

  constructor() {
    this.coinGeckoService = new CoinGeckoPoolService();
    this.hardcodedService = new HardcodedPoolService();
    
    // Set initial next run time
    this.updateNextRunTime();
    
    logger.info('PoolDiscoveryService', 'Pool discovery service initialized', {
      intervalHours: this.schedule.intervalHours,
      nextRun: this.schedule.nextRun
    });
  }

  /**
   * Run pool discovery for all configured token pairs
   */
  async runDiscovery(force: boolean = false): Promise<PoolDiscoveryResult> {
    if (this.isRunning && !force) {
      throw new Error('Pool discovery is already running. Use force=true to override.');
    }

    if (!force && !this.shouldRun()) {
      throw new Error(`Next scheduled run: ${this.schedule.nextRun}. Use force=true to run immediately.`);
    }

    logger.info('PoolDiscoveryService', `Starting pool discovery for ${TOKEN_PAIRS.length} token pairs`);
    
    const startTime = Date.now();
    const result: PoolDiscoveryResult = {
      timestamp: startTime,
      pairsProcessed: 0,
      newPoolsFound: 0,
      totalPoolsAfterUpdate: 0,
      errors: [],
      duration: 0
    };

    this.isRunning = true;

    try {
      const discoveredPools: Record<string, PoolInfo[]> = {};
      const existingPools = this.hardcodedService.getAllPools();

      // Process each token pair
      for (const pair of TOKEN_PAIRS) {
        try {
          logger.info('PoolDiscoveryService', `Discovering pools for ${pair.name}`);
          
          const pools = await this.coinGeckoService.findPoolsForPair(pair);
          discoveredPools[pair.id] = pools;
          result.pairsProcessed++;

          // Compare with existing pools to find new ones
          const existingPoolAddresses = new Set(
            (existingPools[pair.id] || []).map(p => p.address.toLowerCase())
          );
          
          const newPools = pools.filter(p => 
            !existingPoolAddresses.has(p.address.toLowerCase())
          );
          
          if (newPools.length > 0) {
            logger.info('PoolDiscoveryService', `Found ${newPools.length} new pools for ${pair.name}`, {
              newPools: newPools.map(p => ({ address: p.address, dex: p.dex, name: p.name }))
            });
            result.newPoolsFound += newPools.length;
          }

          // Add delay between pairs to avoid rate limiting
          if (TOKEN_PAIRS.indexOf(pair) < TOKEN_PAIRS.length - 1) {
            logger.debug('PoolDiscoveryService', 'Waiting 5s before next pair...');
            await new Promise(resolve => setTimeout(resolve, 5000));
          }

        } catch (error) {
          const errorMsg = `Failed to discover pools for ${pair.name}: ${error instanceof Error ? error.message : String(error)}`;
          logger.error('PoolDiscoveryService', errorMsg, error);
          result.errors.push(errorMsg);
        }
      }

      // Calculate total pools after update
      result.totalPoolsAfterUpdate = Object.values(discoveredPools)
        .reduce((total, pools) => total + pools.length, 0);

      // Update schedule
      this.schedule.lastRun = new Date();
      this.updateNextRunTime();

      const duration = Date.now() - startTime;
      result.duration = duration;

      logger.info('PoolDiscoveryService', 'Pool discovery completed', {
        duration: `${(duration / 1000).toFixed(2)}s`,
        pairsProcessed: result.pairsProcessed,
        newPoolsFound: result.newPoolsFound,
        errors: result.errors.length
      });

      return result;

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if pool discovery should run based on schedule
   */
  shouldRun(): boolean {
    if (!this.schedule.enabled) {
      return false;
    }

    if (!this.schedule.lastRun || !this.schedule.nextRun) {
      return true; // First run
    }

    return new Date() >= this.schedule.nextRun;
  }

  /**
   * Get current discovery schedule
   */
  getSchedule(): PoolDiscoverySchedule {
    return { ...this.schedule };
  }

  /**
   * Update discovery schedule
   */
  updateSchedule(updates: Partial<PoolDiscoverySchedule>): void {
    this.schedule = { ...this.schedule, ...updates };
    this.updateNextRunTime();
    
    logger.info('PoolDiscoveryService', 'Pool discovery schedule updated', this.schedule);
  }

  /**
   * Get discovery status and next run information
   */
  getStatus(): {
    isRunning: boolean;
    schedule: PoolDiscoverySchedule;
    shouldRun: boolean;
    timeUntilNextRun: number | null; // milliseconds
    hardcodedRegistryInfo: ReturnType<HardcodedPoolService['getRegistryInfo']>;
  } {
    const timeUntilNextRun = this.schedule.nextRun 
      ? Math.max(0, this.schedule.nextRun.getTime() - Date.now())
      : null;

    return {
      isRunning: this.isRunning,
      schedule: { ...this.schedule },
      shouldRun: this.shouldRun(),
      timeUntilNextRun,
      hardcodedRegistryInfo: this.hardcodedService.getRegistryInfo()
    };
  }

  /**
   * Manual trigger for pool discovery (bypasses schedule)
   */
  async triggerManualDiscovery(): Promise<PoolDiscoveryResult> {
    logger.info('PoolDiscoveryService', 'Manual pool discovery triggered');
    return this.runDiscovery(true);
  }

  /**
   * Start automatic scheduled discovery
   * Sets up periodic execution based on schedule
   */
  startScheduledDiscovery(): void {
    if (!this.schedule.enabled) {
      logger.warn('PoolDiscoveryService', 'Scheduled discovery is disabled');
      return;
    }

    const checkInterval = 60 * 60 * 1000; // Check every hour
    
    setInterval(async () => {
      if (this.shouldRun() && !this.isRunning) {
        try {
          logger.info('PoolDiscoveryService', 'Running scheduled pool discovery');
          await this.runDiscovery();
        } catch (error) {
          logger.error('PoolDiscoveryService', 'Scheduled pool discovery failed', error);
        }
      }
    }, checkInterval);

    logger.info('PoolDiscoveryService', 'Scheduled pool discovery started', {
      checkIntervalHours: checkInterval / (60 * 60 * 1000),
      nextRun: this.schedule.nextRun
    });
  }

  /**
   * Get discovery statistics and recommendations
   */
  getDiscoveryInsights(): {
    registryStats: ReturnType<HardcodedPoolService['getPoolStats']>;
    recommendations: string[];
    healthScore: number; // 0-100
  } {
    const stats = this.hardcodedService.getPoolStats();
    const recommendations: string[] = [];
    let healthScore = 100;

    // Analyze pool distribution
    const dexCount = Object.keys(stats.poolsByDex).length;
    if (dexCount < 3) {
      recommendations.push(`Consider adding more DEX protocols (currently ${dexCount})`);
      healthScore -= 10;
    }

    // Analyze liquidity
    if (stats.avgLiquidity < 50000000) { // $50M avg
      recommendations.push('Consider focusing on higher liquidity pools');
      healthScore -= 15;
    }

    // Check if discovery is needed
    if (this.hardcodedService.needsUpdate()) {
      recommendations.push('Pool registry needs updating - run discovery soon');
      healthScore -= 20;
    }

    // Check schedule health
    if (!this.schedule.enabled) {
      recommendations.push('Automated pool discovery is disabled');
      healthScore -= 25;
    }

    if (recommendations.length === 0) {
      recommendations.push('Pool registry is healthy and up-to-date');
    }

    return {
      registryStats: stats,
      recommendations,
      healthScore: Math.max(0, healthScore)
    };
  }

  /**
   * Update next run time based on current schedule
   */
  private updateNextRunTime(): void {
    if (!this.schedule.enabled) {
      this.schedule.nextRun = null;
      return;
    }

    const baseTime = this.schedule.lastRun || new Date();
    this.schedule.nextRun = new Date(
      baseTime.getTime() + (this.schedule.intervalHours * 60 * 60 * 1000)
    );
  }
}

export default PoolDiscoveryService;