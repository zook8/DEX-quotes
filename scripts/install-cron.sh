#!/bin/bash

# Install cron job for sellAmounts updates (3x daily)
# Runs at 8am, 2pm, 8pm UTC

CRON_JOB="0 8,14,20 * * * /home/ubuntu/uniswap-price-quotes/scripts/update-sell-amounts.sh >> /var/log/sellAmounts-cron.log 2>&1"
SCRIPT_DIR="/home/ubuntu/uniswap-price-quotes/scripts"

echo "Installing cron job for sellAmounts updates..."

# Create log files with proper permissions
sudo touch /var/log/sellAmounts-update.log
sudo touch /var/log/sellAmounts-cron.log
sudo chown ubuntu:ubuntu /var/log/sellAmounts-*.log

# Add cron job if it doesn't already exist
(crontab -l 2>/dev/null | grep -v "update-sell-amounts"; echo "$CRON_JOB") | crontab -

echo "✅ Cron job installed successfully!"
echo "📅 Schedule: 8am, 2pm, 8pm UTC daily"
echo "📋 View logs with: tail -f /var/log/sellAmounts-update.log"
echo "🔧 View cron logs: tail -f /var/log/sellAmounts-cron.log"
echo ""
echo "Current crontab:"
crontab -l | grep "update-sell-amounts" || echo "No cron job found"