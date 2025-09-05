/**
 * Enhanced DEX Comparison Service
 * Adds dynamic pricing support to the existing DEX comparison workflow
 * Integrates with DynamicTokenPairService for real-time sellAmount calculations
 */

import { ethers } from 'ethers';
import CoinGeckoPoolService, { type PoolInfo } from './coinGeckoPoolService';
import HardcodedPoolService from './hardcodedPoolService';
import OnChainQuoteService, { type SwapSimulation, type OnChainQuote } from './onChainQuoteService';
import { dynamicTokenPairService, type DynamicTokenPair } from '../config/dynamicTokenPairs';
import type { TokenPair } from '../types/api';
import { logger } from './logger';

export interface EnhancedDexComparisonResult {
  pair: DynamicTokenPair; // Enhanced with pricing info
  timestamp: number;
  inputAmountUSD: number;
  totalPoolsFound: number;
  successfulQuotes: number;
  simulation: SwapSimulation;
  bestProtocol: string | null;
  protocolSummary: ProtocolSummary[];
  pricingInfo: {
    sellAmountUsed: string;
    priceUsed: number | undefined;
    priceSource: 'live' | 'fallback' | undefined;
    lastPriceUpdate: string;
  };
}

export interface ProtocolSummary {
  protocol: string;
  poolCount: number;
  bestRank: number | null;
  avgRank: number | null;
  bestQuote: OnChainQuote | null;
}

class EnhancedDexComparisonService {
  private poolService: CoinGeckoPoolService;
  private hardcodedPoolService: HardcodedPoolService;
  private quoteService: OnChainQuoteService;
  private ALCHEMY_URL = 'https://eth-mainnet.g.alchemy.com/v2/QVvswhgDKgK5Xuf3Jkb1M';

  constructor() {
    this.poolService = new CoinGeckoPoolService();
    this.hardcodedPoolService = new HardcodedPoolService();
    this.quoteService = new OnChainQuoteService(this.ALCHEMY_URL);
  }

  /**
   * Enhanced DEX comparison using dynamic pricing
   */
  async compareTokenPairWithDynamicPricing(pairId: string): Promise<EnhancedDexComparisonResult> {
    logger.info('EnhancedDexComparisonService', `Starting enhanced DEX comparison for pair: ${pairId}`);
    
    const startTime = Date.now();
    
    try {
      // Step 1: Get dynamic token pair with calculated sellAmount
      const dynamicPair = await dynamicTokenPairService.getTokenPair(pairId);
      
      if (!dynamicPair) {
        throw new Error(`Token pair ${pairId} not found`);
      }

      logger.info('EnhancedDexComparisonService', 
        `Using dynamic sellAmount: ${ethers.formatUnits(dynamicPair.sellAmount, dynamicPair.sellToken.decimals)} ${dynamicPair.sellToken.symbol} ` +
        `(price: $${dynamicPair.priceUsed}, source: ${dynamicPair.priceSource})`
      );

      // Step 2: Discover pools - use hardcoded first, fallback to CoinGecko
      logger.info('EnhancedDexComparisonService', `Step 1: Discovering pools for ${dynamicPair.name}`);
      
      let pools: PoolInfo[] = [];
      
      // First try hardcoded pools for faster response
      pools = this.hardcodedPoolService.getPoolsForPair(dynamicPair);
      
      if (pools.length === 0) {
        logger.info('EnhancedDexComparisonService', `No hardcoded pools for ${dynamicPair.name}, falling back to CoinGecko API`);
        pools = await this.poolService.findPoolsForPair(dynamicPair);
        
        if (pools.length === 0) {
          logger.warn('EnhancedDexComparisonService', `No pools found for ${dynamicPair.name} in either hardcoded or CoinGecko`);
          return this.createEmptyResult(dynamicPair, startTime);
        }
      } else {
        logger.info('EnhancedDexComparisonService', `Using ${pools.length} hardcoded pools for ${dynamicPair.name} (API calls avoided)`);
      }

      logger.info('EnhancedDexComparisonService', `Found ${pools.length} pools across ${this.countProtocols(pools)} protocols`);
      
      // Step 3: Simulate swaps on-chain using dynamic sellAmount
      const sellAmountBigInt = BigInt(dynamicPair.sellAmount);
      const sellAmountFormatted = ethers.formatUnits(sellAmountBigInt, dynamicPair.sellToken.decimals);
      logger.info('EnhancedDexComparisonService', `Step 2: Simulating ${sellAmountFormatted} ${dynamicPair.sellToken.symbol} swaps`);
      
      const simulation = await this.quoteService.simulateSwapsWithAmount(pools, sellAmountBigInt, dynamicPair);
      
      const successfulQuotes = simulation.quotes.filter(q => q.success).length;
      logger.info('EnhancedDexComparisonService', `Successfully quoted ${successfulQuotes}/${pools.length} pools`);
      
      // Step 4: Generate protocol summary
      const protocolSummary = this.generateProtocolSummary(simulation);
      const bestProtocol = protocolSummary.length > 0 ? protocolSummary[0].protocol : null;
      
      const result: EnhancedDexComparisonResult = {
        pair: dynamicPair,
        timestamp: startTime,
        inputAmountUSD: dynamicPair.targetUSD,
        totalPoolsFound: pools.length,
        successfulQuotes,
        simulation,
        bestProtocol,
        protocolSummary,
        pricingInfo: {
          sellAmountUsed: dynamicPair.sellAmount,
          priceUsed: dynamicPair.priceUsed,
          priceSource: dynamicPair.priceSource,
          lastPriceUpdate: dynamicPair.lastUpdated ? new Date(dynamicPair.lastUpdated).toISOString() : 'unknown'
        }
      };

      const duration = Date.now() - startTime;
      logger.info('EnhancedDexComparisonService', 
        `Enhanced comparison completed for ${dynamicPair.name}: ${successfulQuotes} quotes in ${duration}ms`
      );

      return result;

    } catch (error) {
      logger.error('EnhancedDexComparisonService', `Enhanced comparison failed for ${pairId}:`, error);
      
      // Try to get fallback pair for error result
      const fallbackPair = await this.getFallbackPair(pairId);
      return this.createEmptyResult(fallbackPair, startTime);
    }
  }

