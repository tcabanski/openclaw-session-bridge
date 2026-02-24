const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Configuration
const PORT = process.env.PORT || 30000;

// Map world names/identifiers to Foundry Data paths
const WORLD_PATHS = {};

// In-memory store for pending updates
const pendingUpdates = new Map();

// Load from environment variable
// Format: WORLD_PATHS=world1:/path/to/data1,world2:/path/to/data2
if (process.env.WORLD_PATHS) {
  process.env.WORLD_PATHS.split(',').forEach(mapping => {
    const colonIndex = mapping.indexOf(':');
    if (colonIndex > 0) {
      const world = mapping.substring(0, colonIndex).trim();
      const dataPath = mapping.substring(colonIndex + 1).trim();
      if (world && dataPath) {
        WORLD_PATHS[world.toLowerCase()] = dataPath;
      }
    }
  });
}

// Middleware
app.use(cors());
app.use(express.json());

// Helper to find the actual world folder
function findWorldFolder(worldsDir, worldIdentifier) {
  try {
    const entries = fs.readdirSync(worldsDir, { withFileTypes: true });
    const worldFolders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
    
    if (worldFolders.length === 0) {
      return null;
    }
    
    // If only one world, use it
    if (worldFolders.length === 1) {
      return worldFolders[0];
    }
    
    // Try to match by name (case insensitive, partial match)
    const targetLower = worldIdentifier.toLowerCase();
    const match = worldFolders.find(folder => {
      const folderLower = folder.toLowerCase();
      return folderLower === targetLower ||
             folderLower.includes(targetLower) ||
             targetLower.includes(folderLower);
    });
    
    if (match) {
      return match;
    }
    
    // If no match, return first folder
    console.warn(`No exact match for '${worldIdentifier}', using first world: ${worldFolders[0]}`);
    return worldFolders[0];
    
  } catch (err) {
    console.error('Error reading worlds directory:', err);
    return null;
  }
}

// API endpoint for session updates (POST from OpenClaw)
app.post('/update-session', (req, res) => {
  const { world, worldId, date, time, title, teaser } = req.body;
  
  if (!title || !teaser) {
    return res.status(400).json({ 
      error: 'Missing required fields: title, teaser' 
    });
  }
  
  // Determine which Foundry Data path to use
  const targetWorld = (world || worldId || 'default').toLowerCase();
  let foundryDataPath = WORLD_PATHS[targetWorld];
  
  if (!foundryDataPath && Object.keys(WORLD_PATHS).length === 1) {
    // If only one world configured, use it as default
    foundryDataPath = Object.values(WORLD_PATHS)[0];
  }
  
  if (!foundryDataPath) {
    return res.status(400).json({
      error: `Unknown world: ${targetWorld}`,
      configuredWorlds: Object.keys(WORLD_PATHS),
      hint: 'Configure WORLD_PATHS environment variable'
    });
  }
  
  // Find the actual world folder name
  const worldsDir = path.join(foundryDataPath, 'worlds');
  const worldFolder = findWorldFolder(worldsDir, targetWorld);
  
  if (!worldFolder) {
    return res.status(404).json({ 
      error: 'No worlds found in Data directory',
      worldsDir: worldsDir
    });
  }
  
  // Build the update data
  const updateData = {
    date,
    time,
    title,
    teaser,
    timestamp: Date.now(),
    world: worldFolder
  };
  
  // Store in memory for the module to poll
  pendingUpdates.set(worldFolder, updateData);
  
  console.log(`[${new Date().toISOString()}] Session update queued for world: ${worldFolder}`);
  console.log(`  Title: ${title}`);
  
  res.json({ 
    success: true, 
    message: 'Update queued for module pickup',
    world: worldFolder,
    timestamp: updateData.timestamp
  });
});

// API endpoint for module to poll (GET from Foundry)
app.get('/get-update', (req, res) => {
  const world = req.query.world;
  
  if (!world) {
    return res.status(400).json({ error: 'Missing world parameter' });
  }
  
  // Find the world (handle case variations)
  let worldKey = null;
  for (const [key, value] of pendingUpdates) {
    if (key.toLowerCase() === world.toLowerCase() || 
        world.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(world.toLowerCase())) {
      worldKey = key;
      break;
    }
  }
  
  if (!worldKey || !pendingUpdates.has(worldKey)) {
    return res.status(404).json({ 
      error: 'No pending update',
      world: world
    });
  }
  
  const update = pendingUpdates.get(worldKey);
  
  // Return the update and remove it from pending
  pendingUpdates.delete(worldKey);
  
  console.log(`[${new Date().toISOString()}] Update delivered to module for world: ${worldKey}`);
  
  res.json({
    success: true,
    update: update
  });
});

// List configured worlds
app.get('/worlds', (req, res) => {
  res.json({
    configuredWorlds: Object.keys(WORLD_PATHS),
    mappings: WORLD_PATHS,
    pendingUpdates: Array.from(pendingUpdates.keys())
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    module: 'openclaw-session-bridge-proxy',
    port: PORT,
    worldsConfigured: Object.keys(WORLD_PATHS),
    worldCount: Object.keys(WORLD_PATHS).length,
    pendingUpdates: Array.from(pendingUpdates.keys())
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('OpenClaw Session Bridge Proxy');
  console.log('='.repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`Worlds configured: ${Object.keys(WORLD_PATHS).length}`);
  
  if (Object.keys(WORLD_PATHS).length > 0) {
    console.log('\nMappings:');
    Object.entries(WORLD_PATHS).forEach(([world, path]) => {
      console.log(`  ${world} → ${path}`);
    });
  } else {
    console.log('\nWARNING: No worlds configured!');
    console.log('Set WORLD_PATHS environment variable');
  }
  
  console.log('\n' + '-'.repeat(60));
  console.log('Endpoints:');
  console.log(`  POST /update-session  - Send update from OpenClaw`);
  console.log(`  GET  /get-update?world=NAME  - Module polls here`);
  console.log(`  GET  /health          - Health check`);
  console.log('='.repeat(60));
});