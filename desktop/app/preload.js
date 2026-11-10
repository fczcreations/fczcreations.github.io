const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('harmonicaApp', {
  fontStatus: () => ipcRenderer.invoke('fonts:status'),
  installFonts: () => ipcRenderer.invoke('fonts:install'),
  onFontsChanged: (cb) => ipcRenderer.on('fonts:changed', () => cb())
});