  /**
   * Compare all token pairs with dynamic pricing
   */
  async compareAllPairsWithDynamicPricing(): Promise<Map<string, EnhancedDexComparisonResult>> {
    logger.info('EnhancedDexComparisonService', 'Starting enhanced comparison for all token pairs');
    
    const results = new Map<string, EnhancedDexComparisonResult>();
    const dynamicPairs = await dynamicTokenPairService.getDynamicTokenPairs();
    
    for (const pair of dynamicPairs) {
      try {
        logger.info('EnhancedDexComparisonService', `Processing ${pair.name}...`);
        const result = await this.compareTokenPairWithDynamicPricing(pair.id);
        results.set(pair.id, result);
        
        // Delay between pairs to be respectful to RPC endpoints
        if (pair.id !== dynamicPairs[dynamicPairs.length - 1].id) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logger.error('EnhancedDexComparisonService', `Failed to process ${pair.name}:`, error);
        results.set(pair.id, this.createEmptyResult(pair, Date.now()));
      }
    }
    
    logger.info('EnhancedDexComparisonService', `Completed enhanced comparison for ${results.size} pairs`);
    return results;
  }

  /**
   * Backward compatibility: Compare using original TokenPair interface
   */
  async compareTokenPair(tokenPair: TokenPair, inputAmountUSD: number = 10000): Promise<EnhancedDexComparisonResult> {
    // Convert to dynamic pair format
    const dynamicPair: DynamicTokenPair = {
      ...tokenPair,
      targetUSD: inputAmountUSD,
      lastUpdated: Date.now(),
      priceSource: 'fallback' // Since we're using hardcoded sellAmount
    };

    // Use existing comparison logic but with enhanced result format
    return this.compareTokenPairDirect(dynamicPair);
  }

  /**
   * Direct comparison using provided dynamic pair
   */
  private async compareTokenPairDirect(dynamicPair: DynamicTokenPair): Promise<EnhancedDexComparisonResult> {
    const startTime = Date.now();
    
    try {
      // Discover pools
      let pools: PoolInfo[] = this.hardcodedPoolService.getPoolsForPair(dynamicPair);
      
      if (pools.length === 0) {
        pools = await this.poolService.findPoolsForPair(dynamicPair);
      }

      if (pools.length === 0) {
        return this.createEmptyResult(dynamicPair, startTime);
      }

      // Simulate swaps
      const sellAmountBigInt = BigInt(dynamicPair.sellAmount);
      const simulation = await this.quoteService.simulateSwapsWithAmount(pools, sellAmountBigInt, dynamicPair);
      
      // Generate summary
      const protocolSummary = this.generateProtocolSummary(simulation);
      const bestProtocol = protocolSummary.length > 0 ? protocolSummary[0].protocol : null;
      
      return {
        pair: dynamicPair,
        timestamp: startTime,
        inputAmountUSD: dynamicPair.targetUSD,
        totalPoolsFound: pools.length,
        successfulQuotes: simulation.quotes.filter(q => q.success).length,
        simulation,
        bestProtocol,
        protocolSummary,
        pricingInfo: {
          sellAmountUsed: dynamicPair.sellAmount,
          priceUsed: dynamicPair.priceUsed,
          priceSource: dynamicPair.priceSource,
          lastPriceUpdate: dynamicPair.lastUpdated ? new Date(dynamicPair.lastUpdated).toISOString() : 'unknown'
        }
      };

    } catch (error) {
      logger.error('EnhancedDexComparisonService', `Direct comparison failed for ${dynamicPair.name}:`, error);
      return this.createEmptyResult(dynamicPair, startTime);
    }
  }

