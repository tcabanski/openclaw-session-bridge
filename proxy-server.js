const express = require('express');
const cors = require('cors');

const app = express();

// Configuration
const PORT = process.env.PORT || 30025;

// In-memory store for pending updates
const pendingUpdates = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// API endpoint for session updates (POST from OpenClaw)
app.post('/update-session', (req, res) => {
  const { world, worldId, date, time, title, teaser } = req.body;
  
  if (!title || !teaser) {
    return res.status(400).json({ 
      error: 'Missing required fields: title, teaser' 
    });
  }
  
  // Use provided world identifier
  const worldKey = (world || worldId || 'default').toLowerCase();
  
  // Build the update data
  const updateData = {
    date,
    time,
    title,
    teaser,
    timestamp: Date.now()
  };
  
  // Store in memory for the module to poll
  pendingUpdates.set(worldKey, updateData);
  
  console.log(`[${new Date().toISOString()}] Update queued for world: ${worldKey} - "${title}"`);
  
  res.json({ 
    success: true, 
    message: 'Update queued for module pickup',
    world: worldKey,
    timestamp: updateData.timestamp
  });
});

// API endpoint for module to poll (GET from Foundry)
app.get('/get-update', (req, res) => {
  const world = req.query.world;
  
  if (!world) {
    return res.status(400).json({ error: 'Missing world parameter' });
  }
  
  const worldKey = world.toLowerCase();
  
  if (!pendingUpdates.has(worldKey)) {
    return res.status(404).json({ 
      error: 'No pending update',
      world: worldKey
    });
  }
  
  const update = pendingUpdates.get(worldKey);
  
  // Return the update and remove it from pending
  pendingUpdates.delete(worldKey);
  
  console.log(`[${new Date().toISOString()}] Update delivered to: ${worldKey}`);
  
  res.json({
    success: true,
    update: update
  });
});

// List pending updates (useful for debugging)
app.get('/worlds', (req, res) => {
  res.json({
    pendingUpdates: Array.from(pendingUpdates.keys()),
    count: pendingUpdates.size
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    module: 'openclaw-session-bridge-proxy',
    port: PORT,
    pendingUpdates: pendingUpdates.size
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('OpenClaw Session Bridge Proxy');
  console.log('='.repeat(60));
  console.log(`Port: ${PORT}`);
  console.log('\nEndpoints:');
  console.log(`  POST /update-session         - Send update from OpenClaw`);
  console.log(`  GET  /get-update?world=NAME  - Module polls here`);
  console.log(`  GET  /health                 - Health check`);
  console.log(`  GET  /worlds                 - List pending updates`);
  console.log('='.repeat(60));
});