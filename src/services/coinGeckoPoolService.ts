/**
 * CoinGecko Pool Discovery Service
 * Uses CoinGecko's onchain DEX API to find pool contract addresses
 * and metadata for major DEX platforms
 */

import axios, { type AxiosResponse } from 'axios';
import type { TokenPair } from '../types/api';

export interface PoolInfo {
  address: string;
  name: string;
  dex: string;
  network: string;
  tokens: {
    base: {
      address: string;
      symbol: string;
      decimals: number;
    };
    quote: {
      address: string;
      symbol: string;
      decimals: number;
    };
  };
  fee_tier?: string;
  volume_24h?: number;
  liquidity_usd?: number;
}

export interface CoinGeckoPoolResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      address: string;
      name: string;
      pool_created_at: string;
      token_price_usd: string;
      base_token_price_usd: string;
      quote_token_price_usd: string;
      base_token_price_native_currency: string;
      quote_token_price_native_currency: string;
      volume_usd: {
        h24: string;
      };
      market_cap_usd?: string;
      reserve_in_usd: string;
    };
    relationships: {
      dex: {
        data: {
          id: string;
          type: string;
        };
      };
      base_token: {
        data: {
          id: string;
          type: string;
        };
      };
      quote_token: {
        data: {
          id: string;
          type: string;
        };
      };
    };
  }[];
  included?: any[];
}

class CoinGeckoPoolService {
  private baseUrl = 'https://api.coingecko.com/api/v3';
  private headers: Record<string, string>;
  private maxRetries = 3;

  constructor() {
    this.headers = {
      'User-Agent': 'ZookCryptoAnalytics/1.0 (contact@zook.com)',
      'x-cg-demo-api-key': 'CG-sw3jGBgpxKyEsNACERZfnebE',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip'
    };
  }

  /**
   * Find pool addresses for a token pair from major DEXes
   * Focus on Ethereum mainnet initially
   */
  async findPoolsForPair(tokenPair: TokenPair): Promise<PoolInfo[]> {
    const pools: PoolInfo[] = [];
    
    try {
      // Get Uniswap V3 pools
      const uniV3Pools = await this.getUniswapV3Pools(tokenPair);
      pools.push(...uniV3Pools);
      
      // Get Uniswap V2 pools
      const uniV2Pools = await this.getUniswapV2Pools(tokenPair);
      pools.push(...uniV2Pools);
      
      // Get SushiSwap pools
      const sushiPools = await this.getSushiSwapPools(tokenPair);
      pools.push(...sushiPools);
      
      // Get Curve pools (if applicable)
      const curvePools = await this.getCurvePools(tokenPair);
      pools.push(...curvePools);
      
      console.log(`Found ${pools.length} pools for ${tokenPair.name}`);
      return pools;
      
    } catch (error) {
      console.error(`Error finding pools for ${tokenPair.name}:`, error);
      return [];
    }
  }

  /**
   * Get Uniswap V3 pools for a token pair
   */
  private async getUniswapV3Pools(tokenPair: TokenPair): Promise<PoolInfo[]> {
    try {
      const url = `${this.baseUrl}/onchain/networks/eth/dexes/uniswap_v3/pools`;
      const params = {
        page: 1,
        include: 'base_token,quote_token,dex',
        // Search for pools containing these tokens
        'token_addresses': `${tokenPair.sellToken.address},${tokenPair.buyToken.address}`
      };

      const response = await this.makeRequest(url, params);
      return this.parsePoolResponse(response, 'uniswap_v3');
    } catch (error) {
      console.error('Error fetching Uniswap V3 pools:', error);
      return [];
    }
  }

  /**
   * Get Uniswap V2 pools for a token pair
   */
  private async getUniswapV2Pools(tokenPair: TokenPair): Promise<PoolInfo[]> {
    try {
      const url = `${this.baseUrl}/onchain/networks/eth/dexes/uniswap_v2/pools`;
      const params = {
        page: 1,
        include: 'base_token,quote_token,dex',
        'token_addresses': `${tokenPair.sellToken.address},${tokenPair.buyToken.address}`
      };

      const response = await this.makeRequest(url, params);
      return this.parsePoolResponse(response, 'uniswap_v2');
    } catch (error) {
      console.error('Error fetching Uniswap V2 pools:', error);
      return [];
    }
  }

