#!/bin/bash

# OpenClaw Session Bridge Proxy Startup Script
# Usage: ./start-proxy.sh

# Configuration - EDIT THESE PATHS FOR YOUR SETUP
export PORT=${PORT:-30000}

# Map your campaign names to their Foundry Data paths
# Format: "campaign-name:/path/to/foundry/data"
export WORLD_PATHS="
myth:/home/foundry/myth/data,
runelords:/home/foundry/runelords/data,
vaults:/home/foundry/vaults/data,
ashes:/home/foundry/ashes/data,
blood:/home/foundry/blood/data,
sandpoint:/home/foundry/sandpoint/data,
tusk:/home/foundry/tusk/data,
redhand:/home/foundry/redhand/data
"

# Alternatively, if all worlds share a common Data parent:
# export DEFAULT_FOUNDRY_DATA=/home/foundry/foundrydata/Data

echo "Starting OpenClaw Session Bridge Proxy..."
echo "Port: $PORT"
echo "Worlds: $WORLD_PATHS"
echo ""
echo "Test with:"
echo "curl -X POST http://localhost:$PORT/update-session \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"world\": \"myth\", \"title\": \"Test\", \"teaser\": \"Test teaser\"}'"
echo ""

# Start the proxy
node proxy-server.js