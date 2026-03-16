
// --- CORE MANAGERS ---
// PathManager, StorageManager, AuthManager, ThemeManager
// Isolated to prevent app.js inconsistencies from breaking login.

// 1. PathManager
class PathManager {
    static isElectron() {
        return !!window.electronAPI;
    }

    static getRoot() {
        if (this.isElectron()) {
            const api = window.electronAPI;
            const path = api.path;
            const fs = api.fs;
            const os = api.os;
            const proc = api.process;

            let basePath;
            const execPath = proc.execPath;

            // 1. Dizin Tespit Stratejisi
            // Program Files içine kurulan uygulamalarda oraya yazmaya çalışmak hata verir.
            // Bu yüzden varsayılan olarak BELGELERİM klasörünü kullanacağız.

            const documentsPath = path.join(os.homedir(), 'Documents', 'MufYard');

            // Eğer geliştirme ortamındaysak (cwd) orayı kullanabiliriz, ama prodüksiyonda Documents güvenlidir.
            if (execPath.includes('node_modules') || execPath.includes('electron.exe')) {
                // Dev mode: Project Root
                return proc.cwd();
            }

            // Production: Documents/MufYard
            if (!fs.exists(documentsPath)) {
                try {
                    fs.mkdir(documentsPath);
                } catch (e) {
                    console.error('Belgelerim klasörüne erişilemedi:', e);
                }
            }
            return documentsPath;

            console.log('PathManager: Uygulama kök dizini (Target):', targetPath);
            return targetPath;
        }
        return 'MufYard';
    }

    static join(...parts) {
        if (this.isElectron()) {
            return window.electronAPI.path.join(this.getRoot(), ...parts);
        }
        return [this.getRoot(), ...parts].join('\\');
    }

    static getTemplatesPath() {
        if (!this.isElectron()) return 'Sablonlar';

        const api = window.electronAPI;
        const fs = api.fs;

        let candidates = [
            this.join('Sablonlar'), // C:\MufYard\Sablonlar (Development/Portable)
            this.join('resources', 'Sablonlar') // C:\MufYard\resources\Sablonlar (Production)
        ];

        for (const candidate of candidates) {
            if (fs.exists(candidate)) {
                return candidate;
            }
        }
        return this.join('Sablonlar');
    }
}

// 2. StorageManager (Firebase Integrated)
class StorageManager {
    static get SECRET_KEY() { return 'MufYard_Secret_Key_2025'; }

    // All these keys will be encrypted locally AND synced to cloud
    static get ENCRYPTED_KEYS() {
        return ['reports', 'tasks', 'contacts', 'notes', 'app_user', 'audit_records', 'corp_overrides'];
    }

    // Settings that are synced but NOT encrypted
    static get SYNC_ONLY_KEYS() {
        return ['theme', 'font', 'accent_color', 'sidebar_color', 'report_config'];
    }

    static get(key, defaultValue = null) {
        const stored = localStorage.getItem(key);
        if (!stored) return defaultValue;

        if (this.ENCRYPTED_KEYS.includes(key)) {
            try {
                // Try parsing as plain JSON first (Migration Support)
                const parsed = JSON.parse(stored);
                return parsed;
            } catch (e) {
                // If fails, it is likely Encrypted
                try {
                    if (typeof CryptoJS === 'undefined') return defaultValue;
                    const bytes = CryptoJS.AES.decrypt(stored, this.SECRET_KEY);
                    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
                    if (!decryptedStr) return defaultValue;
                    return JSON.parse(decryptedStr);
                } catch (decErr) {
                    console.error('Decryption Error for ' + key, decErr);
                    return defaultValue;
                }
            }
        }

        try {
            return JSON.parse(stored);
        } catch (e) {
            return stored;
        }
    }