  /**
   * Get SushiSwap pools for a token pair
   */
  private async getSushiSwapPools(tokenPair: TokenPair): Promise<PoolInfo[]> {
    try {
      const url = `${this.baseUrl}/onchain/networks/eth/dexes/sushiswap/pools`;
      const params = {
        page: 1,
        include: 'base_token,quote_token,dex',
        'token_addresses': `${tokenPair.sellToken.address},${tokenPair.buyToken.address}`
      };

      const response = await this.makeRequest(url, params);
      return this.parsePoolResponse(response, 'sushiswap');
    } catch (error) {
      console.error('Error fetching SushiSwap pools:', error);
      return [];
    }
  }

  /**
   * Get Curve pools for a token pair
   */
  private async getCurvePools(tokenPair: TokenPair): Promise<PoolInfo[]> {
    try {
      const url = `${this.baseUrl}/onchain/networks/eth/dexes/curve/pools`;
      const params = {
        page: 1,
        include: 'base_token,quote_token,dex',
        'token_addresses': `${tokenPair.sellToken.address},${tokenPair.buyToken.address}`
      };

      const response = await this.makeRequest(url, params);
      return this.parsePoolResponse(response, 'curve');
    } catch (error) {
      console.error('Error fetching Curve pools:', error);
      return [];
    }
  }

  /**
   * Make HTTP request with retry logic (similar to your CoinGecko script)
   */
  private async makeRequest(url: string, params: any): Promise<CoinGeckoPoolResponse> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.pow(2, attempt) + Math.random() * 3;
          console.log(`🔄 Attempt ${attempt + 1}/${this.maxRetries} - waiting ${delay.toFixed(2)}s`);
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }

        const response: AxiosResponse<CoinGeckoPoolResponse> = await axios.get(url, {
          params,
          headers: this.headers,
          timeout: 30000
        });

        if (response.status === 429) {
          console.warn(`⚠️ Rate limited (429) on attempt ${attempt + 1}`);
          if (attempt === this.maxRetries - 1) {
            throw new Error('Max retries reached for rate limiting');
          }
          const rateLimitDelay = 60 + Math.random() * 30; // 1-1.5 minutes
          await new Promise(resolve => setTimeout(resolve, rateLimitDelay * 1000));
          continue;
        }

        return response.data;
      } catch (error) {
        console.warn(`⚠️ Request failed on attempt ${attempt + 1}:`, error);
        if (attempt === this.maxRetries - 1) {
          throw error;
        }
      }
    }
    throw new Error('All retry attempts failed');
  }

  /**
   * Parse CoinGecko pool response into our PoolInfo format
   */
  private parsePoolResponse(response: CoinGeckoPoolResponse, dexName: string): PoolInfo[] {
    if (!response.data || !Array.isArray(response.data)) {
      return [];
    }

    return response.data.map(pool => {
      // Extract token information from included data if available
      const baseToken = this.findIncludedToken(response, pool.relationships.base_token.data.id);
      const quoteToken = this.findIncludedToken(response, pool.relationships.quote_token.data.id);

      return {
        address: pool.attributes.address,
        name: pool.attributes.name,
        dex: dexName,
        network: 'ethereum',
        tokens: {
          base: {
            address: baseToken?.address || '',
            symbol: baseToken?.symbol || '',
            decimals: baseToken?.decimals || 18
          },
          quote: {
            address: quoteToken?.address || '',
            symbol: quoteToken?.symbol || '',
            decimals: quoteToken?.decimals || 18
          }
        },
        volume_24h: parseFloat(pool.attributes.volume_usd?.h24 || '0'),
        liquidity_usd: parseFloat(pool.attributes.reserve_in_usd || '0')
      };
    });
  }

  /**
   * Find token data from included section of API response
   */
  private findIncludedToken(response: CoinGeckoPoolResponse, tokenId: string): any {
    if (!response.included) return null;
    return response.included.find(item => item.id === tokenId && item.type === 'token');
  }

  /**
   * Search for specific pool by contract address
   */
  async getPoolByAddress(network: string, address: string): Promise<PoolInfo | null> {
    try {
      const url = `${this.baseUrl}/onchain/networks/${network}/pools/${address}`;
      const params = {
        include: 'base_token,quote_token,dex'
      };

      const response = await this.makeRequest(url, params);
      const pools = this.parsePoolResponse(response, 'unknown');
      return pools.length > 0 ? pools[0] : null;
    } catch (error) {
      console.error(`Error fetching pool ${address}:`, error);
      return null;
    }
  }
}

export default CoinGeckoPoolService;