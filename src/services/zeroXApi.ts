import axios from 'axios';
import type { ZeroXQuoteResponse, TokenPair, ProtocolRanking, PairQuote, ZeroXFill } from '../types/api';
import { API_CONFIG } from '../config/tokenPairs';

// 0x API Service
class ZeroXApiService {
  private readonly client = axios.create({
    baseURL: API_CONFIG.baseUrl,
    headers: API_CONFIG.headers,
  });

  async getQuote(tokenPair: TokenPair): Promise<ZeroXQuoteResponse | null> {
    try {
      const response = await this.client.get('/quote', {
        params: {
          chainId: API_CONFIG.chainId,
          sellToken: tokenPair.sellToken.address,
          buyToken: tokenPair.buyToken.address,
          sellAmount: tokenPair.sellAmount,
        },
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching quote for ${tokenPair.name}:`, error);
      return null;
    }
  }

  /**
   * DEPRECATED: filterSingleHopFills() - Created misleading UX by showing single-hop
   * protocols with multi-hop pricing. Replaced with honest multi-hop protocol extraction.
   * 
   * The old approach would show "Uniswap V3" but use the price from complex 
   * WETH→USDC→USDT routing, misleading users about pricing source.
   */

  // Extract protocol information from all fills (honest multi-hop approach)
  extractProtocolInfo(fills: ZeroXFill[]): { name: string; percentage: number; source: string; }[] {
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
    const protocols: { name: string; percentage: number; source: string; }[] = [];
    
    protocolMap.forEach((totalBps, source) => {
      const percentage = Math.round(totalBps / 100); // Convert bps to percentage
      protocols.push({
        name: source,
        percentage,
        source
      });
    });
    
    // Sort by percentage descending
    protocols.sort((a, b) => b.percentage - a.percentage);
    
    return protocols;
  }

  // Calculate protocol rankings from ALL fills (honest multi-hop approach)
  calculateProtocolRanking(allFills: ZeroXFill[]): ProtocolRanking[] {
    const protocols = this.extractProtocolInfo(allFills);
    
    // Convert to ProtocolRanking format
    const rankings = protocols.map((protocol) => ({
      protocol: protocol.name,
      totalProportion: protocol.percentage * 100, // Convert back to BPS for compatibility
      effectiveRate: protocol.percentage,
      rank: 0 // Will be set after sorting
    }));

    // Sort by effective rate (higher is better) and assign ranks
    rankings.sort((a, b) => b.effectiveRate - a.effectiveRate);
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    return rankings;
  }

  async getPairQuote(tokenPair: TokenPair): Promise<PairQuote | null> {
    try {
      const response = await this.getQuote(tokenPair);
      if (!response || !response.liquidityAvailable) {
        return null;
      }

      // Use ALL fills for honest multi-hop protocol rankings
      const allFills = response.route?.fills || [];
      const rankings = this.calculateProtocolRanking(allFills);

      return {
        pair: tokenPair,
        timestamp: Date.now(),
        totalBuyAmount: response.buyAmount, // Price matches displayed multi-hop routing
        minBuyAmount: response.minBuyAmount,
        rankings, // Now shows honest multi-hop protocol distribution
        singleHopFills: allFills, // Renamed field - now contains all fills for transparency
      };
    } catch (error) {
      console.error(`Error getting pair quote for ${tokenPair.name}:`, error);
      return null;
    }
  }
}

export const zeroXApi = new ZeroXApiService();