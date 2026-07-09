const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('selectFolder'),
  getConfig: () => ipcRenderer.invoke('getConfig'),
  saveConfig: (config) => ipcRenderer.invoke('saveConfig', config),
  startMonitoring: () => ipcRenderer.invoke('startMonitoring'),
  stopMonitoring: () => ipcRenderer.invoke('stopMonitoring'),
  checkNow: () => ipcRenderer.invoke('checkNow'),
  reprocess: () => ipcRenderer.invoke('reprocess'),
  openExternal: (url) => ipcRenderer.invoke('openExternal', url),
  onLog: (callback) => ipcRenderer.on('log', (event, msg) => callback(msg)),
  onStats: (callback) => ipcRenderer.on('stats', (event, stats) => callback(stats)),
  onLastCheck: (callback) => ipcRenderer.on('lastCheck', (event, time) => callback(time)),
  onConfig: (callback) => ipcRenderer.on('config', (event, config) => callback(config)),
});
