/**
 * Dynamic Pricing Service
 * Enhances the existing PriceService with your CoinGecko API key
 * Implements proper rate limiting and retry mechanisms for Demo API constraints
 */

import { logger } from './logger';

export interface TokenPrice {
  symbol: string;
  address: string;
  price_usd: number;
  last_updated: number;
  source: 'live' | 'fallback';
}

export interface CoinGeckoTokenResponse {
  [address: string]: {
    usd: number;
    usd_24h_change?: number;
  };
}

class DynamicPricingService {
  private priceCache = new Map<string, TokenPrice>();
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  private lastCacheTime = 0;
  private isUpdating = false;
  private retryDelays = [1000, 5000, 15000, 60000]; // 1s, 5s, 15s, 1min

  // Your CoinGecko API configuration
  private readonly API_HEADERS = {
    'User-Agent': 'ZookCryptoAnalytics/1.0 (contact@zook.com)',
    'x-cg-demo-api-key': import.meta.env.COINGECKO_API_KEY,
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip'
  };

  // Token address mapping for Ethereum mainnet
  private readonly TOKEN_ADDRESSES: Record<string, string> = {
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    'UNI': '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    'USDe': '0x4c9edd5852cd905f086c759e8383e09bff1e68b3',
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  };

  // CoinGecko ID mapping (for Simple Price API which might be more reliable)
  private readonly COINGECKO_IDS: Record<string, string> = {
    'WETH': 'ethereum',
    'UNI': 'uniswap',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'WBTC': 'wrapped-bitcoin',
    'USDe': 'ethena-usde',
    'DAI': 'dai'
  };

  /**
   * Get current token price in USD with proper error handling
   */
  async getTokenPrice(symbol: string): Promise<TokenPrice> {
    await this.ensurePricesLoaded();
    
    const address = this.TOKEN_ADDRESSES[symbol];
    if (!address) {
      logger.warn('DynamicPricingService', `No address mapping for token: ${symbol}`);
      return this.getFallbackPrice(symbol);
    }

    const cached = this.priceCache.get(address);
    if (cached && this.isCacheValid(cached.last_updated)) {
      return cached;
    }

    // If not cached or expired, try to fetch fresh price
    try {
      const freshPrice = await this.fetchTokenPriceWithRetry(symbol);
      return freshPrice;
    } catch (error) {
      logger.error('DynamicPricingService', `Failed to fetch price for ${symbol}:`, error);
      return cached || this.getFallbackPrice(symbol);
    }
  }

  /**
   * Calculate input amount for target USD value using dynamic pricing
   */
  async calculateDynamicInputAmount(symbol: string, targetUSD: number, decimals: number): Promise<{
    amount: string;
    price: TokenPrice;
  }> {
    const priceData = await this.getTokenPrice(symbol);
    const tokenAmount = targetUSD / priceData.price_usd;
    
    // Convert to wei/smallest unit using the token's decimals
    const inputAmount = (tokenAmount * Math.pow(10, decimals)).toFixed(0);
    
    logger.info('DynamicPricingService', 
      `${symbol}: $${targetUSD} = ${tokenAmount.toFixed(6)} tokens (${inputAmount} wei) at $${priceData.price_usd} (${priceData.source})`
    );
    
    return {
      amount: inputAmount,
      price: priceData
    };
  }

