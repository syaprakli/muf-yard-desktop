
// --- CORE MANAGERS ---
// PathManager, StorageManager, AuthManager, ThemeManager
// Isolated to prevent app.js inconsistencies from breaking login.

// 1. PathManager
class PathManager {
    static getRoot() {
        if (typeof require !== 'undefined') {
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

// 2. StorageManager
class StorageManager {
    static get SECRET_KEY() { return 'MufYard_Secret_Key_2025'; }
    static get ENCRYPTED_KEYS() { return ['reports', 'tasks', 'contacts', 'notes', 'app_user']; }

    static get(key, defaultValue = null) {
        const stored = localStorage.getItem(key);
        if (!stored) return defaultValue;

        // Şifreli veri kontrolü (Migration Check)
        if (this.ENCRYPTED_KEYS.includes(key)) {
            try {
                // 1. Önce eski veri (Plain JSON) mi diye bak?
                const parsed = JSON.parse(stored);
                return parsed;
            } catch (e) {
                // 2. JSON değilse, muhtemelen Şifrelidir. Çözmeyi dene.
                try {
                    if (typeof CryptoJS === 'undefined') {
                        console.error('CryptoJS not loaded!');
                        return defaultValue;
                    }
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

        // Şifresiz veriler
        try {
            return JSON.parse(stored);
        } catch (e) {
            return defaultValue;
        }
    }

    static set(key, value) {
        try {
            if (this.ENCRYPTED_KEYS.includes(key)) {
                if (typeof CryptoJS !== 'undefined') {
                    const jsonStr = JSON.stringify(value);
                    const encrypted = CryptoJS.AES.encrypt(jsonStr, this.SECRET_KEY).toString();
                    localStorage.setItem(key, encrypted);
                } else {
                    console.warn('CryptoJS missing, saving plain text!');
                    localStorage.setItem(key, JSON.stringify(value));
                }
            } else {
                localStorage.setItem(key, JSON.stringify(value));
            }
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                const msg = 'Depolama alanı doldu! Lütfen bazı eski kayıtları temizleyin veya fotoğrafları silin.';
                if (typeof Toast !== 'undefined') {
                    Toast.show(msg, 'error');
                } else {
                    alert(msg);
                }
            } else {
                console.error('Storage Save Error:', e);
            }
        }
    }

    static addToArray(key, item) {
        const items = this.get(key, []);
        items.unshift(item); // En yeni en başa
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
        if (typeof BackupManager !== 'undefined') {
            BackupManager.createBackup(true);
        } else {
            alert('Yedekleme yöneticisi yüklenemedi.');
        }
    }

    static importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.reports) this.set('reports', data.reports);
            if (data.tasks) this.set('tasks', data.tasks);
            if (data.contacts) this.set('contacts', data.contacts);
            if (data.notes) this.set('notes', data.notes);

            Toast.show('Veriler başarıyla yüklendi (Şifrelendi).', 'success');
            setTimeout(() => location.reload(), 1500);
            return true;
        } catch (e) {
            console.error('Import Error:', e);
            alert('Yedek dosyası bozuk veya hatalı format.');
            return false;
        }
    }

    static clearAllData() {
        if (confirm('TÜM VERİLERİNİZ SİLİNECEKTİR!\n\nRaporlar, görevler, notlar ve kullanıcı ayarları dahil her şey kalıcı olarak temizlenecektir. Emin misiniz?')) {
            localStorage.clear();
            alert('Tüm veriler temizlendi. Uygulama yeniden başlatılıyor.');
            location.reload();
        }
    }
}

// 3. AuthManager
const AuthManager = {
    // Explicitly expose to window immediately for safety
    init: function () {
        if (typeof window !== 'undefined') window.AuthManager = this;
    },

    getUser: () => {
        return StorageManager.get('app_user');
    },

    register: () => {
        const fullname = document.getElementById('reg-fullname').value.trim();
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const question = document.getElementById('reg-question').value;
        const answer = document.getElementById('reg-answer').value.trim();

        if (!fullname || !username || !password || !question || !answer) {
            Toast.show('Lütfen tüm alanları doldurunuz.', 'warning');
            return;
        }

        const user = {
            fullname,
            username,
            password,
            question,
            answer: answer.toLowerCase()
        };

        StorageManager.set('app_user', user);
        Toast.show('Kurulum tamamlandı! Giriş yapılıyor...', 'success');
        AuthManager.showScreen('login');
    },

    login: () => {
        try {
            console.log('Login attempt...');
            const usernameInputEl = document.getElementById('login-username');
            const passwordInputEl = document.getElementById('login-password');
            const errorMsg = document.getElementById('login-error');

            if (!usernameInputEl || !passwordInputEl) {
                Toast.show('Hata: Giriş kutuları bulunamadı!', 'error');
                return;
            }

            const usernameInput = usernameInputEl.value.trim();
            const passwordInput = passwordInputEl.value;

            const user = AuthManager.getUser();

            if (!user) {
                Toast.show('Sistemde kayıtlı kullanıcı bulunamadı. Lütfen önce KURULUM yapın.', 'warning');
                return;
            }

            if (user.username === usernameInput && user.password === passwordInput) {
                sessionStorage.setItem('isLoggedIn', 'true');
                if (errorMsg) errorMsg.style.display = 'none';
                AuthManager.completeLogin(user);
            } else {
                if (errorMsg) {
                    errorMsg.style.display = 'block';
                    errorMsg.textContent = 'Kullanıcı adı veya şifre hatalı.';
                } else {
                    Toast.show('Kullanıcı adı veya şifre hatalı.', 'error');
                }
            }
        } catch (e) {
            Toast.show('Giriş Hatası: ' + e.message, 'error');
        }
    },

    completeLogin: (user) => {
        document.getElementById('login-overlay').style.display = 'none';
        if (window.checkLogin) window.checkLogin(); // Trigger app init if waiting
    },

    logout: () => {
        sessionStorage.removeItem('isLoggedIn');
        location.reload();
    },

    handleKey: (event, type) => {
        if (event.key === 'Enter') {
            if (type === 'login') AuthManager.login();
        }
    },

    showScreen: (screenName) => {
        try {
            console.log('Switching to screen:', screenName);
            const loginEl = document.getElementById('auth-login');
            const regEl = document.getElementById('auth-register');
            const forgotEl = document.getElementById('auth-forgot');
            const introEl = document.getElementById('auth-intro');
            const targetEl = document.getElementById(`auth-${screenName}`);

            if (!loginEl || !regEl || !forgotEl) {
                console.error('Auth screens not found in DOM');
                return;
            }

            if (introEl) introEl.style.display = 'none';
            loginEl.style.display = 'none';
            regEl.style.display = 'none';
            forgotEl.style.display = 'none';

            if (targetEl) {
                targetEl.style.display = 'block';
            } else {
                Toast.show('Hata: Hedef ekran bulunamadı: ' + screenName, 'error');
            }

            // Reset inputs
            if (screenName === 'login') {
                const err = document.getElementById('login-error');
                if (err) err.style.display = 'none';
            }
        } catch (e) {
            Toast.show('Ekran geçiş hatası: ' + e.message, 'error');
        }
    },

    // Password Recovery Logic
    checkRecoveryUser: () => {
        const username = document.getElementById('forgot-username').value.trim();
        const user = AuthManager.getUser();

        if (user && user.username === username) {
            document.getElementById('forgot-step-1').style.display = 'none';
            document.getElementById('forgot-step-2').style.display = 'block';
            document.getElementById('recovery-question-display').textContent = user.question || 'Güvenlik Sorusu';
        } else {
            Toast.show('Bu kullanıcı adı ile kayıtlı bir hesap bulunamadı.', 'warning');
        }
    },

    resetPassword: () => {
        const answer = document.getElementById('forgot-answer').value.trim().toLowerCase();
        const newPass = document.getElementById('new-password').value;
        const user = AuthManager.getUser();

        if (user.answer === answer) {
            if (!newPass) {
                Toast.show('Lütfen yeni şifre belirleyin.', 'warning');
                return;
            }
            user.password = newPass;
            StorageManager.set('app_user', user);
            Toast.show('Şifreniz başarıyla değiştirildi. Giriş yapabilirsiniz.', 'success');
            location.reload();
        } else {
            Toast.show('Güvenlik cevabı hatalı!', 'error');
        }
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

// Global Export
if (typeof window !== 'undefined') {
    window.PathManager = PathManager;
    window.StorageManager = StorageManager;
    window.AuthManager = AuthManager;
    window.ThemeManager = ThemeManager;

    // Auto init
    AuthManager.init();
    console.log("CoreManagers initialized.");
}
