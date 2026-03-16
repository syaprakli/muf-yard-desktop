const { contextBridge, ipcRenderer } = require('electron');

// Get env from main process synchronously at startup
const env = ipcRenderer.sendSync('get-env');

contextBridge.exposeInMainWorld('electronAPI', {
    // Environment
    env: env,

    // File System (Bridged)
    fs: {
        exists: (path) => ipcRenderer.sendSync('fs:exists', path),
        mkdir: (path) => ipcRenderer.sendSync('fs:mkdir', path),
        readFile: (path) => ipcRenderer.sendSync('fs:readFile', path),
        writeFile: (path, data) => ipcRenderer.sendSync('fs:writeFile', path, data),
        unlink: (path) => ipcRenderer.sendSync('fs:unlink', path)
    },

    // Path (Bridged)
    path: {
        join: (...args) => ipcRenderer.sendSync('path:join', ...args),
        dirname: (p) => ipcRenderer.sendSync('path:dirname', p),
        basename: (p) => ipcRenderer.sendSync('path:basename', p)
    },

    // Process/OS (Bridged)
    process: {
        execPath: ipcRenderer.sendSync('process:execPath'),
        cwd: () => ipcRenderer.sendSync('process:cwd'),
        platform: process.platform
    },
    os: {
        homedir: () => ipcRenderer.sendSync('os:homedir')
    },

    // Dialogs
    openFolder: (path) => ipcRenderer.invoke('folder:open', path),
    selectDirectory: (defaultPath) => ipcRenderer.invoke('dialog:openDirectory', defaultPath),
    selectFile: () => ipcRenderer.invoke('dialog:openFile'),
    saveFile: (name, path) => ipcRenderer.invoke('dialog:saveFile', name, path),

    // Olaylar (Events)
    on: (channel, func) => {
        // Whitelist channels if needed for security
        ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
});
