/**
 * strechat - Express Application & HTTP Server
 * Serves static UI and REST endpoints.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const tikTokService = require('./tiktokService');
const sessionService = require('./sessionService');
const websocketHandler = require('./websocketHandler');
const { getLocalIpAddress } = require('./utils/network');

const app = express();
const server = http.createServer(app);

// Security & Middlewares
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Content-Security-Policy & Safety Headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com data: blob: https://*.tiktokcdn.com https://*.tiktokcdn-eu.com https://*.tiktokcdn-us.com https://p16-sign-va.tiktokcdn.com; img-src 'self' https: data: blob:; connect-src 'self' ws: wss: http: https:;"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Serve frontend static assets
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// REST API Endpoints
app.get('/api/info', (req, res) => {
  const address = server.address();
  const port = address ? address.port : 3000;
  const localIp = getLocalIpAddress();

  res.json({
    name: 'strechat',
    version: '1.1.0',
    port,
    localIp,
    remoteUrl: `http://${localIp}:${port}`,
    status: tikTokService.getStatus()
  });
});

app.get('/api/status', (req, res) => {
  res.json(tikTokService.getStatus());
});

// Live Analytics & Session Endpoints (P4)
app.get('/api/session/current', (req, res) => {
  res.json(sessionService.getCurrentAnalytics());
});

app.get('/api/session/history', (req, res) => {
  res.json(sessionService.getHistory());
});

app.get('/api/session/export', (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const result = sessionService.generateExport(format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="strechat-session-${Date.now()}.csv"`);
    return res.send(result.data);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="strechat-session-${Date.now()}.json"`);
  res.send(result.data);
});

app.post('/api/connect', async (req, res) => {
  const { username, sessionId } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username TikTok wajib diisi.' });
  }

  try {
    const status = await tikTokService.connect(username, { sessionId });
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Gagal tersambung ke TikTok.'
    });
  }
});

app.post('/api/disconnect', async (req, res) => {
  try {
    await tikTokService.disconnect();
    res.json({ success: true, message: 'Berhasil memutuskan koneksi.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Auto-Detect OBS Live status endpoint
app.get('/api/check-live', async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ success: false, error: 'Parameter username diperlukan.' });
  }
  try {
    const result = await tikTokService.checkLiveStatus(username);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, isLive: false, error: err.message });
  }
});

// Dedicated route for OBS Browser Source Overlay
app.get('/overlay', (req, res) => {
  res.sendFile(path.join(publicPath, 'overlay.html'));
});

// Fallback to index.html
app.use((req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Initialize WebSocket handler with HTTP server
websocketHandler.initialize(server);

function startServer(port = 3000, host = '0.0.0.0') {
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      const actualPort = server.address().port;
      const localIp = getLocalIpAddress();
      console.log(`[strechat] Server berjalan di http://localhost:${actualPort}`);
      console.log(`[strechat] Akses perangkat lain (LAN): http://${localIp}:${actualPort}`);
      resolve({ port: actualPort, localIp, server });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[strechat] Port ${port} sedang digunakan, mencoba port berikutnya...`);
        server.listen(0, host, () => {
          const actualPort = server.address().port;
          resolve({ port: actualPort, localIp: getLocalIpAddress(), server });
        });
      } else {
        reject(err);
      }
    });
  });
}

async function stopServer() {
  try {
    await tikTokService.disconnect();
  } catch (e) {}

  websocketHandler.close();

  return new Promise((resolve) => {
    if (server && server.listening) {
      server.close((err) => {
        if (err) console.warn('[strechat] Peringatan saat menutup HTTP server:', err.message);
        resolve();
      });
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      setTimeout(() => resolve(), 1200);
    } else {
      resolve();
    }
  });
}

module.exports = {
  app,
  server,
  startServer,
  stopServer
};

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  startServer(PORT);

  const handleTermination = async (signal) => {
    console.log(`[strechat] Menerima sinyal ${signal}, menghentikan server dengan aman...`);
    await stopServer();
    process.exit(0);
  };

  process.on('SIGINT', () => handleTermination('SIGINT'));
  process.on('SIGTERM', () => handleTermination('SIGTERM'));
}
