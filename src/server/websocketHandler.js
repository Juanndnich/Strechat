/**
 * strechat - WebSocket Stream Server
 * Zero-delay event distributor for UI and remote clients.
 */

const { WebSocketServer } = require('ws');
const tikTokService = require('./tiktokService');

class WebSocketHandler {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  initialize(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      this.clients.add(ws);

      // Send initial status immediately upon connection
      this.sendTo(ws, {
        type: 'initial_state',
        data: tikTokService.getStatus()
      });

      ws.on('message', async (raw) => {
        try {
          const message = JSON.parse(raw.toString());
          await this._handleClientMessage(ws, message);
        } catch (err) {
          this.sendTo(ws, {
            type: 'error',
            data: { message: 'Format pesan WebSocket tidak valid.' }
          });
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    this._bindServiceEvents();
  }

  _bindServiceEvents() {
    const forwardEvents = [
      'status',
      'connected',
      'disconnected',
      'reconnecting',
      'chat',
      'gift',
      'like',
      'viewers',
      'member',
      'social',
      'streamEnd',
      'error',
      'stats_update'
    ];

    forwardEvents.forEach((eventName) => {
      tikTokService.on(eventName, (payload) => {
        this.broadcast({
          type: eventName,
          data: payload,
          timestamp: Date.now()
        });
      });
    });
  }

  async _handleClientMessage(ws, message) {
    const { action, payload } = message;

    switch (action) {
      case 'ping':
        this.sendTo(ws, { type: 'pong', timestamp: Date.now(), clientTimestamp: payload?.clientTimestamp });
        break;

      case 'connect':
        try {
          await tikTokService.connect(payload?.username, {
            sessionId: payload?.sessionId
          });
        } catch (err) {
          // Error already emitted via service
        }
        break;

      case 'disconnect':
        await tikTokService.disconnect();
        break;

      case 'get_status':
        this.sendTo(ws, {
          type: 'status',
          data: tikTokService.getStatus()
        });
        break;

      default:
        break;
    }
  }

  sendTo(ws, packet) {
    if (ws && ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(packet));
    }
  }

  broadcast(packet) {
    const payload = JSON.stringify(packet);
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }
}

module.exports = new WebSocketHandler();
