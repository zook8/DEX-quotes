/**
 * Dynamic Pricing Test Component
 * Test interface for validating dynamic pricing functionality
 * Shows live vs fallback pricing, cache status, and allows manual testing
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import BrowserDynamicPricingService from '../services/browserDynamicPricingService';
import { browserDynamicTokenPairService } from '../config/browserDynamicTokenPairs';
import type { DynamicTokenPair } from '../config/browserDynamicTokenPairs';
import { Clock, RefreshCw, AlertCircle, CheckCircle, TrendingUp, Database } from 'lucide-react';

const pricingService = new BrowserDynamicPricingService();

export const DynamicPricingTest: React.FC = () => {
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [pairs, setPairs] = useState<DynamicTokenPair[]>([]);
  const [cacheStats, setCacheStats] = useState<any>({});
  const [pairStats, setPairStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('Never');
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPrices(),
        loadPairs(),
        loadCacheStats(),
        loadPairStats()
      ]);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPrices = async () => {
    try {
      const tokens = ['WETH', 'UNI', 'USDT', 'USDC', 'DAI'];
      const priceData: Record<string, any> = {};
      
      for (const token of tokens) {
        const price = await pricingService.getTokenPrice(token);
        priceData[token] = price;
      }
      
      setPrices(priceData);
    } catch (error) {
      console.error('Failed to load prices:', error);
    }
  };

  const loadPairs = async () => {
    try {
      const dynamicPairs = await browserDynamicTokenPairService.getDynamicTokenPairs();
      setPairs(dynamicPairs);
    } catch (error) {
      console.error('Failed to load pairs:', error);
    }
  };

  const loadCacheStats = async () => {
    try {
      const stats = pricingService.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    }
  };

  const loadPairStats = async () => {
    try {
      const stats = await browserDynamicTokenPairService.getStatus();
      setPairStats(stats);
    } catch (error) {
      console.error('Failed to load pair stats:', error);
    }
  };

  const testTokenPricing = async (symbol: string) => {
    try {
      const result = await pricingService.calculateDynamicInputAmount(symbol, 10000, 18);
      setTestResults(prev => ({
        ...prev,
        [symbol]: {
          success: true,
          amount: result.amount,
          price: result.price,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [symbol]: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      }));
    }
  };

  const testPairCalculation = async (pairId: string) => {
    try {
      const result = await browserDynamicTokenPairService.testTokenPair(pairId);
      setTestResults(prev => ({
        ...prev,
        [`pair_${pairId}`]: result
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [`pair_${pairId}`]: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
  };

  const refreshPrices = async () => {
    setLoading(true);
    try {
      await pricingService.refreshPrices();
      await loadAllData();
    } catch (error) {
      console.error('Failed to refresh prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshPairs = async () => {
    setLoading(true);
    try {
      await browserDynamicTokenPairService.refreshTokenPairs();
      await loadAllData();
    } catch (error) {
      console.error('Failed to refresh pairs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: string, decimals: number, symbol: string) => {
    try {
      const formatted = (Number(amount) / Math.pow(10, decimals)).toFixed(6);
      return `${formatted} ${symbol}`;
    } catch {
      return `${amount} (raw)`;
    }
  };

  const getStatusIcon = (source?: string) => {
    switch (source) {
      case 'live':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fallback':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dynamic Pricing Test Dashboard</h1>
        <div className="flex gap-2">
          <Button onClick={loadAllData} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
        </div>
      </div>

      <div className="text-sm text-gray-500">
        Last Updated: {lastUpdate}
      </div>

      {/* Cache Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cache Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{cacheStats.cached_tokens || 0}</div>
              <div className="text-sm text-gray-500">Cached Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{cacheStats.live_prices || 0}</div>
              <div className="text-sm text-gray-500">Live Prices</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{cacheStats.fallback_prices || 0}</div>
              <div className="text-sm text-gray-500">Fallback Prices</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{cacheStats.cache_age_hours?.toFixed(1) || 0}h</div>
              <div className="text-sm text-gray-500">Cache Age</div>
            </div>
          </div>
          <Button onClick={refreshPrices} disabled={loading} className="w-full">
            Update All Prices
          </Button>
        </CardContent>
      </Card>

      {/* Token Prices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Current Token Prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(prices).map(([symbol, price]) => (
              <div key={symbol} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(price.source)}
                  <div>
                    <div className="font-medium">{symbol}</div>
                    <div className="text-sm text-gray-500">
                      Updated: {new Date(price.last_updated).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">${price.price_usd?.toFixed(2) || 'N/A'}</div>
                  <div className="text-sm text-gray-500 capitalize">{price.source}</div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => testTokenPricing(symbol)}
                  className="ml-4"
                >
                  Test $10K
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Token Pairs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Dynamic Token Pairs
            </div>
            <Button onClick={refreshPairs} disabled={loading} variant="outline" size="sm">
              Refresh Pairs
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pairs.map((pair) => (
              <div key={pair.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium">{pair.name}</div>
                    <div className="text-sm text-gray-500">
                      Target: ${pair.targetUSD.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(pair.priceSource)}
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        ${pair.priceUsed?.toFixed(2) || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {pair.priceSource}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm space-y-1">
                  <div>
                    <strong>Sell Amount:</strong>{' '}
                    {formatAmount(pair.sellAmount, pair.sellToken.decimals, pair.sellToken.symbol)}
                  </div>
                  <div>
                    <strong>Raw Amount:</strong> {pair.sellAmount}
                  </div>
                  <div>
                    <strong>Last Updated:</strong>{' '}
                    {pair.lastUpdated ? new Date(pair.lastUpdated).toLocaleString() : 'Never'}
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => testPairCalculation(pair.id)}
                    className="flex-1"
                  >
                    Test Calculation
                  </Button>
                </div>

                {/* Test Results */}
                {testResults[`pair_${pair.id}`] && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm">
                      <strong>Test Result:</strong>
                    </div>
                    <pre className="text-xs mt-1 overflow-x-auto">
                      {JSON.stringify(testResults[`pair_${pair.id}`], null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(testResults).filter(([key]) => !key.startsWith('pair_')).map(([symbol, result]) => (
                <div key={symbol} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{symbol} - $10K Test</div>
                    <div className="text-xs text-gray-500">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  
                  {result.success ? (
                    <div className="space-y-1 text-sm">
                      <div>
                        <strong>Amount:</strong> {formatAmount(result.amount, 18, symbol)}
                      </div>
                      <div>
                        <strong>Price Used:</strong> ${result.price.price_usd.toFixed(2)} ({result.price.source})
                      </div>
                      <div>
                        <strong>Raw Amount:</strong> {result.amount}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-red-600">
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Pair Service</h4>
              <div className="text-sm space-y-1">
                <div>Cached Pairs: {pairStats.cached_pairs || 0}</div>
                <div>Cache Age: {pairStats.cache_age_minutes || 0} minutes</div>
                <div>Last Update: {pairStats.last_update || 'Never'}</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Pricing Service</h4>
              <div className="text-sm space-y-1">
                <div>Next Refresh: {cacheStats.next_refresh_hours?.toFixed(1) || 0}h</div>
                <div>Live Sources: {cacheStats.live_prices || 0}</div>
                <div>Fallback Sources: {cacheStats.fallback_prices || 0}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};