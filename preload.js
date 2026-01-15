const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openFolder: (path) => ipcRenderer.invoke('folder:open', path)
});