    static set(key, value, skipCloudSync = false) {
        try {
            let saveValue = value;
            if (this.ENCRYPTED_KEYS.includes(key)) {
                if (typeof CryptoJS !== 'undefined') {
                    const jsonStr = JSON.stringify(value);
                    saveValue = CryptoJS.AES.encrypt(jsonStr, this.SECRET_KEY).toString();
                } else {
                    saveValue = JSON.stringify(value);
                }
            } else if (typeof value === 'object') {
                saveValue = JSON.stringify(value);
            }

            const oldValue = localStorage.getItem(key);
            localStorage.setItem(key, saveValue);

            // Store local timestamp for conflict resolution
            const now = Date.now();
            localStorage.setItem(`_ts_${key}`, now.toString());

            // --- AUTO CLOUD SYNC ---
            // Only sync if content actually changed and skipCloudSync is false
            if (!skipCloudSync && saveValue !== oldValue) {
                this.syncToCloud(key, saveValue, now);
            }

        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                Toast.show('Depolama alanı doldu! Lütfen eski verileri temizleyin.', 'error');
            } else {
                console.error('Storage Save Error:', e);
            }
        }
    }

    // --- CLOUD SYNC METHODS ---
    static async syncToCloud(key, value, timestamp = null) {
        if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
        if (!navigator.onLine) return; // Don't even try if offline
        if (!this.ENCRYPTED_KEYS.includes(key) && !this.SYNC_ONLY_KEYS.includes(key)) return;

        const uid = firebase.auth().currentUser.uid;
        const ts = timestamp || Date.now();

        try {
            await firebase.firestore().collection('users').doc(uid).collection('data').doc(key).set({
                value: value,
                clientUpdatedAt: ts,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`Cloud [UP]: ${key} (ts: ${ts})`);
        } catch (e) {
            console.error(`Cloud Sync Failed (${key}):`, e);
        }
    }

    static async syncFromCloud() {
        if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
        if (!navigator.onLine) return;

        console.log('Sync: Reconciling with cloud...');
        const uid = firebase.auth().currentUser.uid;
        const allKeys = [...this.ENCRYPTED_KEYS, ...this.SYNC_ONLY_KEYS];
        let pullCount = 0;

        for (const key of allKeys) {
            try {
                const doc = await firebase.firestore().collection('users').doc(uid).collection('data').doc(key).get();
                const localTs = parseInt(localStorage.getItem(`_ts_${key}`) || '0');
                const localValue = localStorage.getItem(key);

                if (doc.exists) {
                    const serverData = doc.data();
                    const serverTs = serverData.clientUpdatedAt || 0;

                    if (serverTs > localTs) {
                        // Cloud is newer -> Pull
                        if (serverData.value && serverData.value !== localValue) {
                            console.log(`Sync [DOWN]: ${key} (${serverTs} > ${localTs})`);
                            localStorage.setItem(key, serverData.value);
                            localStorage.setItem(`_ts_${key}`, serverTs.toString());
                            pullCount++;
                        }
                    } else if (localTs > serverTs) {
                        // Local is newer -> Push
                        console.log(`Sync [UP-RECONCILE]: ${key} (${localTs} > ${serverTs})`);
                        await this.syncToCloud(key, localValue, localTs);
                    }
                } else if (localValue) {
                    // Local exists but not on cloud -> Push
                    console.log(`Sync [UP-INITIAL]: ${key}`);
                    await this.syncToCloud(key, localValue, localTs);
                }
            } catch (e) {
                console.error(`Sync Reconciliation Error (${key}):`, e);
            }
        }

        if (pullCount > 0) {
            Toast.show(`${pullCount} verİ buluttan güncellendi.`, 'success');
            setTimeout(() => location.reload(), 1500);
        }
    }

    static async syncAllToCloud() {
        if (typeof firebase === 'undefined' || !firebase.auth().currentUser) {
            return Toast.show('Lütfen önce giriş yapın.', 'warning');
        }
        Toast.show('Tam eşitleme başlatıldı...', 'info');
        const allKeys = [...this.ENCRYPTED_KEYS, ...this.SYNC_ONLY_KEYS];
        for (const key of allKeys) {
            const val = localStorage.getItem(key);
            if (val) await this.syncToCloud(key, val);
        }
        Toast.show('Tüm veriler buluta gönderildi.', 'success');
    }

    static addToArray(key, item) {
        const items = this.get(key, []);
        items.unshift(item);
        this.set(key, items);
        return items;
    }

    static removeFromArray(key, idField, idValue) {
        let items = this.get(key, []);
        items = items.filter(item => item[idField] !== idValue);
        this.set(key, items);
        return items;
    }

    static exportData() {
        if (typeof BackupManager !== 'undefined') BackupManager.createBackup(true);
    }

    static clearAllData() {
        if (typeof ConfirmationManager !== 'undefined') {
            ConfirmationManager.show(
                'TÜM VERİLERİNİZ (BULUT DAHİL) SİLİNECEKTİR! Kalıcı olarak temizlenecektir. Emin misiniz?',
                async () => { // Async callback
                    // 1. Bulut Verilerini Temizle
                    try {
                        if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
                            Toast.show('Bulut verileri temizleniyor...', 'info');
                            const uid = firebase.auth().currentUser.uid;
                            const allKeys = [...this.ENCRYPTED_KEYS, ...this.SYNC_ONLY_KEYS];

                            // Batch delete is more efficient
                            const batch = firebase.firestore().batch();
                            allKeys.forEach(key => {
                                const ref = firebase.firestore().collection('users').doc(uid).collection('data').doc(key);
                                batch.delete(ref);
                            });

                            // 1.1. Ayrıca Global 'audit_records' koleksiyonundan bu kullanıcıya ait olanları sil
                            const auditSnapshot = await firebase.firestore().collection('audit_records').where('userId', '==', uid).get();
                            auditSnapshot.forEach(doc => {
                                batch.delete(doc.ref);
                            });

                            await batch.commit();
                            console.log('Cloud data cleared.');
                        }
                    } catch (e) {
                        console.error('Cloud clear error:', e);
                        Toast.show('Bulut silinirken hata oluştu (İnternet bağlantınızı kontrol edin).', 'warning');
                    }

                    // 2. Yerel Verileri Temizle
                    localStorage.clear();
                    Toast.show('Tüm veriler (Yerel ve Bulut) temizlendi.', 'success');

                    // 3. Yeniden Başlat
                    setTimeout(() => location.reload(), 2000);
                },
                'Evet, Hepsini Sil'
            );
        }
    }
}

