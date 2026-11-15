/**
 * strechat - Electron Main Process
 * Desktop window manager, custom titlebar controls, and lifecycle orchestrator.
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { startServer } = require('../server/app');
const tikTokService = require('../server/tiktokService');

let mainWindow = null;
let serverInstance = null;
let serverPort = 3000;

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 860,
    minWidth: 420,
    minHeight: 580,
    frame: false, // Custom sleek titlebar
    backgroundColor: '#0c0d12',
    icon: path.join(__dirname, '../public/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window-pin', (_event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(Boolean(flag));
  }
});

ipcMain.on('open-external', (_event, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

app.whenReady().then(async () => {
  try {
    const started = await startServer(3000);
    serverPort = started.port;
    await createWindow();
  } catch (err) {
    console.error('[strechat] Gagal memulai aplikasi:', err);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  try {
    await tikTokService.disconnect();
  } catch (e) {}
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  try {
    await tikTokService.disconnect();
  } catch (e) {}
});
