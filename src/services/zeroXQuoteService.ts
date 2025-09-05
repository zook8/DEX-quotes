/**
 * ZeroX API Quote Service
 * Integrates ZeroX API quotes into the protocol ranking system
 */

import { zeroXApi } from './zeroXApi';
import type { TokenPair } from '../types/api';
import type { OnChainQuote } from './onChainQuoteService';
import type { PoolInfo } from './coinGeckoPoolService';
import { ethers } from 'ethers';

export interface ZeroXProtocolInfo {
  name: string;
  percentage: number;
}

export interface ZeroXQuoteResult {
  quote: OnChainQuote;
  protocols: ZeroXProtocolInfo[];
  totalFillCount: number;
  protocolDetails: string; // Multi-hop routing breakdown for hover/tooltip
}

export class ZeroXQuoteService {
  /**
   * Format protocol name for clean UI display:
   * - Single protocol: "🔀 Ekubo via Matcha"
   * - Two protocols: "🔀 Ekubo+Uniswap_V3 via Matcha"
   * - 3+ protocols: "🔀 Matcha via aggregation" (with full details in hover/tooltip)
   */
  static formatProtocolName(protocols: ZeroXProtocolInfo[]): string {
    if (protocols.length === 0) {
      return '🔀 Unknown via Matcha';
    }
    
    // Single protocol case
    if (protocols.length === 1) {
      return `🔀 ${protocols[0].name} via Matcha`;
    }
    
    // Two protocols - show both without percentages
    if (protocols.length === 2) {
      const protocolParts = protocols.map(p => p.name).join('+');
      return `🔀 ${protocolParts} via Matcha`;
    }
    
    // 3+ protocols - use clean "aggregation" display
    return '🔀 Matcha via aggregation';
  }

  /**
   * Get detailed multi-hop routing breakdown for hover/tooltip display
   * Shows token paths and protocols used for each hop
   */
  static getProtocolDetails(protocols: ZeroXProtocolInfo[], fills: any[], tokenPair: any): string {
    if (protocols.length === 0) {
      return 'No routing information available';
    }
    
    if (protocols.length === 1) {
      return `${protocols[0].name}: ${protocols[0].percentage}%`;
    }
    
    if (protocols.length === 2) {
      // For 2 protocols, show simple breakdown
      const protocolList = protocols.map(p => 
        `${p.name}: ${p.percentage}%`
      ).join('\n');
      return protocolList;
    }
    
    // For 3+ protocols, show multi-hop routing breakdown
    return this.buildMultiHopBreakdown(fills, tokenPair);
  }

  /**
   * Build multi-hop routing breakdown showing token paths and protocols
   * Format: "WETH → USDC: Via Uniswap V3 (30%) + V4 (45%)"
   */
  static buildMultiHopBreakdown(fills: any[], tokenPair: any): string {
    if (!fills || fills.length === 0) {
      return 'Multi-hop routing breakdown unavailable';
    }

    // Group fills by trading pair (from → to)
    const routeMap = new Map<string, any[]>();
    
    fills.forEach(fill => {
      if (fill.from && fill.to && fill.source && fill.proportionBps) {
        const routeKey = `${this.getTokenSymbol(fill.from, tokenPair)}→${this.getTokenSymbol(fill.to, tokenPair)}`;
        if (!routeMap.has(routeKey)) {
          routeMap.set(routeKey, []);
        }
        routeMap.get(routeKey)!.push(fill);
      }
    });

    const routeBreakdown: string[] = [];
    
    // Process each route
    routeMap.forEach((routeFills, routeKey) => {
      // Group by protocol for this route
      const protocolMap = new Map<string, number>();
      
      routeFills.forEach(fill => {
        const bps = parseInt(fill.proportionBps) || 0;
        if (bps > 0) {
          const existing = protocolMap.get(fill.source) || 0;
          protocolMap.set(fill.source, existing + bps);
        }
      });

      // Format protocol list for this route
      const routeProtocols: string[] = [];
      protocolMap.forEach((totalBps, protocol) => {
        const percentage = Math.round(totalBps / 100);
        routeProtocols.push(`${protocol} (${percentage}%)`);
      });

      if (routeProtocols.length > 0) {
        const protocolsList = routeProtocols.join(' + ');
        routeBreakdown.push(`  ${routeKey}: Via ${protocolsList}`);
      }
    });

    const header = 'Multi-hop routing breakdown:\n';
    return header + routeBreakdown.join('\n');
  }

