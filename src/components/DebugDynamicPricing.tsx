/**
 * Debug Component for Dynamic Pricing
 * Simple component to test and debug the browser services
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';

export const DebugDynamicPricing: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testBrowserServices = async () => {
    setLoading(true);
    setDebugInfo('Starting browser service tests...\n');
    
    try {
      // Test 1: Import browser services
      setDebugInfo(prev => prev + 'Test 1: Importing browser services...\n');
      
      const BrowserDynamicPricingService = (await import('../services/browserDynamicPricingService')).default;
      const { browserDynamicTokenPairService } = await import('../config/browserDynamicTokenPairs');
      
      setDebugInfo(prev => prev + '✅ Browser services imported successfully\n');
      
      // Test 2: Create pricing service instance
      setDebugInfo(prev => prev + 'Test 2: Creating pricing service instance...\n');
      const pricingService = new BrowserDynamicPricingService();
      setDebugInfo(prev => prev + '✅ Pricing service created\n');
      
      // Test 3: Get cache stats
      setDebugInfo(prev => prev + 'Test 3: Getting cache statistics...\n');
      const cacheStats = pricingService.getCacheStats();
      setDebugInfo(prev => prev + `✅ Cache stats: ${JSON.stringify(cacheStats, null, 2)}\n`);
      
      // Test 4: Get token pair service status
      setDebugInfo(prev => prev + 'Test 4: Getting token pair service status...\n');
      const pairStatus = await browserDynamicTokenPairService.getStatus();
      setDebugInfo(prev => prev + `✅ Pair service status: ${JSON.stringify(pairStatus, null, 2)}\n`);
      
      // Test 5: Try to get a single price
      setDebugInfo(prev => prev + 'Test 5: Fetching WETH price...\n');
      try {
        const wethPrice = await pricingService.getTokenPrice('WETH');
        setDebugInfo(prev => prev + `✅ WETH price: ${JSON.stringify(wethPrice, null, 2)}\n`);
      } catch (error) {
        setDebugInfo(prev => prev + `⚠️ WETH price fetch failed: ${error instanceof Error ? error.message : String(error)}\n`);
      }
      
      // Test 6: Try to get dynamic token pairs
      setDebugInfo(prev => prev + 'Test 6: Getting dynamic token pairs...\n');
      try {
        const pairs = await browserDynamicTokenPairService.getDynamicTokenPairs();
        setDebugInfo(prev => prev + `✅ Dynamic pairs loaded: ${pairs.length} pairs\n`);
        
        // Show first pair details
        if (pairs.length > 0) {
          const firstPair = pairs[0];
          setDebugInfo(prev => prev + `First pair: ${JSON.stringify({
            id: firstPair.id,
            name: firstPair.name,
            sellAmount: firstPair.sellAmount,
            priceUsed: firstPair.priceUsed,
            priceSource: firstPair.priceSource
          }, null, 2)}\n`);
        }
      } catch (error) {
        setDebugInfo(prev => prev + `⚠️ Dynamic pairs fetch failed: ${error instanceof Error ? error.message : String(error)}\n`);
      }
      
      setDebugInfo(prev => prev + '\n🎉 All tests completed!\n');
      
    } catch (error) {
      setDebugInfo(prev => prev + `❌ Test failed: ${error instanceof Error ? error.message : String(error)}\n`);
      console.error('Test error:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearDebug = () => {
    setDebugInfo('');
  };

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Debug Dynamic Pricing Services</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={testBrowserServices} 
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Running Tests...' : 'Run Service Tests'}
              </Button>
              <Button 
                onClick={clearDebug} 
                variant="outline"
              >
                Clear
              </Button>
            </div>
            
            {debugInfo && (
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                <pre className="whitespace-pre-wrap">{debugInfo}</pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};