// 3. AuthManager (Firebase Integrated)
const AuthManager = {
    init: function () {
        if (typeof window !== 'undefined') window.AuthManager = this;
    },

    getUser: () => {
        return StorageManager.get('app_user');
    },

    register: async () => {
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        if (!email || !password) {
            Toast.show('Lütfen e-posta ve şifre giriniz.', 'warning');
            return;
        }

        try {
            // FIREBASE ONLY REGISTRATION
            if (typeof firebase === 'undefined') throw new Error('Firebase not loaded');

            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            const localUser = {
                uid: user.uid,
                email: email,
                password: password // Cache for local convenience
            };
            StorageManager.set('app_user', localUser);
            sessionStorage.setItem('isLoggedIn', 'true'); // Auto-login after register

            Toast.show('Hesap başarıyla oluşturuldu!', 'success');
            AuthManager.completeLogin(localUser);

        } catch (error) {
            console.error('Registration Error:', error);
            if (error.code === 'auth/email-already-in-use') {
                Toast.show('Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.', 'warning');
                AuthManager.showScreen('login');
            } else if (error.code === 'auth/network-request-failed') {
                Toast.show('İnternet bağlantısı yok. Kayıt için internet gereklidir.', 'error');
            } else {
                Toast.show('Kayıt Hatası: ' + error.message, 'error');
            }
        }
    },

    login: async () => {
        try {
            const emailInput = document.getElementById('login-email').value.trim();
            const passwordInput = document.getElementById('login-password').value;
            const errorMsg = document.getElementById('login-error');

            if (!emailInput || !passwordInput) {
                Toast.show('E-posta ve şifre giriniz.', 'warning');
                return;
            }

            // FIREBASE ONLY LOGIN
            if (typeof firebase === 'undefined') {
                Toast.show('Sistem hatası: Firebase yüklenemedi.', 'error');
                return;
            }

            try {
                const userCredential = await firebase.auth().signInWithEmailAndPassword(emailInput, passwordInput);
                const user = userCredential.user;

                // Update Local Data (Source of Truth is now Cloud)
                const localUser = {
                    uid: user.uid,
                    fullname: user.displayName || 'Kullanıcı',
                    email: user.email,
                    password: passwordInput, // Cache for conveniences like "Show Password" or re-auth if needed
                    // Security question/answer is NOT here, must be fetched from Firestore if needed
                };

                // Security question/answer removed per user feedback

                StorageManager.set('app_user', localUser);
                sessionStorage.setItem('isLoggedIn', 'true');

                if (errorMsg) errorMsg.style.display = 'none';
                AuthManager.completeLogin(localUser);
                Toast.show('Giriş başarılı.', 'success');

            } catch (firebaseError) {
                console.error('Login error:', firebaseError);
                if (errorMsg) {
                    errorMsg.style.display = 'block';
                    errorMsg.textContent = 'Giriş başarısız: ' + (firebaseError.message || 'Hata');
                } else {
                    Toast.show('Giriş başarısız: ' + firebaseError.code, 'error');
                }
            }
        } catch (e) {
            console.error('Critical login error:', e);
            Toast.show('Giriş işleminde kritik hata.', 'error');
        }
    },

    completeLogin: (user) => {
        document.getElementById('login-overlay').style.display = 'none';
        if (!sessionStorage.getItem('initialSyncDone') && typeof firebase !== 'undefined' && firebase.auth().currentUser) {
            sessionStorage.setItem('initialSyncDone', 'true');
            setTimeout(() => StorageManager.syncFromCloud(), 1000);
        }
        if (window.checkLogin) window.checkLogin();
    },

    logout: async () => {
        try {
            if (typeof firebase !== 'undefined') await firebase.auth().signOut();

            // Clean Session
            sessionStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('initialSyncDone');

            // Optional: Clear local user to force fresh login next time
            // StorageManager.set('app_user', null); 

            location.reload();
        } catch (e) {
            console.error('Logout error:', e);
            location.reload();
        }
    },

    checkRecoveryUser: async () => {
        const email = document.getElementById('forgot-username').value.trim();
        if (!email) {
            Toast.show('Lütfen e-posta adresinizi girin.', 'warning');
            return;
        }

        if (typeof firebase === 'undefined') {
            Toast.show('Sistem hatası: Firebase yüklenemedi.', 'error');
            return;
        }

        try {
            await firebase.auth().sendPasswordResetEmail(email);
            Toast.show('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.', 'success');
            // Back to login after a short delay
            setTimeout(() => AuthManager.showScreen('login'), 3000);
        } catch (error) {
            console.error('Reset email error:', error);
            if (error.code === 'auth/user-not-found') {
                Toast.show('Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.', 'error');
            } else {
                Toast.show('Hata: ' + error.message, 'error');
            }
        }
    },

    handleKey: (event, type) => {
        if (event.key === 'Enter') {
            if (type === 'login') AuthManager.login();
        }
    },

    showScreen: (screenName) => {
        const screens = ['auth-login', 'auth-register', 'auth-forgot', 'auth-intro'];
        screens.forEach(s => {
            const el = document.getElementById(s);
            if (el) el.style.display = 'none';
        });
        const target = document.getElementById(`auth-${screenName}`);
        if (target) target.style.display = 'block';
    }
};

