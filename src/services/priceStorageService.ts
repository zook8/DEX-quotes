/**
 * Price Storage Service
 * Persists token prices using SQLite database for reliable caching
 * Supports both in-memory and file-based storage for different environments
 */

import Database from 'better-sqlite3';
import { logger } from './logger';

export interface StoredTokenPrice {
  symbol: string;
  address: string;
  price_usd: number;
  last_updated: number;
  source: 'live' | 'fallback';
  created_at: number;
}

export interface PriceUpdate {
  symbol: string;
  price_usd: number;
  source: 'live' | 'fallback';
}

class PriceStorageService {
  private db: Database.Database;
  private readonly DB_PATH = './data/prices.db';

  constructor(dbPath?: string) {
    try {
      // Create data directory if it doesn't exist
      const fs = require('fs');
      const path = require('path');
      const dir = path.dirname(dbPath || this.DB_PATH);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('PriceStorageService', `Created directory: ${dir}`);
      }

      this.db = new Database(dbPath || this.DB_PATH);
      this.initializeDatabase();
      
      logger.info('PriceStorageService', `Database initialized: ${dbPath || this.DB_PATH}`);
    } catch (error) {
      logger.error('PriceStorageService', 'Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Initialize database schema
   */
  private initializeDatabase(): void {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS token_prices (
        symbol TEXT NOT NULL,
        address TEXT NOT NULL,
        price_usd REAL NOT NULL,
        last_updated INTEGER NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('live', 'fallback')),
        created_at INTEGER NOT NULL,
        PRIMARY KEY (symbol, address)
      )
    `;

    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_token_prices_updated 
      ON token_prices (last_updated DESC)
    `;

    this.db.exec(createTableSQL);
    this.db.exec(createIndexSQL);
    
    logger.debug('PriceStorageService', 'Database schema initialized');
  }

  /**
   * Store or update a single token price
   */
  async storePrice(symbol: string, address: string, priceUsd: number, source: 'live' | 'fallback' = 'live'): Promise<void> {
    const now = Date.now();
    
    const upsertSQL = `
      INSERT INTO token_prices (symbol, address, price_usd, last_updated, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, address) DO UPDATE SET
        price_usd = excluded.price_usd,
        last_updated = excluded.last_updated,
        source = excluded.source
    `;

    try {
      const stmt = this.db.prepare(upsertSQL);
      stmt.run(symbol, address, priceUsd, now, source, now);
      
      logger.debug('PriceStorageService', `Stored ${symbol}: $${priceUsd} (${source})`);
    } catch (error) {
      logger.error('PriceStorageService', `Failed to store price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Store multiple token prices in a transaction
   */
  async storePrices(prices: PriceUpdate[]): Promise<void> {
    const now = Date.now();
    
    const upsertSQL = `
      INSERT INTO token_prices (symbol, address, price_usd, last_updated, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, address) DO UPDATE SET
        price_usd = excluded.price_usd,
        last_updated = excluded.last_updated,
        source = excluded.source
    `;

    const transaction = this.db.transaction((priceUpdates: PriceUpdate[]) => {
      const stmt = this.db.prepare(upsertSQL);
      
      for (const update of priceUpdates) {
        // We'll need the address mapping - for now use empty string, real integration will provide it
        stmt.run(update.symbol, '', update.price_usd, now, update.source, now);
      }
    });

    try {
      transaction(prices);
      logger.info('PriceStorageService', `Stored ${prices.length} token prices`);
    } catch (error) {
      logger.error('PriceStorageService', 'Failed to store batch prices:', error);
      throw error;
    }
  }

  /**
   * Get current price for a token
   */
  async getPrice(symbol: string): Promise<StoredTokenPrice | null> {
    const selectSQL = `
      SELECT symbol, address, price_usd, last_updated, source, created_at
      FROM token_prices
      WHERE symbol = ?
      ORDER BY last_updated DESC
      LIMIT 1
    `;

    try {
      const stmt = this.db.prepare(selectSQL);
      const row = stmt.get(symbol) as any;
      
      if (!row) {
        logger.debug('PriceStorageService', `No stored price found for ${symbol}`);
        return null;
      }

      const price: StoredTokenPrice = {
        symbol: row.symbol,
        address: row.address,
        price_usd: row.price_usd,
        last_updated: row.last_updated,
        source: row.source as 'live' | 'fallback',
        created_at: row.created_at
      };

      logger.debug('PriceStorageService', `Retrieved ${symbol}: $${price.price_usd} (${price.source}, age: ${Math.round((Date.now() - price.last_updated) / 60000)}min)`);
      return price;
    } catch (error) {
      logger.error('PriceStorageService', `Failed to get price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get all current prices
   */
  async getAllPrices(): Promise<StoredTokenPrice[]> {
    const selectSQL = `
      SELECT symbol, address, price_usd, last_updated, source, created_at
      FROM token_prices
      ORDER BY symbol ASC
    `;

    try {
      const stmt = this.db.prepare(selectSQL);
      const rows = stmt.all() as any[];
      
      const prices: StoredTokenPrice[] = rows.map(row => ({
        symbol: row.symbol,
        address: row.address,
        price_usd: row.price_usd,
        last_updated: row.last_updated,
        source: row.source as 'live' | 'fallback',
        created_at: row.created_at
      }));

      logger.debug('PriceStorageService', `Retrieved ${prices.length} stored prices`);
      return prices;
    } catch (error) {
      logger.error('PriceStorageService', 'Failed to get all prices:', error);
      return [];
    }
  }

  /**
   * Get prices updated within timeframe (default 24 hours)
   */
  async getRecentPrices(maxAgeHours: number = 24): Promise<StoredTokenPrice[]> {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    
    const selectSQL = `
      SELECT symbol, address, price_usd, last_updated, source, created_at
      FROM token_prices
      WHERE last_updated > ?
      ORDER BY last_updated DESC
    `;

    try {
      const stmt = this.db.prepare(selectSQL);
      const rows = stmt.all(cutoffTime) as any[];
      
      const prices: StoredTokenPrice[] = rows.map(row => ({
        symbol: row.symbol,
        address: row.address,
        price_usd: row.price_usd,
        last_updated: row.last_updated,
        source: row.source as 'live' | 'fallback',
        created_at: row.created_at
      }));

      logger.debug('PriceStorageService', `Retrieved ${prices.length} recent prices (max age: ${maxAgeHours}h)`);
      return prices;
    } catch (error) {
      logger.error('PriceStorageService', 'Failed to get recent prices:', error);
      return [];
    }
  }

  /**
   * Clean up old price records
   */
  async cleanupOldPrices(keepDays: number = 7): Promise<number> {
    const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
    
    const deleteSQL = `
      DELETE FROM token_prices
      WHERE last_updated < ?
    `;

    try {
      const stmt = this.db.prepare(deleteSQL);
      const result = stmt.run(cutoffTime);
      
      const deletedCount = result.changes;
      logger.info('PriceStorageService', `Cleaned up ${deletedCount} old price records (older than ${keepDays} days)`);
      
      return deletedCount;
    } catch (error) {
      logger.error('PriceStorageService', 'Failed to cleanup old prices:', error);
      return 0;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    total_records: number;
    unique_tokens: number;
    oldest_record_age_hours: number;
    newest_record_age_hours: number;
    live_prices: number;
    fallback_prices: number;
  }> {
    const statsSQL = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT symbol) as unique_tokens,
        MIN(last_updated) as oldest_updated,
        MAX(last_updated) as newest_updated,
        SUM(CASE WHEN source = 'live' THEN 1 ELSE 0 END) as live_prices,
        SUM(CASE WHEN source = 'fallback' THEN 1 ELSE 0 END) as fallback_prices
      FROM token_prices
    `;

    try {
      const stmt = this.db.prepare(statsSQL);
      const result = stmt.get() as any;
      
      const now = Date.now();
      
      const stats = {
        total_records: result.total_records || 0,
        unique_tokens: result.unique_tokens || 0,
        oldest_record_age_hours: result.oldest_updated ? Math.round((now - result.oldest_updated) / (60 * 60 * 1000)) : 0,
        newest_record_age_hours: result.newest_updated ? Math.round((now - result.newest_updated) / (60 * 60 * 1000)) : 0,
        live_prices: result.live_prices || 0,
        fallback_prices: result.fallback_prices || 0
      };

      logger.debug('PriceStorageService', 'Storage stats:', stats);
      return stats;
    } catch (error) {
      logger.error('PriceStorageService', 'Failed to get storage stats:', error);
      return {
        total_records: 0,
        unique_tokens: 0,
        oldest_record_age_hours: 0,
        newest_record_age_hours: 0,
        live_prices: 0,
        fallback_prices: 0
      };
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      this.db.close();
      logger.info('PriceStorageService', 'Database connection closed');
    } catch (error) {
      logger.error('PriceStorageService', 'Failed to close database:', error);
    }
  }

  /**
   * Check if database is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testSQL = 'SELECT COUNT(*) as count FROM token_prices LIMIT 1';
      const stmt = this.db.prepare(testSQL);
      stmt.get();
      return true;
    } catch (error) {
      logger.error('PriceStorageService', 'Health check failed:', error);
      return false;
    }
  }
}

export default PriceStorageService;