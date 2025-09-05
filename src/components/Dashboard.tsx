import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PairRankingTable } from './PairRankingTable';
import type { PairQuote } from '../types/api';
import { TOKEN_PAIRS } from '../config/tokenPairs';
import { zeroXApi } from '../services/zeroXApi';

export const Dashboard: React.FC = () => {
  const [quotes, setQuotes] = useState<Record<string, PairQuote | null>>({});
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // Fetch quotes for all pairs
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['allQuotes', lastUpdate],
    queryFn: async () => {
      const results: Record<string, PairQuote | null> = {};
      
      // Sequential API calls with 2s delay (VPS-friendly)
      for (const pair of TOKEN_PAIRS) {
        try {
          console.log(`Fetching quote for ${pair.name}...`);
          const quote = await zeroXApi.getPairQuote(pair);
          results[pair.id] = quote;
          
          // 2 second delay between calls to be resource-friendly
          if (pair !== TOKEN_PAIRS[TOKEN_PAIRS.length - 1]) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Failed to fetch ${pair.name}:`, error);
          results[pair.id] = null;
        }
      }
      
      return results;
    },
    refetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
    staleTime: 25 * 60 * 1000, // Consider stale after 25 minutes
  });

  useEffect(() => {
    if (data) {
      setQuotes(data);
    }
  }, [data]);

  const handleRefresh = () => {
    setLastUpdate(Date.now());
    refetch();
  };

  const getLoadingStateCount = () => {
    return TOKEN_PAIRS.filter(pair => !quotes[pair.id] && isLoading).length;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Live DEX Price Rankings
              </h1>
              <p className="text-gray-600 mt-1">
                $50K swap quotes • Single-hop direct swaps only • Ethereum mainnet
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  Last updated: {new Date(lastUpdate).toLocaleTimeString()}
                </p>
                {isLoading && (
                  <p className="text-sm text-blue-600">
                    Loading {getLoadingStateCount()} pairs...
                  </p>
                )}
              </div>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {isLoading ? 'Refreshing...' : 'Refresh All'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="text-red-400">⚠️</div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error fetching quotes
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {error instanceof Error ? error.message : 'Unknown error occurred'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {TOKEN_PAIRS.map((pair) => (
            <PairRankingTable
              key={pair.id}
              quote={quotes[pair.id] ?? null}
              isLoading={isLoading && !quotes[pair.id]}
            />
          ))}
        </div>

        {/* Summary Stats */}
        {!isLoading && Object.values(quotes).some(q => q !== null) && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Protocol Performance Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {getProtocolSummary(quotes).map(({ protocol, appearances, avgRank }) => (
                <div key={protocol} className="text-center p-3 bg-gray-50 rounded">
                  <p className="font-medium text-gray-800">{protocol.replace('_', ' ')}</p>
                  <p className="text-2xl font-bold text-blue-600">{avgRank.toFixed(1)}</p>
                  <p className="text-sm text-gray-600">Avg Rank ({appearances} pairs)</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Data provided by 0x API • Updated every 30 minutes</p>
          <p className="mt-1">
            Built for Uniswap Foundation • Showing single-hop execution prices
          </p>
        </div>
      </div>
    </div>
  );
};

// Helper function to calculate protocol summary stats
function getProtocolSummary(quotes: Record<string, PairQuote | null>) {
  const protocolStats: Record<string, { ranks: number[], appearances: number }> = {};

  Object.values(quotes).forEach(quote => {
    if (!quote) return;
    
    quote.rankings.forEach(ranking => {
      if (!protocolStats[ranking.protocol]) {
        protocolStats[ranking.protocol] = { ranks: [], appearances: 0 };
      }
      protocolStats[ranking.protocol].ranks.push(ranking.rank);
      protocolStats[ranking.protocol].appearances++;
    });
  });

  return Object.entries(protocolStats)
    .map(([protocol, stats]) => ({
      protocol,
      appearances: stats.appearances,
      avgRank: stats.ranks.reduce((sum, rank) => sum + rank, 0) / stats.ranks.length
    }))
    .sort((a, b) => a.avgRank - b.avgRank)
    .slice(0, 8); // Top 8 protocols
}