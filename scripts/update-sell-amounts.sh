#!/bin/bash

# Update sellAmounts by triggering the API endpoint
# This script runs 3x daily: 8am, 2pm, 8pm UTC

LOG_FILE="/var/log/sellAmounts-update.log"
API_URL="http://localhost:3001/api/sellAmounts"

# Function to log with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S UTC')] $1" >> "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S UTC')] $1"
}

log_message "Starting sellAmounts update..."

# Make request to API endpoint to trigger fresh calculation
response=$(curl -s -w "HTTP_CODE:%{http_code}" "$API_URL")
http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
response_body=$(echo "$response" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$http_code" = "200" ]; then
    # Parse response to get source and age info
    source=$(echo "$response_body" | grep -o '"source":"[^"]*"' | cut -d: -f2 | tr -d '"')
    age_hours=$(echo "$response_body" | grep -o '"age_hours":[0-9.]*' | cut -d: -f2)
    
    log_message "✅ SUCCESS: sellAmounts updated (source: $source, age: ${age_hours}h)"
    
    # Log some price info if available
    if echo "$response_body" | grep -q '"data"'; then
        log_message "📊 Cache refreshed with current market prices"
    fi
else
    log_message "❌ ERROR: HTTP $http_code - $response_body"
    exit 1
fi

log_message "sellAmounts update completed successfully"