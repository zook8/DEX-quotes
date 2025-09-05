#!/bin/bash

# NGINX Cache Monitor and Management Script
# Usage: ./nginx-cache-monitor.sh [check|clear|stats|purge-old]

set -e

CACHE_DIR="/var/cache/nginx"
STATIC_CACHE_DIR="$CACHE_DIR/static_assets"
PROXY_CACHE_DIR="$CACHE_DIR/proxy_cache"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display cache statistics
show_cache_stats() {
    echo -e "${BLUE}=== NGINX Cache Statistics ===${NC}"
    echo
    
    if [ -d "$STATIC_CACHE_DIR" ]; then
        echo -e "${GREEN}Static Assets Cache:${NC}"
        echo "  Directory: $STATIC_CACHE_DIR"
        echo "  Size: $(du -sh $STATIC_CACHE_DIR 2>/dev/null | cut -f1 || echo '0B')"
        echo "  Files: $(find $STATIC_CACHE_DIR -type f 2>/dev/null | wc -l || echo '0')"
        echo "  Last modified: $(stat -c %y $STATIC_CACHE_DIR 2>/dev/null | cut -d' ' -f1,2 || echo 'N/A')"
        echo
    else
        echo -e "${YELLOW}Static Assets Cache: Not found${NC}"
        echo
    fi
    
    if [ -d "$PROXY_CACHE_DIR" ]; then
        echo -e "${GREEN}Proxy Cache:${NC}"
        echo "  Directory: $PROXY_CACHE_DIR"
        echo "  Size: $(du -sh $PROXY_CACHE_DIR 2>/dev/null | cut -f1 || echo '0B')"
        echo "  Files: $(find $PROXY_CACHE_DIR -type f 2>/dev/null | wc -l || echo '0')"
        echo "  Last modified: $(stat -c %y $PROXY_CACHE_DIR 2>/dev/null | cut -d' ' -f1,2 || echo 'N/A')"
        echo
    else
        echo -e "${YELLOW}Proxy Cache: Not found${NC}"
        echo
    fi
    
    # Overall disk usage
    echo -e "${BLUE}Disk Usage:${NC}"
    echo "  Cache partition: $(df -h $CACHE_DIR 2>/dev/null | tail -1 | awk '{print $4 " available (" $5 " used)"}' || echo 'N/A')"
    echo
}

# Function to check cache health
check_cache_health() {
    echo -e "${BLUE}=== Cache Health Check ===${NC}"
    echo
    
    local warnings=0
    
    # Check if cache directories exist and are writable
    for dir in "$STATIC_CACHE_DIR" "$PROXY_CACHE_DIR"; do
        if [ ! -d "$dir" ]; then
            echo -e "${RED}✗ Cache directory missing: $dir${NC}"
            warnings=$((warnings + 1))
        elif [ ! -w "$dir" ]; then
            echo -e "${YELLOW}⚠ Cache directory not writable: $dir${NC}"
            warnings=$((warnings + 1))
        else
            echo -e "${GREEN}✓ Cache directory OK: $dir${NC}"
        fi
    done
    
    # Check disk space
    local available=$(df $CACHE_DIR 2>/dev/null | tail -1 | awk '{print $4}' || echo '0')
    local total=$(df $CACHE_DIR 2>/dev/null | tail -1 | awk '{print $2}' || echo '1')
    local usage_percent=$((100 * (total - available) / total))
    
    if [ "$usage_percent" -gt 90 ]; then
        echo -e "${RED}✗ Disk usage critical: ${usage_percent}%${NC}"
        warnings=$((warnings + 1))
    elif [ "$usage_percent" -gt 80 ]; then
        echo -e "${YELLOW}⚠ Disk usage high: ${usage_percent}%${NC}"
        warnings=$((warnings + 1))
    else
        echo -e "${GREEN}✓ Disk usage OK: ${usage_percent}%${NC}"
    fi
    
    # Check NGINX processes
    if pgrep -f "nginx.*cache" > /dev/null; then
        echo -e "${GREEN}✓ NGINX cache processes running${NC}"
    else
        echo -e "${YELLOW}⚠ No NGINX cache processes detected${NC}"
        warnings=$((warnings + 1))
    fi
    
    echo
    if [ "$warnings" -eq 0 ]; then
        echo -e "${GREEN}✓ All cache health checks passed${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ $warnings warning(s) detected${NC}"
        return 1
    fi
}