// 4. ThemeManager
class ThemeManager {
    static init() {
        const savedTheme = StorageManager.get('theme', 'light');
        const savedFont = StorageManager.get('font', 'Inter');
        const savedColor = StorageManager.get('accent_color', '#1a237e');
        const savedSidebar = StorageManager.get('sidebar_color', '#0f172a');

        this.apply(savedTheme);
        this.applyFont(savedFont);
        this.applyColor(savedColor);
        this.applySidebarColor(savedSidebar);
        this.updateIcon(savedTheme);
    }

    static toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        this.apply(newTheme);
        StorageManager.set('theme', newTheme);
        this.updateIcon(newTheme);
    }

    static apply(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    static applyFont(fontName) {
        document.documentElement.style.setProperty('--font-main', `'${fontName}', sans-serif`);
        document.body.style.fontFamily = `'${fontName}', sans-serif`;
        StorageManager.set('font', fontName);
    }

    static applyColor(colorHex) {
        document.documentElement.style.setProperty('--primary-color', colorHex);
        document.documentElement.style.setProperty('--primary-light', colorHex);
        document.documentElement.style.setProperty('--primary-dark', colorHex);
        StorageManager.set('accent_color', colorHex);
        StorageManager.set('themeColor', colorHex);
    }

    static applySidebarColor(colorHex) {
        document.documentElement.style.setProperty('--bg-sidebar', colorHex);
        StorageManager.set('sidebar_color', colorHex);
    }

    static updateIcon(theme) {
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) {
            btn.innerHTML = theme === 'dark'
                ? '<span class="material-icons-round">light_mode</span>'
                : '<span class="material-icons-round">dark_mode</span>';
        }
    }
}