  /**
   * Get fallback pair for error scenarios
   */
  private async getFallbackPair(pairId: string): Promise<DynamicTokenPair> {
    const fallbackPairs = dynamicTokenPairService.getFallbackTokenPairs();
    const fallbackPair = fallbackPairs.find(p => p.id === pairId);
    
    if (!fallbackPair) {
      throw new Error(`No fallback pair found for ${pairId}`);
    }

    return {
      ...fallbackPair,
      targetUSD: 10000,
      lastUpdated: Date.now(),
      priceSource: 'fallback'
    };
  }

  /**
   * Create empty result for error scenarios
   */
  private createEmptyResult(pair: DynamicTokenPair, startTime: number): EnhancedDexComparisonResult {
    return {
      pair,
      timestamp: startTime,
      inputAmountUSD: pair.targetUSD,
      totalPoolsFound: 0,
      successfulQuotes: 0,
      simulation: {
        quotes: [],
        bestQuote: null,
        rankings: []
      },
      bestProtocol: null,
      protocolSummary: [],
      pricingInfo: {
        sellAmountUsed: pair.sellAmount,
        priceUsed: pair.priceUsed,
        priceSource: pair.priceSource,
        lastPriceUpdate: pair.lastUpdated ? new Date(pair.lastUpdated).toISOString() : 'unknown'
      }
    };
  }

  /**
   * Count unique protocols in pool list
   */
  private countProtocols(pools: PoolInfo[]): number {
    const protocols = new Set(pools.map(pool => pool.dex));
    return protocols.size;
  }

  /**
   * Generate protocol summary from simulation results
   */
  private generateProtocolSummary(simulation: SwapSimulation): ProtocolSummary[] {
    const protocolMap = new Map<string, {
      pools: OnChainQuote[],
      bestQuote: OnChainQuote | null,
      rankings: number[]
    }>();

    // Group quotes by protocol
    simulation.quotes.filter(q => q.success).forEach(quote => {
      const protocol = quote.pool.dex;
      if (!protocolMap.has(protocol)) {
        protocolMap.set(protocol, {
          pools: [],
          bestQuote: null,
          rankings: []
        });
      }
      
      const protocolData = protocolMap.get(protocol)!;
      protocolData.pools.push(quote);
    });

    // Find rankings and best quotes for each protocol
    simulation.rankings.forEach(ranking => {
      const protocol = ranking.pool.dex;
      const protocolData = protocolMap.get(protocol);
      
      if (protocolData) {
        protocolData.rankings.push(ranking.rank);
        if (!protocolData.bestQuote || ranking.rank === 1) {
          protocolData.bestQuote = ranking.quote;
        }
      }
    });

    // Generate summary
    const summary: ProtocolSummary[] = [];
    
    for (const [protocol, data] of protocolMap.entries()) {
      const rankings = data.rankings;
      summary.push({
        protocol,
        poolCount: data.pools.length,
        bestRank: rankings.length > 0 ? Math.min(...rankings) : null,
        avgRank: rankings.length > 0 ? Math.round(rankings.reduce((a, b) => a + b, 0) / rankings.length) : null,
        bestQuote: data.bestQuote
      });
    }

    // Sort by best rank (lower is better)
    return summary.sort((a, b) => {
      if (a.bestRank === null) return 1;
      if (b.bestRank === null) return -1;
      return a.bestRank - b.bestRank;
    });
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      pool_service: boolean;
      quote_service: boolean;
      dynamic_pricing: boolean;
    };
    pricing_stats: any;
  }> {
    const services = {
      pool_service: true, // Assume healthy for now
      quote_service: true, // Assume healthy for now  
      dynamic_pricing: false
    };

    try {
      const pricingStats = await dynamicTokenPairService.getStatus();
      services.dynamic_pricing = true;
      
      const status = Object.values(services).every(s => s) ? 'healthy' : 'degraded';
      
      return {
        status,
        services,
        pricing_stats: pricingStats
      };
    } catch (error) {
      logger.error('EnhancedDexComparisonService', 'Health check failed:', error);
      
      return {
        status: 'unhealthy',
        services,
        pricing_stats: null
      };
    }
  }
}

export default EnhancedDexComparisonService;