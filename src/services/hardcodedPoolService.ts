/**
 * Hardcoded Pool Service
 * Static pool registry for major token pairs to reduce API calls
 * Pools sourced from CoinGecko and manually curated for highest liquidity
 */

import type { PoolInfo } from './coinGeckoPoolService';
import type { TokenPair } from '../types/api';
import { logger } from './logger';

interface HardcodedPool {
  address: string;
  name: string;
  dex: string;
  fee_tier?: string;
  volume_24h: number;
  liquidity_usd: number;
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
}

/**
 * Major pool addresses for token pairs - manually curated for highest liquidity
 * Updated: 2025-01-24 from CoinGecko DEX API
 */
const HARDCODED_POOLS: Record<string, HardcodedPool[]> = {
  'weth-usdt': [
    {
      address: '0x72331fcb696b0151904c03584b66dc8365bc63f8a144d89a773384e3a579ca73',
      name: 'ETH/USDT 0.05%',
      dex: 'uniswap_v4',
      fee_tier: '500',
      volume_24h: 36108572,
      liquidity_usd: 33065537,
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    },
    {
      address: '0x11b815efB8f581194ae79006d24E0d814B7697F6',
      name: 'WETH/USDT 0.05%',
      dex: 'uniswap_v3',
      fee_tier: '500',
      volume_24h: 150000000,
      liquidity_usd: 400000000,
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    },
    {
      address: '0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36',
      name: 'WETH/USDT 0.30%',
      dex: 'uniswap_v3',
      fee_tier: '3000',
      volume_24h: 80000000,
      liquidity_usd: 200000000,
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    },
    {
      address: '0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852',
      name: 'WETH/USDT',
      dex: 'uniswap_v2',
      volume_24h: 25000000,
      liquidity_usd: 120000000,
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    },
    {
      address: '0x06da0fd433C1A5d7a4faa01111c044910A184553',
      name: 'WETH/USDT',
      dex: 'sushiswap',
      volume_24h: 15000000,
      liquidity_usd: 80000000,
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    },
    {
      address: 'zeroX-aggregator-weth-usdt',
      name: 'WETH/USDT Aggregator',
      dex: 'zerox',
      fee_tier: 'variable',
      volume_24h: 100000000, // High volume due to aggregation
      liquidity_usd: 250000000, // Virtual liquidity representing aggregated sources
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    }
  ],

  'wbtc-usdc': [
    {
      address: '0x99ac8ca7087fa4a2a1fb6357269965a2014abc35',
      name: 'WBTC/USDC 0.30%',
      dex: 'uniswap_v3',
      fee_tier: '3000',
      volume_24h: 45000000,
      liquidity_usd: 180000000,
      tokens: {
        base: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8 },
        quote: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }
      }
    },
    {
      address: '0x004375dff511095cc5a197a54140a24efef3a416',
      name: 'WBTC/USDC 0.05%',
      dex: 'uniswap_v3',
      fee_tier: '500',
      volume_24h: 25000000,
      liquidity_usd: 100000000,
      tokens: {
        base: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8 },
        quote: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }
      }
    },
    {
      address: '0x3ea74c37fbb79dfcd6d760870f0f4e00cf4c3960b3259d0d43f211c0547394c1',
      name: 'WBTC/USDC User Suggested',
      dex: 'uniswap_v3',
      fee_tier: '3000',
      volume_24h: 15000000,
      liquidity_usd: 75000000,
      tokens: {
        base: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8 },
        quote: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }
      }
    },
    {
      address: '0x56534741cd8b152df6d48adf7ac51f75169a83b2',
      name: 'WBTC/USDT Fallback',
      dex: 'uniswap_v3',
      fee_tier: '3000',
      volume_24h: 20000000,
      liquidity_usd: 90000000,
      tokens: {
        base: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    }
  ],

  'wbtc-usdt': [
    {
      address: '0x56534741cd8b152df6d48adf7ac51f75169a83b2',
      name: 'WBTC/USDT User Suggested',
      dex: 'uniswap_v3',
      fee_tier: '3000',
      volume_24h: 25000000,
      liquidity_usd: 120000000,
      tokens: {
        base: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    }
  ],

  'uni-weth': [
    {
      address: '0x053f6a47ccba79e7d5d623173ed6dd5a31cf19c28bae0fb8276f4506295f90da',
      name: 'UNI/ETH V4',
      dex: 'uniswap_v4',
      fee_tier: '3000',
      volume_24h: 25000000,
      liquidity_usd: 85000000,
      tokens: {
        base: { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', decimals: 18 },
        quote: { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18 }
      }
    },
    {
      address: '0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801',
      name: 'UNI/WETH 0.30%',
      dex: 'uniswap_v3',
      fee_tier: '3000',
      volume_24h: 18000000,
      liquidity_usd: 75000000,
      tokens: {
        base: { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', decimals: 18 },
        quote: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 }
      }
    },
    {
      address: '0xd3d2E2692501A5c9Ca623199D38826e513033a17',
      name: 'UNI/WETH',
      dex: 'uniswap_v2',
      volume_24h: 8000000,
      liquidity_usd: 45000000,
      tokens: {
        base: { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', decimals: 18 },
        quote: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 }
      }
    }
  ],

  'weth-usdc': [
    {
      address: '0x00b9edc1583bf6ef09ff3a09f6c23ecb57fd7d0bb75625717ec81eed181e22d7',
      name: 'ETH/USDC 0.01%',
      dex: 'uniswap_v4',
      fee_tier: '100',
      volume_24h: 73975834,
      liquidity_usd: 6901141,
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }
      }
    },
    {
      address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
      name: 'WETH/USDC 0.05%',
      dex: 'uniswap_v3',
      fee_tier: '500',
      volume_24h: 200000000,
      liquidity_usd: 500000000,
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }
      }
    },
    {
      address: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8',
      name: 'WETH/USDC 0.30%',
      dex: 'uniswap_v3',
      fee_tier: '3000',
      volume_24h: 120000000,
      liquidity_usd: 300000000,
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }
      }
    },
    {
      address: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
      name: 'WETH/USDC',
      dex: 'uniswap_v2',
      volume_24h: 35000000,
      liquidity_usd: 150000000,
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }
      }
    },
    {
      address: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0',
      name: 'WETH/USDC',
      dex: 'sushiswap',
      volume_24h: 20000000,
      liquidity_usd: 90000000,
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }
      }
    },
    {
      address: 'zeroX-aggregator-weth-usdc',
      name: 'WETH/USDC Aggregator',
      dex: 'zerox',
      fee_tier: 'variable',
      volume_24h: 120000000, // High volume due to aggregation
      liquidity_usd: 300000000, // Virtual liquidity representing aggregated sources
      tokens: {
        base: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
        quote: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }
      }
    }
  ],

  'usdc-dai': [
    {
      address: '0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168',
      name: 'USDC/DAI 0.01%',
      dex: 'uniswap_v3',
      fee_tier: '100',
      volume_24h: 30000000,
      liquidity_usd: 180000000,
      tokens: {
        base: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
        quote: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 }
      }
    },
    {
      address: '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7',
      name: 'USDC/DAI Curve 3Pool',
      dex: 'curve',
      volume_24h: 50000000,
      liquidity_usd: 300000000,
      tokens: {
        base: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
        quote: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 }
      }
    },
    {
      address: '0x06df3b2bbb68adc8b0e302443692037ed9f91b42',
      name: 'USDC/DAI Balancer',
      dex: 'balancer',
      volume_24h: 20000000,
      liquidity_usd: 150000000,
      tokens: {
        base: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
        quote: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 }
      }
    },
    {
      address: 'zeroX-aggregator-usdc-dai',
      name: 'USDC/DAI Aggregator',
      dex: 'zerox',
      fee_tier: 'variable',
      volume_24h: 75000000, // High volume due to aggregation
      liquidity_usd: 200000000, // Virtual liquidity representing aggregated sources
      tokens: {
        base: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
        quote: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 }
      }
    }
  ],

  'usde-usdt': [
    {
      address: '0xf063BD202E45d6b2843102cb4EcE339026645D4a',
      name: 'USDe/USDT Fluid 0.01%',
      dex: 'fluid',
      fee_tier: '100',
      volume_24h: 15000000,
      liquidity_usd: 35000000,
      tokens: {
        base: { address: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3', symbol: 'USDe', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    },
    {
      address: '0xaae9da4a878406eb1de54efac30e239fd56d54fb',
      name: 'USDe/USDT 0.0063%',
      dex: 'uniswap_v4',
      fee_tier: '63',
      volume_24h: 72269924,
      liquidity_usd: 80000000,
      tokens: {
        base: { address: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3', symbol: 'USDe', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    },
    {
      address: '0x435664008f38b0650fbc1c9fc971d0a3bc2f1e47',
      name: 'USDe/USDT 0.01%',
      dex: 'uniswap_v3',
      fee_tier: '100',
      volume_24h: 11727959,
      liquidity_usd: 50000000,
      tokens: {
        base: { address: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3', symbol: 'USDe', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    },
    {
      address: '0x9ebc4fcaab898b75c1d1f6f7a301621fb004a9f3',
      name: 'USDe/USDT 0.003%',
      dex: 'uniswap_v4',
      fee_tier: '30',
      volume_24h: 3229527,
      liquidity_usd: 25000000,
      tokens: {
        base: { address: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3', symbol: 'USDe', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    },
    {
      address: '0x5b03cccab7ba3010fa5cad23746cbf0794938e96',
      name: 'USDT/USDe Curve',
      dex: 'curve',
      volume_24h: 8000000,
      liquidity_usd: 40000000,
      tokens: {
        base: { address: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3', symbol: 'USDe', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    },
    {
      address: 'zeroX-aggregator-usde-usdt',
      name: 'USDe/USDT Aggregator',
      dex: 'zerox',
      fee_tier: 'variable',
      volume_24h: 50000000, // High volume due to aggregation
      liquidity_usd: 100000000, // Virtual liquidity representing aggregated sources
      tokens: {
        base: { address: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3', symbol: 'USDe', decimals: 18 },
        quote: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 }
      }
    }
  ]
};

class HardcodedPoolService {
  private lastUpdated = new Date('2025-01-24');
  private updateInterval = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds

  /**
   * Get hardcoded pools for a specific token pair
   */
  getPoolsForPair(tokenPair: TokenPair): PoolInfo[] {
    const pools = HARDCODED_POOLS[tokenPair.id] || [];
    
    logger.info('HardcodedPoolService', `Found ${pools.length} hardcoded pools for ${tokenPair.name}`);
    
    // Convert to PoolInfo format
    return pools.map(pool => ({
      address: pool.address,
      name: pool.name,
      dex: pool.dex,
      network: 'ethereum',
      tokens: pool.tokens,
      fee_tier: pool.fee_tier,
      volume_24h: pool.volume_24h,
      liquidity_usd: pool.liquidity_usd
    }));
  }

  /**
   * Get all available pools across all token pairs
   */
  getAllPools(): Record<string, PoolInfo[]> {
    const result: Record<string, PoolInfo[]> = {};
    
    Object.keys(HARDCODED_POOLS).forEach(pairId => {
      const pools = HARDCODED_POOLS[pairId] || [];
      result[pairId] = pools.map(pool => ({
        address: pool.address,
        name: pool.name,
        dex: pool.dex,
        network: 'ethereum',
        tokens: pool.tokens,
        fee_tier: pool.fee_tier,
        volume_24h: pool.volume_24h,
        liquidity_usd: pool.liquidity_usd
      }));
    });

    return result;
  }

  /**
   * Check if pool data needs updating (every 5 days)
   */
  needsUpdate(): boolean {
    const now = new Date();
    const timeSinceUpdate = now.getTime() - this.lastUpdated.getTime();
    const needsUpdate = timeSinceUpdate > this.updateInterval;
    
    logger.debug('HardcodedPoolService', `Pool data age: ${(timeSinceUpdate / (24 * 60 * 60 * 1000)).toFixed(1)} days, needs update: ${needsUpdate}`);
    
    return needsUpdate;
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    totalPools: number;
    poolsByDex: Record<string, number>;
    poolsByPair: Record<string, number>;
    totalLiquidityUsd: number;
    avgLiquidity: number;
  } {
    let totalPools = 0;
    let totalLiquidityUsd = 0;
    const poolsByDex: Record<string, number> = {};
    const poolsByPair: Record<string, number> = {};

    Object.entries(HARDCODED_POOLS).forEach(([pairId, pools]) => {
      poolsByPair[pairId] = pools.length;
      totalPools += pools.length;

      pools.forEach(pool => {
        poolsByDex[pool.dex] = (poolsByDex[pool.dex] || 0) + 1;
        totalLiquidityUsd += pool.liquidity_usd;
      });
    });

    return {
      totalPools,
      poolsByDex,
      poolsByPair,
      totalLiquidityUsd,
      avgLiquidity: totalPools > 0 ? totalLiquidityUsd / totalPools : 0
    };
  }

  /**
   * Get metadata about the pool registry
   */
  getRegistryInfo(): {
    lastUpdated: Date;
    nextUpdateDue: Date;
    supportedPairs: string[];
    supportedDexes: string[];
    updateIntervalDays: number;
  } {
    const nextUpdateDue = new Date(this.lastUpdated.getTime() + this.updateInterval);
    const allDexes = new Set<string>();

    Object.values(HARDCODED_POOLS).forEach(pools => {
      pools.forEach(pool => allDexes.add(pool.dex));
    });

    return {
      lastUpdated: this.lastUpdated,
      nextUpdateDue,
      supportedPairs: Object.keys(HARDCODED_POOLS),
      supportedDexes: Array.from(allDexes).sort(),
      updateIntervalDays: this.updateInterval / (24 * 60 * 60 * 1000)
    };
  }
}

export default HardcodedPoolService;