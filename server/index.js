require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.NODE_ENV === 'production' ? 3003 : 3002;

// Enable CORS
app.use(cors());
app.use(express.json());

// Cache file path for sellAmounts
const CACHE_FILE_PATH = path.join(__dirname, '../data/sellAmounts-cache.json');

// Ensure data directory exists
const ensureDataDir = async () => {
  const dataDir = path.join(__dirname, '../data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
};

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../dist')));

// API endpoint to serve cached sellAmounts
app.get('/api/sellAmounts', async (req, res) => {
  try {
    await ensureDataDir();
    
    // Try to read from cache file
    try {
      const cacheData = await fs.readFile(CACHE_FILE_PATH, 'utf8');
      const parsedData = JSON.parse(cacheData);
      
      // Check if cache is still valid (8 hours = 8 * 60 * 60 * 1000 ms)
      const cacheExpiry = 8 * 60 * 60 * 1000;
      const now = Date.now();
      
      if (now - parsedData.timestamp < cacheExpiry && parsedData.sellAmounts) {
        console.log('Serving cached sellAmounts from server cache');
        res.json({
          success: true,
          data: parsedData.sellAmounts,
          source: 'server_cache',
          timestamp: parsedData.timestamp,
          age_hours: Math.round((now - parsedData.timestamp) / (60 * 60 * 1000) * 100) / 100
        });
        return;
      }
    } catch (error) {
      console.log('No valid server cache found, will generate fresh data');
    }
    
    // If no valid cache, generate fresh sellAmounts
    const freshSellAmounts = await generateFreshSellAmounts();
    
    // Cache the fresh data
    const cacheData = {
      timestamp: Date.now(),
      sellAmounts: freshSellAmounts
    };
    
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2));
    console.log('Generated and cached fresh sellAmounts');
    
    res.json({
      success: true,
      data: freshSellAmounts,
      source: 'fresh_calculation',
      timestamp: cacheData.timestamp,
      age_hours: 0
    });
    
  } catch (error) {
    console.error('sellAmounts API error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      data: getFallbackSellAmounts(),
      source: 'fallback'
    });
  }
});

// Generate fresh sellAmounts using the existing pricing logic
const generateFreshSellAmounts = async () => {
  const fetch = (await import('node-fetch')).default;
  
  // CoinGecko API configuration
  const API_HEADERS = {
    'User-Agent': 'ZookCryptoAnalytics/1.0 (contact@zook.com)',
    'x-cg-demo-api-key': 'CG-sw3jGBgpxKyEsNACERZfnebE',
    'Accept': 'application/json'
  };
  
  // Token configurations for dynamic pairs only
  const dynamicTokens = {
    'WETH': { coingeckoId: 'ethereum', decimals: 18 },
    'UNI': { coingeckoId: 'uniswap', decimals: 18 }
  };
  
  const sellAmounts = {};
  const targetUSD = 10000; // $10K swaps
  
  try {
    // Fetch prices for dynamic tokens
    const coingeckoIds = Object.values(dynamicTokens).map(t => t.coingeckoId).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds}&vs_currencies=usd`;
    
    console.log('Fetching fresh prices from CoinGecko...');
    const response = await fetch(url, { headers: API_HEADERS });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const priceData = await response.json();
    console.log('Received price data:', priceData);
    
    // Calculate sellAmounts for dynamic pairs
    for (const [symbol, config] of Object.entries(dynamicTokens)) {
      const price = priceData[config.coingeckoId]?.usd;
      
      if (price) {
        const tokenAmount = targetUSD / price;
        const sellAmountScaled = Math.floor(tokenAmount * (10 ** config.decimals));
        const sellAmountStr = BigInt(sellAmountScaled).toString();
        
        // Map to pair IDs that use this token
        if (symbol === 'WETH') {
          sellAmounts['weth-usdt'] = sellAmountStr;
          sellAmounts['weth-usdc'] = sellAmountStr;
        } else if (symbol === 'UNI') {
          sellAmounts['uni-weth'] = sellAmountStr;
        }
        
        console.log(`${symbol}: $${price} -> ${sellAmountStr} wei`);
      }
    }
    
    // Add hardcoded amounts for stablecoin pairs
    sellAmounts['usdc-dai'] = '10000000000'; // $10K USDC
    sellAmounts['usde-usdt'] = '10000000000000000000000'; // 10K USDe
    
    return sellAmounts;
    
  } catch (error) {
    console.error('Error generating fresh sellAmounts:', error);
    throw error;
  }
};

// Fallback sellAmounts if everything fails
const getFallbackSellAmounts = () => {
  return {
    'weth-usdt': '2127659574468085000',    // ~2.13 ETH (~$10K at ~$4700/ETH)
    'uni-weth': '555555555555555555555',    // ~555.6 UNI (~$10K at ~$18/UNI)  
    'weth-usdc': '2127659574468085000',     // ~2.13 ETH (~$10K at ~$4700/ETH)
    'usdc-dai': '10000000000',              // $10K USDC
    'usde-usdt': '10000000000000000000000'  // 10K USDe (~$10K at ~$1/USDe)
  };
};

// Proxy API calls to 0x API
app.get('/api/quote', async (req, res) => {
  try {
    const { chainId, sellToken, buyToken, sellAmount } = req.query;
    
    const url = `https://api.0x.org/swap/permit2/price?chainId=${chainId}&sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${sellAmount}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        '0x-api-key': process.env.ZEROX_API_KEY || 'YOUR_ZEROX_API_KEY_HERE',
        '0x-version': 'v2'
      }
    });

    if (!response.ok) {
      throw new Error(`0x API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});