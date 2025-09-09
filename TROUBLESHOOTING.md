# Troubleshooting Dynamic Pricing Test Environment

## 🐛 Current Issue

The Dynamic Pricing Test Dashboard is showing zeros and "Never" for all stats because the browser services aren't initializing properly.

## 🔧 Quick Fix Applied

I've created browser-compatible versions of the services and added a debug interface:

### New Files Created:
1. `src/services/browserDynamicPricingService.ts` - Browser-compatible pricing service
2. `src/config/browserDynamicTokenPairs.ts` - Browser-compatible token pairs  
3. `src/components/DebugDynamicPricing.tsx` - Debug interface for testing services

### Updated Files:
- `src/App.tsx` - Added "Debug Services" tab
- `src/components/DynamicPricingTest.tsx` - Updated to use browser services

## 🧪 How to Test

1. **Access the Application**: `http://localhost:3002`
2. **Click "Debug Services" Tab**: This will run step-by-step tests
3. **Click "Run Service Tests"**: Watch the console for detailed output

### Expected Debug Output:
```
✅ Browser services imported successfully  
✅ Pricing service created
✅ Cache stats: {...}
✅ Pair service status: {...}
✅ WETH price: {...}
✅ Dynamic pairs loaded: 5 pairs
```

## 🔍 What to Look For

### If Debug Tests Pass:
- Switch to "Dynamic Pricing Test" tab
- Services should now show real data instead of zeros

### If Debug Tests Fail:
- Check browser console for detailed error messages
- Look for CORS issues with CoinGecko API
- Verify network connectivity

## 🌐 API Testing

The services use your CoinGecko Demo API key: `CG-sw3jGBgpxKyEsNACERZfnebE`

### Manual API Test:
```bash
# Test if CoinGecko API is accessible
curl -H "x-cg-demo-api-key: CG-sw3jGBgpxKyEsNACERZfnebE" \
     "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
```

Expected response:
```json
{"ethereum":{"usd":2400.00}}
```

## 🚨 Common Issues & Solutions

### Issue 1: CORS Errors
**Symptoms**: API calls fail with CORS errors
**Solution**: CoinGecko API should allow browser requests, but if blocked, we'll need a proxy

### Issue 2: Rate Limiting
**Symptoms**: 429 errors in console  
**Solution**: Services implement retry logic with exponential backoff

### Issue 3: Network Errors  
**Symptoms**: Fetch failures, network timeouts
**Solution**: Services fall back to hardcoded prices automatically

### Issue 4: Import Errors
**Symptoms**: Module resolution errors
**Solution**: Use browser-compatible versions (already implemented)

## 📊 Expected Behavior After Fix

### Dynamic Pricing Test Tab Should Show:
- **Cached Tokens**: 0-7 (initially 0, increases after API calls)
- **Live Prices**: 0-7 (number of successfully fetched prices)  
- **Cache Age**: Actual hours instead of "487835.2h"
- **Token Prices**: Real prices from CoinGecko instead of empty
- **Token Pairs**: Calculated sellAmounts based on live prices

### Test Interface Should Work:
- "Update All Prices" button fetches from CoinGecko
- "Test $10K" buttons calculate real amounts
- "Test Calculation" buttons show dynamic vs fallback pairs

## 🎯 Next Steps

1. **Run Debug Tests First**: Identify specific failure points
2. **Check Browser Console**: Look for detailed error messages  
3. **Verify API Access**: Ensure CoinGecko API is reachable
4. **Test Individual Functions**: Use debug interface to isolate issues

## 💾 Fallback Mode

If live pricing continues to fail, the system automatically falls back to:
- **WETH**: $2,400 (conservative estimate)
- **UNI**: $8 (conservative estimate)  
- **Stablecoins**: $1.00 (assumed)

This ensures the application continues working even with API issues.

---
*Last Updated: August 26, 2025*  
*Test Environment: http://localhost:3002*