  /**
   * Get token symbol from address for readable display
   */
  static getTokenSymbol(address: string, tokenPair: any): string {
    const lowerAddress = address.toLowerCase();
    
    if (!tokenPair) return address.slice(0, 6) + '...';
    
    if (lowerAddress === tokenPair.sellToken?.address?.toLowerCase()) {
      return tokenPair.sellToken.symbol || 'Token1';
    }
    if (lowerAddress === tokenPair.buyToken?.address?.toLowerCase()) {
      return tokenPair.buyToken.symbol || 'Token2';
    }
    
    // Common intermediate tokens
    const knownTokens: Record<string, string> = {
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
      '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT', 
      '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
      '0xa1b99c887c0d5e1ee7b5ba76af1a899f2506da23': 'ETH'
    };
    
    return knownTokens[lowerAddress] || address.slice(0, 6) + '...';
  }

  /**
   * Extract protocol information from ZeroX fills
   */
  static extractProtocolInfo(fills: any[]): ZeroXProtocolInfo[] {
    if (!fills || fills.length === 0) return [];
    
    // Group fills by source protocol
    const protocolMap = new Map<string, number>();
    
    fills.forEach(fill => {
      if (fill.source && fill.proportionBps) {
        const bps = parseInt(fill.proportionBps) || 0;
        if (bps > 0) { // Only include protocols with >0% participation
          const existing = protocolMap.get(fill.source) || 0;
          protocolMap.set(fill.source, existing + bps);
        }
      }
    });
    
    if (protocolMap.size === 0) return [];
    
    // Convert to protocol info with percentages
    const protocols: ZeroXProtocolInfo[] = [];
    
    protocolMap.forEach((totalBps, source) => {
      const percentage = Math.round(totalBps / 100); // Convert bps to percentage
      protocols.push({
        name: source,
        percentage
      });
    });
    
    // Sort by percentage descending
    protocols.sort((a, b) => b.percentage - a.percentage);
    
    return protocols;
  }

  /**
   * Calculate quote amount WITHOUT ZeroEx fees
   */
  static calculateNetQuoteAmount(buyAmount: string, zeroExFeeAmount?: string): string {
    if (!zeroExFeeAmount || zeroExFeeAmount === '0') {
      return buyAmount;
    }
    
    try {
      const buyAmountBN = ethers.getBigInt(buyAmount);
      const feeAmountBN = ethers.getBigInt(zeroExFeeAmount);
      
      // Add back the ZeroEx fee to get the gross amount for comparison
      const netAmount = buyAmountBN + feeAmountBN;
      return netAmount.toString();
    } catch (error) {
      console.warn('Error calculating net quote amount:', error);
      return buyAmount;
    }
  }

  /**
   * Get ZeroX quote for a token pair and convert to OnChainQuote format
   */
  static async getZeroXQuote(tokenPair: TokenPair): Promise<ZeroXQuoteResult | null> {
    try {
      const zeroXResponse = await zeroXApi.getQuote(tokenPair);
      
      if (!zeroXResponse || !zeroXResponse.liquidityAvailable) {
        return null;
      }
      
      // Extract protocol information
      const protocols = this.extractProtocolInfo(zeroXResponse.route?.fills || []);
      
      if (protocols.length === 0) {
        console.warn('No valid protocols found in ZeroX response');
        return null;
      }
      
      // Calculate net amount (excluding ZeroEx fees)
      const zeroExFeeAmount = zeroXResponse.fees?.zeroExFee?.amount || '0';
      const netBuyAmount = this.calculateNetQuoteAmount(
        zeroXResponse.buyAmount,
        zeroExFeeAmount
      );
      
      // Format protocol name
      const protocolName = this.formatProtocolName(protocols);
      
      // Create PoolInfo structure for ZeroX aggregator
      const poolInfo: PoolInfo = {
        address: 'zeroX-aggregator-' + tokenPair.id,
        name: protocolName,
        dex: protocolName, // Use the formatted protocol name as dex
        network: 'ethereum',
        fee_tier: 'variable',
        volume_24h: 50000000, // High volume due to aggregation
        liquidity_usd: 100000000, // Virtual liquidity
        tokens: {
          base: tokenPair.sellToken,
          quote: tokenPair.buyToken
        }
      };

      // Create OnChainQuote-compatible object
      const quote: OnChainQuote = {
        pool: poolInfo,
        inputAmount: zeroXResponse.sellAmount,
        outputAmount: netBuyAmount, // Using net amount (without ZeroEx fees)
        pricePerToken: 0, // Would need calculation
        gasEstimate: zeroXResponse.gas || '0',
        executionPrice: 0, // Would need calculation
        timestamp: Date.now(),
        success: true
      };
      
      return {
        quote,
        protocols,
        totalFillCount: zeroXResponse.route?.fills?.length || 0,
        protocolDetails: this.getProtocolDetails(protocols, zeroXResponse.route?.fills || [], tokenPair)
      };
      
    } catch (error) {
      console.error('Error fetching ZeroX quote:', error);
      return null;
    }
  }
}

export default ZeroXQuoteService;