class BackupManager {
    static createBackup(interactive = false) {
        if (!PathManager.isElectron() && typeof require === 'undefined') {
            if (interactive) {
                if (typeof Toast !== 'undefined') Toast.show('Yedekleme sadece masaüstü uygulamasında çalışır.', 'warning');
                else console.warn('Yedekleme sadece masaüstü uygulamasında çalışır.');
            }
            return;
        }

        try {
            const fs = require('fs');
            const path = require('path');
            const { shell } = require('electron');

            // 1. Verileri Hazırla
            const data = {
                meta: {
                    date: new Date().toISOString(),
                    version: '1.0',
                    user: (typeof AuthManager !== 'undefined') ? AuthManager.getUser()?.username : 'unknown'
                },
                app_user: StorageManager.get('app_user'),
                reports: StorageManager.get('reports'),
                tasks: StorageManager.get('tasks'),
                contacts: StorageManager.get('contacts'),
                notes: StorageManager.get('notes'),
                audit_records: StorageManager.get('audit_records'),
                corp_overrides: StorageManager.get('corp_overrides'),
                theme: StorageManager.get('theme')
            };

            const os = require('os');
            const homeDir = os.homedir();

            // 2. Yedekleme Konumu Belirle (Akıllı Algılama)
            let backupBase = PathManager.getRoot(); // Varsayılan: Documents/MufYard

            // Google Drive Kontrolü
            const drivePath = path.join(homeDir, 'Google Drive');
            const oneDrivePath = path.join(homeDir, 'OneDrive'); // OneDrive da yaygın

            if (fs.existsSync(drivePath)) {
                backupBase = path.join(drivePath, 'MufYard');
                console.log('Google Drive algılandı, yedekleme buraya yapılacak:', backupBase);
            } else if (fs.existsSync(oneDrivePath)) {
                // Opsiyonel: OneDrive varsa orayı kullan
                backupBase = path.join(oneDrivePath, 'MufYard');
            }

            const backupDir = path.join(backupBase, 'Yedekler');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `MufYard_Yedek_${timestamp}.json`;
            const filePath = path.join(backupDir, filename);

            // 3. Yaz
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log('Yedek oluşturuldu:', filePath);

            if (interactive) {
                // Confirm kaldırıldı, sadece bilgilendir
                Toast.show('Yedekleme başarılı: ' + filename, 'success');
                // Dosya konumunu göster
                shell.showItemInFolder(filePath);
            }

        } catch (e) {
            console.error('Backup Error:', e);
            if (interactive) Toast.show('Yedekleme hatası: ' + e.message, 'error');
        }
    }

    static autoBackup() {
        try {
            const lastBackup = localStorage.getItem('last_auto_backup');
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;

            if (!lastBackup || (now - parseInt(lastBackup)) > oneDay) {
                console.log('Otomatik yedekleme başlatılıyor...');
                this.createBackup(false);
                localStorage.setItem('last_auto_backup', now.toString());
            }
        } catch (e) {
            console.error('Auto backup error:', e);
        }
    }

    static shouldBackupToday() {
        const lastBackup = localStorage.getItem('last_auto_backup');
        if (!lastBackup) return true;
        const lastDate = new Date(parseInt(lastBackup)).toDateString();
        const today = new Date().toDateString();
        return lastDate !== today;
    }

    static startDailyBackupScheduler() {
        // Her 4 saatte bir kontrol et
        setInterval(() => {
            if (this.shouldBackupToday()) {
                this.createBackup(false);
                localStorage.setItem('last_auto_backup', Date.now().toString());
            }
        }, 4 * 60 * 60 * 1000);
    }

    static checkDriveSetup() {
        // Google Drive kurulu mu kontrol et (Basit klasör kontrolü)
        if (typeof require === 'undefined') return;
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const drivePath = path.join(os.homedir(), 'Google Drive');

        if (!fs.existsSync(drivePath)) {
            console.log("Google Drive bulunamadı, yerel yedekleme yapılacak.");
        } else {
            console.log("Google Drive aktif.");
        }
    }
}

// Global Export
if (typeof window !== 'undefined') {
    window.PathManager = PathManager;
    window.StorageManager = StorageManager;
    window.AuthManager = AuthManager;
    window.ThemeManager = ThemeManager;
    window.BackupManager = BackupManager;

    // Auto init
    AuthManager.init();
    console.log("CoreManagers initialized.");
}
