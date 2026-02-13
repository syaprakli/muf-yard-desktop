
// --- CORE MANAGERS ---
// PathManager, StorageManager, AuthManager, ThemeManager
// Isolated to prevent app.js inconsistencies from breaking login.

// 1. PathManager
class PathManager {
    static isElectron() {
        return (typeof process !== 'undefined' && process.versions && !!process.versions.electron) ||
            (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes(' electron/'));
    }

    static getRoot() {
        if (this.isElectron() || typeof require !== 'undefined') {
            const path = require('path');
            const fs = require('fs');
            const os = require('os');
            let basePath;

            // 1. Dizin Tespit Stratejisi
            if (process.execPath.includes('node_modules') || process.execPath.includes('electron.exe') || process.execPath.includes('electron.cmd')) {
                basePath = process.cwd(); // Geliştirme (Playground)
            } else {
                basePath = path.dirname(process.execPath); // Üretim (.exe'nin yanı)
            }

            // 2. Klasör İsmi Kontrolü (İç içe MufYard/MufYard oluşmasını önle)
            const baseDirName = path.basename(basePath);
            if (baseDirName.toLowerCase() === 'mufyard') {
                return basePath; // Zaten MufYard içindeyiz, burayı kök al.
            }

            const targetPath = path.join(basePath, 'MufYard');

            // 3. Yazma İzni Kontrolü (Admin yetkisi gerekirse 'Belgeler'e taşı)
            try {
                if (!fs.existsSync(targetPath)) {
                    fs.mkdirSync(targetPath, { recursive: true });
                }
                // Test yazması dene
                const testFile = path.join(targetPath, '.write_test');
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
            } catch (e) {
                const fallback = path.join(os.homedir(), 'Documents', 'MufYard');
                console.warn('Kurulum dizinine yazma izni yok, Belgeler kullanılıyor:', fallback);
                return fallback;
            }

            console.log('PathManager: Uygulama kök dizini (Target):', targetPath);
            return targetPath;
        }
        return 'MufYard';
    }

    static join(...parts) {
        if (typeof require !== 'undefined') {
            return require('path').join(this.getRoot(), ...parts);
        }
        return [this.getRoot(), ...parts].join('\\');
    }

    static getTemplatesPath() {
        if (typeof require === 'undefined') return 'Sablonlar';

        const path = require('path');
        const fs = require('fs');

        let candidates = [
            this.join('Sablonlar'), // C:\MufYard\Sablonlar (Development/Portable)
            this.join('resources', 'Sablonlar') // C:\MufYard\resources\Sablonlar (Production)
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        // Fallback to root if neither exists (will likely be created there)
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
        return ['theme', 'font', 'accent_color', 'sidebar_color'];
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

    static set(key, value) {
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

            localStorage.setItem(key, saveValue);

            // --- AUTO CLOUD SYNC ---
            this.syncToCloud(key, saveValue);

        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                Toast.show('Depolama alanı doldu! Lütfen eski verileri temizleyin.', 'error');
            } else {
                console.error('Storage Save Error:', e);
            }
        }
    }

