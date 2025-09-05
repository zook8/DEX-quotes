#!/bin/bash

# Test NGINX cache functionality
# This script tests if caching is working properly

set -e

SITE_URL="https://quotes.mynodes.duckdns.org"
TEST_LOG="/tmp/cache-test-$(date +%Y%m%d_%H%M%S).log"

echo "=== NGINX Cache Functionality Test ===" | tee -a "$TEST_LOG"
echo "Site: $SITE_URL" | tee -a "$TEST_LOG"
echo "Test started: $(date)" | tee -a "$TEST_LOG"
echo | tee -a "$TEST_LOG"

# Function to test static asset caching
test_static_assets() {
    echo "Testing static asset caching..." | tee -a "$TEST_LOG"
    echo | tee -a "$TEST_LOG"
    
    # Get the main page to find asset URLs
    local index_html=$(curl -s -k "$SITE_URL" || echo "")
    
    if [ -z "$index_html" ]; then
        echo "❌ Failed to fetch main page" | tee -a "$TEST_LOG"
        return 1
    fi
    
    # Extract CSS and JS file URLs from the HTML
    local css_files=$(echo "$index_html" | grep -oP 'href="[^"]*\.css[^"]*"' | sed 's/href="//;s/"//' | head -3)
    local js_files=$(echo "$index_html" | grep -oP 'src="[^"]*\.js[^"]*"' | sed 's/src="//;s/"//' | head -3)
    
    # Test CSS files
    for css_file in $css_files; do
        if [[ "$css_file" == /* ]]; then
            local full_url="$SITE_URL$css_file"
        else
            local full_url="$SITE_URL/$css_file"
        fi
        
        echo "Testing CSS: $css_file" | tee -a "$TEST_LOG"
        
        # First request - should be MISS
        local first_response=$(curl -s -k -I "$full_url" 2>/dev/null || echo "")
        local first_cache_status=$(echo "$first_response" | grep -i "x-cache-status" | cut -d' ' -f2- | tr -d '\r\n' || echo "UNKNOWN")
        
        # Second request - should be HIT
        sleep 1
        local second_response=$(curl -s -k -I "$full_url" 2>/dev/null || echo "")
        local second_cache_status=$(echo "$second_response" | grep -i "x-cache-status" | cut -d' ' -f2- | tr -d '\r\n' || echo "UNKNOWN")
        
        echo "  First request:  X-Cache-Status: $first_cache_status" | tee -a "$TEST_LOG"
        echo "  Second request: X-Cache-Status: $second_cache_status" | tee -a "$TEST_LOG"
        
        # Check cache headers
        local cache_control=$(echo "$second_response" | grep -i "cache-control" | cut -d' ' -f2- | tr -d '\r\n' || echo "NONE")
        local expires=$(echo "$second_response" | grep -i "expires" | cut -d' ' -f2- | tr -d '\r\n' || echo "NONE")
        
        echo "  Cache-Control: $cache_control" | tee -a "$TEST_LOG"
        echo "  Expires: $expires" | tee -a "$TEST_LOG"
        echo | tee -a "$TEST_LOG"
    done
    
    # Test JS files
    for js_file in $js_files; do
        if [[ "$js_file" == /* ]]; then
            local full_url="$SITE_URL$js_file"
        else
            local full_url="$SITE_URL/$js_file"
        fi
        
        echo "Testing JS: $js_file" | tee -a "$TEST_LOG"
        
        # First request - should be MISS
        local first_response=$(curl -s -k -I "$full_url" 2>/dev/null || echo "")
        local first_cache_status=$(echo "$first_response" | grep -i "x-cache-status" | cut -d' ' -f2- | tr -d '\r\n' || echo "UNKNOWN")
        
        # Second request - should be HIT
        sleep 1
        local second_response=$(curl -s -k -I "$full_url" 2>/dev/null || echo "")
        local second_cache_status=$(echo "$second_response" | grep -i "x-cache-status" | cut -d' ' -f2- | tr -d '\r\n' || echo "UNKNOWN")
        
        echo "  First request:  X-Cache-Status: $first_cache_status" | tee -a "$TEST_LOG"
        echo "  Second request: X-Cache-Status: $second_cache_status" | tee -a "$TEST_LOG"
        
        # Check cache headers
        local cache_control=$(echo "$second_response" | grep -i "cache-control" | cut -d' ' -f2- | tr -d '\r\n' || echo "NONE")
        local expires=$(echo "$second_response" | grep -i "expires" | cut -d' ' -f2- | tr -d '\r\n' || echo "NONE")
        
        echo "  Cache-Control: $cache_control" | tee -a "$TEST_LOG"
        echo "  Expires: $expires" | tee -a "$TEST_LOG"
        echo | tee -a "$TEST_LOG"
    done
}

# Function to test HTML caching
test_html_caching() {
    echo "Testing HTML page caching..." | tee -a "$TEST_LOG"
    echo | tee -a "$TEST_LOG"
    
    # First request
    local first_response=$(curl -s -k -I "$SITE_URL" 2>/dev/null || echo "")
    local first_cache_status=$(echo "$first_response" | grep -i "x-cache-status" | cut -d' ' -f2- | tr -d '\r\n' || echo "UNKNOWN")
    
    # Second request
    sleep 1
    local second_response=$(curl -s -k -I "$SITE_URL" 2>/dev/null || echo "")
    local second_cache_status=$(echo "$second_response" | grep -i "x-cache-status" | cut -d' ' -f2- | tr -d '\r\n' || echo "UNKNOWN")
    
    echo "  First request:  X-Cache-Status: $first_cache_status" | tee -a "$TEST_LOG"
    echo "  Second request: X-Cache-Status: $second_cache_status" | tee -a "$TEST_LOG"
    
    # Check cache headers
    local cache_control=$(echo "$second_response" | grep -i "cache-control" | cut -d' ' -f2- | tr -d '\r\n' || echo "NONE")
    
    echo "  Cache-Control: $cache_control" | tee -a "$TEST_LOG"
    echo | tee -a "$TEST_LOG"
}

# Function to check cache files on disk
check_cache_files() {
    echo "Checking cache files on disk..." | tee -a "$TEST_LOG"
    echo | tee -a "$TEST_LOG"
    
    local static_files=$(sudo find /var/cache/nginx/static_assets -type f 2>/dev/null | wc -l || echo '0')
    local proxy_files=$(sudo find /var/cache/nginx/proxy_cache -type f 2>/dev/null | wc -l || echo '0')
    
    echo "  Static cache files: $static_files" | tee -a "$TEST_LOG"
    echo "  Proxy cache files: $proxy_files" | tee -a "$TEST_LOG"
    
    if [ "$static_files" -gt 0 ] || [ "$proxy_files" -gt 0 ]; then
        echo "  ✓ Cache files created successfully" | tee -a "$TEST_LOG"
    else
        echo "  ❌ No cache files found" | tee -a "$TEST_LOG"
    fi
    
    echo | tee -a "$TEST_LOG"
}

# Run all tests
test_html_caching
test_static_assets
check_cache_files

echo "=== Test Summary ===" | tee -a "$TEST_LOG"
echo "Test completed: $(date)" | tee -a "$TEST_LOG"
echo "Full log saved to: $TEST_LOG" | tee -a "$TEST_LOG"

# Show log file location
echo
echo "Full test results saved to: $TEST_LOG"
echo "View with: cat $TEST_LOG"