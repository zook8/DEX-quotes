/**
 * On-Chain Dashboard Component
 * Uses direct pool queries instead of 0x API
 * Shows real pool-by-pool comparisons for Uniswap Foundation
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { browserDynamicTokenPairService } from '../config/browserDynamicTokenPairs';
// import type { DynamicTokenPair } from '../config/browserDynamicTokenPairs';
import { TOKEN_PAIRS } from '../config/tokenPairs';
import type { TokenPair } from '../types/api';
import DexComparisonService, { type DexComparisonResult } from '../services/dexComparisonService';
import { OnChainPairRankingTable } from './OnChainPairRankingTable';
import { ProtocolSummaryCards } from './ProtocolSummaryCards';

const dexComparisonService = new DexComparisonService();

export const OnChainDashboard: React.FC = () => {
  const [results, setResults] = useState<Record<string, DexComparisonResult>>({});
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [currentlyProcessing, setCurrentlyProcessing] = useState<string | null>(null);
  const [allPairs, setAllPairs] = useState<TokenPair[]>([]);

  // Health check query
  const { data: healthStatus } = useQuery({
    queryKey: ['healthCheck'],
    queryFn: () => dexComparisonService.healthCheck(),
    refetchInterval: 5 * 60 * 1000, // Check every 5 minutes
    retry: 1, // Only retry once to avoid excessive API calls
  });

  // Main data fetching query with dynamic token pairs
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['onChainQuotes', lastUpdate],
    queryFn: async () => {
      const results: Record<string, DexComparisonResult> = {};
      
      // Step 1: Create hybrid token pairs - dynamic for WETH/UNI pairs, original for stablecoins
      console.log('🔄 Loading hybrid token pairs (dynamic WETH/UNI + original stablecoins)...');
      
      const hybridPairs: TokenPair[] = [];
      const dynamicPairIds = ['weth-usdt', 'uni-weth', 'weth-usdc']; // Only these use dynamic pricing
      
      for (const originalPair of TOKEN_PAIRS) {
        if (dynamicPairIds.includes(originalPair.id)) {
          // Use dynamic pricing for WETH/UNI pairs
          try {
            console.log(`🔍 Getting dynamic pricing for ${originalPair.name}...`);
            const dynamicPair = await browserDynamicTokenPairService.getTokenPair(originalPair.id);
            if (dynamicPair) {
              hybridPairs.push(dynamicPair);
              const formatted = (Number(dynamicPair.sellAmount) / Math.pow(10, dynamicPair.sellToken.decimals)).toFixed(6);
              console.log(`💰 ${dynamicPair.name}: ${formatted} ${dynamicPair.sellToken.symbol} (price: $${dynamicPair.priceUsed?.toFixed(2)}, source: ${dynamicPair.priceSource})`);
            } else {
              // Fallback to original if dynamic fails
              hybridPairs.push(originalPair);
              console.log(`⚠️ ${originalPair.name}: Using fallback (dynamic failed)`);
            }
          } catch (error) {
            // Fallback to original if dynamic fails
            hybridPairs.push(originalPair);
            console.log(`⚠️ ${originalPair.name}: Using fallback (error: ${error})`);
          }
        } else {
          // Use original configuration for stablecoin pairs
          hybridPairs.push(originalPair);
          console.log(`✅ ${originalPair.name}: Using original configuration`);
        }
      }
      
      console.log(`✅ Loaded ${hybridPairs.length} hybrid pairs (${dynamicPairIds.length} dynamic, ${hybridPairs.length - dynamicPairIds.length} original)`);
      
      // Store pairs in state for rendering
      setAllPairs(hybridPairs);
      
      // Update total pairs count for progress tracking
      setTotalPairs(hybridPairs.length);
      
      // Step 2: Process pairs sequentially with progress updates
      const targetUSD = 10000; // All pairs target $10K
      for (const pair of hybridPairs) {
        setCurrentlyProcessing(pair.name);
        
        try {
          console.log(`🔍 Processing ${pair.name}...`);
          const result = await dexComparisonService.compareTokenPair(pair, targetUSD);
          results[pair.id] = result;
          
          // Update state incrementally so user sees progress
          setResults(prev => ({ ...prev, [pair.id]: result }));
          
        } catch (error) {
          console.error(`❌ Failed to process ${pair.name}:`, error);
          results[pair.id] = {
            pair,
            timestamp: Date.now(),
            inputAmountUSD: targetUSD,
            totalPoolsFound: 0,
            successfulQuotes: 0,
            simulation: { quotes: [], bestQuote: null, rankings: [] },
            bestProtocol: null,
            protocolSummary: []
          };
        }
      }
      
      setCurrentlyProcessing(null);
      return results;
    },
    refetchInterval: 60 * 60 * 1000, // Refresh every 1 hour
    staleTime: 55 * 60 * 1000, // Consider stale after 55 minutes
    retry: 2, // Retry failed requests twice
  });

  useEffect(() => {
    if (data) {
      setResults(data);
    }
  }, [data]);

  const handleRefresh = () => {
    setLastUpdate(Date.now());
    setResults({}); // Clear previous results
    refetch();
  };

  // Add state for dynamic pairs count
  const [totalPairs, setTotalPairs] = useState(5); // Default to 5 pairs

  const getProcessingProgress = () => {
    if (!isLoading) return null;
    const processed = Object.keys(results).length;
    return { processed, total: totalPairs, current: currentlyProcessing };
  };

  const getOverallStats = () => {
    const allResults = Object.values(results).filter(r => r.successfulQuotes > 0);
    
    if (allResults.length === 0) return null;

    const totalPools = allResults.reduce((sum, r) => sum + r.totalPoolsFound, 0);
    const successfulQuotes = allResults.reduce((sum, r) => sum + r.successfulQuotes, 0);
    const protocolCounts = new Map<string, number>();

    allResults.forEach(result => {
      result.protocolSummary.forEach(protocol => {
        const current = protocolCounts.get(protocol.protocol) || 0;
        protocolCounts.set(protocol.protocol, current + protocol.poolCount);
      });
    });

    return {
      totalPools,
      successfulQuotes,
      successRate: ((successfulQuotes / totalPools) * 100).toFixed(1),
      protocolsFound: protocolCounts.size,
      mostCommonProtocol: Array.from(protocolCounts.entries())
        .sort(([,a], [,b]) => b - a)[0]?.[0]
    };
  };

  const progress = getProcessingProgress();
  const stats = getOverallStats();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* IMPROVED RESPONSIVE HEADER */}
      <div className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          
          {/* MOBILE LAYOUT (< md) - Vertical Stack */}
          <div className="md:hidden space-y-3">
            {/* Title & Subtitle */}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-100">
                Live DEX Quotes
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Best direct pool quotes for USD $10K swaps
              </p>
            </div>

            {/* Refresh Button - Prominent on mobile */}
            <div className="flex justify-center">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 text-white px-6 py-2 rounded-lg transition-colors font-medium"
              >
                {isLoading ? 'Processing...' : 'Refresh All'}
              </button>
            </div>

            {/* Processing Status (mobile) */}
            {progress && (
              <div className="text-center text-sm text-blue-400">
                Processing {progress.processed}/{progress.total}: {progress.current}
              </div>
            )}

            {/* Last Updated - Bottom on mobile */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Last updated: {new Date(lastUpdate).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* DESKTOP LAYOUT (≥ md) - Original Horizontal */}
          <div className="hidden md:flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-100">
                Live DEX Quotes
              </h1>
              <p className="text-gray-400 mt-1">
                Best direct pool quotes for USD $10K swaps
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Health Status - Desktop only */}
              {healthStatus && (
                <div className="text-right text-sm">
                  <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                    healthStatus.coinGeckoApi && healthStatus.alchemyRpc
                      ? 'bg-green-900 text-green-200'
                      : 'bg-yellow-900 text-yellow-200'
                  }`}>
                    {healthStatus.coinGeckoApi && healthStatus.alchemyRpc ? '🟢 APIs Healthy' : '🟡 API Issues'}
                  </div>
                </div>
              )}

              <div className="text-right">
                <p className="text-sm text-gray-400">
                  Last updated: {new Date(lastUpdate).toLocaleTimeString()}
                </p>
                {progress && (
                  <div className="text-sm text-blue-400">
                    Processing {progress.processed}/{progress.total}: {progress.current}
                  </div>
                )}
              </div>
              
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {isLoading ? 'Processing...' : 'Refresh All'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${(progress.processed / progress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-900 border border-red-700 rounded-lg p-4">
            <div className="flex">
              <div className="text-red-400">⚠️</div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-200">
                  Error processing pool comparisons
                </h3>
                <div className="mt-2 text-sm text-red-300">
                  {error instanceof Error ? error.message : 'Unknown error occurred'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overall Stats */}
        {stats && (
          <div className="mb-8 bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4 text-center md:text-left">
              Overall Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">{stats.totalPools}</p>
                <p className="text-sm text-gray-400">Total Pools</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{stats.successfulQuotes}</p>
                <p className="text-sm text-gray-400">Quotes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-400">{stats.protocolsFound}</p>
                <p className="text-sm text-gray-400">DEX</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-300">{stats.mostCommonProtocol}</p>
                <p className="text-sm text-gray-400">Most Quotes</p>
              </div>
            </div>
          </div>
        )}

        {/* Token Pair Results */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {allPairs.map((pair) => (
            <OnChainPairRankingTable
              key={pair.id}
              result={results[pair.id] ?? null}
              isLoading={isLoading && !results[pair.id]}
            />
          ))}
        </div>

        {/* Protocol Summary */}
        {Object.keys(results).length > 0 && (
          <ProtocolSummaryCards results={Object.values(results)} />
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Data sourced from CoinGecko DEX API + Alchemy RPC • Updated every 1 hour</p>
          <p className="mt-1">
            Built for Uniswap Foundation • Direct on-chain pool comparison via eth_call
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {healthStatus && `CoinGecko: ${healthStatus.coinGeckoApi ? '✅' : '❌'} • Alchemy: ${healthStatus.alchemyRpc ? '✅' : '❌'}`} • Quote Success Rate: {stats?.successRate}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default OnChainDashboard;