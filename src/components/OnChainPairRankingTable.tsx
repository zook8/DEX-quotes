/**
 * On-Chain Pair Ranking Table Component
 * Displays pool-level comparison results for a single token pair
 */

import React from 'react';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';
import type { DexComparisonResult } from '../services/dexComparisonService';
import { ethers } from 'ethers';

interface OnChainPairRankingTableProps {
  result: DexComparisonResult | null;
  isLoading: boolean;
}

export const OnChainPairRankingTable: React.FC<OnChainPairRankingTableProps> = ({
  result,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4 w-3/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-gray-700 rounded w-full"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="text-center text-gray-400">
          <AlertCircle className="mx-auto h-8 w-8 mb-2" />
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const { pair, simulation, bestProtocol, successfulQuotes, totalPoolsFound } = result;
  const hasData = successfulQuotes > 0;

  const formatAmount = (amount: string, decimals: number): string => {
    if (amount === '0') return '0.00';
    try {
      const formatted = ethers.formatUnits(amount, decimals);
      const num = parseFloat(formatted);
      return num.toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    } catch {
      return '0.00';
    }
  };

  const getProtocolEmoji = (protocol: string): string => {
    const emojiMap: Record<string, string> = {
      'uniswap_v3': '🦄',
      'uniswap_v2': '🦄',
      'uniswap_v4': '🦄',
      'sushiswap': '🍣',
      'curve': '🌊',
      'balancer': '⚖️',
      'pancakeswap': '🥞',
      'zerox': '🔀',
      '0x': '🔀',
      'matcha': '🔀',
      // Also support formatted names
      'Uniswap V3': '🦄',
      'Uniswap V2': '🦄',
      'Uniswap V4': '🦄',
      'SushiSwap': '🍣',
      'Curve Finance': '🌊',
      'Balancer': '⚖️',
      'PancakeSwap': '🥞',
      'ZeroX': '🔀',
      'Matcha': '🔀'
    };
    return emojiMap[protocol] || '🔄';
  };

  const getRankEmoji = (rank: number): string => {
    if (rank === 1) return '🏆';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">
            {pair.name}
          </h3>
          <div className="flex items-center text-sm text-gray-400 mt-1">
            <Clock className="h-4 w-4 mr-1" />
            {new Date(result.timestamp).toLocaleTimeString()}
          </div>
        </div>
        <div className="text-right">
          <div 
            className={`inline-flex items-center px-2 py-1 rounded text-xs cursor-help ${
              hasData ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
            }`}
            title={`${successfulQuotes}/${totalPoolsFound} pools successfully quoted using on-chain data.`}
          >
            {hasData ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
            {successfulQuotes}/{totalPoolsFound} pools
          </div>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Best Quote Summary */}
          {simulation.bestQuote && (
            <div className="bg-gray-900 rounded-lg p-4 mb-4 border border-gray-600">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Input Amount:</span>
                <span className="text-sm font-medium text-blue-400">
                  {formatAmount(simulation.bestQuote.inputAmount, pair.sellToken.decimals)} {pair.sellToken.symbol}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Expected Output:</span>
                <span className="text-lg font-semibold text-green-400">
                  {formatAmount(simulation.bestQuote.outputAmount, pair.buyToken.decimals)} {pair.buyToken.symbol}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Guaranteed Min:</span>
                <span className="text-sm text-gray-300">
                  {formatAmount(
                    (parseFloat(simulation.bestQuote.outputAmount) * 0.99).toFixed(0), 
                    pair.buyToken.decimals
                  )} {pair.buyToken.symbol}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Best Quote:</span>
                <span className="text-sm text-blue-400 font-medium">
                  {bestProtocol?.startsWith('🔀') ? 
                    bestProtocol : // ZeroX names already have emoji
                    `${getProtocolEmoji(bestProtocol || '')} ${bestProtocol}`
                  }
                </span>
              </div>
            </div>
          )}

          {/* Protocol Rankings */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Protocol Rankings</h4>
            <div className="space-y-2">
              {simulation.rankings.slice(0, 5).map((ranking) => (
                <div 
                  key={`${ranking.pool.dex}-${ranking.pool.address}`}
                  className="flex items-center justify-between p-3 bg-gray-900 rounded border border-gray-600"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getRankEmoji(ranking.rank)}</span>
                    <div>
                      <p 
                        className="text-sm font-medium text-gray-200 cursor-help"
                        title={ranking.quote.protocolDetails || undefined}
                      >
                        {ranking.pool.dex.startsWith('🔀') ? 
                          ranking.pool.dex : // ZeroX names already have emoji, use as-is
                          `${getProtocolEmoji(ranking.pool.dex)} ${ranking.pool.dex.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`
                        }
                        {ranking.pool.fee_tier && ranking.pool.fee_tier !== 'variable' && !isNaN(parseFloat(ranking.pool.fee_tier)) && (
                          <span className="text-white opacity-70 ml-1">
                            {(parseFloat(ranking.pool.fee_tier) / 10000).toFixed(3)}%
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        Rank #{ranking.rank}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p 
                      className={`text-sm font-medium flex items-center justify-end cursor-help ${
                        ranking.priceAdvantage > 0 ? 'text-green-400' : ranking.priceAdvantage === 0 ? 'text-white' : 'text-red-400'
                      }`}
                      title={`Price advantage: ${ranking.priceAdvantage.toFixed(2)}% better output than the worst performing pool`}
                    >
                      {ranking.priceAdvantage > 0 ? (
                        <span className="mr-1">↗</span>
                      ) : ranking.priceAdvantage < 0 ? (
                        <span className="mr-1">↘</span>
                      ) : null}
                      {ranking.priceAdvantage.toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatAmount(ranking.quote.outputAmount, pair.buyToken.decimals)} {pair.buyToken.symbol}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pool Details */}
          <div className="text-xs text-gray-500">
            <p>Single-hop pools ({simulation.quotes.filter(q => q.success).length})</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {simulation.quotes.filter(q => q.success).slice(0, 6).map((quote, i) => (
                <span 
                  key={i} 
                  className="bg-gray-700 px-2 py-1 rounded cursor-help"
                  title={quote.protocolDetails || undefined}
                >
                  {quote.pool.dex.startsWith('🔀') ? 
                    quote.pool.dex.replace('🔀 ', '').replace(' via Matcha', '') : // Clean ZeroX name, remove emoji and suffix
                    quote.pool.dex.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                  }
                  {quote.pool.fee_tier && quote.pool.fee_tier !== 'variable' && !isNaN(parseFloat(quote.pool.fee_tier)) && (
                    <span className="text-blue-400 ml-1">
                      {(parseFloat(quote.pool.fee_tier) / 10000).toFixed(3)}%
                    </span>
                  )}
                </span>
              ))}
              {simulation.quotes.filter(q => q.success).length > 6 && (
                <span className="text-gray-400">
                  +{simulation.quotes.filter(q => q.success).length - 6} more
                </span>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-600 mb-4" />
          <p className="text-gray-400 mb-2">No Data Available</p>
          <p className="text-sm text-gray-500">
            Unable to fetch quotes for this pair
          </p>
        </div>
      )}
    </div>
  );
};