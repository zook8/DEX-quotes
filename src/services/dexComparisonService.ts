/**
 * DEX Comparison Service
 * Orchestrates the entire pool discovery -> quote simulation -> ranking pipeline
 * Replaces the 0x API with direct on-chain data
 */

import { ethers } from 'ethers';
import CoinGeckoPoolService, { type PoolInfo } from './coinGeckoPoolService';
import HardcodedPoolService from './hardcodedPoolService';
import OnChainQuoteService, { type SwapSimulation, type OnChainQuote, type PoolRanking } from './onChainQuoteService';
import type { TokenPair } from '../types/api';
import { alchemyRateLimiter } from '../utils/rateLimiter';
import { logger } from './logger';

export interface DexComparisonResult {
  pair: TokenPair;
  timestamp: number;
  inputAmountUSD: number;
  totalPoolsFound: number;
  successfulQuotes: number;
  simulation: SwapSimulation;
  bestProtocol: string | null;
  protocolSummary: ProtocolSummary[];
}

export interface ProtocolSummary {
  protocol: string;
  poolCount: number;
  bestRank: number | null;
  avgRank: number | null;
  bestQuote: OnChainQuote | null;
}

class DexComparisonService {
  private poolService: CoinGeckoPoolService;
  private hardcodedPoolService: HardcodedPoolService;
  private quoteService: OnChainQuoteService;
  private ALCHEMY_URL = `https://eth-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY || 'YOUR_ALCHEMY_API_KEY_HERE'}`;

  constructor() {
    this.poolService = new CoinGeckoPoolService();
    this.hardcodedPoolService = new HardcodedPoolService();
    this.quoteService = new OnChainQuoteService(this.ALCHEMY_URL);
  }

