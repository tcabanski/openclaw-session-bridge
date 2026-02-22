# OpenClaw Session Bridge

Foundry VTT module to receive session updates from OpenClaw and update World settings.

## Installation

1. Create folder: `Data/modules/openclaw-session-bridge/`
2. Copy `module.json` and `main.js` into the folder
3. Enable module in your world

## Configuration

Configure in **Game Settings > Configure Settings > OpenClaw Session Bridge**:

- **Server Port**: Unique port per world (e.g., 30001, 30002, 30003...)
- **API Key**: Secret key shared with OpenClaw

## API Usage

```bash
curl -X POST http://localhost:PORT/update-session \
  -H "Authorization: Bearer API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-02-28",
    "time": "12:00 PM",
    "title": "The Toll",
    "teaser": "The demon is dead..."
  }'
```

## What It Does

Updates your World description (same as Edit World dialog) with:
- Next session date/time
- Session title (as H4 heading)
- Teaser text

Also sets the World's `nextSession` field for Foundry's built-in session tracking.

## Per-World Setup Example

| Campaign | Port | URL |
|----------|------|-----|
| Sandpoint | 30001 | http://localhost:30001 |
| Blood Lords | 30002 | http://localhost:30002 |
| Abomination Vaults | 30003 | http://localhost:30003 |

## Requirements

- Foundry VTT v13.300+
- GM must be logged in for server to run
