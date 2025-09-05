import React from 'react';
import type { PairQuote } from '../types/api';

interface PairRankingTableProps {
  quote: PairQuote | null;
  isLoading?: boolean;
}

export const PairRankingTable: React.FC<PairRankingTableProps> = ({ 
  quote, 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">No Data Available</h3>
        <p className="text-gray-600">Unable to fetch quotes for this pair</p>
      </div>
    );
  }

  const formatAmount = (amount: string, decimals: number) => {
    const value = parseFloat(amount) / Math.pow(10, decimals);
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-600 bg-yellow-50';
      case 2: return 'text-gray-600 bg-gray-50';
      case 3: return 'text-amber-600 bg-amber-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🏆';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '📊';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{quote.pair.name}</h3>
        <span className="text-sm text-gray-500">
          {new Date(quote.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <div className="mb-4 p-3 bg-gray-50 rounded">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Expected Output:</span>
            <p className="font-mono font-medium">
              {formatAmount(quote.totalBuyAmount, quote.pair.buyToken.decimals)} {quote.pair.buyToken.symbol}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Guaranteed Min:</span>
            <p className="font-mono font-medium">
              {formatAmount(quote.minBuyAmount, quote.pair.buyToken.decimals)} {quote.pair.buyToken.symbol}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-gray-700 mb-3">Protocol Rankings</h4>
        {quote.rankings.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No single-hop swaps available for this pair
          </div>
        ) : (
          <div className="space-y-2">
            {quote.rankings.map((ranking) => (
              <div
                key={ranking.protocol}
                className={`flex items-center justify-between p-3 rounded-lg border ${getRankColor(ranking.rank)}`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{getRankEmoji(ranking.rank)}</span>
                  <div>
                    <p className="font-medium">{ranking.protocol.replace('_', ' ')}</p>
                    <p className="text-sm opacity-75">Rank #{ranking.rank}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">{ranking.effectiveRate.toFixed(2)}%</p>
                  <p className="text-xs opacity-75">
                    {ranking.totalProportion} bps
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {quote.singleHopFills.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
              Single-hop fills ({quote.singleHopFills.length})
            </summary>
            <div className="mt-2 space-y-1 pl-4">
              {quote.singleHopFills.map((fill, index) => (
                <div key={index} className="text-xs text-gray-500 font-mono">
                  {fill.source}: {fill.proportionBps} bps
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};