  /**
   * Complete DEX comparison for a single token pair
   * This replaces our previous 0x API integration
   */
  async compareTokenPair(tokenPair: TokenPair, inputAmountUSD: number = 10000): Promise<DexComparisonResult> {
    logger.info('DexComparisonService', `Starting DEX comparison for ${tokenPair.name} with $${inputAmountUSD.toLocaleString()}`);
    
    const startTime = Date.now();
    
    try {
      // Step 1: Discover pools - use hardcoded first, fallback to CoinGecko
      logger.info('DexComparisonService', `Step 1: Discovering pools for ${tokenPair.name}`);
      
      let pools: PoolInfo[] = [];
      
      // First try hardcoded pools for faster response
      pools = this.hardcodedPoolService.getPoolsForPair(tokenPair);
      
      if (pools.length === 0) {
        logger.info('DexComparisonService', `No hardcoded pools for ${tokenPair.name}, falling back to CoinGecko API`);
        pools = await this.poolService.findPoolsForPair(tokenPair);
        
        if (pools.length === 0) {
          logger.warn('DexComparisonService', `No pools found for ${tokenPair.name} in either hardcoded or CoinGecko`);
          return this.createEmptyResult(tokenPair, inputAmountUSD, startTime);
        }
      } else {
        logger.info('DexComparisonService', `Using ${pools.length} hardcoded pools for ${tokenPair.name} (API calls avoided)`);
      }

      logger.info('DexComparisonService', `Found ${pools.length} pools across ${this.countProtocols(pools)} protocols`);
      
      // Step 2: Simulate swaps on-chain - use token pair's configured sellAmount
      const sellAmountBigInt = BigInt(tokenPair.sellAmount);
      const sellAmountFormatted = ethers.formatUnits(sellAmountBigInt, tokenPair.sellToken.decimals);
      logger.info('DexComparisonService', `Step 2: Simulating ${sellAmountFormatted} ${tokenPair.sellToken.symbol} swaps`);
      const simulation = await this.quoteService.simulateSwapsWithAmount(pools, sellAmountBigInt, tokenPair);
      
      const successfulQuotes = simulation.quotes.filter(q => q.success).length;
      logger.info('DexComparisonService', `Successfully quoted ${successfulQuotes}/${pools.length} pools`);
      
      // Step 3: Generate protocol summary
      const protocolSummary = this.generateProtocolSummary(simulation);
      const bestProtocol = protocolSummary.length > 0 ? protocolSummary[0].protocol : null;
      
      const result: DexComparisonResult = {
        pair: tokenPair,
        timestamp: startTime,
        inputAmountUSD,
        totalPoolsFound: pools.length,
        successfulQuotes,
        simulation,
        bestProtocol,
        protocolSummary
      };

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`🏁 Completed ${tokenPair.name} comparison in ${duration}s`);
      
      return result;

    } catch (error) {
      console.error(`❌ Error comparing ${tokenPair.name}:`, error);
      return this.createEmptyResult(tokenPair, inputAmountUSD, startTime);
    }
  }

  /**
   * Compare multiple token pairs in parallel
   */
  async compareMultiplePairs(
    tokenPairs: TokenPair[], 
    inputAmountUSD: number = 10000
  ): Promise<DexComparisonResult[]> {
    console.log(`🔄 Starting batch comparison of ${tokenPairs.length} token pairs`);
    
    const results: DexComparisonResult[] = [];
    
    // Process pairs sequentially to avoid overwhelming APIs
    for (const pair of tokenPairs) {
      const result = await this.compareTokenPair(pair, inputAmountUSD);
      results.push(result);
      
      // Add delay between pairs
      if (tokenPairs.indexOf(pair) < tokenPairs.length - 1) {
        console.log('⏳ Waiting 3s before next pair...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log(`✅ Completed batch comparison of ${tokenPairs.length} pairs`);
    return results;
  }

  /**
   * Get quick comparison for frontend display
   * Returns data in format similar to old 0x API response
   */
  async getQuickComparison(tokenPair: TokenPair): Promise<{
    pair: TokenPair;
    timestamp: number;
    totalBuyAmount: string;
    minBuyAmount: string;
    rankings: PoolRanking[];
    singleHopFills: any[];
    available: boolean;
  }> {
    try {
      const result = await this.compareTokenPair(tokenPair);
      
      const bestQuote = result.simulation.bestQuote;
      const totalBuyAmount = bestQuote?.outputAmount || '0';
      // Assume 1% slippage for minBuyAmount
      const minBuyAmount = bestQuote 
        ? (parseFloat(bestQuote.outputAmount) * 0.99).toFixed(0)
        : '0';

      return {
        pair: tokenPair,
        timestamp: result.timestamp,
        totalBuyAmount,
        minBuyAmount,
        rankings: result.simulation.rankings,
        singleHopFills: result.simulation.quotes.filter(q => q.success).map(q => ({
          source: q.pool.dex,
          proportionBps: Math.round(10000 / result.simulation.quotes.length), // Rough estimate
          from: tokenPair.sellToken.address,
          to: tokenPair.buyToken.address
        })),
        available: result.successfulQuotes > 0
      };
    } catch (error) {
      console.error(`Error getting quick comparison for ${tokenPair.name}:`, error);
      return {
        pair: tokenPair,
        timestamp: Date.now(),
        totalBuyAmount: '0',
        minBuyAmount: '0',
        rankings: [],
        singleHopFills: [],
        available: false
      };
    }
  }

  /**
   * Generate protocol performance summary
   */
  private generateProtocolSummary(simulation: SwapSimulation): ProtocolSummary[] {
    const protocolMap = new Map<string, {
      quotes: OnChainQuote[];
      rankings: PoolRanking[];
    }>();

    // Group by protocol
    simulation.quotes.forEach(quote => {
      const protocol = quote.pool.dex;
      if (!protocolMap.has(protocol)) {
        protocolMap.set(protocol, { quotes: [], rankings: [] });
      }
      protocolMap.get(protocol)!.quotes.push(quote);
    });

    simulation.rankings.forEach(ranking => {
      const protocol = ranking.pool.dex;
      if (protocolMap.has(protocol)) {
        protocolMap.get(protocol)!.rankings.push(ranking);
      }
    });

    // Generate summary for each protocol
    const summaries: ProtocolSummary[] = [];
    
    protocolMap.forEach((data, protocol) => {
      const successfulQuotes = data.quotes.filter(q => q.success);
      const ranks = data.rankings.map(r => r.rank);
      
      summaries.push({
        protocol: this.formatProtocolName(protocol),
        poolCount: data.quotes.length,
        bestRank: ranks.length > 0 ? Math.min(...ranks) : null,
        avgRank: ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null,
        bestQuote: successfulQuotes.length > 0 
          ? successfulQuotes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount))[0]
          : null
      });
    });

    // Sort by best performance (lowest best rank)
    return summaries.sort((a, b) => {
      if (a.bestRank === null) return 1;
      if (b.bestRank === null) return -1;
      return a.bestRank - b.bestRank;
    });
  }

  /**
   * Format protocol names for display
   */
  private formatProtocolName(protocol: string): string {
    const formatMap: Record<string, string> = {
      'uniswap_v2': 'Uniswap V2',
      'uniswap_v3': 'Uniswap V3', 
      'sushiswap': 'SushiSwap',
      'curve': 'Curve Finance',
      'balancer': 'Balancer',
      'pancakeswap': 'PancakeSwap'
    };
    
    return formatMap[protocol] || protocol.charAt(0).toUpperCase() + protocol.slice(1);
  }

  /**
   * Count unique protocols in pool list
   */
  private countProtocols(pools: PoolInfo[]): number {
    return new Set(pools.map(p => p.dex)).size;
  }

  /**
   * Create empty result for error cases
   */
  private createEmptyResult(
    tokenPair: TokenPair, 
    inputAmountUSD: number, 
    timestamp: number
  ): DexComparisonResult {
    return {
      pair: tokenPair,
      timestamp,
      inputAmountUSD,
      totalPoolsFound: 0,
      successfulQuotes: 0,
      simulation: {
        quotes: [],
        bestQuote: null,
        rankings: []
      },
      bestProtocol: null,
      protocolSummary: []
    };
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<{
    coinGeckoApi: boolean;
    alchemyRpc: boolean;
    timestamp: number;
  }> {
    const checks = {
      coinGeckoApi: false,
      alchemyRpc: false,
      timestamp: Date.now()
    };

    logger.debug('DexComparisonService', 'Starting health checks');

    try {
      // Test CoinGecko API with a simple ping
      const response = await fetch('https://api.coingecko.com/api/v3/ping', {
        headers: {
          'x-cg-demo-api-key': 'CG-sw3jGBgpxKyEsNACERZfnebE',
          'Accept': 'application/json'
        }
      });
      checks.coinGeckoApi = response.ok;
      logger.debug('DexComparisonService', `CoinGecko API health: ${checks.coinGeckoApi}`);
    } catch (error) {
      logger.warn('DexComparisonService', 'CoinGecko API health check failed', error);
      checks.coinGeckoApi = false;
    }

    try {
      // Test Alchemy RPC
      const response = await alchemyRateLimiter.execute(() =>
        fetch(this.ALCHEMY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
          })
        })
      );
      
      const data = await response.json();
      checks.alchemyRpc = response.ok && data.result;
      logger.debug('DexComparisonService', `Alchemy RPC health: ${checks.alchemyRpc}`);
    } catch (error) {
      logger.warn('DexComparisonService', 'Alchemy RPC health check failed', error);
      checks.alchemyRpc = false;
    }

    logger.info('DexComparisonService', `Health check completed: CoinGecko=${checks.coinGeckoApi}, Alchemy=${checks.alchemyRpc}`);
    return checks;
  }

  /**
   * Get hardcoded pool registry statistics
   */
  getPoolRegistryStats(): {
    registry: {
      totalPools: number;
      poolsByDex: Record<string, number>;
      poolsByPair: Record<string, number>;
      totalLiquidityUsd: number;
      avgLiquidity: number;
    };
    info: {
      lastUpdated: Date;
      nextUpdateDue: Date;
      supportedPairs: string[];
      supportedDexes: string[];
      updateIntervalDays: number;
      needsUpdate: boolean;
    };
  } {
    const stats = this.hardcodedPoolService.getPoolStats();
    const info = this.hardcodedPoolService.getRegistryInfo();
    const needsUpdate = this.hardcodedPoolService.needsUpdate();

    logger.debug('DexComparisonService', 'Pool registry stats requested', { stats, needsUpdate });

    return {
      registry: stats,
      info: {
        ...info,
        needsUpdate
      }
    };
  }
}

export default DexComparisonService;