# Function to clear cache
clear_cache() {
    local cache_type="$1"
    
    echo -e "${BLUE}=== Clearing Cache ===${NC}"
    echo
    
    if [ "$cache_type" = "static" ] || [ "$cache_type" = "all" ]; then
        if [ -d "$STATIC_CACHE_DIR" ]; then
            echo "Clearing static assets cache..."
            sudo rm -rf "$STATIC_CACHE_DIR"/*
            echo -e "${GREEN}✓ Static assets cache cleared${NC}"
        fi
    fi
    
    if [ "$cache_type" = "proxy" ] || [ "$cache_type" = "all" ]; then
        if [ -d "$PROXY_CACHE_DIR" ]; then
            echo "Clearing proxy cache..."
            sudo rm -rf "$PROXY_CACHE_DIR"/*
            echo -e "${GREEN}✓ Proxy cache cleared${NC}"
        fi
    fi
    
    echo "Reloading NGINX..."
    sudo systemctl reload nginx
    echo -e "${GREEN}✓ NGINX reloaded${NC}"
}

# Function to purge old cache files
purge_old_cache() {
    echo -e "${BLUE}=== Purging Old Cache Files ===${NC}"
    echo
    
    # Find files older than 7 days in static cache (should be rare due to 2M setting)
    if [ -d "$STATIC_CACHE_DIR" ]; then
        local old_static=$(find "$STATIC_CACHE_DIR" -type f -mtime +7 2>/dev/null | wc -l || echo '0')
        if [ "$old_static" -gt 0 ]; then
            echo "Found $old_static old static cache files (>7 days)"
            find "$STATIC_CACHE_DIR" -type f -mtime +7 -delete 2>/dev/null || true
            echo -e "${GREEN}✓ Old static cache files purged${NC}"
        else
            echo "No old static cache files found"
        fi
    fi
    
    # Find files older than 1 day in proxy cache
    if [ -d "$PROXY_CACHE_DIR" ]; then
        local old_proxy=$(find "$PROXY_CACHE_DIR" -type f -mtime +1 2>/dev/null | wc -l || echo '0')
        if [ "$old_proxy" -gt 0 ]; then
            echo "Found $old_proxy old proxy cache files (>1 day)"
            find "$PROXY_CACHE_DIR" -type f -mtime +1 -delete 2>/dev/null || true
            echo -e "${GREEN}✓ Old proxy cache files purged${NC}"
        else
            echo "No old proxy cache files found"
        fi
    fi
    
    echo -e "${GREEN}✓ Cache purge completed${NC}"
}

# Main script logic
case "${1:-check}" in
    "check")
        show_cache_stats
        check_cache_health
        ;;
    "stats")
        show_cache_stats
        ;;
    "clear")
        clear_cache "${2:-all}"
        ;;
    "clear-static")
        clear_cache "static"
        ;;
    "clear-proxy")
        clear_cache "proxy"
        ;;
    "purge-old")
        purge_old_cache
        ;;
    "help"|"--help"|"-h")
        echo "NGINX Cache Monitor and Management Script"
        echo
        echo "Usage: $0 [COMMAND]"
        echo
        echo "Commands:"
        echo "  check          Check cache health and show statistics (default)"
        echo "  stats          Show cache statistics only"
        echo "  clear          Clear all cache"
        echo "  clear-static   Clear static assets cache only"
        echo "  clear-proxy    Clear proxy cache only"
        echo "  purge-old      Remove old cache files"
        echo "  help           Show this help message"
        echo
        echo "Examples:"
        echo "  $0 check       # Health check and stats"
        echo "  $0 clear       # Clear all cache"
        echo "  $0 stats       # Show statistics"
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac