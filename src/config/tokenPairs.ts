import type { TokenPair } from '../types/api';

// Token pair configurations with $10K USD equivalent amounts
export const TOKEN_PAIRS: TokenPair[] = [
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
    sellAmount: '2127659574468085000' // ~2.13 ETH (~$10K at ~$4700/ETH)
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
    sellAmount: '555555555555555555555' // ~555.6 UNI (~$10K at ~$18/UNI)
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
    sellAmount: '2127659574468085000' // ~2.13 ETH (~$10K at ~$4700/ETH)
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
    sellAmount: '10000000000' // $10K USDC
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
    sellAmount: '10000000000000000000000' // 10K USDe (~$10K at ~$1/USDe)
  }
];

export const API_CONFIG = {
  baseUrl: '/api', // Use our proxy instead of direct 0x API
  apiKey: 'dee1a681-0a60-4537-b560-ba86dc8f8423',
  chainId: 1,
  headers: {
    'Content-Type': 'application/json'
  }
};