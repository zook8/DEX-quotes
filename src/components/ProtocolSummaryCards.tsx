/**
 * Protocol Summary Cards Component
 * Shows overall performance summary for all DEX protocols
 */

import React from 'react';
import { TrendingUp, Award, BarChart3 } from 'lucide-react';
import type { DexComparisonResult } from '../services/dexComparisonService';

interface ProtocolSummaryCardsProps {
  results: DexComparisonResult[];
}

interface ProtocolOverallSummary {
  protocol: string;
  totalPools: number;
  successfulPools: number;
  bestRanks: number[];
  avgRank: number;
  appearances: number;
  successRate: number;
  topPerformances: number; // Number of times in top 3
}

export const ProtocolSummaryCards: React.FC<ProtocolSummaryCardsProps> = ({ results }) => {
  const calculateOverallSummary = (): ProtocolOverallSummary[] => {
    const protocolMap = new Map<string, {
      pools: number;
      successful: number;
      ranks: number[];
      appearances: number;
      topPerformances: number;
    }>();

    results.forEach(result => {
      result.protocolSummary.forEach(protocol => {
        const key = protocol.protocol;
        const current = protocolMap.get(key) || {
          pools: 0,
          successful: 0,
          ranks: [],
          appearances: 0,
          topPerformances: 0
        };

        current.pools += protocol.poolCount;
        current.successful += protocol.bestQuote ? 1 : 0;
        current.appearances += 1;
        
        if (protocol.bestRank !== null) {
          current.ranks.push(protocol.bestRank);
          if (protocol.bestRank === 1) {
            current.topPerformances += 1;
          }
        }

        protocolMap.set(key, current);
      });
    });

    return Array.from(protocolMap.entries()).map(([protocol, data]) => ({
      protocol,
      totalPools: data.pools,
      successfulPools: data.successful,
      bestRanks: data.ranks,
      avgRank: data.ranks.length > 0 
        ? data.ranks.reduce((sum, rank) => sum + rank, 0) / data.ranks.length 
        : 0,
      appearances: data.appearances,
      successRate: data.pools > 0 ? (data.successful / data.pools) * 100 : 0,
      topPerformances: data.topPerformances
    }))
    .filter(summary => summary.appearances > 0)
    .sort((a, b) => a.avgRank - b.avgRank);
  };

  const summaries = calculateOverallSummary();

  const getProtocolEmoji = (protocol: string): string => {
    const emojiMap: Record<string, string> = {
      'uniswap_v3': '🦄',
      'uniswap_v2': '🦄',
      'uniswap_v4': '🦄',
      'sushiswap': '🍣',
      'curve': '🌊',
      'balancer': '⚖️',
      'pancakeswap': '🥞',
      'fluid': '💧',
      // Also support formatted names
      'Uniswap V3': '🦄',
      'Uniswap V2': '🦄',
      'Uniswap V4': '🦄',
      'SushiSwap': '🍣',
      'Curve Finance': '🌊',
      'Balancer': '⚖️',
      'PancakeSwap': '🥞',
      'Fluid': '💧'
    };
    return emojiMap[protocol] || '🔄';
  };

  // Removed unused color functions

  if (summaries.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center mb-6">
        <BarChart3 className="h-6 w-6 text-blue-400 mr-2" />
        <h3 className="text-lg font-semibold text-gray-200">
          Protocol Performance Summary
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {summaries.slice(0, 8).map((summary) => (
          <div 
            key={summary.protocol}
            className="bg-gray-900 rounded-lg border border-gray-600 p-4 hover:border-gray-500 transition-colors"
          >
            {/* Protocol Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{getProtocolEmoji(summary.protocol)}</span>
                <h4 className="text-sm font-medium text-gray-200 truncate">
                  {summary.protocol}
                </h4>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Quotes</span>
                <span className="text-sm text-gray-300">
                  {summary.totalPools}
                </span>
              </div>

              {summary.topPerformances > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">First-Place Finishes</span>
                  <div className="flex items-center space-x-1">
                    <Award className="h-3 w-3 text-yellow-400" />
                    <span className="text-sm text-yellow-400">
                      {summary.topPerformances}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Performance Indicator */}
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="flex items-center justify-center space-x-1">
                <TrendingUp className={`h-4 w-4 ${
                  summary.avgRank <= 2 ? 'text-green-400' : 
                  summary.avgRank <= 3 ? 'text-yellow-400' : 
                  'text-red-400'
                }`} />
                <span className="text-xs text-gray-400">
                  {summary.avgRank <= 1.5 ? 'Excellent' :
                   summary.avgRank <= 2.5 ? 'Good' :
                   summary.avgRank <= 3.5 ? 'Average' : 'Below Average'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};