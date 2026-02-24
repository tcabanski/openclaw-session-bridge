/**
 * OpenClaw Session Bridge for Foundry VTT
 * Polls proxy server for session updates
 */

class OpenClawSessionBridge {
  constructor() {
    this.pollingInterval = null;
    this.lastUpdateTime = 0;
    this.worldId = null;
    this.proxyUrl = null;
  }

  async init() {
    this.worldId = game.world.id;
    this.lastUpdateTime = game.settings.get('openclaw-session-bridge', 'lastUpdate') || 0;
    this.proxyUrl = game.settings.get('openclaw-session-bridge', 'proxyUrl');
    
    console.log('OpenClaw Session Bridge | Initializing...');
    console.log(`OpenClaw Session Bridge | World: ${this.worldId}`);
    console.log(`OpenClaw Session Bridge | Proxy URL: ${this.proxyUrl}`);
    
    if (!this.proxyUrl || this.proxyUrl === 'http://localhost:30000') {
      ui.notifications.warning('OpenClaw Session Bridge: Proxy URL not configured or using default. Check module settings and reload.');
      console.warn('OpenClaw Session Bridge | Current proxyUrl:', this.proxyUrl);
      return;
    }
    
    // Start polling for updates
    this.startPolling();
    
    ui.notifications.info('OpenClaw Session Bridge active');
  }

  startPolling() {
    // Get polling interval from settings (convert seconds to milliseconds)
    const pollingIntervalSec = game.settings.get('openclaw-session-bridge', 'pollingInterval') || 60;
    const pollingIntervalMs = pollingIntervalSec * 1000;
    
    console.log(`OpenClaw Session Bridge | Polling every ${pollingIntervalSec} seconds`);
    
    // Check for updates at configured interval
    this.pollingInterval = setInterval(() => {
      this.checkForUpdates();
    }, pollingIntervalMs);
    
    // Also check immediately
    this.checkForUpdates();
  }

  async checkForUpdates() {
    try {
      // Poll the proxy server for updates
      const url = `${this.proxyUrl}/get-update?world=${encodeURIComponent(this.worldId)}`;
      
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.status === 404) {
        // No pending update - this is normal
        return;
      }
      
      if (!response.ok) {
        console.debug('OpenClaw Session Bridge | Proxy returned error:', response.status);
        return;
      }
      
      const result = await response.json();
      
      if (!result.success || !result.update) {
        return;
      }
      
      const data = result.update;
      
      // Check if this is a new update
      if (data.timestamp > this.lastUpdateTime) {
        console.log('OpenClaw Session Bridge | New update found:', data);
        await this.handleUpdate(data);
        
        // Update timestamp
        this.lastUpdateTime = data.timestamp;
        await game.settings.set('openclaw-session-bridge', 'lastUpdate', data.timestamp);
      }
    } catch (error) {
      // Network error or proxy not available
      // Don't spam console with errors
    }
  }

  async handleUpdate(data) {
    const { date, time, title, teaser } = data;

    if (!title || !teaser) {
      console.error('OpenClaw Session Bridge | Missing title or teaser');
      return;
    }

    // Build the description HTML (title and teaser only)
    const description = this.buildDescription(title, teaser);

    // Update the World document
    const worldUpdate = {
      description: description
    };

    // If we have a date, try to parse it for nextSession
    // nextSession should be an ISO 8601 string (e.g., "2026-03-01T19:00:00")
    if (date) {
      try {
        // Parse date and time in local timezone
        let dateTimeStr;
        if (time) {
          dateTimeStr = `${date} ${time}`;
        } else {
          dateTimeStr = date;
        }
        
        // Create a Date object (parses in local/browser timezone)
        const parsedDate = new Date(dateTimeStr);
        
        if (!isNaN(parsedDate.getTime())) {
          // Convert to ISO string for Foundry
          worldUpdate.nextSession = parsedDate.toISOString();
          console.log('OpenClaw Session Bridge | Parsed nextSession:', worldUpdate.nextSession, 'from:', dateTimeStr);
        } else {
          console.warn('OpenClaw Session Bridge | Could not parse date/time:', dateTimeStr);
        }
      } catch (e) {
        console.error('OpenClaw Session Bridge | Error parsing date:', e);
      }
    }

    try {
      // Foundry v13: Use the setup endpoint to update world
      // This is the proper way to persist world changes
      const worldData = {
        action: "editWorld",
        id: game.world.id,
        ...worldUpdate
      };
      
      await foundry.utils.fetchJsonWithTimeout(foundry.utils.getRoute("setup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(worldData),
      });
      
      // Update local copy
      game.world.updateSource(worldUpdate);
      
      console.log('OpenClaw Session Bridge | Updated via setup endpoint');
      console.log('OpenClaw Session Bridge | World updated with session info');
      ui.notifications.info('Next session info updated');
    } catch (error) {
      console.error('OpenClaw Session Bridge | Error updating world:', error);
      ui.notifications.error('Failed to update session info: ' + error.message);
    }
  }

  buildDescription(title, teaser) {
    // Only include title and teaser in the description
    // Date/time goes in the nextSession field, not the description
    let html = '';
    html += `<h4>${title}</h4>`;
    html += `<p>${teaser}</p>`;
    return html;
  }

  destroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    console.log('OpenClaw Session Bridge | Shutting down');
  }
}

// Register settings
Hooks.once('init', () => {
  game.settings.register('openclaw-session-bridge', 'proxyUrl', {
    name: 'Proxy Server URL',
    hint: 'URL of the OpenClaw Session Bridge proxy server (e.g., http://localhost:30000)',
    scope: 'world',
    config: true,
    type: String,
    default: 'http://localhost:30000'
  });
  
  game.settings.register('openclaw-session-bridge', 'pollingInterval', {
    name: 'Polling Interval (seconds)',
    hint: 'How often to check for updates (default: 60 seconds). Lower values = faster updates but more network requests.',
    scope: 'world',
    config: true,
    type: Number,
    default: 60,
    range: {
      min: 2,
      max: 600,
      step: 1
    }
  });
  
  game.settings.register('openclaw-session-bridge', 'lastUpdate', {
    name: 'Last Update Timestamp',
    hint: 'Internal timestamp of last processed update',
    scope: 'world',
    config: false,
    type: Number,
    default: 0
  });
});

// Start when ready
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