  /**
   * Batch update all token prices (called daily via scheduler)
   */
  async updateAllPrices(): Promise<{
    success: number;
    failed: number;
    results: Record<string, TokenPrice>;
  }> {
    if (this.isUpdating) {
      logger.info('DynamicPricingService', 'Price update already in progress, skipping');
      return this.getLastUpdateResults();
    }

    this.isUpdating = true;
    logger.info('DynamicPricingService', 'Starting daily price update...');
    
    const startTime = Date.now();
    const tokens = Object.keys(this.TOKEN_ADDRESSES);
    const results: Record<string, TokenPrice> = {};
    let successCount = 0;
    let failedCount = 0;

    try {
      // Process tokens one by one due to Demo API limitations
      for (const symbol of tokens) {
        try {
          logger.debug('DynamicPricingService', `Updating price for ${symbol}...`);
          const price = await this.fetchTokenPriceWithRetry(symbol);
          results[symbol] = price;
          successCount++;
          
          // Rate limiting: Wait between requests to respect Demo API limits
          if (symbol !== tokens[tokens.length - 1]) { // Don't wait after last token
            logger.debug('DynamicPricingService', 'Rate limiting: waiting 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          logger.error('DynamicPricingService', `Failed to update ${symbol}:`, error);
          results[symbol] = this.getFallbackPrice(symbol);
          failedCount++;
        }
      }

      this.lastCacheTime = Date.now();
      const duration = Date.now() - startTime;
      
      logger.info('DynamicPricingService', 
        `Price update completed: ${successCount} success, ${failedCount} failed (${duration}ms)`
      );

      return { success: successCount, failed: failedCount, results };
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Fetch single token price with retry mechanism
   */
  private async fetchTokenPriceWithRetry(symbol: string, retryAttempt: number = 0): Promise<TokenPrice> {
    const address = this.TOKEN_ADDRESSES[symbol];
    const coinGeckoId = this.COINGECKO_IDS[symbol];
    
    if (!address && !coinGeckoId) {
      throw new Error(`No mapping found for ${symbol}`);
    }

    // Try Simple Price API first (often more reliable for major coins)
    if (coinGeckoId) {
      try {
        return await this.fetchFromSimplePriceAPI(symbol, coinGeckoId);
      } catch (error) {
        logger.warn('DynamicPricingService', `Simple price API failed for ${symbol}, trying token price API`);
      }
    }

    // Fallback to Token Price API
    if (address) {
      try {
        return await this.fetchFromTokenPriceAPI(symbol, address);
      } catch (error) {
        if (retryAttempt < this.retryDelays.length) {
          const delay = this.retryDelays[retryAttempt];
          logger.warn('DynamicPricingService', `Retry ${retryAttempt + 1} for ${symbol} in ${delay}ms`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchTokenPriceWithRetry(symbol, retryAttempt + 1);
        }
        throw error;
      }
    }

    throw new Error(`Could not fetch price for ${symbol} from any API`);
  }

  /**
   * Fetch from CoinGecko Simple Price API
   */
  private async fetchFromSimplePriceAPI(symbol: string, coinGeckoId: string): Promise<TokenPrice> {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd&include_24hr_change=true`;
    
    logger.debug('DynamicPricingService', `Fetching simple price for ${symbol}: ${coinGeckoId}`);
    
    const response = await fetch(url, { headers: this.API_HEADERS });
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(`Rate limited (429) - will retry with backoff`);
      }
      throw new Error(`CoinGecko Simple API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data[coinGeckoId]?.usd) {
      throw new Error(`No price data found for ${coinGeckoId}`);
    }
    
    const price: TokenPrice = {
      symbol,
      address: this.TOKEN_ADDRESSES[symbol] || '',
      price_usd: data[coinGeckoId].usd,
      last_updated: Date.now(),
      source: 'live'
    };
    
    // Cache the result
    if (price.address) {
      this.priceCache.set(price.address, price);
    }
    
    logger.debug('DynamicPricingService', `Cached ${symbol}: $${price.price_usd} (simple API)`);
    return price;
  }

  /**
   * Fetch from CoinGecko Token Price API
   */
  private async fetchFromTokenPriceAPI(symbol: string, address: string): Promise<TokenPrice> {
    const url = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${address}&vs_currencies=usd&include_24hr_change=true`;
    
    logger.debug('DynamicPricingService', `Fetching token price for ${symbol}: ${address}`);
    
    const response = await fetch(url, { headers: this.API_HEADERS });
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(`Rate limited (429) - will retry with backoff`);
      }
      throw new Error(`CoinGecko Token API error: ${response.status} ${response.statusText}`);
    }
    
    const data: CoinGeckoTokenResponse = await response.json();
    
    if (!data[address.toLowerCase()]?.usd) {
      throw new Error(`No price data found for ${address}`);
    }
    
    const price: TokenPrice = {
      symbol,
      address,
      price_usd: data[address.toLowerCase()].usd,
      last_updated: Date.now(),
      source: 'live'
    };
    
    this.priceCache.set(address, price);
    
    logger.debug('DynamicPricingService', `Cached ${symbol}: $${price.price_usd} (token API)`);
    return price;
  }

  /**
   * Ensure prices are loaded and current
   */
  private async ensurePricesLoaded(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastCacheTime > this.cacheExpiry || this.priceCache.size === 0) {
      logger.info('DynamicPricingService', 'Price cache expired or empty, triggering update...');
      await this.updateAllPrices();
    }
  }

  /**
   * Check if cached price is still valid
   */
  private isCacheValid(lastUpdated: number): boolean {
    return Date.now() - lastUpdated < this.cacheExpiry;
  }

  /**
   * Get fallback price for tokens
   */
  private getFallbackPrice(symbol: string): TokenPrice {
    const fallbackPrices: Record<string, number> = {
      'WETH': 2400,    // Conservative fallback
      'ETH': 2400,
      'USDT': 1,
      'USDC': 1,
      'WBTC': 45000,
      'UNI': 8,        // Conservative fallback
      'USDe': 1,
      'DAI': 1
    };
    
    const price = fallbackPrices[symbol] || 1;
    logger.warn('DynamicPricingService', `Using fallback price for ${symbol}: $${price}`);
    
    const fallbackPrice: TokenPrice = {
      symbol,
      address: this.TOKEN_ADDRESSES[symbol] || '',
      price_usd: price,
      last_updated: Date.now(),
      source: 'fallback'
    };

    // Cache fallback to avoid repeated warnings
    if (fallbackPrice.address) {
      this.priceCache.set(fallbackPrice.address, fallbackPrice);
    }

    return fallbackPrice;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    cached_tokens: number;
    cache_age_hours: number;
    next_refresh_hours: number;
    live_prices: number;
    fallback_prices: number;
  } {
    const cacheAgeMs = Date.now() - this.lastCacheTime;
    const nextRefreshMs = Math.max(0, this.cacheExpiry - cacheAgeMs);
    
    let liveCount = 0;
    let fallbackCount = 0;
    
    for (const price of this.priceCache.values()) {
      if (price.source === 'live') liveCount++;
      else fallbackCount++;
    }
    
    return {
      cached_tokens: this.priceCache.size,
      cache_age_hours: Math.round(cacheAgeMs / (60 * 60 * 1000) * 100) / 100,
      next_refresh_hours: Math.round(nextRefreshMs / (60 * 60 * 1000) * 100) / 100,
      live_prices: liveCount,
      fallback_prices: fallbackCount
    };
  }

  /**
   * Get last update results
   */
  private getLastUpdateResults() {
    const results: Record<string, TokenPrice> = {};
    for (const [, price] of this.priceCache.entries()) {
      results[price.symbol] = price;
    }
    
    const liveCount = Object.values(results).filter(p => p.source === 'live').length;
    const fallbackCount = Object.values(results).length - liveCount;
    
    return {
      success: liveCount,
      failed: fallbackCount,
      results
    };
  }

  /**
   * Manual price refresh for testing
   */
  async refreshPrices(): Promise<void> {
    await this.updateAllPrices();
  }

  /**
   * Get all cached prices for debugging
   */
  getAllCachedPrices(): Record<string, TokenPrice> {
    const result: Record<string, TokenPrice> = {};
    for (const price of this.priceCache.values()) {
      result[price.symbol] = price;
    }
    return result;
  }
}

export default DynamicPricingService;
