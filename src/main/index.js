/**
 * strechat - Electron Main Process
 * Desktop window manager, custom titlebar controls, and lifecycle orchestrator.
 */

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer, stopServer } = require('../server/app');

let mainWindow = null;
let tray = null;
let serverPort = 3000;
let isShuttingDown = false;
let isQuitting = false;

function getAppIconPath() {
  if (process.platform === 'win32') {
    const icoPath = path.join(__dirname, '../public/icons/icon.ico');
    if (fs.existsSync(icoPath)) return icoPath;
  }
  return path.join(__dirname, '../public/icons/icon.png');
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

function createTray() {
  if (tray) return;

  const iconPath = getAppIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('strechat - TikTok Live Monitor');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Buka Strechat',
      click: () => {
        showMainWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Keluar dari Aplikasi',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isVisible()) {
      if (mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.focus();
      }
    } else {
      showMainWindow();
    }
  });

  tray.on('double-click', () => {
    showMainWindow();
  });
}

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 800,
    minHeight: 580,
    frame: false, // Custom sleek titlebar
    backgroundColor: '#0c0d12',
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false // Audio, TTS, and WebSocket stay active when hidden in tray
    },
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Hide to System Tray instead of closing when not explicitly quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Strict Navigation Security: Intercept window.open / target="_blank"
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const parsed = new URL(url);
        const localOrigin = `http://localhost:${serverPort}`;
        if (parsed.origin !== new URL(localOrigin).origin) {
          shell.openExternal(url);
        }
      } catch (e) {
        shell.openExternal(url);
      }
    }
    return { action: 'deny' };
  });

  // Strict Navigation Security: Intercept in-window navigation
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      const localOrigin = `http://localhost:${serverPort}`;
      if (parsed.origin !== new URL(localOrigin).origin) {
        event.preventDefault();
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(navigationUrl);
        }
      }
    } catch (e) {
      event.preventDefault();
    }
  });

  // Load the running local server URL
  await mainWindow.loadURL(`http://localhost:${serverPort}`);

  // Track window maximize / unmaximize
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: true });
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: false });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control IPC handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

// Close button hides window to System Tray (keeping session active)
ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

// Explicit quit from Settings or Tray
ipcMain.on('app-quit', () => {
  isQuitting = true;
  app.quit();
});

ipcMain.on('window-pin', (_event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(Boolean(flag));
  }
});

ipcMain.on('open-external', (_event, targetUrl) => {
  if (typeof targetUrl === 'string') {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(targetUrl);
      }
    } catch (e) {}
  }
});

async function shutdownApp() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  isQuitting = true;

  if (tray) {
    try {
      tray.destroy();
    } catch (e) {}
    tray = null;
  }

  try {
    await stopServer();
  } catch (err) {
    console.warn('[strechat] Peringatan saat shutdown server:', err.message);
  }
}

app.whenReady().then(async () => {
  try {
    const started = await startServer(3000);
    serverPort = started.port;
    await createWindow();
    createTray();
  } catch (err) {
    console.error('[strechat] Gagal memulai aplikasi:', err);
    app.quit();
  }

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('window-all-closed', async () => {
  // If not explicitly quitting, keep running in System Tray
  if (isQuitting) {
    await shutdownApp();
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  isQuitting = true;
  if (!isShuttingDown) {
    event.preventDefault();
    await shutdownApp();
    app.quit();
  }
});
