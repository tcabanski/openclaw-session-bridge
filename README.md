# OpenClaw Session Bridge

Foundry VTT module to receive session updates from OpenClaw via HTTP proxy.

## Architecture

```
OpenClaw → HTTP POST → Proxy Server → Writes File → Foundry Module (polls) → Updates World
```

## Installation

### 1. Install Foundry Module

```bash
# On your remote Foundry server
ln -s /path/to/openclaw-session-bridge /path/to/foundrydata/Data/modules/openclaw-session-bridge
```

Or copy the files:
- `module.json`
- `main.js`

To: `Data/modules/openclaw-session-bridge/`

### 2. Enable in Foundry
1. Launch Foundry VTT
2. Enable "OpenClaw Session Bridge" module
3. Configure port in Game Settings (for reference)

### 3. Start Proxy Server

On your remote Foundry server:

```bash
cd /path/to/openclaw-session-bridge
npm install express cors

# Configure paths for your worlds
export WORLD_PATHS="myth:/home/foundry/myth/data,vaults:/home/foundry/vaults/data"
export PORT=30000

node proxy-server.js
```

Or use the startup script:
```bash
./start-proxy.sh
```

## Configuration

### World Mappings

The proxy needs to know where each Foundry instance's **Data directory** is. This is the folder containing `worlds/`, `systems/`, `modules/` subdirectories.

```bash
export WORLD_PATHS="
campaign1:/path/to/instance1/Data,
campaign2:/path/to/instance2/Data,
campaign3:/path/to/instance3/Data
"
```

**NOT** the specific world folder - the proxy finds the world automatically in `Data/worlds/`.

### Port

Default: 30000

Override with: `export PORT=30001`

## Usage

### Send Updates

From OpenClaw or any HTTP client:

```bash
curl -X POST http://your-foundry-server:30000/update-session \
  -H "Content-Type: application/json" \
  -d '{
    "world": "myth",
    "title": "The Toll",
    "teaser": "The demon is dead. The cost was high.",
    "date": "2026-02-28",
    "time": "7:00 PM"
  }'
```

### Check Health

```bash
curl http://your-foundry-server:30000/health
```

### List Configured Worlds

```bash
curl http://your-foundry-server:30000/worlds
```

## How It Works

1. **Proxy receives POST** with session data
2. **Proxy writes file** to `Data/worlds/{world}/.openclaw-update.json`
3. **Foundry module polls** every 2 seconds for this file
4. **Module updates world** description when file is found
5. **File is overwritten** on next update (no cleanup needed)

## Troubleshooting

### Module shows "Could not access Foundry server"
This is expected - the module doesn't need server access, it polls for files.

### Updates not appearing
- Check proxy is running: `curl http://localhost:30000/health`
- Verify world name matches: `curl http://localhost:30000/worlds`
- Check Foundry console for polling messages
- Ensure file permissions allow proxy to write to Data folder

### Permission denied
```bash
chmod 755 /path/to/foundry/data
chown -R foundry:foundry /path/to/foundry/data
```

## API Reference

### POST /update-session

**Body:**
```json
{
  "world": "campaign-name",      // Required - matches WORLD_PATHS key
  "title": "Session Title",      // Required
  "teaser": "Session teaser",    // Required
  "date": "2026-02-28",          // Optional
  "time": "7:00 PM"              // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Update queued",
  "world": "actual-world-folder",
  "file": "/path/to/.openclaw-update.json"
}
```

## Requirements

- Foundry VTT v13+
- Node.js 14+ (for proxy server)
- Express and CORS npm packages
- GM logged in to receive updates