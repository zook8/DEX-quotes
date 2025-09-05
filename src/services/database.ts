import Database from 'better-sqlite3';
import type { HistoricalData, PairQuote } from '../types/api';

class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string = './quotes.db') {
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables() {
    // Create historical data table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS historical_quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        pair_id TEXT NOT NULL,
        pair_name TEXT NOT NULL,
        total_buy_amount TEXT NOT NULL,
        min_buy_amount TEXT NOT NULL,
        rankings TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_timestamp (timestamp),
        INDEX idx_pair_id (pair_id)
      )
    `);

    // Create protocol rankings table for easier querying
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS protocol_rankings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        pair_id TEXT NOT NULL,
        protocol TEXT NOT NULL,
        rank INTEGER NOT NULL,
        effective_rate REAL NOT NULL,
        total_proportion INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_timestamp_pair (timestamp, pair_id),
        INDEX idx_protocol (protocol)
      )
    `);
  }

  saveQuote(quote: PairQuote) {
    const insertQuote = this.db.prepare(`
      INSERT INTO historical_quotes (timestamp, pair_id, pair_name, total_buy_amount, min_buy_amount, rankings)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertRanking = this.db.prepare(`
      INSERT INTO protocol_rankings (timestamp, pair_id, protocol, rank, effective_rate, total_proportion)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    try {
      // Insert main quote record
      insertQuote.run(
        quote.timestamp,
        quote.pair.id,
        quote.pair.name,
        quote.totalBuyAmount,
        quote.minBuyAmount,
        JSON.stringify(quote.rankings)
      );

      // Insert individual rankings for easier querying
      quote.rankings.forEach(ranking => {
        insertRanking.run(
          quote.timestamp,
          quote.pair.id,
          ranking.protocol,
          ranking.rank,
          ranking.effectiveRate,
          ranking.totalProportion
        );
      });

      console.log(`Saved quote for ${quote.pair.name} at ${new Date(quote.timestamp).toISOString()}`);
    } catch (error) {
      console.error('Error saving quote to database:', error);
    }
  }

  getHistoricalData(pairId: string, hoursBack: number = 24): HistoricalData[] {
    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
    
    const query = this.db.prepare(`
      SELECT timestamp, pair_id, rankings
      FROM historical_quotes
      WHERE pair_id = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `);

    try {
      const results = query.all(pairId, cutoffTime) as Array<{
        timestamp: number;
        pair_id: string;
        rankings: string;
      }>;
      return results.map(row => ({
        timestamp: row.timestamp,
        pairId: row.pair_id,
        rankings: JSON.parse(row.rankings)
      }));
    } catch (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }
  }

  getProtocolHistoricalRanks(pairId: string, protocol: string, hoursBack: number = 24) {
    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
    
    const query = this.db.prepare(`
      SELECT timestamp, rank, effective_rate
      FROM protocol_rankings
      WHERE pair_id = ? AND protocol = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `);

    try {
      return query.all(pairId, protocol, cutoffTime);
    } catch (error) {
      console.error('Error fetching protocol historical ranks:', error);
      return [];
    }
  }

  cleanup(daysToKeep: number = 7) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    const deleteOld = this.db.prepare(`
      DELETE FROM historical_quotes WHERE timestamp < ?
    `);
    
    const deleteOldRankings = this.db.prepare(`
      DELETE FROM protocol_rankings WHERE timestamp < ?
    `);

    try {
      const deletedQuotes = deleteOld.run(cutoffTime);
      const deletedRankings = deleteOldRankings.run(cutoffTime);
      
      console.log(`Cleaned up ${deletedQuotes.changes} old quotes and ${deletedRankings.changes} old rankings`);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  close() {
    this.db.close();
  }
}

export const database = new DatabaseService();