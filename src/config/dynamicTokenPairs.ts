/**
 * Dynamic Token Pairs Configuration
 * Enhanced version of tokenPairs.ts with dynamic pricing support
 * Integrates with DynamicPricingService to calculate correct sellAmounts
 */

import type { TokenPair } from '../types/api';
import DynamicPricingService from '../services/dynamicPricingService';
import { logger } from '../services/logger';

export interface DynamicTokenPair extends TokenPair {
  targetUSD: number; // Target swap value in USD
  lastUpdated?: number; // When sellAmount was last calculated
  priceUsed?: number; // Price used for last calculation
  priceSource?: 'live' | 'fallback'; // Source of price used
}

// Base token pair definitions (without hardcoded sellAmounts)
export const BASE_TOKEN_PAIRS: Omit<DynamicTokenPair, 'sellAmount'>[] = [
  {
    id: 'weth-usdt',
    name: 'WETH → USDT',
    sellToken: {
      symbol: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18
    },
    buyToken: {
      symbol: 'USDT',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6
    },
    targetUSD: 10000 // $10K swap
  },
  {
    id: 'uni-weth',
    name: 'UNI → WETH', 
    sellToken: {
      symbol: 'UNI',
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      decimals: 18
    },
    buyToken: {
      symbol: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18
    },
    targetUSD: 10000 // $10K swap
  },
  {
    id: 'weth-usdc',
    name: 'WETH → USDC',
    sellToken: {
      symbol: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      decimals: 18
    },
    buyToken: {
      symbol: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6
    },
    targetUSD: 10000 // $10K swap
  },
  {
    id: 'usdc-dai',
    name: 'USDC → DAI',
    sellToken: {
      symbol: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6
    },
    buyToken: {
      symbol: 'DAI',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      decimals: 18
    },
    targetUSD: 10000 // $10K swap (1:1 for stablecoins)
  },
  {
    id: 'usde-usdt',
    name: 'USDe → USDT',
    sellToken: {
      symbol: 'USDe',
      address: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3',
      decimals: 18
    },
    buyToken: {
      symbol: 'USDT',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6
    },
    targetUSD: 10000 // $10K swap (1:1 for stablecoins)
  }
];

// Fallback sellAmounts (same as original tokenPairs.ts)
const FALLBACK_SELL_AMOUNTS: Record<string, string> = {
  'weth-usdt': '2127659574468085000',    // ~2.13 ETH (~$10K at ~$4700/ETH)
  'uni-weth': '555555555555555555555',    // ~555.6 UNI (~$10K at ~$18/UNI)  
  'weth-usdc': '2127659574468085000',     // ~2.13 ETH (~$10K at ~$4700/ETH)
  'usdc-dai': '10000000000',              // $10K USDC
  'usde-usdt': '10000000000000000000000'  // 10K USDe (~$10K at ~$1/USDe)
};

class DynamicTokenPairService {
  private pricingService: DynamicPricingService;
  private cachedPairs: DynamicTokenPair[] = [];
  private lastUpdateTime = 0;
  private cacheExpiry = 60 * 60 * 1000; // 1 hour cache

  constructor() {
    this.pricingService = new DynamicPricingService();
  }

  /**
   * Get token pairs with dynamically calculated sellAmounts
   */
  async getDynamicTokenPairs(): Promise<DynamicTokenPair[]> {
    // Return cached pairs if still valid
    if (this.isCacheValid() && this.cachedPairs.length > 0) {
      logger.debug('DynamicTokenPairService', 'Returning cached token pairs');
      return this.cachedPairs;
    }

    logger.info('DynamicTokenPairService', 'Calculating dynamic sellAmounts for token pairs...');

    const dynamicPairs: DynamicTokenPair[] = [];

    for (const basePair of BASE_TOKEN_PAIRS) {
      try {
        const pair = await this.calculateSellAmount(basePair);
        dynamicPairs.push(pair);
      } catch (error) {
        logger.error('DynamicTokenPairService', `Failed to calculate sellAmount for ${basePair.name}:`, error);
        
        // Use fallback sellAmount
        const fallbackPair: DynamicTokenPair = {
          ...basePair,
          sellAmount: FALLBACK_SELL_AMOUNTS[basePair.id] || '0',
          lastUpdated: Date.now(),
          priceSource: 'fallback'
        };
        
        dynamicPairs.push(fallbackPair);
      }
    }

    // Cache the results
    this.cachedPairs = dynamicPairs;
    this.lastUpdateTime = Date.now();

    logger.info('DynamicTokenPairService', `Updated ${dynamicPairs.length} token pairs with dynamic pricing`);
    return dynamicPairs;
  }

