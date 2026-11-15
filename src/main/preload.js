/**
 * strechat - Electron Preload Script
 * Secure contextBridge bridge between renderer and main process.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('window-pin', flag),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-changed', (_event, state) => callback(state));
  }
});
