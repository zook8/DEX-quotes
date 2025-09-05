/**
 * Browser-Compatible Dynamic Token Pairs Configuration
 * Version that works in browser environment using localStorage instead of SQLite
 */

import type { TokenPair } from '../types/api';
import BrowserDynamicPricingService from '../services/browserDynamicPricingService';
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

class BrowserDynamicTokenPairService {
  private pricingService: BrowserDynamicPricingService;
  private cachedPairs: DynamicTokenPair[] = [];
  private lastUpdateTime = 0;
  private cacheExpiry = 60 * 60 * 1000; // 1 hour cache

  constructor() {
    this.pricingService = new BrowserDynamicPricingService();
    this.loadCacheFromStorage();
  }

  /**
   * Get token pairs with dynamically calculated sellAmounts
   * New architecture: Server cache (8h) -> localStorage (1h) -> Fresh calculation -> Fallback
   */
  async getDynamicTokenPairs(): Promise<DynamicTokenPair[]> {
    // Return cached pairs if still valid
    if (this.isCacheValid() && this.cachedPairs.length > 0) {
      logger.debug('BrowserDynamicTokenPairService', 'Returning cached token pairs');
      return this.cachedPairs;
    }

    logger.info('BrowserDynamicTokenPairService', 'Loading sellAmounts with server cache priority...');

    try {
      // Step 1: Try server cache first (fastest path)
      const serverSellAmounts = await this.fetchFromServerCache();
      if (serverSellAmounts) {
        const dynamicPairs = this.buildPairsFromSellAmounts(serverSellAmounts, 'server_cache');
        this.updateCache(dynamicPairs);
        return dynamicPairs;
      }
    } catch (error) {
      logger.warn('BrowserDynamicTokenPairService', 'Server cache failed, trying localStorage fallback:', error);
    }

    try {
      // Step 2: Fallback to localStorage cache if server cache fails
      const localSellAmounts = this.getLocalStorageSellAmounts();
      if (localSellAmounts && this.isLocalStorageValid()) {
        logger.info('BrowserDynamicTokenPairService', 'Using localStorage fallback');
        const dynamicPairs = this.buildPairsFromSellAmounts(localSellAmounts, 'localStorage');
        this.updateCache(dynamicPairs);
        return dynamicPairs;
      }
    } catch (error) {
      logger.warn('BrowserDynamicTokenPairService', 'localStorage fallback failed:', error);
    }

    try {
      // Step 3: Generate fresh sellAmounts using original logic
      logger.info('BrowserDynamicTokenPairService', 'Generating fresh sellAmounts...');
      const dynamicPairs = await this.calculateFreshSellAmounts();
      this.updateCache(dynamicPairs);
      return dynamicPairs;
    } catch (error) {
      logger.error('BrowserDynamicTokenPairService', 'Fresh calculation failed, using hardcoded fallbacks:', error);
      
      // Step 4: Ultimate fallback to hardcoded values
      const fallbackPairs = this.buildPairsFromSellAmounts(FALLBACK_SELL_AMOUNTS, 'fallback');
      return fallbackPairs;
    }
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
   * Fetch sellAmounts from server cache
   */
  private async fetchFromServerCache(): Promise<Record<string, string> | null> {
    try {
      const response = await fetch('/api/sellAmounts');
      
      if (!response.ok) {
        throw new Error(`Server cache API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        logger.info('BrowserDynamicTokenPairService', 
          `Server cache hit: ${result.source} (${result.age_hours}h old)`);
        
        // Store in localStorage as backup
        this.saveToLocalStorage(result.data, result.timestamp);
        
        return result.data;
      }
      
      return null;
    } catch (error) {
      logger.error('BrowserDynamicTokenPairService', 'Server cache fetch failed:', error);
      return null;
    }
  }

  /**
   * Get sellAmounts from localStorage
   */
  private getLocalStorageSellAmounts(): Record<string, string> | null {
    try {
      const stored = localStorage.getItem('sellAmounts_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.sellAmounts;
      }
    } catch (error) {
      logger.warn('BrowserDynamicTokenPairService', 'localStorage read failed:', error);
    }
    return null;
  }

  /**
   * Check if localStorage cache is still valid (1 hour)
   */
  private isLocalStorageValid(): boolean {
    try {
      const stored = localStorage.getItem('sellAmounts_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        const age = Date.now() - parsed.timestamp;
        return age < (60 * 60 * 1000); // 1 hour
      }
    } catch (error) {
      logger.warn('BrowserDynamicTokenPairService', 'localStorage validation failed:', error);
    }
    return false;
  }

  /**
   * Save sellAmounts to localStorage
   */
  private saveToLocalStorage(sellAmounts: Record<string, string>, timestamp: number): void {
    try {
      const cacheData = {
        sellAmounts,
        timestamp,
        source: 'server_cache'
      };
      localStorage.setItem('sellAmounts_cache', JSON.stringify(cacheData));
      logger.debug('BrowserDynamicTokenPairService', 'Saved sellAmounts to localStorage');
    } catch (error) {
      logger.warn('BrowserDynamicTokenPairService', 'localStorage save failed:', error);
    }
  }

  /**
   * Build token pairs from sellAmounts data
   */
  private buildPairsFromSellAmounts(sellAmounts: Record<string, string>, source: string): DynamicTokenPair[] {
    const dynamicPairs: DynamicTokenPair[] = [];
    
    for (const basePair of BASE_TOKEN_PAIRS) {
      const sellAmount = sellAmounts[basePair.id];
      
      if (sellAmount) {
        const pair: DynamicTokenPair = {
          ...basePair,
          sellAmount,
          lastUpdated: Date.now(),
          priceSource: source as 'live' | 'fallback'
        };
        
        dynamicPairs.push(pair);
      } else {
        // Use fallback if no sellAmount found
        const fallbackPair: DynamicTokenPair = {
          ...basePair,
          sellAmount: FALLBACK_SELL_AMOUNTS[basePair.id] || '0',
          lastUpdated: Date.now(),
          priceSource: 'fallback'
        };
        
        dynamicPairs.push(fallbackPair);
      }
    }
    
    logger.info('BrowserDynamicTokenPairService', 
      `Built ${dynamicPairs.length} pairs from sellAmounts (source: ${source})`);
    
    return dynamicPairs;
  }

  /**
   * Generate fresh sellAmounts using original calculation logic
   */
  private async calculateFreshSellAmounts(): Promise<DynamicTokenPair[]> {
    const dynamicPairs: DynamicTokenPair[] = [];

    for (const basePair of BASE_TOKEN_PAIRS) {
      try {
        const pair = await this.calculateSellAmount(basePair);
        dynamicPairs.push(pair);
      } catch (error) {
        logger.error('BrowserDynamicTokenPairService', `Failed to calculate sellAmount for ${basePair.name}:`, error);
        
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

    return dynamicPairs;
  }

  /**
   * Update internal cache and localStorage
   */
  private updateCache(dynamicPairs: DynamicTokenPair[]): void {
    this.cachedPairs = dynamicPairs;
    this.lastUpdateTime = Date.now();
    this.saveCacheToStorage();
    
    logger.info('BrowserDynamicTokenPairService', `Updated cache with ${dynamicPairs.length} pairs`);
  }

  /**
   * Calculate stablecoin amount directly
   */
  private calculateStablecoinAmount(targetUSD: number, decimals: number): string {
    const amount = targetUSD * Math.pow(10, decimals);
    return amount.toFixed(0);
  }

  /**
   * Load cache from localStorage
   */
  private loadCacheFromStorage(): void {
    try {
      const cacheData = localStorage.getItem('dynamicTokenPairs_cache');
      const cacheTime = localStorage.getItem('dynamicTokenPairs_cacheTime');
      
      if (cacheData && cacheTime) {
        this.cachedPairs = JSON.parse(cacheData);
        this.lastUpdateTime = parseInt(cacheTime);
        
        logger.debug('BrowserDynamicTokenPairService', `Loaded ${this.cachedPairs.length} pairs from localStorage`);
      }
    } catch (error) {
      logger.warn('BrowserDynamicTokenPairService', 'Failed to load cache from localStorage:', error);
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveCacheToStorage(): void {
    try {
      localStorage.setItem('dynamicTokenPairs_cache', JSON.stringify(this.cachedPairs));
      localStorage.setItem('dynamicTokenPairs_cacheTime', this.lastUpdateTime.toString());
      
      logger.debug('BrowserDynamicTokenPairService', `Saved ${this.cachedPairs.length} pairs to localStorage`);
    } catch (error) {
      logger.warn('BrowserDynamicTokenPairService', 'Failed to save cache to localStorage:', error);
    }
  }

  /**
   * Force refresh of all token pairs
   */
  async refreshTokenPairs(): Promise<DynamicTokenPair[]> {
    logger.info('BrowserDynamicTokenPairService', 'Force refreshing token pairs...');
    
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
export const browserDynamicTokenPairService = new BrowserDynamicTokenPairService();

// For backward compatibility, export the original API config
export const API_CONFIG = {
  baseUrl: '/api',
  apiKey: 'dee1a681-0a60-4537-b560-ba86dc8f8423',
  chainId: 1,
  headers: {
    'Content-Type': 'application/json'
  }
};

export default BrowserDynamicTokenPairService;