  /**
   * Calculate sellAmount for a specific token pair
   */
  private async calculateSellAmount(basePair: Omit<DynamicTokenPair, 'sellAmount'>): Promise<DynamicTokenPair> {
    const sellToken = basePair.sellToken;
    
    // For stablecoins, use direct amount calculation
    const stablecoins = ['USDT', 'USDC', 'DAI', 'USDe'];
    if (stablecoins.includes(sellToken.symbol)) {
      const sellAmount = this.calculateStablecoinAmount(basePair.targetUSD, sellToken.decimals);
      
      return {
        ...basePair,
        sellAmount,
        lastUpdated: Date.now(),
        priceUsed: 1.0,
        priceSource: 'live' // Stablecoins are assumed 1:1
      };
    }

    // For volatile tokens (WETH, UNI), use dynamic pricing
    const priceResult = await this.pricingService.calculateDynamicInputAmount(
      sellToken.symbol,
      basePair.targetUSD,
      sellToken.decimals
    );

    return {
      ...basePair,
      sellAmount: priceResult.amount,
      lastUpdated: Date.now(),
      priceUsed: priceResult.price.price_usd,
      priceSource: priceResult.price.source
    };
  }

  /**
   * Calculate stablecoin amount directly
   */
  private calculateStablecoinAmount(targetUSD: number, decimals: number): string {
    const amount = targetUSD * Math.pow(10, decimals);
    return amount.toFixed(0);
  }

  /**
   * Force refresh of all token pairs
   */
  async refreshTokenPairs(): Promise<DynamicTokenPair[]> {
    logger.info('DynamicTokenPairService', 'Force refreshing token pairs...');
    
    // Clear cache
    this.cachedPairs = [];
    this.lastUpdateTime = 0;
    
    return await this.getDynamicTokenPairs();
  }

  /**
   * Get a specific token pair by ID
   */
  async getTokenPair(id: string): Promise<DynamicTokenPair | null> {
    const pairs = await this.getDynamicTokenPairs();
    return pairs.find(pair => pair.id === id) || null;
  }

  /**
   * Get fallback token pairs (original hardcoded version)
   */
  getFallbackTokenPairs(): TokenPair[] {
    return BASE_TOKEN_PAIRS.map(basePair => ({
      ...basePair,
      sellAmount: FALLBACK_SELL_AMOUNTS[basePair.id] || '0'
    }));
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return (Date.now() - this.lastUpdateTime) < this.cacheExpiry;
  }

  /**
   * Get service status and statistics
   */
  async getStatus(): Promise<{
    cached_pairs: number;
    cache_age_minutes: number;
    last_update: string;
    pricing_service_stats: any;
    pairs_status: Array<{
      id: string;
      name: string;
      price_used: number | undefined;
      price_source: string | undefined;
      last_updated: string;
    }>;
  }> {
    const cacheAge = Date.now() - this.lastUpdateTime;
    const pricingStats = this.pricingService.getCacheStats();

    const pairsStatus = this.cachedPairs.map(pair => ({
      id: pair.id,
      name: pair.name,
      price_used: pair.priceUsed,
      price_source: pair.priceSource || 'unknown',
      last_updated: pair.lastUpdated ? new Date(pair.lastUpdated).toISOString() : 'never'
    }));

    return {
      cached_pairs: this.cachedPairs.length,
      cache_age_minutes: Math.round(cacheAge / 60000),
      last_update: this.lastUpdateTime ? new Date(this.lastUpdateTime).toISOString() : 'never',
      pricing_service_stats: pricingStats,
      pairs_status: pairsStatus
    };
  }

  /**
   * Test a specific token pair calculation
   */
  async testTokenPair(id: string): Promise<{
    success: boolean;
    pair?: DynamicTokenPair;
    error?: string;
    fallback_pair?: TokenPair;
  }> {
    const basePair = BASE_TOKEN_PAIRS.find(p => p.id === id);
    
    if (!basePair) {
      return {
        success: false,
        error: `Token pair ${id} not found`
      };
    }

    try {
      const dynamicPair = await this.calculateSellAmount(basePair);
      
      return {
        success: true,
        pair: dynamicPair,
        fallback_pair: {
          ...basePair,
          sellAmount: FALLBACK_SELL_AMOUNTS[basePair.id] || '0'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback_pair: {
          ...basePair,
          sellAmount: FALLBACK_SELL_AMOUNTS[basePair.id] || '0'
        }
      };
    }
  }
}

// Singleton instance
export const dynamicTokenPairService = new DynamicTokenPairService();

// For backward compatibility, export the original API config
export const API_CONFIG = {
  baseUrl: '/api',
  apiKey: 'dee1a681-0a60-4537-b560-ba86dc8f8423',
  chainId: 1,
  headers: {
    'Content-Type': 'application/json'
  }
};

export default DynamicTokenPairService;