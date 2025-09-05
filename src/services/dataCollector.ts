import { zeroXApi } from './zeroXApi';
import { database } from './database';
import { TOKEN_PAIRS } from '../config/tokenPairs';
import type { PairQuote } from '../types/api';

class DataCollectorService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly COLLECTION_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private readonly API_DELAY = 2000; // 2 seconds between API calls (VPS-friendly)

  async start() {
    if (this.isRunning) {
      console.log('Data collector is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting data collector service...');

    // Collect data immediately
    await this.collectAllPairsData();

    // Schedule regular collections
    this.intervalId = setInterval(async () => {
      await this.collectAllPairsData();
    }, this.COLLECTION_INTERVAL);

    console.log(`Data collector started - collecting every ${this.COLLECTION_INTERVAL / 60000} minutes`);
  }

  stop() {
    if (!this.isRunning) {
      console.log('Data collector is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('Data collector stopped');
  }

  private async collectAllPairsData(): Promise<void> {
    console.log(`[${new Date().toISOString()}] Starting data collection cycle...`);
    
    const results: { pair: string; success: boolean; rankings: number }[] = [];
    let totalApiCalls = 0;
    
    for (let i = 0; i < TOKEN_PAIRS.length; i++) {
      const pair = TOKEN_PAIRS[i];
      
      try {
        console.log(`Collecting data for ${pair.name} (${i + 1}/${TOKEN_PAIRS.length})`);
        
        const quote = await zeroXApi.getPairQuote(pair);
        totalApiCalls++;
        
        if (quote) {
          // Save to database
          database.saveQuote(quote);
          
          results.push({
            pair: pair.name,
            success: true,
            rankings: quote.rankings.length
          });
          
          console.log(`✅ ${pair.name}: ${quote.rankings.length} protocols ranked`);
        } else {
          results.push({
            pair: pair.name,
            success: false,
            rankings: 0
          });
          
          console.log(`❌ ${pair.name}: No data available`);
        }
        
        // Add delay between API calls to be VPS-friendly
        if (i < TOKEN_PAIRS.length - 1) {
          console.log(`Waiting ${this.API_DELAY}ms before next API call...`);
          await this.delay(this.API_DELAY);
        }
        
      } catch (error) {
        console.error(`Error collecting data for ${pair.name}:`, error);
        results.push({
          pair: pair.name,
          success: false,
          rankings: 0
        });
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const totalRankings = results.reduce((sum, r) => sum + r.rankings, 0);
    
    console.log(`[${new Date().toISOString()}] Collection cycle complete:`);
    console.log(`  📊 ${successful}/${TOKEN_PAIRS.length} pairs successful`);
    console.log(`  🏆 ${totalRankings} total protocol rankings collected`);
    console.log(`  📡 ${totalApiCalls} API calls made`);
    console.log(`  ⏳ Next collection in ${this.COLLECTION_INTERVAL / 60000} minutes`);

    // Cleanup old data (keep 7 days)
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      console.log('Running database cleanup...');
      database.cleanup(7);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Manual data collection (for testing or immediate updates)
  async collectSinglePair(pairId: string): Promise<PairQuote | null> {
    const pair = TOKEN_PAIRS.find(p => p.id === pairId);
    if (!pair) {
      throw new Error(`Pair with ID ${pairId} not found`);
    }

    console.log(`Manual collection for ${pair.name}`);
    const quote = await zeroXApi.getPairQuote(pair);
    
    if (quote) {
      database.saveQuote(quote);
      console.log(`✅ Manual collection completed for ${pair.name}`);
    } else {
      console.log(`❌ No data available for ${pair.name}`);
    }

    return quote;
  }

  // Get collection status
  getStatus() {
    return {
      isRunning: this.isRunning,
      collectionInterval: this.COLLECTION_INTERVAL,
      apiDelay: this.API_DELAY,
      nextCollection: this.intervalId ? 
        new Date(Date.now() + this.COLLECTION_INTERVAL).toISOString() : 
        null
    };
  }

  // Get historical data for a specific pair
  async getHistoricalData(pairId: string, hours = 24) {
    return database.getHistoricalData(pairId, hours);
  }

  // Get protocol historical ranks
  async getProtocolHistory(pairId: string, protocol: string, hours = 24) {
    return database.getProtocolHistoricalRanks(pairId, protocol, hours);
  }
}

// Singleton instance
export const dataCollector = new DataCollectorService();