    // --- CLOUD SYNC METHODS ---
    static async syncToCloud(key, value) {
        if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
        if (!this.ENCRYPTED_KEYS.includes(key) && !this.SYNC_ONLY_KEYS.includes(key)) return;

        const uid = firebase.auth().currentUser.uid;
        try {
            await firebase.firestore().collection('users').doc(uid).collection('data').doc(key).set({
                value: value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Cloud [UP]: ${key}`);
        } catch (e) {
            console.error(`Cloud Sync Failed (${key}):`, e);
        }
    }

    static async syncFromCloud() {
        if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;
        if (!navigator.onLine) return;

        console.log('Sync: Checking cloud for updates...');
        const uid = firebase.auth().currentUser.uid;
        const allKeys = [...this.ENCRYPTED_KEYS, ...this.SYNC_ONLY_KEYS];
        let changeCount = 0;

        for (const key of allKeys) {
            try {
                const doc = await firebase.firestore().collection('users').doc(uid).collection('data').doc(key).get();
                if (doc.exists) {
                    const serverData = doc.data();
                    const localValue = localStorage.getItem(key);
                    if (serverData.value && serverData.value !== localValue) {
                        localStorage.setItem(key, serverData.value);
                        changeCount++;
                    }
                }
            } catch (e) {
                console.error(`Sync Download Error (${key}):`, e);
            }
        }

        if (changeCount > 0) {
            Toast.show('Veriler buluttan güncellendi.', 'success');
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
                'TÜM VERİLERİNİZ SİLİNECEKTİR! Kalıcı olarak temizlenecektir. Emin misiniz?',
                () => {
                    localStorage.clear();
                    Toast.show('Tüm veriler temizlendi.', 'success');
                    setTimeout(() => location.reload(), 2000);
                },
                'Evet, Tüm Verileri Sil'
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
        const fullname = document.getElementById('reg-fullname').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const question = document.getElementById('reg-question')?.value || '';
        const answer = document.getElementById('reg-answer')?.value.trim().toLowerCase() || '';

        if (!fullname || !email || !password || !answer) {
            Toast.show('Lütfen tüm alanları doldurunuz.', 'warning');
            return;
        }

        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await user.updateProfile({ displayName: fullname });

            const localUser = {
                uid: user.uid,
                fullname: fullname,
                email: email,
                password: password, // For manual recovery display
                question: question,
                answer: answer
            };
            StorageManager.set('app_user', localUser);
            Toast.show('Hesap oluşturuldu!', 'success');
            AuthManager.completeLogin(localUser);
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                Toast.show('Bu e-posta adresi zaten bir hesaba kayıtlı. Lütfen giriş yapın.', 'info');
                AuthManager.showScreen('login');
                // Mevcut e-postayı giriş ekranına taşıyalım (opsiyonel ama iyi olur)
                const loginEmail = document.getElementById('login-email');
                if (loginEmail) loginEmail.value = email;
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

            const userCredential = await firebase.auth().signInWithEmailAndPassword(emailInput, passwordInput);
            const user = userCredential.user;

            // Sync with local data
            const localUser = StorageManager.get('app_user') || {};
            localUser.uid = user.uid;
            localUser.fullname = user.displayName || localUser.fullname || 'Kullanıcı';
            localUser.email = user.email;

            StorageManager.set('app_user', localUser);
            sessionStorage.setItem('isLoggedIn', 'true');

            if (errorMsg) errorMsg.style.display = 'none';
            AuthManager.completeLogin(localUser);
        } catch (e) {
            const errorMsg = document.getElementById('login-error');
            if (errorMsg) {
                errorMsg.style.display = 'block';
                errorMsg.textContent = 'Giriş başarısız: ' + e.message;
            } else {
                Toast.show('Giriş başarısız.', 'error');
            }
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
            sessionStorage.removeItem('isLoggedIn');
            StorageManager.set('app_user', null);
            location.reload();
        } catch (e) {
            location.reload();
        }
    },

    checkRecoveryUser: () => {
        const email = document.getElementById('forgot-username').value.trim();
        const user = AuthManager.getUser();

        if (user && user.email === email) {
            document.getElementById('forgot-step-1').style.display = 'none';
            document.getElementById('forgot-step-2').style.display = 'block';
            document.getElementById('recovery-question-display').textContent = user.question || 'Güvenlik Sorusu';
        } else {
            Toast.show('Kullanıcı bulunamadı. Lütfen kayıtlı e-postanızı girin.', 'error');
        }
    },

    resetPassword: async () => {
        const answer = document.getElementById('forgot-answer').value.trim().toLowerCase();
        const newPass = document.getElementById('new-password').value;
        const user = AuthManager.getUser();

        if (user && user.answer === answer) {
            try {
                // If the user's secret matches, we update the local password first
                user.password = newPass;
                StorageManager.set('app_user', user);

                // Note: Firebase password update requires recent login normally.
                // However, since this is a local recovery workaround for desktop, 
                // we tell the user to try login with new password.
                Toast.show('Şifre yerel olarak güncellendi. Giriş yapmayı deneyin.', 'success');
                setTimeout(() => location.reload(), 1500);
            } catch (e) {
                Toast.show('Güncelleme hatası: ' + e.message, 'error');
            }
        } else {
            Toast.show('Cevap hatalı!', 'error');
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
