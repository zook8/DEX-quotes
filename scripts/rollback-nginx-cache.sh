#!/bin/bash

# NGINX Cache Rollback Script
# This script will restore the original NGINX configuration if needed

set -e

BACKUP_FILE="/tmp/quotes.backup.$(ls /tmp/quotes.backup.* 2>/dev/null | head -1 | cut -d'.' -f3-)"
ORIGINAL_NGINX_CONF="/etc/nginx/nginx.conf.original"

echo "=== NGINX Cache Configuration Rollback ==="
echo

# Check if backup exists
if [ ! -f "/tmp/quotes.backup."* ]; then
    echo "❌ No backup file found. Cannot rollback safely."
    echo "Manual restoration required."
    exit 1
fi

BACKUP_FILE=$(ls /tmp/quotes.backup.* 2>/dev/null | head -1)
echo "Found backup: $BACKUP_FILE"

# Confirm rollback
read -p "Are you sure you want to rollback to the previous configuration? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 0
fi

echo "Starting rollback process..."

# 1. Stop nginx temporarily
echo "Stopping NGINX..."
sudo systemctl stop nginx

# 2. Restore original sites-available configuration
echo "Restoring original quotes configuration..."
sudo cp "$BACKUP_FILE" /etc/nginx/sites-available/quotes

# 3. Create backup of current nginx.conf and restore original if exists
if [ -f "$ORIGINAL_NGINX_CONF" ]; then
    echo "Restoring original nginx.conf..."
    sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.with-cache
    sudo cp "$ORIGINAL_NGINX_CONF" /etc/nginx/nginx.conf
else
    echo "No original nginx.conf found. You may need to manually remove cache configuration."
fi

# 4. Test configuration
echo "Testing NGINX configuration..."
if sudo nginx -t; then
    echo "✓ Configuration test passed"
else
    echo "❌ Configuration test failed. Restoring cache configuration..."
    sudo cp /etc/nginx/nginx.conf.with-cache /etc/nginx/nginx.conf
    sudo cp "$BACKUP_FILE.rollback" /etc/nginx/sites-available/quotes 2>/dev/null || true
    sudo systemctl start nginx
    echo "Cache configuration restored due to test failure."
    exit 1
fi

# 5. Start nginx
echo "Starting NGINX..."
sudo systemctl start nginx

# 6. Verify nginx is running
if systemctl is-active --quiet nginx; then
    echo "✓ NGINX is running"
else
    echo "❌ NGINX failed to start"
    exit 1
fi

# 7. Optional: Remove cache directories
read -p "Do you want to remove cache directories? (y/N): " remove_cache
if [[ "$remove_cache" =~ ^[Yy]$ ]]; then
    echo "Removing cache directories..."
    sudo rm -rf /var/cache/nginx/static_assets
    sudo rm -rf /var/cache/nginx/proxy_cache
    echo "✓ Cache directories removed"
fi

echo
echo "✓ Rollback completed successfully"
echo "Original configuration restored"
echo "NGINX is running without caching"