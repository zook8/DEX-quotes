/**
 * Price Service for Token Pricing
 * Fetches and caches daily token prices from CoinGecko
 * Used to calculate proper input amounts for ~$10K USD swaps
 */

import { logger } from './logger';

interface TokenPrice {
  symbol: string;
  address: string;
  price_usd: number;
  last_updated: number;
}

interface CoinGeckoTokenResponse {
  [address: string]: {
    usd: number;
    usd_24h_change?: number;
  };
}

class PriceService {
  private priceCache = new Map<string, TokenPrice>();
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  private lastCacheTime = 0;

  // CoinGecko token address mapping for Ethereum mainnet
  private readonly TOKEN_ADDRESSES: Record<string, string> = {
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    'UNI': '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    'USDe': '0x4c9edd5852cd905f086c759e8383e09bff1e68b3',
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  };

  /**
   * Get current token price in USD
   */
  async getTokenPrice(symbol: string): Promise<number> {
    await this.ensurePricesLoaded();
    
    const address = this.TOKEN_ADDRESSES[symbol];
    if (!address) {
      logger.warn('PriceService', `No address mapping for token: ${symbol}`);
      return this.getFallbackPrice(symbol);
    }

    const cached = this.priceCache.get(address);
    if (cached && this.isCacheValid(cached.last_updated)) {
      return cached.price_usd;
    }

    // If not cached or expired, fetch fresh price
    try {
      await this.fetchAndCachePrices([address]);
      const updated = this.priceCache.get(address);
      return updated ? updated.price_usd : this.getFallbackPrice(symbol);
    } catch (error) {
      logger.error('PriceService', `Failed to fetch price for ${symbol}:`, error);
      return this.getFallbackPrice(symbol);
    }
  }

  /**
   * Calculate input amount for target USD value
   */
  async calculateInputAmount(symbol: string, targetUSD: number, decimals: number): Promise<string> {
    const priceUSD = await this.getTokenPrice(symbol);
    const tokenAmount = targetUSD / priceUSD;
    
    // Convert to wei/smallest unit using the token's decimals
    const inputAmount = (tokenAmount * Math.pow(10, decimals)).toFixed(0);
    
    logger.info('PriceService', `${symbol}: $${targetUSD} = ${tokenAmount.toFixed(6)} tokens (${inputAmount} wei)`);
    return inputAmount;
  }

  /**
   * Get batch prices for multiple tokens
   */
  async getBatchPrices(symbols: string[]): Promise<Record<string, number>> {
    await this.ensurePricesLoaded();
    
    const result: Record<string, number> = {};
    const addressesToFetch: string[] = [];

    // Check cache first
    for (const symbol of symbols) {
      const address = this.TOKEN_ADDRESSES[symbol];
      if (!address) {
        result[symbol] = this.getFallbackPrice(symbol);
        continue;
      }

      const cached = this.priceCache.get(address);
      if (cached && this.isCacheValid(cached.last_updated)) {
        result[symbol] = cached.price_usd;
      } else {
        addressesToFetch.push(address);
      }
    }

    // Fetch missing prices
    if (addressesToFetch.length > 0) {
      try {
        await this.fetchAndCachePrices(addressesToFetch);
        
        // Update results with fresh prices
        for (const symbol of symbols) {
          if (!result[symbol]) {
            const address = this.TOKEN_ADDRESSES[symbol];
            const cached = this.priceCache.get(address);
            result[symbol] = cached ? cached.price_usd : this.getFallbackPrice(symbol);
          }
        }
      } catch (error) {
        logger.error('PriceService', 'Failed to fetch batch prices:', error);
        
        // Fill missing prices with fallbacks
        for (const symbol of symbols) {
          if (!result[symbol]) {
            result[symbol] = this.getFallbackPrice(symbol);
          }
        }
      }
    }

    return result;
  }

  /**
   * Ensure prices are loaded and current
   */
  private async ensurePricesLoaded(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastCacheTime > this.cacheExpiry || this.priceCache.size === 0) {
      logger.info('PriceService', 'Refreshing daily price cache...');
      
      const addresses = Object.values(this.TOKEN_ADDRESSES);
      await this.fetchAndCachePrices(addresses);
      this.lastCacheTime = now;
    }
  }

  /**
   * Fetch prices from CoinGecko and cache them
   * Note: Free/Demo tier only allows 1 address per request
   */
  private async fetchAndCachePrices(addresses: string[]): Promise<void> {
    logger.info('PriceService', `Fetching prices for ${addresses.length} tokens (sequential due to API limits)`);
    
    let successCount = 0;
    const now = Date.now();
    
    // Fetch prices one by one due to API limitations
    for (const address of addresses) {
      try {
        const url = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${address}&vs_currencies=usd&include_24hr_change=true`;
        
        logger.debug('PriceService', `Fetching price for ${address}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          if (response.status === 429) {
            logger.warn('PriceService', 'Rate limited, waiting 1 minute...');
            await new Promise(resolve => setTimeout(resolve, 60000));
            continue; // Retry this address later
          }
          throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
        }
        
        const data: CoinGeckoTokenResponse = await response.json();
        
        // Cache the result
        for (const [addr, priceData] of Object.entries(data)) {
          const symbol = this.getSymbolByAddress(addr);
          
          this.priceCache.set(addr, {
            symbol,
            address: addr,
            price_usd: priceData.usd,
            last_updated: now
          });
          
          logger.debug('PriceService', `Cached ${symbol}: $${priceData.usd}`);
          successCount++;
        }
        
        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.error('PriceService', `Failed to fetch price for ${address}:`, error);
        // Continue with other addresses, use fallback for this one
      }
    }
    
    logger.info('PriceService', `Successfully cached ${successCount}/${addresses.length} token prices`);
    
    if (successCount === 0) {
      throw new Error('Failed to fetch any token prices from CoinGecko');
    }
  }

  /**
   * Check if cached price is still valid (within 24 hours)
   */
  private isCacheValid(lastUpdated: number): boolean {
    return Date.now() - lastUpdated < this.cacheExpiry;
  }

  /**
   * Get fallback price for common tokens
   */
  private getFallbackPrice(symbol: string): number {
    const fallbackPrices: Record<string, number> = {
      'WETH': 2400,
      'ETH': 2400,
      'USDT': 1,
      'USDC': 1,
      'WBTC': 45000,
      'UNI': 8,
      'USDe': 1,
      'DAI': 1
    };
    
    const price = fallbackPrices[symbol] || 1;
    logger.warn('PriceService', `Using fallback price for ${symbol}: $${price}`);
    return price;
  }

  /**
   * Get symbol by contract address
   */
  private getSymbolByAddress(address: string): string {
    for (const [symbol, addr] of Object.entries(this.TOKEN_ADDRESSES)) {
      if (addr.toLowerCase() === address.toLowerCase()) {
        return symbol;
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Get cache stats for debugging
   */
  getCacheStats(): {
    cached_tokens: number;
    cache_age_minutes: number;
    next_refresh_minutes: number;
  } {
    const cacheAgeMs = Date.now() - this.lastCacheTime;
    const nextRefreshMs = Math.max(0, this.cacheExpiry - cacheAgeMs);
    
    return {
      cached_tokens: this.priceCache.size,
      cache_age_minutes: Math.round(cacheAgeMs / (60 * 1000)),
      next_refresh_minutes: Math.round(nextRefreshMs / (60 * 1000))
    };
  }
}

export default PriceService;