#!/bin/bash

# n8n Startup Script with ngrok tunnel
# Location: /Users/teerayutyeerahem/My-project/n8n/start-n8n.sh

echo "🚀 Starting n8n with ngrok tunnel..."

# Load environment variables
if [ -f "/Users/teerayutyeerahem/My-project/n8n/.env" ]; then
  set -a
  source "/Users/teerayutyeerahem/My-project/n8n/.env"
  set +a
fi

# Set n8n user folder to custom path
export N8N_USER_FOLDER="/Users/teerayutyeerahem/My-project/n8n"

# Note: Authentication credentials are now loaded from .env file

# Start ngrok in background
echo "📡 Starting ngrok tunnel on port 5678..."
ngrok http 5678 > /dev/null 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get ngrok public URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$NGROK_URL" ]; then
    echo "⚠️  Warning: Could not get ngrok URL"
else
    echo "✅ ngrok tunnel: $NGROK_URL"
fi

# Start n8n
echo "🟢 Starting n8n..."
/usr/local/bin/n8n start

# Cleanup on exit
trap "echo '🛑 Stopping ngrok...'; kill $NGROK_PID 2>/dev/null" EXIT
