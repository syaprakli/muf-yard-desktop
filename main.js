const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// --- IPC Handlers (Existing + Path/FS) ---
ipcMain.on('fs:exists', (event, p) => { try { event.returnValue = fs.existsSync(p); } catch (e) { event.returnValue = false; } });
ipcMain.on('fs:mkdir', (event, p) => { try { event.returnValue = fs.mkdirSync(p, { recursive: true }); } catch (e) { event.returnValue = false; } });
ipcMain.on('fs:readFile', (event, p) => { try { event.returnValue = fs.readFileSync(p); } catch (e) { event.returnValue = null; } });
ipcMain.on('fs:writeFile', (event, p, data) => { try { event.returnValue = fs.writeFileSync(p, data); } catch (e) { event.returnValue = null; } });
ipcMain.on('fs:unlink', (event, p) => { try { event.returnValue = fs.unlinkSync(p); } catch (e) { event.returnValue = false; } });

ipcMain.on('path:join', (event, ...args) => event.returnValue = path.join(...args));
ipcMain.on('path:dirname', (event, p) => event.returnValue = path.dirname(p));
ipcMain.on('path:basename', (event, p) => event.returnValue = path.basename(p));

ipcMain.on('process:execPath', (event) => event.returnValue = process.execPath);
ipcMain.on('process:cwd', (event) => event.returnValue = process.cwd());
ipcMain.on('os:homedir', (event) => event.returnValue = os.homedir());

ipcMain.handle('folder:open', async (event, folderPath) => {
    try {
        if (!fs.existsSync(folderPath)) {
            try {
                fs.mkdirSync(folderPath, { recursive: true });
            } catch (err) {
                return { success: false, error: 'Klasör oluşturulamadı: ' + err.message };
            }
        }

        const error = await shell.openPath(folderPath);
        if (error) {
            return { success: false, error: 'Klasör açılamadı (Sistem): ' + error };
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to open folder:', error);
        return { success: false, error: error.message };
    }
});


ipcMain.handle('dialog:openDirectory', async (event, defaultPath) => {
    const options = {
        properties: ['openDirectory']
    };
    if (defaultPath) {
        options.defaultPath = defaultPath;
    }
    const result = await dialog.showOpenDialog(options);
    return result;
});

ipcMain.handle('dialog:openFile', async (event) => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections']
    });
    return result;
});

ipcMain.handle('dialog:saveFile', async (event, defaultName, defaultPath) => {
    const options = {
        title: 'Yedek Dosyasını Kaydet',
        defaultPath: defaultPath ? path.join(defaultPath, defaultName) : defaultName,
        filters: [
            { name: 'JSON Dosyaları', extensions: ['json'] },
            { name: 'Tüm Dosyalar', extensions: ['*'] }
        ]
    };
    const result = await dialog.showSaveDialog(options);
    return result;
});

// --- .env Loader (Manual) ---
const env = {};
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            env[key] = value.trim();
        }
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'Müf.Yard',
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            // Pass env to the renderer indirectly via IPC or Global
        },
        autoHideMenuBar: true
    });

    // Ortam değişkenlerini (env) preload'a aktar
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('env-data', {
            ...env,
            appVersion: app.getVersion(),
            isPackaged: app.isPackaged
        });
    });

    ipcMain.on('get-env', (event) => {
        event.returnValue = env;
    });

    // Maximize window on startup
    win.maximize();

    win.loadFile('index.html');

    // DevTools kapalı (production mode)

    // Program kapanmadan önce yedek al
    win.on('close', async (e) => {
        e.preventDefault(); // Kapanmayı durdur

        // Renderer process'e yedekleme komutu gönder
        win.webContents.executeJavaScript('BackupManager.backupOnClose()').then(() => {
            win.destroy(); // Yedek alındıktan sonra kapat
        }).catch(() => {
            win.destroy(); // Hata olsa bile kapat
        });
    });

    // win.webContents.openDevTools(); // Uncomment for debugging
}

app.whenReady().then(() => {
    // --- Şablonları Otomatik Yükle ---
    // --- Şablonları Otomatik Yükle ---
    // NOT: Şablonlar artık uygulamanın içine gömülü (embedded) çalışıyor.
    // Harici kopyalamaya gerek yok, ancak kullanıcı erişimi için istenirse açılabilir.
    /*
    try {
        let baseDir = path.dirname(process.execPath);
        if (process.execPath.includes('electron.exe')) {
            baseDir = __dirname;
        }
        const targetDir = path.join(baseDir, 'Sablonlar');
        if (!fs.existsSync(targetDir)) {
            const sourceDir = app.isPackaged
                ? path.join(process.resourcesPath, 'Sablonlar')
                : path.join(__dirname, 'Sablonlar');

            if (fs.existsSync(sourceDir)) {
                fs.cpSync(sourceDir, targetDir, { recursive: true });
                console.log('Şablonlar başarıyla kopyalandı:', targetDir);
            }
        }
    } catch (err) {
        console.error('Şablon kopyalama hatası:', err);
    }
    */
    // --------------------------------
    // --------------------------------

    createWindow();

    // --- Auto Updater ---
    if (app.isPackaged) {
        const { autoUpdater } = require('electron-updater');

        autoUpdater.checkForUpdatesAndNotify();

        autoUpdater.on('update-available', () => {
            console.log('Güncelleme bulundu, indiriliyor...');
        });

        autoUpdater.on('update-downloaded', () => {
            dialog.showMessageBox({
                type: 'info',
                title: 'Güncelleme Hazır',
                message: 'Yeni bir sürüm indirildi. Yüklemek için uygulama yeniden başlatılacak.',
                buttons: ['Yeniden Başlat']
            }).then(() => {
                autoUpdater.quitAndInstall();
            });
        });
    }
    // --------------------

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
