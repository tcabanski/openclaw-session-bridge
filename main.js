/**
 * OpenClaw Session Bridge for Foundry VTT
 * Receives session updates via HTTP and updates World settings
 */

class OpenClawSessionBridge {
  constructor() {
    this.server = null;
    this.port = game.settings.get('openclaw-session-bridge', 'port');
  }

  async init() {
    console.log('OpenClaw Session Bridge | Initializing...');
    this.startServer();
  }

  startServer() {
    // Simple HTTP server using Node.js http module
    const http = require('http');
    const url = require('url');

    this.server = http.createServer((req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Only accept POST to /update-session
      const parsedUrl = url.parse(req.url, true);
      if (req.method !== 'POST' || parsedUrl.pathname !== '/update-session') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      // Read request body
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          await this.handleUpdate(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          console.error('OpenClaw Session Bridge | Error:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    });

    this.server.listen(this.port, () => {
      console.log(`OpenClaw Session Bridge | Server listening on port ${this.port}`);
      ui.notifications.info(`OpenClaw Session Bridge active on port ${this.port}`);
    });

    this.server.on('error', (error) => {
      console.error('OpenClaw Session Bridge | Server error:', error);
      ui.notifications.error(`OpenClaw Session Bridge failed to start: ${error.message}`);
    });
  }

  async handleUpdate(data) {
    const { date, time, title, teaser } = data;

    if (!title || !teaser) {
      throw new Error('Missing required fields: title and teaser');
    }

    // Build the description HTML
    const description = this.buildDescription(date, time, title, teaser);

    // Update the World document (same as Edit World dialog)
    const worldUpdate = {
      description: description
    };

    // If we have a date, try to parse it for nextSession
    if (date) {
      const dateTime = time ? `${date} ${time}` : date;
      const timestamp = Date.parse(dateTime);
      if (!isNaN(timestamp)) {
        worldUpdate.nextSession = timestamp;
      }
    }

    // Update the world
    await game.world.update(worldUpdate);

    console.log('OpenClaw Session Bridge | World updated with session info');
    ui.notifications.info('Next session info updated');
  }

  buildDescription(date, time, title, teaser) {
    let html = '';
    
    if (date) {
      html += `<p><strong>Next Session:</strong> ${date}`;
      if (time) {
        html += ` at ${time}`;
      }
      html += `</p>`;
    }

    html += `<h4>${title}</h4>`;
    html += `<p>${teaser}</p>`;

    return html;
  }

  destroy() {
    if (this.server) {
      this.server.close();
      console.log('OpenClaw Session Bridge | Server stopped');
    }
  }
}

// Register settings
Hooks.once('init', () => {
  game.settings.register('openclaw-session-bridge', 'port', {
    name: 'Server Port',
    hint: 'The port number for the OpenClaw Session Bridge server (must be unique per world)',
    scope: 'world',
    config: true,
    type: Number,
    default: 30001,
    range: {
      min: 1024,
      max: 65535,
      step: 1
    }
  });
});

// Start the server when ready
Hooks.once('ready', () => {
  if (game.user.isGM) {
    window.openclawBridge = new OpenClawSessionBridge();
    window.openclawBridge.init();
  }
});

// Clean up on logout
Hooks.on('logout', () => {
  if (window.openclawBridge) {
    window.openclawBridge.destroy();
    window.openclawBridge = null;
  }
});
