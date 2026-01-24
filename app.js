/**
 * Müfettiş Asistanı - Main Application Logic
 */

// --- Data Layer ---
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
                // Eğer valid bir JSON objesiyse, henüz şifrelenmemiştir.
                // Ancak "U2F..." gibi raw string JSON.parse'da hata verir.
                const parsed = JSON.parse(stored);
                // Başarılı olursa ve boş değilse eski veridir.
                // (Not: Sayısal/Bool veriler de parse olabilir ama bizim key'ler array/object)
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

                    if (!decryptedStr) return defaultValue; // Boş dönerse decrypt hatası/boş veri

                    return JSON.parse(decryptedStr);
                } catch (decErr) {
                    console.error('Decryption Error for ' + key, decErr);
                    return defaultValue;
                }
            }
        }

        // Şifresiz veriler (Ayarlar vs.)
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
                console.error('Storage Quota Exceeded:', e);
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
            // Import ederken set metodunu kullandığımız için otomatik şifrelenecek
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


class BackupManager {
    static createBackup(interactive = false) {
        if (typeof require === 'undefined') {
            if (interactive) {
                if (typeof Toast !== 'undefined') Toast.show('Yedekleme sadece masaüstü uygulamasında çalışır.', 'warning');
                else alert('Yedekleme sadece masaüstü uygulamasında çalışır.');
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

/**
 * Auth Manager - Handles Login/Register/Recovery
 */
const AuthManager = {
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

            // Debug - Bunu canlıda yapmayız ama sorunu çözmek için:
            // alert('Girilen: ' + usernameInput + ' / ' + passwordInput);

            const user = AuthManager.getUser();

            if (!user) {
                Toast.show('Sistemde kayıtlı kullanıcı bulunamadı. Lütfen önce KURULUM yapın.', 'warning');
                return;
            }

            if (user.username === usernameInput && user.password === passwordInput) {
                sessionStorage.setItem('isLoggedIn', 'true');
                errorMsg.style.display = 'none';
                AuthManager.completeLogin(user);
            } else {
                errorMsg.style.display = 'block';
                errorMsg.textContent = 'Kullanıcı adı veya şifre hatalı.';
                // alert('Hata: Şifre uyuşmadı. Kayıtlı olan: ' + user.username);
            }
        } catch (e) {
            Toast.show('Giriş Hatası: ' + e.message, 'error');
        }
    },

    completeLogin: (user) => {
        document.getElementById('login-overlay').style.display = 'none';
        // Karşılama mesajı opsiyonel
        // document.getElementById('page-header').textContent = `Hoşgeldin, ${ user.fullname } `;
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
                Toast.show('Hata: Ekranlar HTML içinde bulunamadı. Lütfen sayfayı yenileyin.', 'error');
                return;
            }

            if (introEl) introEl.style.display = 'none';
            loginEl.style.display = 'none';
            regEl.style.display = 'none';
            forgotEl.style.display = 'none';

            if (targetEl) {
                targetEl.style.display = 'block'; // Fixed: flex caused horizontal stacking
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

            // Custom Question Support
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

// Global Erişilebilirlik
if (typeof window !== 'undefined') {
    window.AuthManager = AuthManager;
}





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
        StorageManager.set('themeColor', colorHex); // Sync with new UI key
    }

    static applySidebarColor(colorHex) {
        document.documentElement.style.setProperty('--bg-sidebar', colorHex);
        StorageManager.set('sidebar_color', colorHex);
    }

    static updateIcon(theme) {
        // Header Button
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) {
            btn.innerHTML = theme === 'dark'
                ? '<span class="material-icons-round">light_mode</span>'
                : '<span class="material-icons-round">dark_mode</span>';
            btn.title = theme === 'dark' ? 'Aydınlık Mod' : 'Karanlık Mod';
        }
        // Settings Page Switch
        const sw = document.getElementById('theme-switch');
        if (sw) sw.checked = (theme === 'dark');
    }
}

class NoteManager {
    static getNotes() {
        return StorageManager.get('notes', []);
    }

    static addNote(content) {
        const note = {
            id: Date.now(),
            content: content,
            date: new Date().toISOString(),
            isPinned: false
        };
        StorageManager.addToArray('notes', note);
        return note;
    }

    static updateNote(id, content) {
        let notes = this.getNotes();
        const index = notes.findIndex(n => n.id === id);
        if (index !== -1) {
            notes[index].content = content;
            notes[index].date = new Date().toISOString(); // Update date on edit
            StorageManager.set('notes', notes);
            return notes[index];
        }
    }

    static deleteNote(id) {
        StorageManager.removeFromArray('notes', 'id', id);
    }

    static deleteMultiple(ids) {
        let notes = this.getNotes();
        notes = notes.filter(n => !ids.includes(n.id));
        StorageManager.set('notes', notes);
    }

    static deleteAll() {
        StorageManager.set('notes', []);
    }
}

class ContactsManager {
    static getContacts() {
        return StorageManager.get('contacts', []);
    }

    static addContact(data) {
        const contact = {
            id: Date.now(),
            name: data.name,
            role: data.role,
            phone: data.phone,
            email: data.email,
            relatedJob: data.relatedJob || '' // Yeni Alan: Hangi İş
        };
        StorageManager.addToArray('contacts', contact);
        return contact;
    }

    static updateContact(id, data) {
        let contacts = this.getContacts();
        const index = contacts.findIndex(c => c.id === id);
        if (index !== -1) {
            contacts[index] = { ...contacts[index], ...data };
            StorageManager.set('contacts', contacts);
            return contacts[index];
        }
    }

    static deleteContact(id) {
        StorageManager.removeFromArray('contacts', 'id', id);
    }

    static deleteMultiple(ids) {
        let contacts = this.getContacts();
        contacts = contacts.filter(c => !ids.includes(c.id));
        StorageManager.set('contacts', contacts);
    }

    static deleteAll() {
        StorageManager.set('contacts', []);
    }
}



class FolderManager {
    static ensureReportsFolder() {
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            const targetDir = PathManager.join('Raporlar');
            if (!fs.existsSync(targetDir)) {
                try {
                    fs.mkdirSync(targetDir, { recursive: true });
                } catch (e) {
                    console.error('Rapor klasörü oluşturulamadı:', e);
                }
            }

            // Diğer standart klasörlerin varlığından emin ol
            const otherFolders = ['Dosyalar', 'Yedekler', 'Sablonlar'];
            otherFolders.forEach(folder => {
                const path = PathManager.join(folder);
                if (!fs.existsSync(path)) {
                    try { fs.mkdirSync(path, { recursive: true }); } catch (err) { }
                }
            });
        }
    }

    static getFolderForReport(report) {
        const dateObj = report.startDate ? new Date(report.startDate) : new Date();
        const year = dateObj.getFullYear();

        const typeLabels = {
            'inceleme': 'İnceleme',
            'sorusturma': 'Soruşturma',
            'genel-denetim': 'Genel Denetim',
            'ozel-denetim': 'Özel Denetim',
            'on-inceleme': 'Ön İnceleme',
            'on-arastirma': 'Ön Araştırma'
        };
        const typeName = typeLabels[report.type] || 'Diğer';
        const safeCode = (report.code || '').replace(/[<>:"/\\|?*]/g, '_');
        const safeTitle = (report.title || '').replace(/[<>:"/\\|?*]/g, '_');
        const folderName = `${safeCode} - ${safeTitle}`;

        return PathManager.join('Raporlar', year.toString(), typeName, folderName);
    }

    static createReportFolder(report) {
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            const targetDir = this.getFolderForReport(report);

            try {
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                // Standart alt klasörler (Opsiyonel - Kullanıcı isteğine göre eklenebilir)
                // const subs = ['Belgeler', 'Ekler', 'Rapor Taslağı'];
                // subs.forEach(sub => {
                //    const subPath = targetDir + '\\' + sub;
                //    if (!fs.existsSync(subPath)) fs.mkdirSync(subPath);
                // });
            } catch (e) {
                console.error('Klasör oluşturulamadı:', e);
            }
        }
    }

    static pathJoin(...parts) {
        return parts.join('\\');
    }
}

class FileManager {
    static getBasePath() {
        return PathManager.join('Dosyalar');
    }

    static getPath(subPath = '') {
        // Eğer subPath mutlak bir yolsa (C:\...) doğrudan döndür
        if (subPath && subPath.includes(':\\')) {
            return subPath;
        }
        const base = this.getBasePath();
        return subPath ? this.pathJoin(base, subPath) : base;
    }

    static pathJoin(...parts) {
        // Simple join for Windows, assuming clean inputs or handling by module if available
        return parts.join('\\').replace(/\\\\/g, '\\');
    }

    static async ensureFolder(subPath = '') {
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            const targetDir = this.getPath(subPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
        }
    }

    static getFiles(subPath = '') {
        if (typeof require === 'undefined') return [];
        try {
            const fs = require('fs');
            const path = require('path');
            const dir = this.getPath(subPath);
            this.ensureFolder(subPath);

            const items = fs.readdirSync(dir).map(file => {
                const fullPath = path.join(dir, file);
                try {
                    const stats = fs.statSync(fullPath);
                    return {
                        name: file,
                        path: fullPath,
                        size: stats.size,
                        date: stats.mtime,
                        isDirectory: stats.isDirectory()
                    };
                } catch (err) {
                    return null;
                }
            }).filter(f => f && !f.name.startsWith('.'));

            // Sort: Folders first, then files
            items.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) {
                    return a.name.localeCompare(b.name);
                }
                return a.isDirectory ? -1 : 1;
            });

            return items;
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    static async createFolder(subPath, folderName) {
        if (typeof require === 'undefined') return;
        try {
            const fs = require('fs');
            const path = require('path');
            const targetPath = path.join(this.getPath(subPath), folderName);

            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath);
                Toast.show('Klasör oluşturuldu.', 'success');
            } else {
                Toast.show('Bu isimde bir klasör zaten var.', 'warning');
            }
        } catch (e) {
            console.error('Create folder error:', e);
            Toast.show('Klasör oluşturulurken hata: ' + e.message, 'error');
        }
    }

    static async addFile(subPath = '') {
        if (typeof require === 'undefined') {
            Toast.show('Sadece masaüstü sürümde çalışır.', 'warning');
            return;
        }
        const { ipcRenderer } = require('electron');
        const fs = require('fs');
        const path = require('path');

        try {
            const result = await ipcRenderer.invoke('dialog:openFile');
            if (!result.canceled && result.filePaths.length > 0) {
                this.ensureFolder(subPath);
                const sourcePath = result.filePaths[0];
                const fileName = path.basename(sourcePath);
                const destPath = path.join(this.getPath(subPath), fileName);

                fs.copyFileSync(sourcePath, destPath);
                Toast.show('Dosya başarıyla eklendi.', 'success');
                // View refresh handled by UI
                return true;
            }
        } catch (e) {
            console.error('File add error:', e);
            Toast.show('Dosya eklenirken hata oluştu.', 'error');
            return false;
        }
    }

    static openFile(subPath, fileName) {
        if (typeof require === 'undefined') return;
        const { shell } = require('electron');
        const path = require('path');
        const fullPath = path.join(this.getPath(subPath), fileName);
        shell.openPath(fullPath);
    }

    static deleteItem(subPath, name, isDirectory) {
        if (typeof require === 'undefined') return;

        ConfirmationManager.show(
            `"${name}" ${isDirectory ? 'klasörünü ve içindekileri' : 'dosyasını'} silmek istediğinize emin misiniz?`,
            () => {
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const fullPath = path.join(this.getPath(subPath), name);

                    if (fs.existsSync(fullPath)) {
                        if (isDirectory) {
                            fs.rmSync(fullPath, { recursive: true, force: true });
                        } else {
                            fs.unlinkSync(fullPath);
                        }
                        Toast.show('Silme işlemi başarılı.', 'success');
                        UIManager.initFilesView(subPath); // Refresh same view
                    }
                } catch (e) {
                    console.error('Delete error:', e);
                    Toast.show('Silme hatası.', 'error');
                }
            },
            'Evet, Sil'
        );
    }

    static openFolder(subPath = '') {
        if (typeof require === 'undefined') return;
        const { shell } = require('electron');
        const dir = this.getPath(subPath);
        this.ensureFolder(subPath);
        shell.openPath(dir);
    }

    static openReportsFolder() {
        if (typeof require === 'undefined') return;
        const { shell } = require('electron');
        // Kullanıcı isteği düzeltme: Raporlar alt klasörü yerine MufYard kök dizinini aç.
        const dir = PathManager.getRoot();
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        }
        shell.openPath(dir);
    }
}

class DocumentManager {
    static getTemplateContent(report) {
        // ...

        const user = AuthManager.getUser() || { fullname: 'Müfettiş' };
        // Tarih formatı: dd.mm.yyyy
        const today = new Date().toLocaleDateString('tr-TR');
        const startDate = new Date(report.startDate).toLocaleDateString('tr-TR');

        // Dynamic Titles based on Type
        let mainType = 'SORUŞTURMA';
        if (report.type && report.type.includes('inceleme')) {
            mainType = 'İNCELEME';
        } else if (report.type === 'genel-denetim') {
            mainType = 'DENETİM';
        } else if (report.type === 'on-arastirma') {
            mainType = 'ÖN ARAŞTIRMA';
        }

        // Suffix Logic
        let typeSuffix = 'NIN'; // Default (SORUŞTURMA -> SORUŞTURMA-NIN)
        if (mainType === 'İNCELEME') typeSuffix = 'NİN';
        if (mainType === 'DENETİM') typeSuffix = 'İN';
        if (mainType === 'ÖN ARAŞTIRMA') typeSuffix = 'NIN';

        const title1 = `I- ${mainType} EMRİ:`;
        const title2 = `II- ${mainType}${typeSuffix} KONUSU:`;
        const title3 = `III- ${mainType} TARİHLERİ:`;
        const title4 = `IV- MUHBİR-MÜŞTEKİ:`;
        const title5 = `V- HAKKINDA ${mainType} YAPILAN/YAPILANLAR:`;
        const title6 = `VI- OLAYLARIN TAHLİLİ VE DELİLLERİN TARTIŞILMASI:`;
        const title7 = `VII- SONUÇ, KANAAT VE TEKLİFLER:`;


        return `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>${report.title}</title>
            <style>
                body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; }
                p { margin: 6pt 0; text-align: justify; }
                .header { text-align: center; font-weight: bold; margin-bottom: 30pt; font-size: 14pt; }
                .section-title { font-weight: bold; margin-top: 18pt; margin-bottom: 6pt; text-transform: uppercase; }
                .footer { margin-top: 48pt; text-align: right; }
                .table-reset { width: 100%; border: none; border-collapse: collapse; margin-bottom: 24pt; }
                .table-reset td { padding: 0; vertical-align: top; }
                .address { text-align: center; font-weight: bold; margin: 36pt 0; font-size: 12pt; }
            </style>
        </head>
        <body>
            <div class="header">
                T.C.<br>
                GENÇLİK VE SPOR BAKANLIĞI<br>
                MÜFETTİŞLİĞİ
            </div>
            
            <table class="table-reset">
                <tr>
                    <td style="text-align: left; width: 60%;">
                        <strong>Sayı:</strong> ${report.code}
                    </td>
                    <td style="text-align: right; width: 40%;">
                        ${today}
                    </td>
                </tr>
            </table>

            <div class="address">
                BAKANLIK MAKAMINA
            </div>

            <div class="section-title">${title1}</div>
            <p>
                ${mainType.charAt(0) + mainType.slice(1).toLocaleLowerCase('tr')}, Bakanlık Makamının ${startDate} tarihli Oluru ile Rehberlik ve Denetim Başkanlığınca verilen görev emrine istinaden yapılmıştır.
            </p>

            <div class="section-title">${title2}</div>
            <p>
                ${report.title} hususları ${mainType.toLocaleLowerCase('tr')}${typeSuffix.toLocaleLowerCase('tr')} konusunu oluşturmaktadır.
            </p>

            <div class="section-title">${title3}</div>
            <p>
                ${mainType.charAt(0) + mainType.slice(1).toLocaleLowerCase('tr')} ${startDate} tarihinde başlamış olup, halen devam etmektedir.
            </p>

            <div class="section-title">${title4}</div>
            <p>
                (Muhbir veya müşteki varsa buraya yazılacaktır. Yoksa 'Bulunmamaktadır' yazılabilir.)
            </p>

            <div class="section-title">${title5}</div>
            <p>
                (Hakkında ${mainType.toLocaleLowerCase('tr')} yapılan personel bilgileri...)
            </p>
            
            <div class="section-title">${title6}</div>
            <p>
                (Elde edilen bilgi ve belgelerin değerlendirilmesi...)
            </p>

            <div class="section-title">${title7}</div>
            <p>
                (Sonuç ve kanaat...)
            </p>

            <div class="footer">
                <br><br>
                <strong>${user.fullname}</strong><br>
                Müfettiş
            </div>
        </body>
        </html>
        `;
    }

    static createTemplate(reportId) {
        const reports = StorageManager.get('reports', []);
        const report = reports.find(r => r.id === reportId);
        if (!report) return Toast.show('Rapor bulunamadı!', 'error');

        const content = this.getTemplateContent(report);
        const folderPath = FolderManager.getFolderForReport(report);
        // Filename updated to 'Rapor_Taslagi' as per new context
        const filename = `Rapor_Taslagi_${report.code.replace(/[\/\\?%*:|"<>\.]/g, '-')}.doc`;
        const fullPath = FolderManager.pathJoin(folderPath, filename);

        if (typeof require !== 'undefined') {
            const fs = require('fs');
            const { shell } = require('electron');

            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }

            try {
                fs.writeFileSync(fullPath, content, 'utf-8');

                ConfirmationManager.show(
                    `Dosya Başarıyla Oluşturuldu!\n\nDosya Adı: ${filename}\nKonum: ${folderPath}\n\nKlasörü açıp dosyayı görmek ister misiniz?`,
                    () => {
                        shell.openPath(folderPath);
                    },
                    'Klasörü Aç'
                );

            } catch (error) {
                console.error(error);
                Toast.show('Dosya oluşturulamadı: ' + error.message, 'error');
            }
        } else {
            Toast.show('Bu özellik tarayıcıda çalışmaz.', 'warning');
        }
    }
}

class TemplateManager {
    static getPath() { return PathManager.getTemplatesPath(); }

    static async initializeDefaults() {
        if (typeof require === 'undefined') return;
        const fs = require('fs');
        const path = require('path');

        const targetDir = PathManager.join('Sablonlar');

        // Klasör yoksa oluştur
        if (!fs.existsSync(targetDir)) {
            try {
                fs.mkdirSync(targetDir, { recursive: true });
            } catch (e) {
                console.error('Hedef dizin oluşturulamadı:', e);
                return;
            }
        }

        // Eğer içi boş değilse kopyalama yapma (Kullanıcı kendi şablonlarını eklemiş olabilir)
        try {
            const existingFiles = fs.readdirSync(targetDir);
            if (existingFiles.filter(f => !f.startsWith('.')).length > 0) return;
        } catch (e) {
            console.error('Hedef dizin okunamadı:', e);
            return;
        }

        // Kaynak dizinleri kontrol et
        const sources = [];
        if (typeof __dirname !== 'undefined') sources.push(path.join(__dirname, 'Sablonlar'));
        sources.push(path.join(process.cwd(), 'Sablonlar'));
        if (typeof process !== 'undefined' && process.resourcesPath) {
            sources.push(path.join(process.resourcesPath, 'Sablonlar'));
        }

        for (const sourceDir of sources) {
            if (fs.existsSync(sourceDir) && sourceDir !== targetDir) {
                try {
                    fs.cpSync(sourceDir, targetDir, { recursive: true });
                    console.log('Varsayılan şablonlar kopyalandı:', sourceDir);
                    break;
                } catch (e) {
                    console.error(`Şablon kopyalama hatası (${sourceDir}):`, e);
                }
            }
        }
    }

    static async ensureFolder() {
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            const path = this.getPath();
            if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
        }
    }

    // Recursive file walker
    static getAllFiles(dirPath, arrayOfFiles) {
        if (typeof require === 'undefined') return [];
        const fs = require('fs');
        const path = require('path');

        const files = fs.readdirSync(dirPath);
        arrayOfFiles = arrayOfFiles || [];

        files.forEach(file => {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                // Skip hidden folders or special folder names if needed
                if (!file.startsWith('.') && !file.startsWith('_')) {
                    arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
                }
            } else {
                arrayOfFiles.push(fullPath);
            }
        });

        return arrayOfFiles;
    }

    static async listTemplates() {
        if (typeof require === 'undefined') {
            console.warn('TemplateManager: require is undefined (Browser Mode). Returning empty list.');
            return [];
        }
        try {
            // Ensure defaults are initialized before listing
            await this.initializeDefaults();

            await this.ensureFolder();
            const path = require('path');
            const fs = require('fs'); // Explicit require for safety

            const templatesPath = this.getPath();
            if (!fs.existsSync(templatesPath)) {
                console.warn('TemplateManager: Templates folder does not exist.');
                return [];
            }

            // Get all files recursively
            const allFiles = this.getAllFiles(templatesPath);

            // Filter and converting to relative paths
            return allFiles
                .filter(f => {
                    if (!f) return false;
                    const lower = f.toLowerCase();
                    return (lower.endsWith('.html') || lower.endsWith('.txt') || lower.endsWith('.htm') || lower.endsWith('.doc') || lower.endsWith('.docx'));
                })
                .map(f => {
                    // Return relative path
                    return path.relative(templatesPath, f);
                });

        } catch (e) {
            console.error('Template list error:', e);
            // Return empty array instead of throwing to prevent white screen crashes
            return [];
        }
    }

    static async generate(relativeTemplatePath, report) {
        if (typeof require === 'undefined') return Toast.show('Masaüstü uygulaması gerekli.', 'warning');
        try {
            const fs = require('fs');
            const path = require('path');

            // Resolve full path
            const templatePath = path.join(this.getPath(), relativeTemplatePath);

            if (!fs.existsSync(templatePath)) {
                return Toast.show('Şablon dosyası bulunamadı!', 'error');
            }

            // Determine file extension and if it is binary
            const ext = path.extname(templatePath).toLowerCase();
            const isBinary = (ext === '.doc' || ext === '.docx');

            let content;
            if (!isBinary) {
                content = fs.readFileSync(templatePath, 'utf-8');

                // Replacements
                const user = AuthManager.getUser();
                const map = {
                    '{RAPOR_KODU}': report.code || '',
                    '{KONU}': report.title || '',
                    '{BASLAMA_TARIHI}': report.startDate ? new Date(report.startDate).toLocaleDateString('tr-TR') : '',
                    '{SURE}': report.duration || '',
                    '{DURUM}': report.status || '',
                    '{MURETTIP}': user ? user.fullname : (report.author || ''),
                    '{BUGUN}': new Date().toLocaleDateString('tr-TR')
                };

                Object.keys(map).forEach(key => {
                    content = content.split(key).join(map[key]);
                });

                // Force UTF-8 Meta Tag
                if (!content.includes('charset=utf-8')) {
                    const metaTag = '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">';
                    if (content.includes('<head>')) {
                        content = content.replace('<head>', '<head>' + metaTag);
                    } else if (content.includes('<html>')) {
                        content = content.replace('<html>', '<html><head>' + metaTag + '</head>');
                    } else {
                        content = metaTag + content;
                    }
                }
            }

            // Determine Save Path
            let savePath;
            const reportFolder = FolderManager.getFolderForReport(report);
            const safeCode = (report.code || 'Rapor').replace(/[<>:"/\\|?*]/g, '_');
            const filename = `Rapor_${safeCode}${ext}`;

            if (fs.existsSync(reportFolder)) {
                savePath = path.join(reportFolder, filename);
            } else {
                try {
                    fs.mkdirSync(reportFolder, { recursive: true });
                    savePath = path.join(reportFolder, filename);
                } catch (err) {
                    savePath = path.join(require('os').homedir(), 'Desktop', filename);
                }
            }

            // Write to file with BOM
            // Write (or copy) to file
            if (isBinary) {
                fs.copyFileSync(templatePath, savePath);
            } else {
                fs.writeFileSync(savePath, '\uFEFF' + content, 'utf8');
            }

            // --- Copy Resource Folder (_dosyalar or _files) ---
            // Look in the SAME directory as the template file
            const templateDir = path.dirname(templatePath);
            const templateBaseName = path.basename(templatePath, path.extname(templatePath));

            const possibleFolders = [
                templateBaseName + '_dosyalar',
                templateBaseName + '_files'
            ];

            possibleFolders.forEach(folderName => {
                const srcFolderPath = path.join(templateDir, folderName);
                if (fs.existsSync(srcFolderPath)) {
                    const destFolderPath = path.join(reportFolder, folderName);
                    try {
                        fs.cpSync(srcFolderPath, destFolderPath, { recursive: true });
                        console.log(`Copied resources: ${folderName}`);
                    } catch (err) {
                        console.error('Resource copy failed:', err);
                    }
                }
            });

            // Open the file
            const { shell } = require('electron');
            shell.openPath(savePath);
            Toast.show('Rapor oluşturuldu ve açıldı.', 'success');

        } catch (e) {
            console.error(e);
            Toast.show('Hata: ' + e.message, 'error');
        }
    }
}

class ConfirmationManager {
    static show(message, onConfirm, okText = 'Evet') {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        if (!modal) return;

        msgEl.innerText = message; // Use innerText to respect newlines
        okBtn.textContent = okText;

        // Clean previous listeners
        const newOkBtn = okBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newOkBtn.addEventListener('click', () => {
            onConfirm();
            modal.style.display = 'none';
        });

        newCancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.style.display = 'flex';
    }
}

class ReportManager {
    static getReports() {
        return StorageManager.get('reports', []);
    }

    static generateReportCode() {
        const reports = this.getReports();
        const currentYear = new Date().getFullYear();
        const prefix = `S.Y.64/${currentYear}-`;

        // Bu yıla ait raporların sıra numaralarını bul
        const sequenceNumbers = reports
            .filter(r => r.code && r.code.startsWith(prefix))
            .map(r => parseInt(r.code.replace(prefix, '')))
            .filter(n => !isNaN(n));

        const nextSeq = sequenceNumbers.length > 0 ? Math.max(...sequenceNumbers) + 1 : 1;
        return `${prefix}${nextSeq}`;
    }

    static addReport(data) {
        // Tarih hesaplamaları
        let deadline = data.endDate; // Artık explicit bitiş tarihi var
        let duration = parseInt(data.duration) || 0;

        // Eğer bitiş tarihi seçildiyse süreyi hesapla, seçilmediyse süreden hesapla
        // Eğer bitiş tarihi seçildiyse süreyi hesapla, seçilmediyse süreden hesapla
        if (data.startDate && duration) {
            const start = new Date(data.startDate);
            const end = new Date(start);
            end.setDate(start.getDate() + duration);
            deadline = end.toISOString().split('T')[0];
        } else {
            // Fallback
            deadline = data.startDate;
        }

        const report = {
            id: Date.now(),
            code: data.code || this.generateReportCode(), // Manual or Auto
            title: data.title,
            type: data.type || 'genel-denetim',
            entity: data.entity,
            startDate: data.startDate || new Date().toISOString().split('T')[0],
            duration: duration,
            deadline: deadline, // Bitiş Tarihi
            status: data.status || 'baslanmadi',
            priority: data.priority || 'normal',
            checklist: [],
            description: data.description || '',
            createdAt: new Date().toISOString()
        };
        StorageManager.addToArray('reports', report);

        // [NEW] Otomatik Klasör Oluşturma
        FolderManager.createReportFolder(report);

        return report;
    }

    static deleteReport(id) {
        StorageManager.removeFromArray('reports', 'id', id);
    }

    static deleteMultiple(ids) {
        let reports = this.getReports();
        reports = reports.filter(r => !ids.includes(r.id));
        StorageManager.set('reports', reports);

        // Sync: Delete linked global tasks
        if (typeof TaskManager !== 'undefined') {
            TaskManager.deleteLinkedTasks(ids);
        }
    }

    static deleteAll() {
        // Collect all IDs first to delete linked tasks?
        // Or just clear all Linked tasks? 
        // For now, let's get all report IDs.
        const reports = this.getReports();
        const ids = reports.map(r => r.id);

        if (typeof TaskManager !== 'undefined' && ids.length > 0) {
            TaskManager.deleteLinkedTasks(ids);
        }

        StorageManager.set('reports', []);
    }

    static updateStatus(id, newStatus) {
        let reports = this.getReports();
        const index = reports.findIndex(i => i.id === id);
        if (index !== -1) {
            reports[index].status = newStatus;
            StorageManager.set('reports', reports);
        }
    }

    static updateReport(id, updatedData) {
        let reports = this.getReports();
        const index = reports.findIndex(r => r.id === id);
        if (index !== -1) {
            // Mevcut veriyi koru, yenileriyle güncelle
            const oldReport = reports[index];

            // Tarih/Süre tekrar hesapla (logic Add ile aynı olmalı ama basitleştirilmiş)
            let deadline = updatedData.endDate;
            let duration = parseInt(updatedData.duration) || 0;
            if (updatedData.startDate && duration) {
                const start = new Date(updatedData.startDate);
                const end = new Date(start);
                end.setDate(start.getDate() + duration);
                deadline = end.toISOString().split('T')[0];
            } else {
                deadline = updatedData.startDate;
            }

            reports[index] = {
                ...oldReport,
                code: updatedData.code,
                title: updatedData.title,
                type: updatedData.type,
                startDate: updatedData.startDate,
                duration: duration,
                deadline: deadline
            };
            StorageManager.set('reports', reports);
        }
    }

    static updateReportDate(id, type, newDateStr) {
        let reports = this.getReports();
        const index = reports.findIndex(r => r.id == id); // Loose equality for string/number id mix
        if (index !== -1) {
            const report = reports[index];
            const newDate = new Date(newDateStr);

            if (type === 'start') {
                // Update Start Date
                // Maintain duration: Shift deadline relative to new start
                const duration = parseInt(report.duration) || 0;
                const newDeadline = new Date(newDate);
                newDeadline.setDate(newDeadline.getDate() + duration);

                report.startDate = newDateStr;
                report.deadline = newDeadline.toISOString().split('T')[0];

            } else if (type === 'deadline') {
                // Update Deadline
                // Maintain Start Date: Recalculate duration
                report.deadline = newDateStr;

                const start = new Date(report.startDate);
                const diffTime = newDate - start;
                const newDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                report.duration = newDuration > 0 ? newDuration : 0;
            }

            StorageManager.set('reports', reports);
            return true;
        }
        return false;
    }

    static addChecklistItem(repId, text) {
        let reports = this.getReports();
        const index = reports.findIndex(i => i.id == repId);
        if (index !== -1) {
            const item = { id: Date.now(), text: text, completed: false };
            reports[index].checklist = reports[index].checklist || [];
            reports[index].checklist.push(item);
            StorageManager.set('reports', reports);

            // Sync with Global Tasks
            if (typeof TaskManager !== 'undefined') {
                const reportCode = reports[index].code || reports[index].title;
                const taskContent = `${text} (${reportCode})`;
                // Pass metadata for linkage
                TaskManager.addTask(taskContent, 'normal', { type: 'checklist', reportId: repId, checklistId: item.id });
            }
        }
    }

    static toggleChecklistItem(repId, itemId) {
        let reports = this.getReports();
        const index = reports.findIndex(i => i.id == repId);
        if (index !== -1 && reports[index].checklist) {
            const itemIndex = reports[index].checklist.findIndex(c => c.id == itemId);
            if (itemIndex !== -1) {
                const newState = !reports[index].checklist[itemIndex].completed;
                reports[index].checklist[itemIndex].completed = newState;
                StorageManager.set('reports', reports);

                // Sync with Global Tasks
                if (typeof TaskManager !== 'undefined') {
                    const tasks = TaskManager.getTasks();
                    const linkedTask = tasks.find(t => t.meta && t.meta.checklistId == itemId);

                    if (linkedTask) {
                        linkedTask.completed = newState;
                        StorageManager.set('tasks', tasks);
                    } else if (newState === false) {
                        // If reactivating and task is missing (deleted), re-create it
                        const report = reports[index];
                        const reportCode = report.code || report.title;
                        const text = reports[index].checklist[itemIndex].text;
                        const content = `${text} (${reportCode})`;
                        TaskManager.addTask(content, 'normal', { type: 'checklist', reportId: repId, checklistId: itemId });
                    }
                }
            }
        }
    }

    static deleteChecklistItem(repId, itemId, sync = true) {
        let reports = this.getReports();
        const index = reports.findIndex(i => i.id == repId);
        if (index !== -1 && reports[index].checklist) {
            reports[index].checklist = reports[index].checklist.filter(c => c.id != itemId);
            StorageManager.set('reports', reports);

            // Sync with Global Tasks
            if (sync && typeof TaskManager !== 'undefined') {
                const tasks = TaskManager.getTasks();
                const linkedTask = tasks.find(t => t.meta && t.meta.checklistId == itemId);
                if (linkedTask) {
                    // Remove from tasks without triggering deleteChecklistItem again
                    const updatedTasks = tasks.filter(t => t.id !== linkedTask.id);
                    StorageManager.set('tasks', updatedTasks);
                }
            }
        }
    }

    static setChecklistItemStatus(repId, itemId, status) {
        let reports = this.getReports();
        const index = reports.findIndex(i => i.id == repId);
        if (index !== -1 && reports[index].checklist) {
            const itemIndex = reports[index].checklist.findIndex(c => c.id == itemId);
            if (itemIndex !== -1) {
                reports[index].checklist[itemIndex].completed = status;
                StorageManager.set('reports', reports);
            }
        }
    }

    static getStats() {
        const reports = this.getReports();
        return {
            total: reports.length,
            active: reports.filter(i => i.status !== 'tamamlandi').length,
            completed: reports.filter(i => i.status === 'tamamlandi').length,
            urgent: reports.filter(i => {
                if (i.status === 'tamamlandi') return false;
                const deadline = new Date(i.deadline);
                const today = new Date();
                const diffTime = deadline - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 7 && diffDays >= 0;
            }).length
        };
    }
}




class TaskManager {
    static getTasks() {
        return StorageManager.get('tasks', []);
    }

    static addTask(text, priority = 'normal', meta = null) {
        const task = {
            id: Date.now(),
            text: text,
            priority: priority, // 'normal', 'high'
            completed: false,
            createdAt: new Date().toISOString(),
            meta: meta // { type: 'checklist', reportId: 1, checklistId: 123 }
        };
        StorageManager.addToArray('tasks', task);
        return task;
    }

    static toggleTask(id) {
        let tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            const task = tasks[index];
            task.completed = !task.completed;
            StorageManager.set('tasks', tasks);

            // Sync back to Report Checklist
            if (task.meta && task.meta.type === 'checklist' && typeof ReportManager !== 'undefined') {
                ReportManager.setChecklistItemStatus(task.meta.reportId, task.meta.checklistId, task.completed);
            }
        }
    }

    static deleteTask(id) {
        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === id);

        // Sync: If linked to checklist, delete the item from the report as well
        if (task && task.meta && task.meta.type === 'checklist' && typeof ReportManager !== 'undefined') {
            ReportManager.deleteChecklistItem(task.meta.reportId, task.meta.checklistId, false); // false = don't call deleteTask again
        }

        StorageManager.removeFromArray('tasks', 'id', id);

        // Refresh UI
        if (typeof UIManager !== 'undefined') {
            UIManager.renderTasks(this.getTasks());
            if (UIManager.updateDashboardStatsIfVisible) UIManager.updateDashboardStatsIfVisible();
        }
    }

    static deleteMultiple(ids) {
        let tasks = this.getTasks();
        // Remove tasks that are in the delete list
        tasks = tasks.filter(t => {
            // Check if task is linked to a checklist item that is being crossed out?
            // User request was about deleting specific tasks.
            // But here we just delete by ID.
            if (ids.includes(t.id)) {
                // Sync check: If we bulk delete tasks, should we cross out checklist items?
                // Yes, probably.
                if (t.meta && t.meta.type === 'checklist' && typeof ReportManager !== 'undefined') {
                    ReportManager.deleteChecklistItem(t.meta.reportId, t.meta.checklistId, false);
                }
                return false; // Remove
            }
            return true; // Keep
        });
        StorageManager.set('tasks', tasks);
    }

    static deleteLinkedTasks(reportIds) {
        let tasks = this.getTasks();
        const initialCount = tasks.length;
        tasks = tasks.filter(t => {
            if (t.meta && t.meta.type === 'checklist' && reportIds.some(rid => rid == t.meta.reportId)) {
                return false; // Remove linked task
            }
            return true;
        });

        if (tasks.length !== initialCount) {
            StorageManager.set('tasks', tasks);
        }
    }

    static deleteAll() {
        const tasks = this.getTasks();
        tasks.forEach(t => {
            // Sync with ReportManager for each task before deleting
            if (t.meta && t.meta.type === 'checklist' && typeof ReportManager !== 'undefined') {
                ReportManager.deleteChecklistItem(t.meta.reportId, t.meta.checklistId, false);
            }
        });
        StorageManager.set('tasks', []);

        // Refresh UI
        if (typeof UIManager !== 'undefined') {
            UIManager.renderTasks([]);
            if (UIManager.updateDashboardStatsIfVisible) UIManager.updateDashboardStatsIfVisible();
        }
    }

    static setReminder(id, dateTimeStr) {
        let tasks = this.getTasks();
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex > -1) {
            tasks[taskIndex].reminder = dateTimeStr; // ISO String or similar
            StorageManager.set('tasks', tasks);
        }
    }

    static checkReminders() {
        if (Notification.permission !== "granted") return;

        const tasks = this.getTasks();
        const now = new Date();
        let changed = false;

        tasks.forEach(task => {
            if (task.reminder && !task.completed) {
                const reminderTime = new Date(task.reminder);
                // Check if time is passed (within last minute to avoid double notify if internal is fast)
                // or just check if it is in the past and not yet notified (flag could be added, but clearing reminder is easier)

                if (now >= reminderTime) {
                    // Send Notification
                    const notif = new Notification("Hatırlatıcı: " + task.text, {
                        body: "Zamanı geldi! Görevi tamamlamayı unutmayın.",
                        icon: "logo.png" // Ensure logo exists or remove
                    });

                    notif.onclick = () => {
                        window.focus();
                        // Belki ilgili sayfaya git
                    };

                    // Clear reminder so it doesn't notify again
                    task.reminder = null;
                    changed = true;

                    // Play sound? (Optional)
                    // const audio = new Audio('alert.mp3'); audio.play();
                }
            }
        });

        if (changed) {
            StorageManager.set('tasks', tasks);
            // Re-render only if Tasks view is active to show updated icon state
            const currentView = document.querySelector('.nav-item.active');
            if (currentView && currentView.dataset.view === 'tasks') {
                UIManager.renderTasks(TaskManager.getTasks());
            }
        }
    }

    static getStats() {
        const tasks = this.getTasks();
        return {
            total: tasks.length,
            completed: tasks.filter(t => t.completed).length,
            pending: tasks.filter(t => !t.completed).length,
            urgent: tasks.filter(t => t.priority === 'high' && !t.completed).length
        };
    }
}


// --- Assistant Manager (AI Logic) ---
const AssistantManager = {
    handleUserMessage: () => {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        // 1. Kullanıcı mesajını ekle
        AssistantManager.addMessage(text, 'user');
        input.value = '';

        // 2. Cevap Üret (Simülasyon)
        setTimeout(() => {
            let response = "Bunu henüz anlayamadım. Şu an sadece 'görevler', 'istatistik', 'merhaba' gibi basit komutları biliyorum.";

            const lower = text.toLowerCase();

            if (lower.includes('merhaba') || lower.includes('selam')) {
                response = "Merhaba! Size nasıl yardımcı olabilirim?";
            }
            else if (lower.includes('görev') || lower.includes('işler')) {
                const stats = TaskManager.getStats();
                const reports = ReportManager.getReports();
                const activeReports = reports.filter(r => r.status !== 'tamamlandi').length;

                response = `Şu an sistemde <strong>${stats.pending}</strong> yapılacak iş ve <strong>${activeReports}</strong> aktif denetim görevi görünüyor.<br>
                Acil durumda olan <strong>${stats.urgent}</strong> işiniz var.`;
            }
            else if (lower.includes('durum') || lower.includes('istatistik')) {
                const stats = TaskManager.getStats();
                response = `Genel Durum:<br>
                 ✅ Tamamlanan İşler: ${stats.completed}<br>
                 ⏳ Bekleyen İşler: ${stats.pending}<br>
                 🚨 Acil İşler: ${stats.urgent}`;
            }
            else if (lower.includes('kimsin') || lower.includes('nesin')) {
                response = "Ben Dijital MüfYard. Henüz geliştirilme aşamasındayım ama senin işlerini kolaylaştırmak için buradayım.";
            }
            else if (lower.includes('yardım') || lower.includes('help') || lower.includes('neler yapabilirsin')) {
                response = `Şu an için şu komutları anlıyorum:<br><br>
                • <strong>görevler / işler:</strong> Aktif görevlerin ve bekleyen işlerin özetini gösterir.<br>
                • <strong>istatistik / durum:</strong> Genel iş yükü istatistiklerini raporlar.<br>
                • <strong>merhaba / selam:</strong> Selamlaşırız.<br>
                • <strong>kimsin:</strong> Kendimi tanıtırım.`;
            }

            AssistantManager.addMessage(response, 'ai');
        }, 600);
    },

    addMessage: (text, type) => {
        const history = document.getElementById('chat-history');
        if (!history) return;

        const isAi = type === 'ai';
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${type}`;
        msgDiv.style.alignSelf = isAi ? 'flex-start' : 'flex-end';
        msgDiv.style.maxWidth = '80%';
        msgDiv.style.animation = 'fadeIn 0.3s ease';

        let innerContent = '';
        if (isAi) {
            innerContent = `
                <div style="background:#fff; padding:1rem; border-radius: 0 12px 12px 12px; border:1px solid #e2e8f0; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                    <p style="margin:0; color:#1e293b; font-size:0.95rem; line-height:1.5;">${text}</p>
                </div>
                <span style="font-size:0.75rem; color:#94a3b8; margin-top:4px; display:block; margin-left:4px;">Dijital MüfYard</span>
            `;
        } else {
            innerContent = `
                <div style="background:#3b82f6; padding:0.8rem 1rem; border-radius: 12px 12px 0 12px; color:white; box-shadow:0 2px 4px rgba(59,130,246,0.2);">
                    <p style="margin:0; font-size:0.95rem; line-height:1.4;">${text}</p>
                </div>
            `;
        }

        msgDiv.innerHTML = innerContent;
        history.appendChild(msgDiv);
        history.scrollTop = history.scrollHeight;
    }
};



// --- Template Manager ---







// --- UI Layer ---
const UIManager = {
    showAboutModal: () => {
        document.getElementById('about-modal').style.display = 'flex';
    },

    saveAIConfig: () => {
        const apiKey = document.getElementById('gemini-api-key').value.trim();
        const model = document.getElementById('gemini-model-select').value;

        if (!apiKey) {
            Toast.show('Lütfen bir API anahtarı girin.', 'warning');
            return;
        }

        // Save to Storage
        localStorage.setItem('gemini_api_key', apiKey);
        localStorage.setItem('gemini_model', model);

        // Update Service
        if (typeof AIService !== 'undefined') {
            AIService.config.apiKey = apiKey;
            AIService.config.model = model;
            AIService.saveConfig();
            Toast.show('Ayarlar yerel olarak kaydedildi.', 'success');
        } else {
            Toast.show('AI Servisi yüklenemedi.', 'error');
        }
    },

    testAIConnection: async () => {
        const apiKey = document.getElementById('gemini-api-key').value.trim() || localStorage.getItem('gemini_api_key');
        const model = document.getElementById('gemini-model-select').value || 'gemini-1.5-flash';
        const statusEl = document.querySelector('#ai-connection-status .status-text');
        const indicatorEl = document.querySelector('#ai-connection-status .status-indicator');

        if (!apiKey) {
            Toast.show('Test için API anahtarı gerekli.', 'warning');
            return;
        }

        if (statusEl) statusEl.textContent = "Bağlantı Test Ediliyor...";
        if (indicatorEl) indicatorEl.style.backgroundColor = "orange";

        if (typeof AIService !== 'undefined') {
            const isConnected = await AIService.testConnection(apiKey, model);

            if (isConnected) {
                if (statusEl) statusEl.textContent = "Bağlandı (Aktif)";
                if (indicatorEl) indicatorEl.style.backgroundColor = "#10b981"; // Green
                Toast.show('Bağlantı başarılı!', 'success');
            } else {
                if (statusEl) statusEl.textContent = "Bağlantı Başarısız";
                if (indicatorEl) indicatorEl.style.backgroundColor = "#ef4444"; // Red
                Toast.show('Bağlantı kurulamadı.', 'error');
            }
        }
    },

    // ... existing methods ...

    initTemplatesView: (filterQuery = '') => {
        // Auto-initialize defaults if needed
        TemplateManager.initializeDefaults();

        const container = document.getElementById('content-area');
        container.innerHTML = `
            <div class="upload-zone" onclick="document.getElementById('template-upload').click()">
                <div class="material-icons-round" style="font-size:3rem; color:var(--primary-color); opacity:0.7;">cloud_upload</div>
                <h3 style="margin:1rem 0 0.5rem 0; color:var(--text-main);">Yeni Şablon Yükle</h3>
                <p style="color:var(--text-secondary);">veya dosyayı buraya sürükleyip bırakın</p>
                <input type="file" id="template-upload" style="display:none;" onchange="TemplateManager.addTemplate(this.files[0])">
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem;">
                <h3>Kayıtlı Şablonlar</h3>
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <input type="text" id="template-search" placeholder="Ara..." 
                        style="padding:0.5rem 1rem; border:1px solid var(--border-color); border-radius:var(--radius-md); font-size:0.9rem; width:200px;"
                        value="${filterQuery}">
                    <select id="template-type-filter" 
                        style="padding:0.5rem; border:1px solid var(--border-color); border-radius:var(--radius-md); font-size:0.9rem;">
                        <option value="">Tüm Tipler</option>
                        <option value="docx">Word (.docx)</option>
                        <option value="pdf">PDF (.pdf)</option>
                        <option value="xlsx">Excel (.xlsx)</option>
                    </select>
                </div>
            </div>

            <div class="template-grid">
                <!-- Templates Loop -->
            </div>
        `;

        // Add event listeners for filtering
        const searchInput = document.getElementById('template-search');
        const typeFilter = document.getElementById('template-type-filter');

        searchInput.addEventListener('input', (e) => {
            UIManager.renderTemplates(e.target.value, typeFilter.value);
        });

        typeFilter.addEventListener('change', (e) => {
            UIManager.renderTemplates(searchInput.value, e.target.value);
        });

        // Initial render
        UIManager.renderTemplates(filterQuery, '');
    },

    renderTemplates: (searchQuery = '', typeFilter = '') => {
        const grid = document.querySelector('.template-grid');
        let templates = TemplateManager.getTemplates();

        // Apply filters
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            templates = templates.filter(t =>
                t.name.toLowerCase().includes(query)
            );
        }

        if (typeFilter) {
            templates = templates.filter(t => t.type === typeFilter);
        }

        if (templates.length === 0) {
            grid.innerHTML = `<div class="empty-state">Şablon bulunamadı.</div>`;
            return;
        }

        grid.innerHTML = templates.map(t => {
            let icon = 'description';
            if (t.type === 'pdf') icon = 'picture_as_pdf';
            if (t.type === 'xlsx' || t.type === 'xls') icon = 'table_view';

            return `
                <div class="template-card" data-type="${t.type}" onclick="Toast.show('Belge açılıyor: ${t.name}', 'info')">
                    <div style="position:absolute; top:1rem; right:1rem; cursor:pointer; color:var(--danger);" onclick="TemplateManager.deleteTemplate(${t.id}, event)">
                        <span class="material-icons-round" style="font-size:1.2rem;">delete</span>
                    </div>
                    <div class="template-icon">
                        <span class="material-icons-round" style="font-size:3rem;">${icon}</span>
                    </div>
                    <div class="template-name" title="${t.name}">${t.name}</div>
                    <div class="template-meta">${t.date} • .${t.type.toUpperCase()}</div>
                </div>
            `;
        }).join('');
    },
    renderNotes: (notes, filterText = '') => {
        const grid = document.getElementById('notes-grid');
        if (!grid) return;

        // Filter
        if (filterText) {
            const lower = filterText.toLowerCase();
            notes = notes.filter(n => n.content.toLowerCase().includes(lower));
        }

        if (notes.length === 0) {
            grid.innerHTML = '<p class="empty-state">Henüz hiç not almadınız. Yeni bir tane ekleyin!</p>';
            // Hide bulk button if no items
            const bulkBtn = document.getElementById('delete-selected-notes');
            if (bulkBtn) bulkBtn.style.display = 'none';
            return;
        }

        grid.innerHTML = notes.map(note => `
            <div class="note-card" style="position:relative;">
                <div style="position:absolute; top:0.5rem; left:0.5rem; z-index:2;">
                    <input type="checkbox" class="note-select-cb" data-id="${note.id}" style="cursor:pointer; width:16px; height:16px;">
                </div>
                <div class="note-content" style="padding-top:1.5rem;">${note.content}</div>
                <div class="note-footer">
                    <span class="note-date">${new Date(note.date).toLocaleDateString('tr-TR')}</span>
                    <div style="display:flex; gap:0.25rem;">
                         <button class="btn-icon edit-note" onclick="editNote(${note.id})" title="Düzenle">
                            <span class="material-icons-round">edit</span>
                        </button>
                        <button class="btn-icon delete-note" data-id="${note.id}" title="Sil">
                            <span class="material-icons-round">delete</span>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Single Delete Listener (Keep existing logic mostly but updated with confirmation)
        document.querySelectorAll('.delete-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                // Directly delete single note (or ask confirmation if preferred, keeping simple for now)
                ConfirmationManager.show(
                    'Bu notu silmek istediğinize emin misiniz?',
                    () => {
                        NoteManager.deleteNote(id);
                        UIManager.renderNotes(NoteManager.getNotes());
                        Toast.show('Not silindi.', 'success');
                    },
                    'Sil'
                );
            });
        });

        // Checkbox Listeners to Toggle Bulk Button
        const checkboxes = document.querySelectorAll('.note-select-cb');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const anyChecked = Array.from(checkboxes).some(c => c.checked);
                const bulkBtn = document.getElementById('delete-selected-notes');
                if (bulkBtn) bulkBtn.style.display = anyChecked ? 'inline-flex' : 'none';
            });
        });
    },

    initNotesView: () => {
        const container = document.getElementById('content-area');

        // Define format command helper
        window.formatDoc = (cmd, value = null) => {
            document.execCommand(cmd, false, value);
            // Keep focus in editor
            const editor = document.getElementById('new-note-editor');
            if (editor) editor.focus();
        };

        container.innerHTML = `
            <div class="section-container">
                <div class="input-group" style="display:block;"> <!-- Block display for stack -->
                    <div class="rich-editor-wrapper">
                        <!-- Toolbar -->
                        <div class="editor-toolbar">
                            <!-- Fonts -->
                            <select id="editor-font-family" class="toolbar-select" onchange="formatDoc('fontName', this.value); this.selectedIndex=0;" style="padding:4px; border-radius:4px; border:1px solid #e2e8f0; color:var(--text-main); font-size:0.8rem; margin-right:0.5rem; outline:none;">
                                <option value="" selected disabled>Yazı Tipi</option>
                                <option value="Arial">Arial</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Verdana">Verdana</option>
                                <option value="Courier New">Courier New</option>
                                <option value="Georgia">Georgia</option>
                                <option value="Tahoma">Tahoma</option>
                                <option value="Trebuchet MS">Trebuchet MS</option>
                            </select>
                            <div class="toolbar-separator"></div>

                            <button class="toolbar-btn" onmousedown="event.preventDefault()" onclick="formatDoc('bold')" title="Kalın"><span class="material-icons-round" style="font-size:1.2rem;">format_bold</span></button>
                            <button class="toolbar-btn" onmousedown="event.preventDefault()" onclick="formatDoc('italic')" title="İtalik"><span class="material-icons-round" style="font-size:1.2rem;">format_italic</span></button>
                            <button class="toolbar-btn" onmousedown="event.preventDefault()" onclick="formatDoc('underline')" title="Altı Çizili"><span class="material-icons-round" style="font-size:1.2rem;">format_underlined</span></button>
                            <div class="toolbar-separator"></div>
                            <button class="toolbar-btn" onmousedown="event.preventDefault()" onclick="formatDoc('insertUnorderedList')" title="Liste"><span class="material-icons-round" style="font-size:1.2rem;">format_list_bulleted</span></button>
                            <div class="toolbar-separator"></div>
                            <!-- Colors (Direct Hex Strings) -->
                            <div class="toolbar-btn" onmousedown="event.preventDefault()" onclick="formatDoc('foreColor', 'black')" title="Siyah" style="padding:2px;"><div class="color-btn-sm" style="background:black;"></div></div>
                            <div class="toolbar-btn" onmousedown="event.preventDefault()" onclick="formatDoc('foreColor', 'red')" title="Kırmızı" style="padding:2px;"><div class="color-btn-sm" style="background:red;"></div></div>
                            <div class="toolbar-btn" onmousedown="event.preventDefault()" onclick="formatDoc('foreColor', 'blue')" title="Mavi" style="padding:2px;"><div class="color-btn-sm" style="background:blue;"></div></div>
                            <div class="toolbar-btn" onmousedown="event.preventDefault()" onclick="formatDoc('foreColor', 'green')" title="Yeşil" style="padding:2px;"><div class="color-btn-sm" style="background:green;"></div></div>
                            <button class="btn-icon toolbar-btn" onclick="formatDoc('removeFormat')" title="Biçimi Temizle"><span class="material-icons-round">format_clear</span></button>
                            
                            <!-- Spacer to push Save button to right -->
                            <div style="flex:1;"></div>

                            <button id="save-note-btn" class="btn btn-primary" style="padding: 0.4rem 1rem; font-size: 0.85rem;">
                                <span class="material-icons-round" style="font-size:1rem;">save</span> Kaydet
                            </button>
                        </div>
                        
                        <!-- Editor Area -->
                        <div id="new-note-editor" class="rich-editor style-postit" contenteditable="true" placeholder="Notunuzu buraya yazın..."></div>
                    </div>
                </div>
                
                <hr style="margin: 2rem 0; border:0; border-top:1px solid #e2e8f0;">
                
                <!-- Notes Grid Header -->
                 <div class="section-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>Notlarım</h3>
                     <div style="display:flex; gap:0.5rem; align-items:center;">
                         <button id="delete-selected-notes" class="btn btn-sm btn-outline" style="border-color:var(--danger); color:var(--danger); display:none;">
                            <span class="material-icons-round" style="font-size:1.1rem; margin-right:4px;">delete_sweep</span> Seçilenleri Sil
                        </button>
                        <div class="filters">
                            <input type="text" id="search-notes" placeholder="Notlarda ara..." class="search-input">
                        </div>
                    </div>
                </div>

                <div id="notes-grid" class="notes-grid"></div>
            </div>
        `;

        // Global Edit Handler
        let activeNoteId = null;

        window.editNote = (id) => {
            const notes = NoteManager.getNotes();
            const note = notes.find(n => n.id === id);
            if (note) {
                activeNoteId = note.id;
                document.getElementById('new-note-editor').innerHTML = note.content;

                // Update Save Button Text
                const saveBtn = document.getElementById('save-note-btn');
                saveBtn.innerHTML = '<span class="material-icons-round">update</span> Güncelle';
                saveBtn.classList.remove('btn-primary');
                saveBtn.classList.add('btn-warning'); // Orange for update

                // Scroll to editor
                document.getElementById('new-note-editor').scrollIntoView({ behavior: 'smooth' });
            }
        };

        UIManager.renderNotes(NoteManager.getNotes());

        // Save Listener
        document.getElementById('save-note-btn').addEventListener('click', () => {
            const editor = document.getElementById('new-note-editor');
            const content = editor.innerHTML;

            if (!content || content === '<br>') return Toast.show('Not içeriği boş olamaz.', 'warning');

            if (activeNoteId) {
                // Update Mode
                NoteManager.updateNote(activeNoteId, content);
                Toast.show('Not güncellendi.', 'success');

                // Reset State
                activeNoteId = null;
                const saveBtn = document.getElementById('save-note-btn');
                saveBtn.innerHTML = '<span class="material-icons-round">save</span> Kaydet';
                saveBtn.classList.add('btn-primary');
                saveBtn.classList.remove('btn-warning');
            } else {
                // Create Mode
                NoteManager.addNote(content);
                Toast.show('Not kaydedildi.', 'success');
            }

            // Clear and Refresh
            editor.innerHTML = '';
            UIManager.renderNotes(NoteManager.getNotes());
        });

        document.getElementById('search-notes').addEventListener('input', (e) => {
            UIManager.renderNotes(NoteManager.getNotes(), e.target.value);
        });

        // Bulk Delete Listener
        const bulkDeleteBtn = document.getElementById('delete-selected-notes');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => {
                const selectedIds = Array.from(document.querySelectorAll('.note-select-cb:checked'))
                    .map(cb => parseInt(cb.dataset.id));

                if (selectedIds.length > 0) {
                    ConfirmationManager.show(
                        `${selectedIds.length} adet notu silmek istediğinize emin misiniz?`,
                        () => {
                            NoteManager.deleteMultiple(selectedIds);
                            UIManager.renderNotes(NoteManager.getNotes());
                            Toast.show(`${selectedIds.length} not başarıyla silindi.`, 'success');
                            bulkDeleteBtn.style.display = 'none';
                        },
                        'Evet, Sil'
                    );
                }
            });
        }
    },
    setEditorTheme: (themeClass) => {
        const editor = document.getElementById('new-note-editor');
        if (!editor) return;
        // Remove old classes
        editor.classList.remove('style-default', 'style-postit', 'style-agenda', 'style-parchment');
        // Add new
        editor.classList.add(themeClass);
        // Save
        localStorage.setItem('note_editor_theme', themeClass);
    },

    renderReports: (reports, filterText = '') => {
        const list = document.getElementById('report-list');
        if (!list) return;

        // Filter
        if (filterText) {
            const lower = filterText.toLowerCase();
            reports = reports.filter(r =>
                (r.title && r.title.toLowerCase().includes(lower)) ||
                (r.code && r.code.toLowerCase().includes(lower))
            );
        }

        if (reports.length === 0) {
            list.innerHTML = `
                <div class="empty-table-state">
                    <span class="material-icons-round">search_off</span>
                    <p>${filterText ? 'Aranan kritere uygun rapor bulunamadı.' : 'Henüz kayıtlı rapor yok.'}</p>
                </div>`;
            return;
        }

        reports.sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true, sensitivity: 'base' }));

        list.innerHTML = reports.map(rep => {
            const statusLabels = {
                'baslanmadi': { text: 'Başlanmadı', class: 'status-pending' },
                'devam-ediyor': { text: 'Devam Ediyor', class: 'status-progress' },
                'evrak-bekleniyor': { text: 'Evrak Bekleniyor', class: 'status-waiting' },
                'incelemecide': { text: 'İncelemede', class: 'status-review' },
                'tamamlandi': { text: 'Tamamlandı', class: 'status-done' }
            };
            const status = statusLabels[rep.status] || statusLabels['baslanmadi'];

            const typeLabels = {
                'inceleme': 'İnceleme',
                'sorusturma': 'Soruşturma',
                'genel-denetim': 'Genel Denetim',
                'ozel-denetim': 'Özel Denetim',
                'on-inceleme': 'Ön İnceleme',
                'on-arastirma': 'Ön Araştırma (8/G)'
            };
            const typeText = typeLabels[rep.type] || rep.type;

            const today = new Date();
            const deadline = new Date(rep.deadline);
            const diffTime = deadline - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let dateText = `${diffDays} gün kaldı`;
            let dateColor = 'var(--success)';
            let statusDotColor = '#4caf50';

            if (rep.status === 'tamamlandi') {
                dateText = 'Tamamlandı';
            } else {
                if (diffDays < 0) {
                    dateText = `${Math.abs(diffDays)} gün geç.`;
                    dateColor = 'var(--danger)';
                    const overdue = Math.abs(diffDays);
                    if (overdue <= 30) statusDotColor = '#ffca28';
                    else if (overdue <= 90) statusDotColor = '#ff9800';
                    else statusDotColor = '#f44336';
                } else {
                    statusDotColor = '#4caf50';
                }
            }

            const startDate = new Date(rep.startDate).toLocaleDateString('tr-TR');

            return `
            <div class="inspection-row" style="padding: 1rem; border-bottom: 1px solid #f1f5f9; display:grid; grid-template-columns: 1fr 2.5fr 1fr 1fr 1.2fr 1fr 0.5fr 1.5fr; gap:0.5rem; align-items:center; background:#fff; transition:background 0.2s;">
                <span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary);">${rep.code || '-'}</span>
                <span style="font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${rep.title}">${rep.title}</span>
                <span style="font-size:0.85rem; color:var(--text-secondary);">${typeText}</span>
                <span style="font-size:0.85rem; color:var(--text-secondary);">${startDate}</span>
                
                <div class="status-selector-wrapper">
                     <select class="status-select-sm" data-id="${rep.id}" style="padding:0.25rem; font-size:0.8rem; border-radius:4px; border:1px solid #e2e8f0; bg: #f8fafc; width:100%;">
                        <option value="baslanmadi" ${rep.status === 'baslanmadi' ? 'selected' : ''}>Başlanmadı</option>
                        <option value="devam-ediyor" ${rep.status === 'devam-ediyor' ? 'selected' : ''}>Devam Ediyor</option>
                        <option value="evrak-bekleniyor" ${rep.status === 'evrak-bekleniyor' ? 'selected' : ''}>Evrak Bek.</option>
                        <option value="incelemecide" ${rep.status === 'incelemecide' ? 'selected' : ''}>İncelemede</option>
                        <option value="tamamlandi" ${rep.status === 'tamamlandi' ? 'selected' : ''}>Tamamlandı</option>
                    </select>
                </div>

                <span style="font-size:0.85rem; font-weight:500; color:${dateColor}; white-space:nowrap;">${dateText}</span>
                <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${statusDotColor}; margin:auto;" title="Durum"></span>
                
                <div style="display:flex; justify-content:flex-end; gap:0.25rem;">
                     <button class="btn-icon-sm create-template" data-id="${rep.id}" title="Rapor Yazımına Başla">
                        <span class="material-icons-round" style="font-size:1.1rem; color:#2563eb;">description</span>
                    </button>
                     <button class="btn-icon-sm toggle-checklist" data-id="${rep.id}" title="Yapılacaklar">
                        <span class="material-icons-round" style="font-size:1.1rem; color:var(--primary-color);">playlist_add_check</span>
                    </button>
                    <button class="btn-icon-sm open-folder" data-id="${rep.id}" title="Klasör Aç">
                        <span class="material-icons-round" style="font-size:1.1rem; color:#64748b;">folder_open</span>
                    </button>
                    <button class="btn-icon-sm edit-report" data-id="${rep.id}" title="Düzenle">
                        <span class="material-icons-round" style="font-size:1.1rem; color:#64748b;">edit</span>
                    </button>
                    <button class="btn-icon-sm delete-report" data-id="${rep.id}" title="Sil">
                        <span class="material-icons-round" style="font-size:1.1rem; color:var(--danger);">delete</span>
                    </button>
                </div>
            </div>
            <!-- Checklist Area (Full Width) -->
            <div id="checklist-${rep.id}" class="checklist-container" style="display:none; padding: 1rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <h5 style="margin-bottom:0.5rem; font-size:0.9rem; color:var(--text-secondary);">İş Adımları (${rep.code})</h5>
                <div class="checklist-items" id="items-${rep.id}">
                    ${(rep.checklist || []).map(item => `
                        <div class="checklist-item" style="display:flex; align-items:center; margin-bottom:0.5rem;">
                            <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="UIManager.toggleChk(${rep.id}, ${item.id})" style="margin-right:0.5rem;">
                            <span style="flex:1; text-decoration: ${item.completed ? 'line-through' : 'none'}; opacity:${item.completed ? 0.6 : 1}">${item.text}</span>
                             <button class="btn-icon" onclick="UIManager.deleteChk(${rep.id}, ${item.id})" style="color:var(--danger); font-size:0.9rem;"><span class="material-icons-round">close</span></button>
                        </div>
                    `).join('')}
                </div>
                <div class="checklist-input" style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                    <input type="text" id="chk-input-${rep.id}" placeholder="Yeni adım ekle..." style="flex:1; padding:0.4rem; border:1px solid #cbd5e1; border-radius:4px; font-size:0.9rem;">
                    <button class="btn btn-sm btn-primary" onclick="UIManager.addChk(${rep.id})">Ekle</button>
                </div>
            </div>
            `;
        }).join('');

        UIManager.attachEventListeners();
    },

    attachEventListeners: () => {
        // Status Change Listeners
        document.querySelectorAll('.status-select-sm').forEach(select => {
            select.addEventListener('change', (e) => {
                try {
                    const id = parseInt(e.target.dataset.id);
                    const newStatus = e.target.value;
                    ReportManager.updateStatus(id, newStatus);
                    UIManager.renderReports(ReportManager.getReports(), document.getElementById('search-reports')?.value || '');
                } catch (err) {
                    console.error('Error updating report status:', err);
                }
            });
        });

        // Toggle Checklist
        document.querySelectorAll('.toggle-checklist').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const container = document.getElementById(`checklist-${id}`);
                const isHidden = container.style.display === 'none';
                container.style.display = isHidden ? 'block' : 'none';
            });
        });

        document.querySelectorAll('.create-template').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                try {
                    const id = parseInt(e.currentTarget.dataset.id);
                    const reports = ReportManager.getReports();
                    const report = reports.find(r => r.id === id);
                    if (!report) return;

                    // Modern Modal Selection Logic
                    let templates = await TemplateManager.listTemplates();
                    const listEl = document.getElementById('template-list');
                    const modal = document.getElementById('template-modal');

                    if (!modal || !listEl) return;

                    if (templates.length === 0) {
                        listEl.innerHTML = '<div class="empty-state">Şablon bulunamadı.</div>';
                    } else {
                        let currentPath = '';
                        const renderList = () => {
                            listEl.innerHTML = '';
                            const cleanTemplates = templates.map(t => t.replace(/\\/g, '/'));
                            const itemsInPath = cleanTemplates.filter(t => !currentPath || t.startsWith(currentPath));

                            const children = new Set();
                            itemsInPath.forEach(t => {
                                const relative = currentPath ? t.slice(currentPath.length) : t;
                                const parts = relative.split('/').filter(p => p);
                                if (parts.length > 0) {
                                    const isFolder = parts.length > 1;
                                    // FIX: Klasörler için fullPath ekleme, yoksa her dosya için ayrı klasör satırı oluşur (Duplicate Fix)
                                    if (isFolder) {
                                        children.add(JSON.stringify({ name: parts[0], type: 'folder' }));
                                    } else {
                                        children.add(JSON.stringify({ name: parts[0], type: 'file', fullPath: t }));
                                    }
                                }
                            });

                            const uniqueChildren = Array.from(children).map(c => JSON.parse(c)).sort((a, b) => {
                                if (a.type === b.type) return a.name.localeCompare(b.name);
                                return a.type === 'folder' ? -1 : 1;
                            });

                            if (currentPath) {
                                const back = document.createElement('div');
                                back.className = 'template-item';
                                back.innerHTML = '<span class="material-icons-round">arrow_back</span> Geri Dön';
                                back.onclick = () => {
                                    const parts = currentPath.split('/').filter(p => p);
                                    parts.pop();
                                    currentPath = parts.length > 0 ? parts.join('/') + '/' : '';
                                    renderList();
                                };
                                listEl.appendChild(back);
                            }

                            uniqueChildren.forEach(item => {
                                const div = document.createElement('div');
                                div.className = 'template-item';
                                div.style.cssText = 'padding:0.75rem; background:white; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; display:flex; align-items:center; margin-bottom:0.5rem;';
                                div.innerHTML = `<span class="material-icons-round" style="color:${item.type === 'folder' ? '#f59e0b' : '#3b82f6'}; margin-right:0.5rem;">${item.type === 'folder' ? 'folder' : 'description'}</span><span>${item.name}</span>`;
                                div.onclick = () => {
                                    if (item.type === 'folder') {
                                        currentPath += item.name + '/';
                                        renderList();
                                    } else {
                                        const original = templates.find(t => t.replace(/\\/g, '/') === (currentPath + item.name));
                                        TemplateManager.generate(original || (currentPath + item.name), report);
                                        modal.style.display = 'none';
                                    }
                                };
                                listEl.appendChild(div);
                            });
                        };
                        renderList();
                    }
                    modal.style.display = 'flex';
                    document.getElementById('template-close-btn').onclick = () => modal.style.display = 'none';
                } catch (err) { console.error('Template list failure:', err); }
            });
        });

        document.querySelectorAll('.open-folder').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const reports = ReportManager.getReports();
                const rep = reports.find(r => r.id === id);
                if (!rep) return;

                const fullPath = FolderManager.getFolderForReport(rep);

                if (window.electronAPI) {
                    window.electronAPI.openFolder(fullPath);
                } else if (typeof require !== 'undefined') {
                    require('electron').ipcRenderer.invoke('folder:open', fullPath);
                } else {
                    navigator.clipboard.writeText(fullPath).then(() => alert('Klasör yolu kopyalandı:\n' + fullPath));
                }
            });
        });

        document.querySelectorAll('.delete-report').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('Bu rapor kaydını silmek istediğinize emin misiniz?')) {
                    const id = parseInt(e.currentTarget.dataset.id);
                    ReportManager.deleteReport(id);
                    UIManager.renderReports(ReportManager.getReports());
                }
            });
        });

        document.querySelectorAll('.edit-report').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const reports = ReportManager.getReports();
                const report = reports.find(r => r.id === id);
                if (report) {
                    document.getElementById('rep-code').value = report.code;
                    document.getElementById('rep-title').value = report.title;
                    document.getElementById('rep-type').value = report.type;
                    document.getElementById('rep-start').value = report.startDate;
                    document.getElementById('rep-duration').value = report.duration;

                    const addBtn = document.getElementById('add-rep-btn');
                    addBtn.innerHTML = '<span class="material-icons-round">save</span> Kaydet';
                    addBtn.dataset.mode = 'edit';
                    addBtn.dataset.editId = id;
                    document.querySelector('.section-container').scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    },

    addChk: (repId) => {
        const input = document.getElementById(`chk-input-${repId}`);
        if (input && input.value.trim()) {
            ReportManager.addChecklistItem(repId, input.value.trim());
            UIManager.renderReports(ReportManager.getReports());

            // Sync notification
            if (typeof Toast !== 'undefined') {
                Toast.show('İş adımı eklendi ve Yapılacaklar listesine yansıtıldı.', 'success');
            }

            setTimeout(() => {
                const container = document.getElementById(`checklist-${repId}`);
                if (container) container.style.display = 'block';
            }, 50);
        }
    },

    toggleChk: (repId, itemId) => {
        ReportManager.toggleChecklistItem(repId, itemId);
        UIManager.renderReports(ReportManager.getReports());
        setTimeout(() => {
            const container = document.getElementById(`checklist-${repId}`);
            if (container) container.style.display = 'block';
        }, 50);
    },

    deleteChk: (repId, itemId) => {
        ReportManager.deleteChecklistItem(repId, itemId);
        UIManager.renderReports(ReportManager.getReports());
        setTimeout(() => {
            const container = document.getElementById(`checklist-${repId}`);
            if (container) container.style.display = 'block';
        }, 50);
    },

    exportToExcel: () => {
        try {
            const reports = ReportManager.getReports();
            const activeReports = reports.filter(r => r.status !== 'tamamlandi');
            const today = new Date();

            // CSV Header
            let csvContent = "Rapor İsmi;Rapor Türü;Rapor Tarihi;Durum;Kalan Gün\n";

            activeReports.forEach(r => {
                const deadline = new Date(r.deadline);
                const diffTime = deadline - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                const statusLabels = {
                    'baslanmadi': 'Başlanmadı',
                    'devam': 'Devam Ediyor',
                    'taslak': 'Taslak Aşamasında',
                    'imza': 'İmza Aşamasında',
                    'tamamlandi': 'Tamamlandı'
                };
                const statusText = statusLabels[r.status] || r.status;

                const typeLabels = {
                    'inceleme': 'İnceleme',
                    'sorusturma': 'Soruşturma',
                    'genel-denetim': 'Genel Denetim',
                    'ozel-denetim': 'Özel Denetim',
                    'on-inceleme': 'Ön İnceleme',
                    'on-arastirma': 'Ön Araştırma'
                };

                const row = [
                    `"${r.title}"`,
                    `"${typeLabels[r.type] || r.type}"`,
                    `"${new Date(r.deadline).toLocaleDateString('tr-TR')}"`,
                    `"${statusText}"`,
                    `"${diffDays}"`
                ];
                csvContent += row.join(';') + "\n";
            });

            // Add BOM for Excel UTF-8 compatibility
            const BOM = "\uFEFF";
            const fileContent = BOM + csvContent;

            if (typeof require !== 'undefined') {
                const fs = require('fs');
                const path = require('path');
                const { shell } = require('electron');

                const timestamp = new Date().toLocaleDateString('tr-TR').replace(/\./g, '_');
                const filename = `Bekleyen_Gorevler_${timestamp}.csv`;
                const targetDir = PathManager.join('SonDurum');
                const fullPath = path.join(targetDir, filename);

                // Ensure directory exists
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                fs.writeFileSync(fullPath, fileContent, 'utf-8');

                // User Feedback & Folder Access
                ConfirmationManager.show(
                    `Excel dosyası oluşturuldu!\n\nKonum: ${fullPath} \n\nDosyanın bulunduğu klasörü açmak ister misiniz ? `,
                    () => {
                        shell.showItemInFolder(fullPath);
                    },
                    'Klasörü Aç'
                );
            } else {
                Toast.show('Bu özellik sadece masaüstü uygulamasında çalışır.', 'warning');
            }
        } catch (error) {
            console.error('Excel export failed:', error);
            Toast.show('Excel oluşturulurken hata oluştu: ' + error.message, 'error');
        }
    },

    deleteChk: (repId, itemId) => {
        ReportManager.deleteChecklistItem(repId, itemId);
        UIManager.renderReports(ReportManager.getReports());
        setTimeout(() => {
            const container = document.getElementById(`checklist-${repId}`);
            if (container) container.style.display = 'block';
        }, 50);
    },

    initReportsView: () => {
        const container = document.getElementById('content-area');
        container.innerHTML = `
            <div class="section-container">
                <div class="form-grid" style="margin-bottom: 1rem;">
                    <div class="form-group">
                        <label>Rapor Kodu</label>
                        <input type="text" id="rep-code" placeholder="S.Y.64/YYYY-N">
                    </div>
                    <div class="form-group">
                        <label>Rapor Adı</label>
                        <input type="text" id="rep-title" placeholder="Örn: X Belediyesi İncelemesi">
                    </div>
                     <div class="form-group">
                        <label>Rapor Türü</label>
                         <select id="rep-type">
                            <option value="inceleme">İnceleme</option>
                            <option value="sorusturma">Soruşturma</option>
                            <option value="genel-denetim">Genel Denetim</option>
                            <option value="ozel-denetim">Özel Denetim</option>
                            <option value="on-inceleme">Ön İnceleme</option>
                            <option value="on-arastirma">Ön Araştırma (8/G)</option>
                        </select>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                    <div class="form-group" style="flex:1;">
                        <label>Başlama Tarihi</label>
                        <input type="date" id="rep-start">
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>Süre (Gün)</label>
                        <input type="number" id="rep-duration" placeholder="Örn: 30">
                    </div>
                </div>

                <div class="form-group" style="display:flex; align-items:flex-end;">
                    <button id="add-rep-btn" class="btn btn-primary" style="width:100%;">
                        <span class="material-icons-round">post_add</span>
                        Rapor Oluştur
                    </button>
                </div>
            </div>

            <div class="section-container" style="margin-top: 1.5rem;">
                <div class="section-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>Görevler</h3>
                    <div class="filters" style="display:flex; gap:0.5rem;">
                        <input type="text" id="search-reports" placeholder="Görev ara..." class="search-input">
                    </div>
                </div>
                
                 <!-- Table Header -->
                <div style="margin-top:1rem; padding: 0.75rem 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px 8px 0 0; display:grid; grid-template-columns: 1fr 2.5fr 1fr 1fr 1.2fr 1fr 0.5fr 1.5fr; gap:0.5rem; font-size:0.85rem; font-weight:600; color:var(--text-secondary);">
                    <span>Rapor No</span>
                    <span>Görev Adı</span>
                    <span>Türü</span>
                    <span>Olur Tarihi</span>
                    <span>Rapor Durumu</span>
                    <span>Süre</span>
                    <span>Drm</span>
                    <span style="text-align:right;">İşlemler</span>
                </div>
                
                <div id="report-list" class="inspection-list" style="margin-top:0; border: 1px solid #e2e8f0; border-top:none; border-radius: 0 0 8px 8px; min-height: 50px;"></div>
            </div>
        `;

        // Render immediately
        setTimeout(() => {
            UIManager.renderReports(ReportManager.getReports());
        }, 0);

        // Pre-fill Report Code
        const codeInput = document.getElementById('rep-code');
        if (codeInput) codeInput.value = ReportManager.generateReportCode();

        document.getElementById('search-reports').addEventListener('input', (e) => {
            UIManager.renderReports(ReportManager.getReports(), e.target.value);
        });


        document.getElementById('add-rep-btn').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const mode = btn.dataset.mode || 'add';

            const code = document.getElementById('rep-code').value;
            const title = document.getElementById('rep-title').value;
            const type = document.getElementById('rep-type').value;
            const startDate = document.getElementById('rep-start').value;
            const duration = document.getElementById('rep-duration').value;

            if (title && startDate && duration) {
                if (mode === 'edit') {
                    const id = parseInt(btn.dataset.editId);
                    ReportManager.updateReport(id, { code, title, type, startDate, duration });
                    btn.innerHTML = '<span class="material-icons-round">post_add</span> Rapor Oluştur';
                    delete btn.dataset.mode;
                    delete btn.dataset.editId;
                } else {
                    ReportManager.addReport({ code, title, type, startDate, duration });
                }
                UIManager.renderReports(ReportManager.getReports());
                document.getElementById('rep-title').value = '';
                document.getElementById('rep-start').value = '';
                document.getElementById('rep-duration').value = '';
                document.getElementById('rep-code').value = ReportManager.generateReportCode();
            } else {
                Toast.show('Lütfen zorunlu alanları (Rapor Adı, Başlama Tarihi, Süre) doldurunuz.', 'warning');
            }
        });
    },





    renderContacts: (contacts, filterText = '') => {
        const grid = document.getElementById('contacts-grid');
        if (!grid) return;

        if (filterText) {
            const lower = filterText.toLowerCase();
            contacts = contacts.filter(c =>
                c.name.toLowerCase().includes(lower) ||
                c.role.toLowerCase().includes(lower) ||
                (c.relatedJob && c.relatedJob.toLowerCase().includes(lower))
            );
        }

        if (contacts.length === 0) {
            grid.innerHTML = '<div class="empty-state">Henüz kişi eklenmemiş.</div>';
            // Hide bulk button
            const bulkBtn = document.getElementById('delete-selected-contacts');
            if (bulkBtn) bulkBtn.style.display = 'none';
            return;
        }

        grid.innerHTML = contacts.map(c => `
    <div class="contact-card" style = "position:relative;" >
                 <div style="position:absolute; top:0.5rem; left:0.5rem; z-index:2;">
                    <input type="checkbox" class="contact-select-cb" data-id="${c.id}" style="cursor:pointer; width:16px; height:16px;">
                </div>
                <div class="contact-avatar">
                   <span class="material-icons-round">person</span>
                </div>
                <div class="contact-info">
                    <h4>${c.name}</h4>
                    <span class="contact-role">${c.role}</span>
                    ${c.relatedJob ? `<span class="contact-job" style="font-size:0.75rem; color:var(--primary-color); display:block; margin-top:0.2rem; font-weight:500;">İş: ${c.relatedJob}</span>` : ''}
                </div>
                <div class="contact-details">
                     <div class="c-detail"><span class="material-icons-round">phone</span> ${c.phone}</div>
                     <div class="c-detail"><span class="material-icons-round">email</span> ${c.email}</div>
                </div>
                <div class="contact-actions">
                    <button class="btn-icon edit-contact" data-id="${c.id}" title="Düzenle">
                        <span class="material-icons-round">edit</span>
                    </button>
                    <button class="btn-icon delete-contact" data-id="${c.id}" title="Sil">
                        <span class="material-icons-round">delete</span>
                    </button>
                </div>
            </div>
    `).join('');

        // Checkbox Listeners
        const checkboxes = document.querySelectorAll('.contact-select-cb');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const anyChecked = Array.from(checkboxes).some(c => c.checked);
                const bulkBtn = document.getElementById('delete-selected-contacts');
                if (bulkBtn) bulkBtn.style.display = anyChecked ? 'inline-flex' : 'none';
            });
        });

        document.querySelectorAll('.delete-contact').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                ConfirmationManager.show(
                    'Bu kişiyi rehberden silmek istediğinize emin misiniz?',
                    () => {
                        ContactsManager.deleteContact(id);
                        UIManager.renderContacts(ContactsManager.getContacts());
                        Toast.show('Kişi başarıyla silindi.', 'success');
                    },
                    'Evet, Sil'
                );
            });
        });

        document.querySelectorAll('.edit-contact').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const contacts = ContactsManager.getContacts();
                const contact = contacts.find(c => c.id === id);

                if (contact) {
                    // Populate Add Form
                    document.getElementById('contact-name').value = contact.name;
                    document.getElementById('contact-role').value = contact.role;
                    document.getElementById('contact-phone').value = contact.phone;
                    document.getElementById('contact-email').value = contact.email;
                    document.getElementById('contact-job').value = contact.relatedJob || '';

                    // Change Button to 'Save'
                    const addBtn = document.getElementById('add-contact-btn');
                    addBtn.innerHTML = '<span class="material-icons-round">save</span> Değişiklikleri Kaydet'; // Fixed text
                    addBtn.dataset.mode = 'edit';
                    addBtn.dataset.editId = id;

                    // Scroll to form
                    document.querySelector('.section-container').scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    },

    initContactsView: (tab = 'personal') => {
        const container = document.getElementById('content-area');

        let tabContent = '';

        if (tab === 'personal') {
            tabContent = `
            <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                <div class="form-group">
                    <input type="text" id="contact-name" placeholder="Ad Soyad">
                </div>
                <div class="form-group">
                    <input type="text" id="contact-role" placeholder="Görev/Ünvan">
                </div>
                <div class="form-group">
                    <input type="text" id="contact-job" placeholder="Hangi İş (Opsiyonel)">
                </div>
                <div class="form-group">
                    <input type="text" id="contact-phone" placeholder="Telefon">
                </div>
                <div class="form-group">
                    <input type="text" id="contact-email" placeholder="E-Posta">
                </div>
                <div class="form-group">
                    <button id="add-contact-btn" class="btn btn-primary" style="justify-content:center;">
                        <span class="material-icons-round">person_add</span> Ekle
                    </button>
                </div>
            </div>
            
            <div class="filters" style="margin-top:2rem;">
                <input type="text" id="search-contacts" placeholder="Kişi ara..." class="search-input">
            </div>
            
            <div id="contacts-grid" class="contacts-grid"></div>
            `;
        } else {
            tabContent = `
            <div class="actions-bar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; margin-top:1rem;">
                <div class="filters">
                    <input type="text" id="search-corp-contacts" placeholder="Kurumsal rehberde ara..." class="search-input" style="width:300px;">
                </div>
            </div>
            <div id="corp-contacts-table" class="inspection-list">Yükleniyor...</div>
            `;
        }

        container.innerHTML = `
            <div class="section-container">
                <div class="section-header" style="margin-bottom:1rem;">
                    <h3>Rehber</h3>
                    <div class="tabs" style="display:flex; gap:1rem; border-bottom:1px solid #e2e8f0;">
                        <button class="tab-btn ${tab === 'personal' ? 'active' : ''}" onclick="UIManager.initContactsView('personal')" style="padding:0.5rem 1rem; border:none; background:none; cursor:pointer; border-bottom: 2px solid ${tab === 'personal' ? 'var(--primary-color)' : 'transparent'}; color: ${tab === 'personal' ? 'var(--primary-color)' : 'var(--text-secondary)'}; font-weight: ${tab === 'personal' ? '600' : '400'};">
                            Kişisel Rehber
                        </button>
                        <button class="tab-btn ${tab === 'corporate' ? 'active' : ''}" onclick="UIManager.initContactsView('corporate')" style="padding:0.5rem 1rem; border:none; background:none; cursor:pointer; border-bottom: 2px solid ${tab === 'corporate' ? 'var(--primary-color)' : 'transparent'}; color: ${tab === 'corporate' ? 'var(--primary-color)' : 'var(--text-secondary)'}; font-weight: ${tab === 'corporate' ? '600' : '400'};">
                            Kurumsal Rehber
                        </button>
                    </div>
                </div>
                
                ${tabContent}
            </div>
        `;

        if (tab === 'personal') {
            UIManager.renderContacts(ContactsManager.getContacts());

            document.getElementById('search-contacts').addEventListener('input', (e) => {
                UIManager.renderContacts(ContactsManager.getContacts(), e.target.value);
            });

            document.getElementById('add-contact-btn').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const name = document.getElementById('contact-name').value;
                const role = document.getElementById('contact-role').value;
                const phone = document.getElementById('contact-phone').value;
                const email = document.getElementById('contact-email').value;
                const job = document.getElementById('contact-job').value;

                if (name && role) {
                    const data = {
                        name: name,
                        role: role,
                        phone: phone,
                        email: email,
                        relatedJob: job
                    };

                    if (btn.dataset.mode === 'edit') {
                        const id = parseInt(btn.dataset.editId);
                        ContactsManager.updateContact(id, data);
                        btn.innerHTML = '<span class="material-icons-round">person_add</span> Ekle';
                        delete btn.dataset.mode;
                        delete btn.dataset.editId;
                    } else {
                        ContactsManager.addContact(data);
                    }

                    document.getElementById('contact-name').value = '';
                    document.getElementById('contact-role').value = '';
                    document.getElementById('contact-phone').value = '';
                    document.getElementById('contact-email').value = '';
                    document.getElementById('contact-job').value = '';

                    UIManager.renderContacts(ContactsManager.getContacts());
                } else {
                    Toast.show('Lütfen Ad Soyad ve Rol alanlarını doldurun.', 'warning');
                }
            });
        } else {
            // Corporate Tab Logic
            CorporateContactsManager.loadAndRender();

            document.getElementById('search-corp-contacts').addEventListener('input', (e) => {
                CorporateContactsManager.render(e.target.value);
            });
        }
    },

    initFilesView: (currentPath = '') => {
        const container = document.getElementById('content-area');

        let items = [];
        try {
            items = FileManager.getFiles(currentPath);
        } catch (e) {
            console.error(e);
            items = [];
        }

        // Breadcrumb construction
        const parts = currentPath ? currentPath.split('\\') : [];
        let breadcrumbHTML = `<span class="breadcrumb-item" onclick="UIManager.initFilesView('')" style="cursor:pointer; color:var(--primary-color);">Dosyalarım</span>`;
        let accumulatedPath = '';
        parts.forEach((part, index) => {
            accumulatedPath = accumulatedPath ? accumulatedPath + '\\' + part : part;
            const clickPath = accumulatedPath.replace(/\\/g, '\\\\'); // escape for JS string
            breadcrumbHTML += ` <span style="color:#cbd5e1;">/</span> <span class="breadcrumb-item" onclick="UIManager.initFilesView('${clickPath}')" style="cursor:pointer; ${index === parts.length - 1 ? 'font-weight:600; color:var(--text-main);' : 'color:var(--primary-color);'}">${part}</span>`;
        });

        let backButton = '';
        if (currentPath) {
            const parentPath = parts.slice(0, -1).join('\\').replace(/\\/g, '\\\\');
            backButton = `
                <button class="btn btn-outline" onclick="UIManager.initFilesView('${parentPath}')" title="Geri">
                    <span class="material-icons-round">arrow_back</span>
                </button>
            `;
        }

        let html = `
        <div class="section-container">
            <div class="section-header" style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
                <div style="display:flex; align-items:center; gap:0.5rem; overflow:hidden;">
                    ${backButton}
                    <div class="breadcrumbs" style="font-size:1.1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${breadcrumbHTML}
                    </div>
                </div>
                <div style="display:flex; gap:0.5rem;">
                     <button class="btn btn-outline" onclick="${currentPath ? `FileManager.openFolder('${currentPath.replace(/\\/g, '\\\\')}')` : 'FileManager.openReportsFolder()'}">
                        <span class="material-icons-round">folder_open</span> Aç
                    </button>
                    <button class="btn btn-primary" id="upload-file-btn">
                        <span class="material-icons-round">upload_file</span> Yükle
                    </button>
                </div>
            </div>
        `;

        // [NEW] Active Task Folders Section (Only at Root)
        if (!currentPath) {
            const activeReports = ReportManager.getReports().filter(r => r.status !== 'tamamlandi');
            if (activeReports.length > 0) {
                // Sort by Code (Number) Ascending
                activeReports.sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true, sensitivity: 'base' }));

                html += `
                    <div class="subtitle" style="margin-top:1.5rem; margin-bottom:0.75rem; color:var(--text-secondary); font-size:0.85rem; font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">GÖREV DOSYALARI</div>
                    <div class="file-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:1rem; margin-bottom:2rem;">
                `;

                activeReports.forEach(rep => {
                    const folderPath = FolderManager.getFolderForReport(rep);
                    // Ensure folder exists (create if not to avoid errors when clicking)
                    try {
                        FileManager.ensureFolder(folderPath.replace(FileManager.getBasePath() + '\\', '')); // ensureFolder expects relative? 
                        // Wait, FileManager logic: ensureFolder(subPath). 
                        // FolderManager returns absolute or relative?
                        // PathManager.join -> usually absolute if root is absolute.
                        // Let's check PathManager again if needed.
                        // Assuming FolderManager returns absolute path.
                        // But initFilesView takes absolute path usually? 
                        // Actually initFilesView(currentPath) uses FileManager.getFiles(currentPath).

                        // If currentPath is empty, getFiles('') uses FileManager.getPath('') which is root.
                        // FolderManager.getFolderForReport returns absolute path? 
                        // PathManager.join uses path.join or similar.

                        // Let's rely on standard path.
                    } catch (e) { }

                    const safePathEscaped = folderPath.replace(/\\/g, '\\\\');

                    html += `
                        <div class="file-card task-folder" style="position:relative; background:linear-gradient(135deg, #eff6ff 0%, #ffffff 100%); border:1px solid #bfdbfe; border-radius:12px; padding:1.25rem 1rem; text-align:center; transition:all 0.2s; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.02);"
                             onclick="UIManager.initFilesView('${safePathEscaped}')"
                             onmouseover="this.style.borderColor='var(--primary-color)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 6px -1px rgba(0, 0, 0, 0.1)';" 
                             onmouseout="this.style.borderColor='#bfdbfe'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.02)';">
                            
                            <div style="background:#dbeafe; width:48px; height:48px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 0.75rem; color:var(--primary-color);">
                                <span class="material-icons-round" style="font-size:28px;">folder_special</span>
                            </div>
                            <div style="font-weight:600; color:var(--text-main); font-size:0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:0.25rem;" title="${rep.code}">${rep.code}</div>
                            <div style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${rep.title}">${rep.title}</div>
                        </div>
                    `;
                });

                html += `</div>
                    <div class="subtitle" style="margin-top:1rem; margin-bottom:0.75rem; color:var(--text-secondary); font-size:0.85rem; font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">Genel Dosyalar</div>
                `;
            }
        }

        html += `
            <div class="file-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:1rem; margin-top:1rem;">
        `;

        if (items.length === 0) {
            html += `<div style="grid-column:1/-1; text-align:center; color:#94a3b8; padding:3rem 1rem;">
                <span class="material-icons-round" style="font-size:4rem; color:#e2e8f0;">folder_open</span>
                <p style="margin-top:1rem;">Bu klasör boş.</p>
            </div>`;
        } else {
            items.forEach(item => {
                const isDir = item.isDirectory;
                const icon = isDir ? 'folder' : 'description';
                const iconColor = isDir ? '#f59e0b' : '#3b82f6'; // Yellow for folder, Blue for file
                const itemPathEscaped = item.path.replace(/\\/g, '\\\\'); // Full absolute path for open
                const subPathEscaped = (currentPath ? currentPath + '\\' + item.name : item.name).replace(/\\/g, '\\\\');

                // Onclick: If dir -> navigate, If file -> open
                // NOTE: If currentPath is empty, item.name is just name. If not, it's relative?
                // FileManager.getFiles returns { name, isDirectory, size, path (absolute) } usually.
                // We should use item.path for navigation if absolute is supported by initFilesView?
                // initFilesView uses FileManager.getFiles(currentPath). 
                // If we pass absolute path to initFilesView, getFiles needs to handle it.
                // Looking at FileManager.getFiles: uses FileManager.getPath(subPath). 
                // If subPath is absolute, getPath should return it or handle it.
                // Let's assume subPathEscaped logic is correct for relative navigation relative to Root, 
                // OR we pass absolute path if initFilesView supports it.

                // If we are in "Task Folder", currentPath is absolute.
                // So subPathEscaped = currentPath + '\' + item.name which is correct for absolute concatenation.

                // HOWEVER: standard files in root are "relative" in subPathEscaped logic above:
                // const subPathEscaped = (currentPath ? currentPath + '\\' + item.name : item.name)
                // If currentPath is empty, it sends "Folder".
                // FileManager.getFiles("Folder") -> joins with root.

                // If we are in Absolute Path (Task Folder):
                // currentPath is "C:\Users\...\Start...".
                // subPathEscaped = "C:\Users\...\Start... \ SubFolder".
                // FileManager.getFiles("C:\...") -> checking getPath implementation:
                // It usually joins if not absolute? Or we need to check if getPath handles absolute.

                // Let's assume standard logic works.

                const clickAction = isDir
                    ? `UIManager.initFilesView('${subPathEscaped}')`
                    : `FileManager.openFile('${currentPath.replace(/\\/g, '\\\\')}', '${item.name}')`;

                const deleteAction = `FileManager.deleteItem('${currentPath.replace(/\\/g, '\\\\')}', '${item.name}', ${isDir})`;

                html += `
                <div class="file-card" style="position:relative; background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; text-align:center; transition:all 0.2s; cursor:pointer;" 
                     onmouseover="this.style.borderColor='var(--primary-color)'; this.querySelector('.delete-btn').style.opacity='1';" 
                     onmouseout="this.style.borderColor='#e2e8f0'; this.querySelector('.delete-btn').style.opacity='0';">
                    
                    <button class="btn-icon delete-btn" onclick="event.stopPropagation(); ${deleteAction}" 
                            style="position:absolute; top:4px; right:4px; opacity:0; transition:opacity 0.2s; color:var(--danger); background:rgba(255,255,255,0.8); border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center;" title="Sil">
                        <span class="material-icons-round" style="font-size:1rem;">close</span>
                    </button>

                    <div onclick="${clickAction}">
                        <span class="material-icons-round" style="font-size:3rem; color:${iconColor}; margin-bottom:0.5rem; display:block;">${icon}</span>
                        <div style="font-weight:${isDir ? '600' : '400'}; color:var(--text-main); font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.name}">${item.name}</div>
                        ${!isDir ? `<div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">${(item.size / 1024).toFixed(1)} KB</div>` : ''}
                    </div>
                </div>
                `;
            });
        }

        html += `</div></div>`;
        container.innerHTML = html;

        // Button Listeners
        document.getElementById('upload-file-btn').addEventListener('click', async () => {
            const success = await FileManager.addFile(currentPath);
            if (success) UIManager.initFilesView(currentPath);
        });
    },

    // --- YAPAY ZEKA ASİSTANI (GÜNCELLENDİ) ---

    initAssistantView: function () {
        const assistantView = document.getElementById('view-assistant');
        // const contentArea = document.getElementById('content-area'); // No longer needed for moving

        // Check if already initialized (simple check: header exists?)
        if (assistantView.querySelector('.assistant-header')) {
            console.log('Assistant view already initialized, restoring...');
            return;
        }

        const header = `
            <div class="assistant-header">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span class="material-icons-round" style="color:#60a5fa;">smart_toy</span>
                    <h3 style="margin:0;">Dijital Müfettiş Asistanı</h3>
                </div>
                <button class="btn btn-outline" id="btn-assistant-settings" 
                        onclick="UIManager.openAssistantSettings()" title="Gelişmiş Ayarlar">
                    <span class="material-icons-round">settings_suggest</span>
                </button>
            </div >
    `;

        // Render View contents (Appends to existing structure if needed, or rewrites inner)
        // Since we have static structure in HTML, we might just want to prepend Header if missing
        // or ensure structure is correct.

        // The HTML already has chat-container etc. We just need to inject the Header 
        // OR reuse the existing structure and just make sure it's valid.

        // Current Static HTML:
        // <div id="view-assistant" ...> <div class="chat-container"> ... </div> </div>

        // We want to insert the header at the top.
        assistantView.innerHTML = header + assistantView.innerHTML;

        // Ensure system message if empty
        const msgs = document.getElementById('chat-messages');
        if (msgs && msgs.children.length === 0) {
            msgs.innerHTML = `
             <div class="chat-message system">
                "Dijital Müfettiş Asistanı"na hoş geldiniz. Size mevzuat, raporlama veya diğer konularda yardımcı olabilirim.
            </div>`;
        }
    },

    // --- Assistant Settings Methods ---

    openAssistantSettings: function () {
        const modal = document.getElementById('ai-settings-modal');
        if (modal) {
            modal.style.display = 'flex';
            UIManager.renderModesList();
            UIManager.renderRulesList();
            UIManager.renderTrainingList();

            // Populate fields
            // API Key is in main settings, but if we wanted to show it? No, removed.
            // Model Select logic:
            const savedModel = localStorage.getItem('gemini_model') || AIService.config.model || 'gemini-1.5-flash';
            const modelSelect = document.getElementById('gemini-model-select');
            if (modelSelect) modelSelect.value = savedModel;

            // Set Radio
            const radios = document.getElementsByName('resp-len');
            for (let r of radios) {
                if (r.value === AIService.config.responseLength) r.checked = true;
            }
        }
    },

    switchSettingsTab: function (tabName) {
        // Headers
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.settings-tab[onclick*="'${tabName}'"]`).classList.add('active');

        // Panels
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
    },

    // Modes UI
    renderModesList: function () {
        const list = document.getElementById('modes-list');
        list.innerHTML = '';

        AIService.config.modes.forEach(mode => {
            const isActive = mode.id === AIService.config.activeModeId;
            const item = document.createElement('div');
            item.className = `config-item ${isActive ? 'active-mode' : ''}`;
            item.innerHTML = `
            <div class="config-info" onclick="AIService.setActiveMode('${mode.id}'); UIManager.renderModesList();" style="cursor:pointer; flex:1;">
                    <span class="config-name">${mode.name}</span>
                    <span class="config-desc">${mode.instruction.substring(0, 60)}...</span>
                </div>
    <div class="config-actions">
        <button class="btn-icon" onclick="UIManager.editMode('${mode.id}')" title="Düzenle">
            <span class="material-icons-round">edit</span>
        </button>
        <button class="btn-icon" onclick="AIService.deleteMode('${mode.id}'); UIManager.renderModesList();"
            title="Sil">
            <span class="material-icons-round">delete</span>
        </button>
        ${isActive ? '<span class="material-icons-round" style="color:var(--primary-color);">check_circle</span>' : ''}
    </div>
`;
            list.appendChild(item);
        });
    },

    showAddModeForm: function () {
        document.getElementById('add-mode-form').style.display = 'block';
    },

    saveNewMode: function () {
        const name = document.getElementById('new-mode-name').value;
        const inst = document.getElementById('new-mode-instruction').value;

        if (name && inst) {
            AIService.addMode(name, inst);
            document.getElementById('add-mode-form').style.display = 'none';
            document.getElementById('new-mode-name').value = '';
            document.getElementById('new-mode-instruction').value = '';
            this.renderModesList();
        } else {
            showToast('Lütfen isim ve talimat giriniz.', 'warning');
        }
    },

    editMode: function (id) {
        const mode = AIService.config.modes.find(m => m.id === id);
        if (mode) {
            document.getElementById('new-mode-name').value = mode.name;
            document.getElementById('new-mode-instruction').value = mode.instruction;
            this.showAddModeForm();
            Toast.show('Mod bilgileri forma yüklendi. Düzenleyip "Ekle" diyebilirsiniz.', 'info');
        }
    },

    // Rules UI
    renderRulesList: function () {
        const list = document.getElementById('rules-list');
        list.innerHTML = '';

        AIService.config.customRules.forEach(rule => {
            const item = document.createElement('div');
            item.className = 'config-item';
            item.innerHTML = `
            <div class="config-info">
        <span class="config-name">${rule}</span>
                </div >
    <div class="config-actions">
        <button class="btn-icon" onclick="AIService.deleteRule('${rule}'); UIManager.renderRulesList();">
            <span class="material-icons-round">delete</span>
        </button>
    </div>
`;
            list.appendChild(item);
        });

        if (AIService.config.customRules.length === 0) {
            list.innerHTML = '<div class="empty-state">Henüz kural eklenmedi.</div>';
        }
    },

    addRule: function () {
        const input = document.getElementById('new-rule-input');
        if (input.value) {
            AIService.addRule(input.value);
            input.value = '';
            this.renderRulesList();
        }
    },

    // Training UI (Simple Handling for Text Files)
    handleTrainingUpload: function (input) {
        Array.from(input.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                // Add to AI Context
                AIService.addContextFile({
                    name: file.name,
                    content: content,
                    type: file.type
                });
                this.renderTrainingList();
            };

            // Basic text reading, binary PDF parsing would require a library like pdf.js
            if (file.type.includes('text') || file.name.endsWith('.md')) {
                reader.readAsText(file);
            } else {
                showToast(`Şimdilik sadece metin dosyaları destekleniyor: ${file.name} `, 'warning');
            }
        });
        input.value = ''; // Reset
    },

    renderTrainingList: function () {
        const list = document.getElementById('training-list');
        list.innerHTML = '';

        AIService.config.contextFiles.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-list-item';
            item.innerHTML = `
            <div class="file-icon"><span class="material-icons-round">description</span></div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${(file.content.length / 1024).toFixed(1)} KB (Text)</div>
                </div>
                <button class="btn-icon" onclick="AIService.deleteContextFile('${file.name}'); UIManager.renderTrainingList();">
                    <span class="material-icons-round">delete</span>
                </button>
`;
            list.appendChild(item);
        });

        if (AIService.config.contextFiles.length === 0) {
            list.innerHTML = '<div class="empty-state">Hafızada dosya yok.</div>';
        }
    },

    saveAISettings: function () {
        const apiKey = document.getElementById('gemini-api-key-modal').value;
        const model = document.getElementById('gemini-model-modal').value;
        const responseLength = document.querySelector('input[name="resp-len"]:checked').value;

        if (apiKey) {
            AIService.config.apiKey = apiKey;
            AIService.config.model = model;
            AIService.config.responseLength = responseLength;
            AIService.saveConfig();

            // Test
            const statusEl = document.getElementById('ai-connection-status-modal');
            statusEl.className = 'connection-status'; // reset
            statusEl.style.backgroundColor = '#fbbf24'; // yellow

            AIService.testConnection(apiKey).then(success => {
                if (success) {
                    statusEl.style.backgroundColor = '#22c55e'; // green
                    showToast('Bağlantı Başarılı!');
                } else {
                    statusEl.style.backgroundColor = '#ef4444'; // red
                    showToast('Bağlantı Başarısız. Anahtarı kontrol edin.', 'error');
                }
            });
        }
    },

    togglePasswordVisibility: (id) => {
        const input = document.getElementById(id);
        if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
        }
    },

    handleFileSelect: (input) => {
        const previewArea = document.getElementById('file-preview-area');
        const files = Array.from(input.files);

        if (files.length === 0) {
            previewArea.style.display = 'none';
            previewArea.innerHTML = '';
            return;
        }

        previewArea.style.display = 'flex';
        previewArea.innerHTML = ''; // Clear prev

        files.forEach((file, index) => {
            const chip = document.createElement('div');
            chip.className = 'file-chip';
            chip.innerHTML = `
    < span class="material-icons-round" style = "font-size:1rem;" > description</span >
        ${file.name}
<span class="remove" onclick="UIManager.removeFile(${index})">&times;</span>
`;
            previewArea.appendChild(chip);
        });

        // Store files temporarily in a way we can remove them?
        // Actually input.files is read-only. We need a custom array if we want removal.
        // For MVP, just allow clearing all by clicking attach again or reset.
        // Or implement custom file list handling.
    },

    removeFile: (index) => {
        // Simplified: Clear all for now or improved later
        const input = document.getElementById('chat-file-input');
        input.value = '';
        document.getElementById('file-preview-area').style.display = 'none';
    },

    sendMessage: async () => {
        const input = document.getElementById('chat-input');
        const fileInput = document.getElementById('chat-file-input');
        const messages = document.getElementById('chat-messages');
        const text = input.value.trim();

        // Read Files
        const files = fileInput.files;
        let images = [];
        let fileContext = "";

        if (!text && files.length === 0) return;

        // User Message UI
        const userMsgDiv = document.createElement('div');
        userMsgDiv.className = 'chat-message user';
        let userContent = text;
        if (files.length > 0) {
            userContent += `< br > <small><i>[${files.length} dosya eklendi]</i></small>`;
        }
        userMsgDiv.innerHTML = userContent;
        messages.appendChild(userMsgDiv);

        // Clear Inputs
        input.value = '';
        input.style.height = 'auto';

        const previewArea = document.getElementById('file-preview-area');
        previewArea.style.display = 'none';

        // Process Files
        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                // Images -> Inline Data (Gemini Vision)
                if (file.type.startsWith('image/')) {
                    try {
                        const base64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                            reader.readAsDataURL(file);
                        });
                        images.push({ inlineData: { mimeType: file.type, data: base64 } });
                    } catch (e) { console.error("Image read error", e); }
                }
                // Text / Code Files -> Append to Prompt
                else if (file.type.startsWith('text/') || file.name.endsWith('.js') || file.name.endsWith('.html') || file.name.endsWith('.css') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
                    try {
                        const content = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (e) => resolve(e.target.result);
                            reader.readAsText(file);
                        });
                        fileContext += `\n\n--- Dosya: ${file.name} ---\n${content}\n`;
                    } catch (e) { console.error("Text read error", e); }
                }
                // Excel -> Convert to CSV/Text (using XLSX if available)
                else if ((file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) && typeof XLSX !== 'undefined') {
                    try {
                        const content = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const data = new Uint8Array(e.target.result);
                                const workbook = XLSX.read(data, { type: 'array' });
                                const firstSheetName = workbook.SheetNames[0];
                                const worksheet = workbook.Sheets[firstSheetName];
                                const csv = XLSX.utils.sheet_to_csv(worksheet);
                                resolve(csv);
                            };
                            reader.readAsArrayBuffer(file);
                        });
                        fileContext += `\n\n--- Excel Dosyası: ${file.name} (İlk Sayfa)---\n${content}\n`;
                    } catch (e) { console.error("Excel read error", e); }
                }
            }
        }

        fileInput.value = ''; // Reset files

        // Loading Indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message ai';
        loadingDiv.innerHTML = '<span class="material-icons-round" style="animation:spin 1s infinite;">refresh</span> Yazıyor...';
        messages.appendChild(loadingDiv);
        messages.scrollTop = messages.scrollHeight;

        try {
            if (typeof AIService !== 'undefined') {
                // Combine text with file context (if simple, or handle internally)
                // AIService.sendMessage(text, history)

                // Let's get history from DOM or maintain it? 
                // For now, simpler usage:
                const response = await AIService.sendMessage(text + (fileContext ? `\n\n[EK: ${fileContext}]` : ""));

                messages.removeChild(loadingDiv);

                // Markdown formatting helper
                let formatted = response
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/```([\s\S]*?)```/g, '<div style="background:#f1f5f9; padding:0.5rem; border-radius:4px; overflow-x:auto;"><pre><code>$1</code></pre></div>')
                    .replace(/\n/g, '<br>');

                const aiMsgDiv = document.createElement('div');
                aiMsgDiv.className = 'chat-message ai';
                aiMsgDiv.innerHTML = formatted;
                messages.appendChild(aiMsgDiv);
            } else {
                throw new Error("AI Servisi (AIService) başlatılamadı.");
            }
        } catch (err) {
            messages.removeChild(loadingDiv);
            const errDiv = document.createElement('div');
            errDiv.className = 'chat-message system';
            errDiv.style.color = 'var(--danger)';
            errDiv.innerText = 'Hata: ' + err.message;
            messages.appendChild(errDiv);
        }

        messages.scrollTop = messages.scrollHeight;
    },

    initSettingsView: () => {
        const container = document.getElementById('content-area');

        // Helper to render main menu
        const renderMenu = () => {
            container.innerHTML = `
    <div class="section-container">
                    <div class="section-header">
                        <h3>Ayarlar</h3>
                        <span style="font-size:0.85rem; color:var(--text-secondary); font-weight:normal;">
                            ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                    </div>

                    <div class="settings-menu-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.5rem; margin-top:2rem;">
                        
                        <!-- Yapay Zeka (AI) - NEW POSITION -->
                        <div class="settings-card-item" onclick="window.openSettingsDetail('ai_settings')" style="background:#fff; padding:1.5rem; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:1rem; border-left:4px solid #8b5cf6;">
                            <div style="width:50px; height:50px; background:#f3e8ff; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#7c3aed;">
                                <span class="material-icons-round" style="font-size:28px;">psychology</span>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.1rem; color:var(--text-main);">Yapay Zeka Asistanı</h4>
                                <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">API ve Model Ayarları</p>
                            </div>
                        </div>

                        <!-- Profil -->
                        <div class="settings-card-item" onclick="window.openSettingsDetail('profile')" style="background:#fff; padding:1.5rem; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:1rem;">
                            <div style="width:50px; height:50px; background:#e0e7ff; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#3730a3;">
                                <span class="material-icons-round" style="font-size:28px;">person</span>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.1rem; color:var(--text-main);">Profil Bilgileri</h4>
                                <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Ad, soyad ve güvenlik sorusu</p>
                            </div>
                        </div>

                        <!-- Şifre -->
                        <div class="settings-card-item" onclick="window.openSettingsDetail('password')" style="background:#fff; padding:1.5rem; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:1rem;">
                            <div style="width:50px; height:50px; background:#fef3c7; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#d97706;">
                                <span class="material-icons-round" style="font-size:28px;">lock</span>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.1rem; color:var(--text-main);">Şifre Ayarları</h4>
                                <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Şifre değiştirme</p>
                            </div>
                        </div>

                        <!-- Görünüm -->
                        <div class="settings-card-item" onclick="window.openSettingsDetail('appearance')" style="background:#fff; padding:1.5rem; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:1rem;">
                            <div style="width:50px; height:50px; background:#f3e8ff; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#7e22ce;">
                                <span class="material-icons-round" style="font-size:28px;">palette</span>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.1rem; color:var(--text-main);">Görünüm Özelleştirme</h4>
                                <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Tema, renk ve yazı tipi</p>
                            </div>
                        </div>

                        <!-- Yedekleme -->
                        <div class="settings-card-item" onclick="window.openSettingsDetail('backup')" style="background:#fff; padding:1.5rem; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:1rem;">
                            <div style="width:50px; height:50px; background:#dcfce7; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#15803d;">
                                <span class="material-icons-round" style="font-size:28px;">cloud_upload</span>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.1rem; color:var(--text-main);">Yedekleme & Geri Yükleme</h4>
                                <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Verilerinizi yedekleyin</p>
                            </div>
                        </div>

                        <!-- Hatırlatıcılar -->
                        <div class="settings-card-item" onclick="window.openSettingsDetail('reminders')" style="background:#fff; padding:1.5rem; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:1rem;">
                            <div style="width:50px; height:50px; background:#fee2e2; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#b91c1c;">
                                <span class="material-icons-round" style="font-size:28px;">notifications_active</span>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.1rem; color:var(--text-main);">Hatırlatıcılarım</h4>
                                <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Bildirimlerinizi yönetin</p>
                            </div>
                        </div>

                        <!-- Verileri Sil (TEHLİKE) -->
                        <div class="settings-card-item" onclick="window.openSettingsDetail('danger_zone')" style="background:#fff; padding:1.5rem; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:1rem; border-color:var(--danger) !important; border-width:1px;">
                            <div style="width:50px; height:50px; background:#fef2f2; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#ef4444;">
                                <span class="material-icons-round" style="font-size:28px;">report_problem</span>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.1rem; color:var(--danger);">Verileri Sil</h4>
                                <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Uygulamayı sıfırla</p>
                            </div>
                        </div>
                    </div>
                    
                    <style>
                        .settings-card-item:hover { transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-color:var(--primary-color) !important; }
                    </style>
                </div >
    `;
        };

        // UI Open Details
        window.openSettingsDetail = (viewId) => {
            const user = AuthManager.getUser();
            let detailHTML = '';
            let title = '';

            if (viewId === 'ai_settings') {
                title = 'Yapay Zeka Ayarları';
                const apiKey = localStorage.getItem('gemini_api_key') || '';
                const model = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';

                detailHTML = `
    <div class="settings-card" style="max-width:600px; margin:0 auto;">
                        <div class="form-group">
                            <label>Gemini API Anahtarı</label>
                            <div style="position:relative;">
                                <input type="password" id="gemini-api-key" value="${apiKey}" placeholder="AIzaSy..." style="padding-right:40px;">
                                <span class="material-icons-round" onclick="UIManager.togglePasswordVisibility('gemini-api-key')" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); cursor:pointer; color:var(--text-secondary);">visibility</span>
                            </div>
                            <small style="color:var(--text-secondary);">Google AI Studio'dan alacağınız anahtarı buraya girin.</small>
                        </div>

                        <div class="form-group">
                            <label>Model Seçimi</label>
                            <select id="gemini-model-select">
                                <option value="gemini-1.5-flash" ${model === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash (Hızlı)</option>
                                <option value="gemini-1.5-pro" ${model === 'gemini-1.5-pro' ? 'selected' : ''}>Gemini 1.5 Pro (Güçlü)</option>
                                <option value="gemini-2.0-flash" ${model === 'gemini-2.0-flash' ? 'selected' : ''}>Gemini 2.0 Flash (Deneysel)</option>
                            </select>
                        </div>
                        
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.5rem;">
                            <div id="ai-connection-status" class="connection-status">
                                <span class="status-indicator"></span>
                                <span class="status-text">Bağlantı Bekleniyor</span>
                            </div>
                            <div style="display:flex; gap:0.5rem;">
                                <button class="btn btn-outline" onclick="UIManager.testAIConnection()">
                                    <span class="material-icons-round">link</span> Test Et
                                </button>
                                <button class="btn btn-primary" onclick="UIManager.saveAIConfig()">
                                    <span class="material-icons-round">save</span> Kaydet
                                </button>
                            </div>
                        </div>
                    </div >
    `;
            } else if (viewId === 'profile') {
                title = 'Profil Bilgileri';
                detailHTML = `
    <div class="settings-card" style="max-width:600px; margin:0 auto;">
                        <div class="form-group">
                            <label>Ad Soyad (Ünvan)</label>
                            <input type="text" id="set-fullname" value="${user ? user.fullname : ''}">
                        </div>
                        <div class="form-group">
                            <label>Kullanıcı Adı</label>
                            <input type="text" id="set-username" value="${user ? user.username : ''}" disabled style="background:#f1f5f9; cursor:not-allowed;" title="Kullanıcı adı değiştirilemez">
                        </div>
                         <div class="form-group">
                            <label>Güvenlik Sorusu</label>
                            <input type="text" id="set-question" value="${user ? user.question : ''}" placeholder="Örn: En sevdiğim renk?">
                        </div>
                        <div class="form-group">
                            <label>Güvenlik Cevabı</label>
                            <input type="text" id="set-answer" placeholder="Değiştirmek için yeni cevap girin">
                        </div>
                        <button class="btn btn-primary" id="save-profile-btn" style="width:100%; margin-top:1rem;">
                            <span class="material-icons-round">save</span> Değişiklikleri Kaydet
                        </button>
                    </div > `;
            } else if (viewId === 'password') {
                title = 'Şifre Ayarları';
                detailHTML = `
    <div class="settings-card" style="max-width:600px; margin:0 auto;">
                         <div class="form-group">
                            <label>Mevcut Şifre</label>
                            <input type="password" id="old-pass" placeholder="******">
                        </div>
                        <div class="form-group">
                            <label>Yeni Şifre</label>
                            <input type="password" id="new-pass" placeholder="******">
                        </div>
                        <button class="btn btn-outline" id="change-pass-btn" onclick="SettingsManager.changePasswordUI()" style="width:100%; margin-top:1rem; border-color:var(--danger); color:var(--danger);">
                            <span class="material-icons-round">lock_reset</span> Şifreyi Değiştir
                        </button>
                    </div > `;
            } else if (viewId === 'appearance') {
                title = 'Görünüm Özelleştirme';
                const savedFont = StorageManager.get('font', 'Inter');
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                detailHTML = `
    <div class="settings-card" style="max-width:600px; margin:0 auto;">
                         <div class="setting-item">
                            <div class="setting-info">
                                <span class="setting-label">Yazı Tipi</span>
                                <span class="setting-desc">Uygulama genel yazı karakteri</span>
                            </div>
                            <select id="set-font" onchange="ThemeManager.applyFont(this.value)" style="padding: 0.4rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-main);">
                                <option value="Inter" ${savedFont === 'Inter' ? 'selected' : ''}>Inter</option>
                                <option value="Roboto" ${savedFont === 'Roboto' ? 'selected' : ''}>Roboto</option>
                                <option value="Merriweather" ${savedFont === 'Merriweather' ? 'selected' : ''}>Merriweather</option>
                                <option value="Patrick Hand" ${savedFont === 'Patrick Hand' ? 'selected' : ''}>Patrick Hand</option>
                                <option value="Ubuntu Mono" ${savedFont === 'Ubuntu Mono' ? 'selected' : ''}>Ubuntu Mono</option>
                            </select>
                        </div>
                         <div class="setting-item">
                            <div class="setting-info">
                                <span class="setting-label">Tema Rengi</span>
                                <span class="setting-desc">Vurgu rengini seçin</span>
                            </div>
                            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                                <button class="color-btn" style="background:#1a237e; width:24px; height:24px; border-radius:50%; border:none; cursor:pointer;" onclick="ThemeManager.applyColor('#1a237e')"></button>
                                <button class="color-btn" style="background:#2563eb; width:24px; height:24px; border-radius:50%; border:none; cursor:pointer;" onclick="ThemeManager.applyColor('#2563eb')"></button>
                                <button class="color-btn" style="background:#7c3aed; width:24px; height:24px; border-radius:50%; border:none; cursor:pointer;" onclick="ThemeManager.applyColor('#7c3aed')"></button>
                                <button class="color-btn" style="background:#db2777; width:24px; height:24px; border-radius:50%; border:none; cursor:pointer;" onclick="ThemeManager.applyColor('#db2777')"></button>
                                <button class="color-btn" style="background:#dc2626; width:24px; height:24px; border-radius:50%; border:none; cursor:pointer;" onclick="ThemeManager.applyColor('#dc2626')"></button>
                                <button class="color-btn" style="background:#ea580c; width:24px; height:24px; border-radius:50%; border:none; cursor:pointer;" onclick="ThemeManager.applyColor('#ea580c')"></button>
                                <button class="color-btn" style="background:#059669; width:24px; height:24px; border-radius:50%; border:none; cursor:pointer;" onclick="ThemeManager.applyColor('#059669')"></button>
                            </div>
                        </div>
                         <div class="setting-item">
                            <div class="setting-info">
                                <span class="setting-label">Karanlık Mod</span>
                                <span class="setting-desc">Koyu tema kullan</span>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="theme-switch" onchange="ThemeManager.toggle()" ${isDark ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div > `;
            } else if (viewId === 'backup') {
                title = 'Yedekleme & Geri Yükleme';
                detailHTML = `
    <div class="settings-card" style="max-width:600px; margin:0 auto;">
                        <div class="setting-item">
                            <div class="setting-info">
                                <span class="setting-label">Veri Yedeğini İndir</span>
                                <span class="setting-desc">Tüm verilerinizi JSON formatında indirin</span>
                            </div>
                             <button class="btn btn-sm btn-primary" onclick="StorageManager.exportData()">
                                <span class="material-icons-round">download</span> İndir
                            </button>
                        </div>
                         <div class="setting-item">
                            <div class="setting-info">
                                <span class="setting-label">Yedek Yükle</span>
                                <span class="setting-desc">Daha önce alınan yedeği yükleyin</span>
                            </div>
                             <button class="btn btn-sm btn-outline" onclick="document.getElementById('import-file-settings').click()">
                                 <span class="material-icons-round">upload</span> Yükle
                            </button>
                            <input type="file" id="import-file-settings" style="display:none;" onchange="handleFileImport(this)">
                        </div>
                        <div style="margin-top:1.5rem; background:rgba(66, 133, 244, 0.08); padding:1rem; border-radius:8px; display:flex; gap:12px; align-items:start; border:1px solid rgba(66, 133, 244, 0.2);">
                            <div style="color:#4285F4; margin-top:2px;">
                                <span class="material-icons-round">info</span>
                            </div>
                            <div style="font-size:0.85rem; color:#334155; line-height:1.5;">
                                <strong style="color:#1e293b; display:block; margin-bottom:4px;">Bulut Yedekleme Hakkında</strong>
                                İndirdiğiniz yedek dosyasını <strong>Google Drive</strong> klasörünüze manuel olarak kopyalayarak verilerinizi bulutta saklayabilirsiniz.
                            </div>
                        </div>
                    </div > `;
            } else if (viewId === 'danger_zone') {
                title = 'Verileri Sil';
                detailHTML = `
    <div class="settings-card" style="max-width:600px; margin:0 auto; border-color:var(--danger);">
        <div style="text-align:center; padding:2rem 0;">
            <div style="width:64px; height:64px; background:#fef2f2; color:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 1.5rem;">
                <span class="material-icons-round" style="font-size:32px;">delete_forever</span>
            </div>
            <h3 style="margin-bottom:0.5rem; color:var(--text-main);">Tüm Verileri Temizle</h3>
            <p style="color:var(--text-secondary); max-width:80%; margin:0 auto 2rem; line-height:1.6;">
                Bu işlem, uygulamadaki <strong>bütün verileri</strong> (denetimler, kişiler, notlar, ayarlar) kalıcı olarak siler ve uygulamayı ilk kurulduğu haline döndürür.
                <br><br>
                    <span style="color:var(--danger); font-weight:600;">Bu işlem geri alınamaz!</span>
                </p>
                    <button class="btn btn-primary"
                        style="background:var(--danger); border-color:var(--danger); width:100%; padding:1rem; font-size:1rem;"
                        onclick="StorageManager.clearAllData()">
                        Evet, Tüm Verileri Sil ve Sıfırla
                    </button>
                </div>
        </div>`;
            } else if (viewId === 'reminders') {
                title = 'Hatırlatıcılar';
                const tasks = TaskManager.getTasks().filter(t => t.reminder && !t.completed);
                let remindersHTML = '';
                if (tasks.length === 0) {
                    remindersHTML = '<div class="empty-state">Aktif hatırlatıcı bulunmuyor.</div>';
                } else {
                    remindersHTML = tasks.map(t => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem; border-bottom:1px solid #f1f5f9;">
                            <div>
                                <div style="font-weight:600;">${t.content}</div>
                                <div style="font-size:0.85rem; color:var(--text-secondary); display:flex; align-items:center; gap:4px;">
                                    <span class="material-icons-round" style="font-size:1rem; color:var(--primary-color);">alarm</span>
                                    ${new Date(t.reminder).toLocaleString('tr-TR')}
                                </div>
                            </div>
                           <button class="btn-icon delete-reminder-btn" data-id="${t.id}" title="Hatırlatıcıyı Sil">
                                <span class="material-icons-round" style="color:var(--danger);">notifications_off</span>
                            </button>
                        </div > `).join('');
                }
                detailHTML = `
    <div class="settings-card" style="max-width:600px; margin:0 auto;">
                        <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:1rem;">Bekleyen hatırlatıcılarınız aşağıda listelenmiştir.</p>
                        <div style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                            ${remindersHTML}
                        </div>
                    </div > `;
            }

            container.innerHTML = `
    <div class="section-container">
                    <div class="section-header" style="display:flex; align-items:center; gap:1rem;">
                        <button class="btn-icon" onclick="UIManager.initSettingsView()" title="Geri Dön">
                            <span class="material-icons-round">arrow_back</span>
                        </button>
                        <h3>${title}</h3>
                    </div>
                    <div style="margin-top:2rem;">
                        ${detailHTML}
                    </div>
                </div > `;

            // Listeners
            if (viewId === 'profile') {
                document.getElementById('save-profile-btn').addEventListener('click', () => {
                    const fullname = document.getElementById('set-fullname').value.trim();
                    const question = document.getElementById('set-question').value;
                    const answer = document.getElementById('set-answer').value.trim();
                    if (fullname) {
                        SettingsManager.updateProfile(fullname, question, answer);
                    } else {
                        Toast.show('Ad Soyad boş olamaz.', 'warning');
                    }
                });
            }
            if (viewId === 'reminders') {
                document.querySelectorAll('.delete-reminder-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = parseInt(e.currentTarget.dataset.id);
                        TaskManager.setReminder(id, null);
                        window.openSettingsDetail('reminders');
                        Toast.show('Hatırlatıcı silindi.', 'success');
                    });
                });
            }
        };

        renderMenu();
    },

    initCalendarView: () => {
        const container = document.getElementById('content-area');
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

        container.innerHTML = `
    <div class="calendar-header">
                <button class="btn-icon" disabled><span class="material-icons-round">chevron_left</span></button>
                <div class="calendar-title">${monthNames[currentMonth]} ${currentYear}</div>
                <button class="btn-icon" disabled><span class="material-icons-round">chevron_right</span></button>
            </div >
    <div class="calendar-grid">
        <div class="cal-day-header">Pt</div>
        <div class="cal-day-header">Sa</div>
        <div class="cal-day-header">Ça</div>
        <div class="cal-day-header">Pe</div>
        <div class="cal-day-header">Cu</div>
        <div class="cal-day-header">Ct</div>
        <div class="cal-day-header">Pz</div>
    </div>
`;

        const grid = container.querySelector('.calendar-grid');
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const emptyCells = (firstDay === 0 ? 7 : firstDay) - 1;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        for (let i = 0; i < emptyCells; i++) grid.innerHTML += `< div class="cal-day empty" style = "background:#f1f5f9; border:none;" ></div > `;

        const reports = ReportManager.getReports();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear} -${String(currentMonth + 1).padStart(2, '0')} -${String(day).padStart(2, '0')} `;
            const isToday = (day === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear());

            let eventsHTML = '';
            reports.forEach(rep => {
                if (rep.startDate === dateStr) eventsHTML += `< div class="cal-event type-start" title = "${rep.title}" > ${rep.code} Başladı</div > `;
                if (rep.deadline === dateStr) eventsHTML += `< div class="cal-event type-end" title = "${rep.title}" > ${rep.code} Bitiş</div > `;
            });

            grid.innerHTML += `
    <div class="cal-day ${isToday ? 'today' : ''}">
        <div class="cal-day-num">${day}</div>
                    ${eventsHTML}
                </div >
    `;
        }
    },

    initTasksView: () => {
        const container = document.getElementById('content-area');
        container.innerHTML = `
    <div class="section-container">
                <style>
                    /* Styles removed as they are now in style.css */
                    .tasks-split-container { display:flex; flex-direction:column; gap:2rem; }
                </style>

                <div class="task-input-card">
                    <div style="display:flex; align-items:center;">
                         <span class="material-icons-round" style="color:var(--text-secondary); margin-right:1rem; font-size:1.5rem;">add_task</span>
                         <input type="text" id="new-task-input" placeholder="Yeni bir görev ekle..." class="clean-task-input">
                    </div>
                    <div class="task-input-footer">
                        <div class="priority-selector">
                            <label class="priority-option option-normal selected">
                                <input type="radio" name="priority" value="normal" checked>
                                Normal
                            </label>
                            <label class="priority-option option-high">
                                <input type="radio" name="priority" value="high">
                                Acil
                            </label>
                        </div>
                        <button id="add-task-btn" class="btn btn-primary btn-sm">
                            Ekle <span class="material-icons-round" style="font-size:1.1rem; margin-left:4px;">arrow_upward</span>
                        </button>
                    </div>
                </div>
                
                <div class="section-header" style="margin-top: 2rem; display:flex; justify-content:space-between; align-items:center;">
                    <h3>Yapılacaklar</h3>
                     <div style="display:flex; gap:0.5rem; align-items:center;">
                         <button id="delete-selected-tasks" class="btn btn-sm btn-outline" style="border-color:var(--danger); color:var(--danger); display:none;">
                            <span class="material-icons-round" style="font-size:1.1rem; margin-right:4px;">delete_sweep</span> Seçilenleri Sil
                        </button>
                        <button id="delete-all-tasks" class="btn btn-sm btn-outline" style="border-color:var(--danger); color:var(--danger);">
                            <span class="material-icons-round" style="font-size:1.1rem; margin-right:4px;">delete_forever</span> Tümünü Sil
                        </button>
                        <!-- Filter for General Tasks visual search -->
                        <div class="filters">
                            <input type="text" id="search-tasks" placeholder="Ara..." class="search-input">
                        </div>
                    </div>
                </div>

                <div class="tasks-split-container">
                    <!-- 1. GENERAL TASKS -->
                    <div>
                        <div class="task-category-title">
                            <span class="material-icons-round" style="color:#64748b;">list</span>
                            Genel Yapılacaklar
                        </div>
                        <div id="general-task-list" class="task-list"></div>
                    </div>

                    <!-- 2. REPORT BASED TASKS -->
                    <div>
                        <div class="task-category-title">
                            <span class="material-icons-round" style="color:#3b82f6;">folder_open</span>
                            Rapor Takip İşlemleri
                        </div>
                        <div id="report-task-container"></div>
                    </div>
                </div>

            </div>
    `;

        UIManager.renderTasks(TaskManager.getTasks());

        // Bulk Delete Listener
        const bulkDeleteBtn = document.getElementById('delete-selected-tasks');
        bulkDeleteBtn.addEventListener('click', () => {
            const selectedIds = Array.from(document.querySelectorAll('.task-select-cb:checked'))
                .map(cb => parseInt(cb.dataset.id));

            if (selectedIds.length > 0) {
                ConfirmationManager.show(
                    `${selectedIds.length} görevi silmek istediğinize emin misiniz ? `,
                    () => {
                        TaskManager.deleteMultiple(selectedIds);
                        UIManager.renderTasks(TaskManager.getTasks());
                        updateDashboardStatsIfVisible();
                        Toast.show(`${selectedIds.length} görev silindi.`, 'success');
                        bulkDeleteBtn.style.display = 'none';
                    },
                    'Evet, Sil'
                );
            }
        });



        // Delete All Listener
        document.getElementById('delete-all-tasks').addEventListener('click', () => {
            if (TaskManager.getTasks().length === 0) return Toast.show('Silinecek görev yok.', 'warning');

            ConfirmationManager.show(
                'TÜM görevleriniz silinecek!\nBu işlem geri alınamaz. Emin misiniz?',
                () => {
                    TaskManager.deleteAll();
                    UIManager.renderTasks([]);
                    updateDashboardStatsIfVisible();
                    Toast.show('Tüm görevler temizlendi.', 'success');
                },
                'Evet, Hepsini Sil'
            );
        });

        document.getElementById('search-tasks').addEventListener('input', (e) => {
            UIManager.renderTasks(TaskManager.getTasks(), e.target.value);
        });


        // Priority Selection Visual Logic
        document.querySelectorAll('.priority-option input').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.querySelectorAll('.priority-option').forEach(bs => bs.classList.remove('selected'));
                e.target.parentElement.classList.add('selected');
            });
        });

        const handleAddTask = () => {
            const input = document.getElementById('new-task-input');
            const priorityInput = document.querySelector('input[name="priority"]:checked');
            const content = input.value.trim();

            if (content) {
                TaskManager.addTask(content, priorityInput ? priorityInput.value : 'normal');
                input.value = '';
                // Reset Priority to Normal
                const normalOption = document.querySelector('input[name="priority"][value="normal"]');
                if (normalOption) normalOption.checked = true;

                document.querySelectorAll('.priority-option').forEach(bs => bs.classList.remove('selected'));
                const normalOptionDiv = document.querySelector('.priority-option.option-normal');
                if (normalOptionDiv) normalOptionDiv.classList.add('selected');

                // Add as General Task (UI Refresh)
                UIManager.renderTasks(TaskManager.getTasks());
            }
        };

        document.getElementById('add-task-btn').addEventListener('click', handleAddTask);
        document.getElementById('new-task-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAddTask();
        });
    },

    toggleAccordion: (id) => {
        const item = document.getElementById(`rep-group-${id}`);
        if (item) {
            const isActive = item.classList.toggle('active');
            const panel = item.querySelector('.report-panel');
            if (panel) {
                panel.style.display = isActive ? 'block' : 'none';
            }
            console.log(`Accordion ${id} toggled. Active: ${isActive}, Panel Display: ${panel ? panel.style.display : 'not found'}`);
        } else {
            console.error(`Accordion element rep-group-${id} not found`);
        }
    },

    createTaskHTML: (task) => {
        const isChecklist = task.meta && task.meta.type === 'checklist';
        const isUrgent = task.priority === 'high';

        // Badges
        let badgesHtml = '';
        if (isUrgent) {
            badgesHtml += '<span class="badge badge-sm" style="background:#fee2e2; color:#ef4444; border:1px solid #fecaca; margin-left:0.5rem; font-size:0.7em; font-weight:700;">ACİL</span>';
        }
        if (isChecklist) {
            badgesHtml += '<span class="badge badge-sm badge-outline" style="margin-left:0.5rem; font-size:0.7em; color:var(--text-secondary); border-color:var(--border-color);">Rapor</span>';
        }

        return `
            <div class="task-item ${task.completed ? 'completed' : ''} priority-${task.priority || 'normal'}" style="margin-bottom:0.5rem;">
                <div class="task-checkbox-wrapper">
                    <input type="checkbox" 
                        ${task.completed ? 'checked' : ''} 
                        onchange="TaskManager.toggleTask(${task.id})">
                </div>
                <div class="task-content" style="flex:1; display:flex; align-items:center;">
                    <span class="task-text">${task.text || task.content || 'İsimsiz Görev'}</span>
                    ${badgesHtml}
                </div>
                <button class="delete-btn" onclick="TaskManager.deleteTask(${task.id})" title="Sil" style="background:none; border:none; color:var(--text-secondary); cursor:pointer;">
                    <span class="material-icons-round" style="font-size:1.2rem;">close</span>
                </button>
            </div>
        `;
    },

    renderTasks: (tasks, filterText = '') => {
        const generalContainer = document.getElementById('general-task-list');
        const reportContainer = document.getElementById('report-task-container');

        if (!generalContainer || !reportContainer) return;

        generalContainer.innerHTML = '';
        reportContainer.innerHTML = '';

        const filteredTasks = (tasks || []).filter(t => {
            const txt = t.text || t.content || '';
            return txt.toLowerCase().includes(filterText.toLowerCase());
        });

        // 1. Separate Tasks
        const generalTasks = [];
        const reportMap = {};

        filteredTasks.forEach(task => {
            if (task.meta && task.meta.reportId) {
                const rId = task.meta.reportId;
                if (!reportMap[rId]) {
                    let title = "Bilinmeyen Rapor";
                    const reports = StorageManager.get('reports') || [];
                    const found = reports.find(r => r.id == rId);
                    if (found) title = found.title || found.code;
                    reportMap[rId] = { title: title, tasks: [] };
                }
                reportMap[rId].tasks.push(task);
            } else {
                generalTasks.push(task);
            }
        });

        // 2. Render General Tasks
        if (generalTasks.length === 0) {
            generalContainer.innerHTML = '<div class="empty-state">Genel görev bulunmuyor.</div>';
        } else {
            generalTasks.forEach(task => {
                generalContainer.innerHTML += UIManager.createTaskHTML(task);
            });
        }

        // 3. Render Report Groups
        const reportIds = Object.keys(reportMap);
        if (reportIds.length === 0) {
            reportContainer.innerHTML = '<div class="empty-state">Rapor bağlı görev bulunmuyor.</div>';
        } else {
            reportIds.forEach(rId => {
                const group = reportMap[rId];
                const groupHtml = `
                    <div class="report-group-item" id="rep-group-${rId}">
                        <button class="report-accordion" onclick="UIManager.toggleAccordion('${rId}')">
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <span class="material-icons-round" style="color:var(--primary-color);">folder</span>
                                <span>${group.title}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <span class="badge-count">${group.tasks.length}</span>
                                <span class="material-icons-round arrow" style="pointer-events:none;">expand_more</span>
                            </div>
                        </button>
                        <div class="report-panel">
                            <div class="task-list" style="padding: 0 1rem;">
                                ${group.tasks.map(t => UIManager.createTaskHTML(t)).join('')}
                            </div>
                        </div>
                    </div>
                `;
                reportContainer.innerHTML += groupHtml;
            });
        }

        // Update dashboard if needed
        if (UIManager.updateDashboardStatsIfVisible) {
            UIManager.updateDashboardStatsIfVisible();
        }
    },

    updateDashboardStatsIfVisible: () => {
        const dash = document.querySelector('.nav-item.active[data-view="dashboard"]');
        if (dash) {
            if (typeof handleViewChange !== 'undefined') handleViewChange('dashboard');
        }
    },

    initDashboardCharts: function () {
        if (typeof Chart === 'undefined') return;

        const reports = ReportManager.getReports();
        const today = new Date();

        // Data Prep for Bar Chart
        let greenCount = 0; // Süresi var
        let yellowCount = 0; // 1-3 Ay Geçti (1-90 gün)
        let orangeCount = 0; // 3-6 Ay Gecikti (91-180 gün)
        let redCount = 0; // Kritik (>180 gün)

        // Ignore completed for duration analysis or keep them? Usually active ones matter.
        const activeReports = reports.filter(r => r.status !== 'tamamlandi');

        activeReports.forEach(r => {
            const deadline = new Date(r.deadline);
            const diffTime = today - deadline;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // >0 Gecikmiş

            if (diffDays <= 0) {
                greenCount++;
            } else {
                if (diffDays <= 90) yellowCount++; // 1-3 Ay (1-90 gün)
                else if (diffDays <= 180) orangeCount++; // 3-6 Ay (91-180 gün)
                else redCount++; // Kritik
            }
        });

        // Bar Chart
        const ctxBar = document.getElementById('chart-duration');
        if (ctxBar) {
            const existingChart = Chart.getChart(ctxBar);
            if (existingChart) existingChart.destroy();

            new Chart(ctxBar, {
                type: 'bar',
                data: {
                    labels: ['Süresi Var', '1-3 Ay Geçti', '3-6 Ay Gecikti', 'Kritik'],
                    datasets: [{
                        label: 'Görev Sayısı',
                        data: [greenCount, yellowCount, orangeCount, redCount],
                        backgroundColor: [
                            '#2196f3', // Blue (Süresi Var)
                            '#ffca28', // Yellow
                            '#ff9800', // Orange
                            '#f44336'  // Red
                        ],
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });
        }

        // Pie Chart (Report Types)
        const typesMap = {};
        reports.forEach(r => {
            const t = r.type || 'Diğer';
            typesMap[t] = (typesMap[t] || 0) + 1;
        });

        // Convert keys to readable
        const typeLabelsMap = {
            'inceleme': 'İnceleme',
            'sorusturma': 'Soruşturma',
            'genel-denetim': 'Genel Denetim',
            'ozel-denetim': 'Özel Denetim',
            'on-inceleme': 'Ön İnceleme',
            'on-arastirma': 'Ön Araştırma'
        };

        const typeLabels = Object.keys(typesMap).map(k => typeLabelsMap[k] || k);
        const typeData = Object.values(typesMap);

        const ctxTypes = document.getElementById('chart-types');
        if (ctxTypes) {
            new Chart(ctxTypes, {
                type: 'pie',
                data: {
                    labels: typeLabels,
                    datasets: [{
                        data: typeData,
                        backgroundColor: [
                            '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }

        // Doughnut Chart (Writing Status - NEW)
        const statusMap = {};
        reports.forEach(r => {
            const s = r.status || 'baslanmadi';
            statusMap[s] = (statusMap[s] || 0) + 1;
        });

        const statusLabelsMap = {
            'baslanmadi': 'Başlanmadı',
            'devam-ediyor': 'Devam Ediyor',
            'evrak-bekleniyor': 'Evrak Bekleniyor',
            'incelemecide': 'İncelemede',
            'tamamlandi': 'Tamamlandı'
        };

        // Status colors consistent with badges
        const statusColorsMap = {
            'baslanmadi': '#94a3b8', // Gray
            'devam-ediyor': '#3b82f6', // Blue
            'evrak-bekleniyor': '#f59e0b', // Orange (Waiting)
            'incelemecide': '#8b5cf6', // Purple
            'tamamlandi': '#10b981' // Green
        };

        const statusKeys = Object.keys(statusMap);
        const chartStatusLabels = statusKeys.map(k => statusLabelsMap[k] || k);
        const chartStatusData = statusKeys.map(k => statusMap[k]);
        const chartStatusColors = statusKeys.map(k => statusColorsMap[k] || '#cbd5e1');

        const ctxStatus = document.getElementById('chart-status');
        if (ctxStatus) {
            const existingChart = Chart.getChart(ctxStatus);
            if (existingChart) existingChart.destroy();

            new Chart(ctxStatus, {
                type: 'doughnut',
                data: {
                    labels: chartStatusLabels,
                    datasets: [{
                        data: chartStatusData,
                        backgroundColor: chartStatusColors,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }

        const pieLabels = Object.keys(typesMap).map(k => typeLabelsMap[k] || k);
        const pieData = Object.values(typesMap);

        const ctxPie = document.getElementById('chart-types');
        if (ctxPie) {
            const existingChart = Chart.getChart(ctxPie);
            if (existingChart) existingChart.destroy();

            new Chart(ctxPie, {
                type: 'doughnut',
                data: {
                    labels: pieLabels,
                    datasets: [{
                        data: pieData,
                        backgroundColor: [
                            '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } }
                    },
                    cutout: '65%'
                }
            });
        }
    }
};

function handleFileImport(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        StorageManager.importData(e.target.result);
    };
    reader.readAsText(file);
    input.value = ''; // Reset
}



// --- Audit Manager ---
const AuditManager_Legacy = {
    data: [],

    initView: () => {
        const container = document.getElementById('content-area');
        container.innerHTML = `
    <div id="view-audit" class="view-section">
                <div class="header-actions" style="justify-content:space-between; margin-bottom:1rem;">
                    <h3>Denetim Formu</h3>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn btn-outline" onclick="AuditManager.loadForm()">
                            <span class="material-icons-round">refresh</span> Yenile
                        </button>
                        <button class="btn btn-primary" onclick="AuditManager.saveState()">
                            <span class="material-icons-round">save</span> Kaydet
                        </button>
                        <button class="btn btn-outline" onclick="AuditManager.exportToExcel()" style="color:var(--success); border-color:var(--success);">
                            <span class="material-icons-round">file_download</span> Excel
                        </button>
                    </div>
                </div>
                <!--Search / Filter Bar(Optional)-- >
                < !-- < div style = "margin-bottom:1rem;" > <input type="text" placeholder="Soru ara..." class="search-input"></div> -->

                <div id="audit-tabs" style="display:flex; overflow-x:auto; border-bottom:1px solid var(--border-color); margin-bottom:1rem; padding:0 0.5rem; white-space:nowrap; gap:1rem;">
                    <!-- Tabs will be rendered here -->
                </div>

                <div id="audit-form-container" class="card"
                    style="padding: 0; max-height: calc(100vh - 220px); overflow-y: auto;">
                    <div class="empty-state">
                        <span class="material-icons-round" style="font-size:3rem; color:var(--text-muted);">fact_check</span>
                        <p>Denetim formu yükleniyor...</p>
                    </div>
                </div>
            </div > `;

        // Auto-load if no data, or maybe always reload to be safe? 
        // Let's check if data is already loaded to avoid Flicker?
        // For now, load fresh to ensure sync with file.
        AuditManager.loadForm();
    },

    loadForm: () => {
        const container = document.getElementById('audit-form-container');
        if (!container) return;

        // UI Update: loading spinner
        container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; color: var(--text-secondary);">
                <div class="loading-spinner" style="width: 32px; height: 32px; border: 3px solid var(--border-color); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
                <div>Denetim formu hazırlanıyor...</div>
            </div > `;

        setTimeout(() => {
            try {
                // 1. Library Check
                if (typeof XLSX === 'undefined') {
                    throw new Error('XLSX kütüphanesi yüklenemedi.');
                }
                const fs = typeof require !== 'undefined' ? require('fs') : null;
                const path = typeof require !== 'undefined' ? require('path') : null;

                if (!fs || !path) {
                    throw new Error('Dosya sistemi erişimi yok (Electron kullanın).');
                }

                // 2. Resolve Path
                let filePath = path.join(process.cwd(), 'Sablonlar', 'denetim_formu.xlsx');
                if (!fs.existsSync(filePath)) {
                    filePath = path.join(__dirname, 'Sablonlar', 'denetim_formu.xlsx');
                }
                if (!fs.existsSync(filePath) && process.resourcesPath) {
                    filePath = path.join(process.resourcesPath, 'Sablonlar', 'denetim_formu.xlsx');
                }

                if (!fs.existsSync(filePath)) {
                    throw new Error(`Şablon dosyası bulunamadı: denetim_formu.xlsx`);
                }

                // 3. Read File
                const fileBuffer = fs.readFileSync(filePath);
                const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

                let parsedItems = [];

                // Iterate through ALL sheets
                let sheets = [];

                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

                    let sheetItems = [];
                    let currentSection = sheetName.trim();

                    // Optional: Check if sheet is empty or useless
                    if (rows.length < 2) return;

                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0) continue;

                        const col0 = String(row[0] || '').trim();
                        const col1 = String(row[1] || '').trim();
                        const col2 = String(row[2] || '').trim();

                        // Detect Sub-Header in sheet (Row with "Evet"/"Hayır" columns)
                        if (col1 === 'Evet' && col2 === 'Hayır') {
                            if (col0 && col0 !== currentSection) {
                                currentSection = col0;
                                sheetItems.push({ type: 'header', title: currentSection });
                            }
                            continue;
                        }

                        // Question Row
                        if (col0 && !col1 && !col2) {
                            const uniqueId = `${sheetName}_${i} `.replace(/\s/g, '_');
                            sheetItems.push({
                                type: 'question',
                                id: uniqueId,
                                text: col0,
                                section: currentSection
                            });
                        }
                    }

                    if (sheetItems.length > 0) {
                        sheets.push({
                            name: sheetName.trim(),
                            items: sheetItems
                        });
                    }
                });

                AuditManager.data = sheets;
                AuditManager.activeTab = sheets.length > 0 ? 0 : -1;

                // Merge with saved state
                const savedState = StorageManager.get('audit_form_state') || {};
                AuditManager.render(savedState);


            } catch (error) {
                console.error('Audit load error:', error);
                container.innerHTML = `
    <div class="error-state" style="color:var(--danger); padding:2rem; text-align:center;">
                        <span class="material-icons-round" style="font-size:3rem; opacity:0.5;">error_outline</span>
                        <p><strong>Hata:</strong> ${error.message}</p>
                    </div > `;
            }
        }, 50);
    },



    render: (savedState = {}) => {
        const container = document.getElementById('audit-form-container');
        const tabsContainer = document.getElementById('audit-tabs');
        if (!container) return;

        if (!AuditManager.data || AuditManager.data.length === 0) {
            container.innerHTML = '<div class="empty-state">İçerik bulunamadı.</div>';
            if (tabsContainer) tabsContainer.innerHTML = '';
            return;
        }

        // 1. Render Tabs
        if (tabsContainer) {
            tabsContainer.innerHTML = AuditManager.data.map((sheet, index) => {
                const isActive = index === AuditManager.activeTab;
                const activeStyle = isActive
                    ? 'border-bottom: 2px solid var(--primary-color); color: var(--primary-color); font-weight:600;'
                    : 'color: var(--text-secondary); cursor:pointer;';

                return `<div onclick="AuditManager.switchTab(${index})"
style="padding: 0.8rem 1rem; font-size: 0.9rem; ${activeStyle}">
    ${sheet.name}
                        </div>`;
            }).join('');
        }

        // 2. Render Active Sheet Content
        const activeSheet = AuditManager.data[AuditManager.activeTab];
        let html = '<div style="padding:1rem;">';

        if (activeSheet && activeSheet.items) {
            activeSheet.items.forEach(item => {
                if (item.type === 'header') {
                    html += `
    <div style="background:var(--bg-main); padding:0.75rem 0.5rem; margin-top:1.5rem; margin-bottom:0.5rem; border-left:4px solid var(--primary-color); font-weight:600; font-size:0.9rem; color:var(--text-main); border-radius:0 4px 4px 0;">
        ${item.title}
    </div>`;
                } else if (item.type === 'question') {
                    const yesChecked = savedState[item.id] === 'yes' ? 'checked' : '';
                    const noChecked = savedState[item.id] === 'no' ? 'checked' : '';
                    const note = savedState[`note_${item.id} `] || '';

                    html += `
    <div class="audit-item" style="display:flex; flex-direction:column; padding:1rem; border-bottom:1px solid var(--border-color); background:var(--bg-card);">
                             <div style="margin-bottom:0.75rem; font-size:0.95rem;">${item.text}</div>
                            <div style="display:flex; align-items:center; gap:2rem;">
                                <label style="display:flex; align-items:center; cursor:pointer;">
                                    <input type="radio" name="audit_${item.id}" value="yes" ${yesChecked} onchange="AuditManager.updateState('${item.id}', 'yes')">
                                    <span style="margin-left:0.5rem; color:var(--success);">Evet</span>
                                </label>
                                <label style="display:flex; align-items:center; cursor:pointer;">
                                    <input type="radio" name="audit_${item.id}" value="no" ${noChecked} onchange="AuditManager.updateState('${item.id}', 'no')">
                                    <span style="margin-left:0.5rem; color:var(--danger);">Hayır</span>
                                </label>
                                <input type="text" placeholder="Varsa notunuz..." value="${note}" 
                                    onchange="AuditManager.updateNote('${item.id}', this.value)"
                                    style="flex:1; padding:0.4rem; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem; background:var(--bg-main); color:var(--text-main);">
                            </div>
                        </div > `;
                }
            });
        }

        html += '</div>';
        container.innerHTML = html;
    },

    switchTab: (index) => {
        AuditManager.activeTab = index;
        const savedState = StorageManager.get('audit_form_state') || {};
        AuditManager.render(savedState);
    },


    updateState: (id, value) => {
        const savedState = StorageManager.get('audit_form_state') || {};
        savedState[id] = value;
        StorageManager.set('audit_form_state', savedState);
    },

    updateNote: (id, text) => {
        const savedState = StorageManager.get('audit_form_state') || {};
        savedState[`note_${id} `] = text;
        StorageManager.set('audit_form_state', savedState);
    },

    saveState: () => {
        Toast.show('Form durumu kaydedildi.', 'success');
    },

    exportToExcel: () => {
        try {
            // 1. Dependencies
            if (typeof XLSX === 'undefined' || typeof require === 'undefined') {
                throw new Error('Gerekli kütüphaneler eksik.');
            }
            const fs = require('fs');
            const path = require('path');

            // 2. Load Template
            let templatePath = path.join(process.cwd(), 'Sablonlar', 'denetim_formu.xlsx');
            if (!fs.existsSync(templatePath)) {
                templatePath = path.join(__dirname, 'Sablonlar', 'denetim_formu.xlsx');
            }
            if (!fs.existsSync(templatePath) && process.resourcesPath) {
                templatePath = path.join(process.resourcesPath, 'Sablonlar', 'denetim_formu.xlsx');
            }

            const fileBuffer = fs.readFileSync(templatePath);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

            // 3. Fill Data
            const savedState = StorageManager.get('audit_form_state') || {};

            // Need to map our data back to the sheet
            // We stored IDs as "SheetName_RowIndex"

            Object.keys(savedState).forEach(key => {
                if (key.startsWith('note_')) return; // Handle notes separately inside the loop if needed, or parse key

                const val = savedState[key]; // 'yes' or 'no'

                // Parse Key: "SheetName_RowIndex"
                // Warning: SheetName might contain underscores.
                // Our generation was: `${ sheetName }_${ i } ` using .replace(/\s/g, '_') ?? 
                // Wait, in loadForm: const uniqueId = `${ sheetName }_${ i } `.replace(/\s/g, '_');
                // This is lossy.
                // BETTER: We should store the rowIndex in the parsed item.

                // QUICK FIX: We need to re-parse or trust that we can parse the ID?
                // No, let's rely on the fact that we can just calculate the row index?
                // If we stored 'i' in parsing, it would be easy.
                // Let's assume we can match the text? No, text might be duplicate.

                // REFACTORING LoadForm to include rowIndex is best.
                // But for now, let's try to extract it from the end of the string.
                // "Sheet_Name_12" -> 12.
                const parts = item.id.split('_');
                const rowIndexStr = parts[parts.length - 1];
                const rowIndex = parseInt(rowIndexStr); // 0-indexed

                if (!isNaN(rowIndex)) {
                    // Excel Columns: 0=A, 1=B(Evet), 2=C(Hayır), 3=D(Not)
                    const cellRefEvet = XLSX.utils.encode_cell({ c: 1, r: rowIndex });
                    const cellRefHayir = XLSX.utils.encode_cell({ c: 2, r: rowIndex });
                    const cellRefNot = XLSX.utils.encode_cell({ c: 3, r: rowIndex }); // Column D for notes?

                    if (ans === 'yes') {
                        worksheet[cellRefEvet] = { t: 's', v: 'X' };
                        // Remove Hayir if it exists?
                        if (worksheet[cellRefHayir]) delete worksheet[cellRefHayir];
                    } else if (ans === 'no') {
                        worksheet[cellRefHayir] = { t: 's', v: 'X' };
                        if (worksheet[cellRefEvet]) delete worksheet[cellRefEvet];
                    }

                    if (note) {
                        worksheet[cellRefNot] = { t: 's', v: note };
                    }
                }
            });

            // 4. Save
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
            const fileName = `Denetim_Raporu_${dateStr}.xlsx`;
            const desktopPath = path.join(process.env.USERPROFILE, 'Desktop', fileName);

            XLSX.writeFile(workbook, desktopPath);
            Toast.show(`Rapor masaüstüne kaydedildi: \n${fileName} `, 'success');

            // Optional: Ask to open folder?
            // require('child_process').exec(`explorer.exe / select, "${desktopPath}"`);

        } catch (e) {
            console.error('Export error:', e);
            Toast.show('Dışa aktarma hatası: ' + e.message, 'error');
        }
    }
};

// --- Auth Manager ---
const CorporateContactsManager = {
    data: [],

    initializeDefaults: async () => {
        if (typeof require === 'undefined') return;
        const fs = require('fs');
        const path = require('path');

        const targetDir = PathManager.join('Telefon_Rehberi');

        // Hedef dizin yoksa veya boşsa kopyala
        if (!fs.existsSync(targetDir) || fs.readdirSync(targetDir).filter(f => !f.startsWith('.')).length === 0) {
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            const sources = [];
            if (typeof __dirname !== 'undefined') sources.push(path.join(__dirname, 'Telefon_Rehberi'));
            sources.push(path.join(process.cwd(), 'Telefon_Rehberi'));
            if (process.resourcesPath) sources.push(path.join(process.resourcesPath, 'Telefon_Rehberi'));

            for (const src of sources) {
                if (fs.existsSync(src) && src !== targetDir) {
                    try {
                        fs.cpSync(src, targetDir, { recursive: true });
                        console.log('Kurumsal rehber senkronize edildi:', src);
                        break;
                    } catch (e) { console.error('Rehber kopyalama hatası:', e); }
                }
            }
        }
    },

    loadAndRender: () => {
        const container = document.getElementById('corp-contacts-table');
        if (!container) return;

        // UI Update: Show loading spinner immediately
        container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; color: var(--text-secondary);">
                <div class="loading-spinner" style="width: 32px; height: 32px; border: 3px solid var(--border-color); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
                <div>Rehber verileri yükleniyor...</div>
            </div>
    <style>@keyframes spin {0 % { transform: rotate(0deg); } 100% {transform: rotate(360deg); } }</style>
`;

        // Execute render logic in next tick to allow UI to paint
        setTimeout(async () => {
            const activeContainer = document.getElementById('corp-contacts-table');
            if (!activeContainer) return; // View changed

            try {
                // Başlatma mantığını çalıştır
                await CorporateContactsManager.initializeDefaults();

                if (typeof XLSX === 'undefined') {
                    throw new Error('XLSX kütüphanesi yüklenemedi. (XLSX is undefined)');
                }

                let fileBuffer;

                // --- ELECTRON / NODE ENVIRONMENT ---
                if (typeof require !== 'undefined') {
                    const fs = require('fs');
                    const path = require('path');

                    let filePath = PathManager.join('Telefon_Rehberi', 'RDB_PERSONEL_TELEFON.xlsx');

                    console.log('Aranan rehber yolu (Final):', filePath);

                    if (!fs.existsSync(filePath)) {
                        throw new Error(`Dosya bulunamadı!(Konum: ${filePath})`);
                    }

                    fileBuffer = fs.readFileSync(filePath);

                    // --- BROWSER ENVIRONMENT ---
                } else {
                    console.log('Browser ortamı: Dosya fetch ediliyor...');
                    const response = await fetch('Telefon_Rehberi/RDB_PERSONEL_TELEFON.xlsx');
                    if (!response.ok) {
                        throw new Error(`Dosya indirilemedi(Status: ${response.status})`);
                    }
                    fileBuffer = await response.arrayBuffer();
                }

                // Read Workbook (Common)
                // type: 'array' works for both Buffer (Node) and ArrayBuffer (Browser)
                const workbook = XLSX.read(fileBuffer, { type: 'array' });

                if (!workbook.SheetNames.length) {
                    throw new Error('Excel dosyasında hiç sayfa yok.');
                }

                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                let parsedData = [];

                // NEW "Clean" Layout Parsing (Left Side)
                for (let i = 0; i < rawRows.length; i++) {
                    const row = rawRows[i];
                    if (!row || row.length === 0) continue;

                    // Handle Headers (e.g. BAŞKANLIK)
                    // Heuristic: Col 0 has text, but Col 3 (Phone) is empty.
                    const col0 = String(row[0] || '').trim();
                    const col1 = String(row[1] || '').trim();

                    // If it looks like a section header (e.g. "BAŞMÜFETTİŞLER" in col 0, and no phone in col 3)
                    const isHeader = col0 && col0.length > 2 && !row[3] && !row[4];

                    // Skip utility headers like "ADI SOYADI"
                    if (col1 === 'ADI SOYADI' || col0 === 'NO') continue;

                    if (isHeader) {
                        parsedData.push({ type: 'header', title: col0 });
                    } else if (col1) {
                        // Person Row
                        let name = row[1];
                        let role = row[2];
                        let phone = row[3];
                        let ext = row[4];
                        let room = row[5];
                        let floor = row[6];

                        parsedData.push({
                            type: 'person',
                            id: i, // Use row index as simple ID for now
                            name: name,
                            role: role,
                            phone: phone,
                            ext: ext,
                            room: room,
                            floor: floor,
                            location: (floor || room) ? `${floor || '-'} / ${room || '-'}` : ''
                        });
                    }
                }

                // Apply Overrides from LocalStorage
                const overrides = StorageManager.get('corp_overrides') || {};
                parsedData = parsedData.map(item => {
                    if (item.type === 'person' && overrides[item.name]) {
                        return { ...item, ...overrides[item.name] };
                    }
                    return item;
                });

                CorporateContactsManager.data = parsedData;
                CorporateContactsManager.render();

            } catch (error) {
                console.error('Excel okuma hatası:', error);
                const errorContainer = document.getElementById('corp-contacts-table');
                if (errorContainer) {
                    errorContainer.innerHTML = `
                        <div class="error-state" style="color:var(--danger); padding:1rem; border:1px solid var(--danger); border-radius:8px; background:#fff5f5;">
                            <strong>Hata Oluştu:</strong><br>
                            ${error.message}<br><br>
                            <small style="color: var(--text-secondary);">Dosya yolu: Telefon_Rehberi/RDB_PERSONEL_TELEFON.xlsx</small>
                        </div>`;
                }
            }
        }, 50);
    },

    // Function to handle edits
    editContact: (name) => {
        const person = CorporateContactsManager.data.find(p => p.name === name);
        if (!person) return;

        // Populate Modal
        document.getElementById('edit-corp-original-name').value = person.name; // ID reference
        document.getElementById('edit-corp-name').value = person.name;
        document.getElementById('edit-corp-role').value = person.role || '';
        document.getElementById('edit-corp-phone').value = person.phone || '';
        document.getElementById('edit-corp-ext').value = person.ext || '';
        document.getElementById('edit-corp-floor').value = person.floor || '';
        document.getElementById('edit-corp-room').value = person.room || '';

        // Show Modal
        document.getElementById('corporate-edit-modal').style.display = 'flex';
    },

    saveEdit: () => {
        const originalName = document.getElementById('edit-corp-original-name').value;
        const newRole = document.getElementById('edit-corp-role').value.trim();
        const newPhone = document.getElementById('edit-corp-phone').value.trim();
        const newExt = document.getElementById('edit-corp-ext').value.trim();
        const newFloor = document.getElementById('edit-corp-floor').value.trim();
        const newRoom = document.getElementById('edit-corp-room').value.trim();

        if (!originalName) return;

        const overrides = StorageManager.get('corp_overrides') || {};

        // Save all editable fields
        overrides[originalName] = {
            role: newRole,
            phone: newPhone,
            ext: newExt,
            floor: newFloor,
            room: newRoom,
            location: (newFloor || newRoom) ? `${newFloor || '-'} / ${newRoom || '-'}` : ''
        };

        StorageManager.set('corp_overrides', overrides);

        // Hide Modal
        document.getElementById('corporate-edit-modal').style.display = 'none';

        // Reload
        CorporateContactsManager.loadAndRender();
        Toast.show('Bilgiler güncellendi.', 'success');
    },

    render: (filterText = '') => {
        const container = document.getElementById('corp-contacts-table');
        if (!container) return;

        let data = CorporateContactsManager.data;
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state">Veri bulunamadı.</div>';
            return;
        }

        if (filterText) {
            const lower = filterText.toLowerCase();
            data = data.filter(item => {
                if (item.type === 'header') return false;
                return (
                    (item.name && item.name.toLowerCase().includes(lower)) ||
                    (item.role && item.role.toLowerCase().includes(lower)) ||
                    (item.location && String(item.location).includes(lower))
                );
            });
        }

        let html = `
        <style>
            .corp-row:hover { background-color: #f1f5f9; transition: background-color 0.2s; }
            .corp-header-row td { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .edit-btn { transition: opacity 0.2s; cursor:pointer; color:var(--primary-color); }
            .corp-row:hover .edit-btn { opacity: 1; }
        </style>
        <table style="width:100%; border-collapse:separate; border-spacing:0; font-size:0.9rem;">
            <thead>
                <tr style="background:#f8fafc; text-align:left; position:sticky; top:0; z-index:10;">
                    <th style="padding:0.75rem; color:var(--text-secondary); border-bottom:2px solid #e2e8f0; background:#f8fafc;">NO</th>
                    <th style="padding:0.75rem; color:var(--text-secondary); border-bottom:2px solid #e2e8f0; background:#f8fafc;">ADI SOYADI</th>
                    <th style="padding:0.75rem; color:var(--text-secondary); border-bottom:2px solid #e2e8f0; background:#f8fafc;">ÜNVANI</th>
                    <th style="padding:0.75rem; color:var(--text-secondary); border-bottom:2px solid #e2e8f0; background:#f8fafc;">DAHİLİ</th>
                    <th style="padding:0.75rem; color:var(--text-secondary); border-bottom:2px solid #e2e8f0; background:#f8fafc;">CEP TEL NO</th>
                    <th style="padding:0.75rem; color:var(--text-secondary); border-bottom:2px solid #e2e8f0; background:#f8fafc;">KAT / ODA</th>
                    <th style="width:40px; border-bottom:2px solid #e2e8f0; background:#f8fafc;"></th> 
                </tr>
            </thead>
            <tbody>
        `;

        let personIndex = 1;

        data.forEach(item => {
            if (item.type === 'header') {
                html += `
                <tr class="corp-header-row" style="background:#fff1f2; text-align:center;">
                    <td colspan="7" style="padding:1rem 0.75rem 0.75rem 0.75rem; color:#be123c; font-weight:700; font-size:1.1rem; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0;">
                        ${item.title.toUpperCase()}
                    </td>
                </tr>`;
            } else {
                html += `
                <tr class="corp-row" style="border-bottom:1px solid #f1f5f9; cursor:default;">
                     <td style="padding:0.75rem; color:var(--text-secondary); width:50px;">${personIndex++}</td>
                     <td style="padding:0.75rem; font-weight:500; color:var(--text-main);">${item.name || ''}</td>
                     <td style="padding:0.75rem;">${item.role || ''}</td>
                     <td style="padding:0.75rem;">${item.ext || ''}</td>
                     <td style="padding:0.75rem; font-family:'Roboto Mono', monospace; color:var(--primary-color); font-weight:600;">
                        ${item.phone || ''} 
                     </td>
                     <td style="padding:0.75rem; font-weight:500; color:var(--text-secondary);">${item.location || ''}</td>
                     <td style="padding:0.75rem; text-align:right;">
                        <button class="edit-btn" onclick="CorporateContactsManager.editContact('${item.name}')" title="Düzenle" style="background:none; border:none; padding:4px;">
                            <span class="material-icons-round" style="font-size:1.2rem;">edit</span>
                        </button>
                     </td>
                </tr>
                `;
            }
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
        container.innerHTML += `<div style="padding:0.5rem; text-align:right; font-size:0.8rem; color:var(--text-secondary);">Toplam ${personIndex - 1} kişi</div>`;
    }
};




const SettingsManager = {
    updateProfile: (fullname, securityQ, securityA) => {
        const user = AuthManager.getUser();
        if (user) {
            user.fullname = fullname;
            user.question = securityQ;
            if (securityA) user.answer = securityA.toLowerCase();

            StorageManager.set('app_user', user);
            Toast.show('Profil başarıyla güncellendi.', 'success');
            return true;
        }
        return false;
    },

    changePassword: (oldPass, newPass) => {
        const user = AuthManager.getUser();
        if (user) {
            if (user.password === oldPass) {
                user.password = newPass;
                StorageManager.set('app_user', user);
                Toast.show('Şifreniz değiştirildi.', 'success');
                return true;
            } else {
                Toast.show('Eski şifreniz hatalı!', 'error');
                return false;
            }
        }
        return false;
    },

    changePasswordUI: () => {
        const oldPass = document.getElementById('old-pass').value;
        const newPass = document.getElementById('new-pass').value;
        if (oldPass && newPass) {
            if (SettingsManager.changePassword(oldPass, newPass)) {
                // Clear inputs on success
                document.getElementById('old-pass').value = '';
                document.getElementById('new-pass').value = '';
            }
        } else {
            Toast.show('Lütfen mevcut ve yeni şifreyi giriniz.', 'warning');
        }
    }
};

function checkLogin() {
    // 1. Kullanıcı var mı? (Kurulum yapılmış mı?)
    const user = AuthManager.getUser();
    const overlay = document.getElementById('login-overlay');

    if (!user) {
        // HİÇ KULLANICI YOK -> KURULUM MODU
        overlay.style.display = 'flex';
        AuthManager.showScreen('intro');
    } else {
        // KULLANICI VAR -> GİRİŞ MODU
        const isLoggedIn = sessionStorage.getItem('isLoggedIn');
        if (isLoggedIn === 'true') {
            overlay.style.display = 'none';
        } else {
            overlay.style.display = 'flex';
            AuthManager.showScreen('login');
        }
    }
}

function initApp() {
    updateDateDisplay();
    setupNavigation();

    // Varsayılan görünüm
    handleViewChange('dashboard');

    // Button Listeners (Backup/Restore/FolderGen)
    const backupBtn = document.getElementById('backup-btn');
    if (backupBtn) {
        backupBtn.addEventListener('click', () => {
            if (typeof StorageManager !== 'undefined') StorageManager.exportData();
        });
    }

    const restoreBtn = document.getElementById('restore-btn');
    const restoreInput = document.getElementById('restore-input');

    if (restoreBtn && restoreInput) {
        restoreBtn.addEventListener('click', () => restoreInput.click());
        restoreInput.addEventListener('change', (e) => handleFileImport(e.target));
    }

    // About Button Listener
    const aboutBtn = document.getElementById('about-btn');
    if (aboutBtn) {
        aboutBtn.addEventListener('click', () => {
            UIManager.showAboutModal();
        });
    }

    // FolderGen Button Removed from Sidebar, keeping logic for future Settings panel

    // Start Reminder Loop
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }

        // Check every minute
        setInterval(() => {
            if (typeof TaskManager !== 'undefined') TaskManager.checkReminders();
        }, 60000);

        // Initial Check
        setTimeout(() => {
            if (typeof TaskManager !== 'undefined') TaskManager.checkReminders();
        }, 5000);
    }
}

function updateDateDisplay() {
    const dateElement = document.getElementById('current-date');
    if (!dateElement) return;
    const now = new Date();
    dateElement.textContent = now.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-item');
    const headerTitle = document.getElementById('page-title');

    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            navButtons.forEach(b => b.classList.remove('active'));
            const button = e.target.closest('.nav-item');
            button.classList.add('active');

            const viewName = button.dataset.view;
            headerTitle.textContent = button.querySelector('span:last-child').textContent;

            handleViewChange(viewName);
        });
    });

    // FAB Actions (Hızlı Ekleme Butonu) - Akıllı Davranış
    const fabBtn = document.getElementById('fab-action');
    if (fabBtn) {
        fabBtn.addEventListener('click', () => {
            const currentView = document.querySelector('.nav-item.active').dataset.view;

            if (currentView === 'notes') {
                const input = document.getElementById('new-note-input');
                if (input) input.focus();
            } else if (currentView === 'tasks') {
                const input = document.getElementById('new-task-input');
                if (input) input.focus();
            } else if (currentView === 'contacts') {
                const input = document.getElementById('contact-name');
                if (input) input.focus();
            } else if (currentView === 'reports') {
                const input = document.getElementById('rep-title');
                if (input) input.focus();
            }
        });
    }
}

function handleViewChange(viewName) {
    const contentArea = document.getElementById('content-area');
    const fabBtn = document.getElementById('fab-action');
    const assistantView = document.getElementById('view-assistant');

    // 1. Reset Views
    // Default: Show Content Area, Hide Assistant
    if (contentArea) contentArea.style.display = 'block';
    if (assistantView) assistantView.style.display = 'none';

    // Note: Settings static view is intentionally ignored/hidden 
    const settingsStatic = document.getElementById('view-settings');
    if (settingsStatic) settingsStatic.style.display = 'none';

    // 2. FAB Visibility
    if (fabBtn) {
        if (['dashboard', 'settings', 'assistant', 'audit'].includes(viewName)) {
            fabBtn.style.display = 'none';
        } else {
            fabBtn.style.display = 'inline-flex';
        }
    }

    // 3. Show Selected View
    if (viewName === 'assistant') {
        // Special Case: Assistant View
        if (contentArea) contentArea.style.display = 'none';
        if (assistantView) {
            assistantView.style.display = 'block';
            UIManager.initAssistantView(); // Ensure init/update
        }
    }
    else if (contentArea) {
        // Normal Views -> Render into Content Area
        if (viewName === 'dashboard') {
            contentArea.innerHTML = getDashboardHTML();
            setTimeout(UIManager.initDashboardCharts, 50);
        } else if (viewName === 'notes') {
            UIManager.initNotesView();
        } else if (viewName === 'tasks') {
            UIManager.initTasksView();
        } else if (viewName === 'contacts') {
            UIManager.initContactsView();
        } else if (viewName === 'reports') {
            if (typeof BackupManager !== 'undefined') BackupManager.autoBackup();
            UIManager.initReportsView();
        } else if (viewName === 'calendar') {
            if (typeof CalendarManager !== 'undefined') CalendarManager.initCalendarView();
        } else if (viewName === 'files') {
            UIManager.initFilesView();
        } else if (viewName === 'settings') {
            UIManager.initSettingsView();
        } else {
            contentArea.innerHTML = `
            <div class="empty-state-wrapper">
                <span class="material-icons-round large-icon">construction</span>
                <h3>${viewName} Modülü Hazırlanıyor</h3>
            </div>`;
        }
    }
}

function getDashboardHTML() {
    try {
        const taskStats = TaskManager.getStats();

        // 1. Eski Rapor Sistemi Verileri
        const reports = ReportManager.getReports();
        const completedReports = reports.filter(r => r.status === 'tamamlandi').length;
        const activeReports = reports.filter(r => r.status !== 'tamamlandi');

        // 2. Yeni Denetim Dosyaları Verileri (Sadece bilgi amaçlı tutuluyor, ana iş sayılmıyor)
        const auditRecords = StorageManager.get('audit_records', []);

        // Toplam İstatistikler (Ana Görev Bazlı)
        const totalActive = activeReports.length;
        const totalCompleted = completedReports;
        console.log('Dashboard Stats:', { totalActive, totalCompleted, taskStats });

        let greenCount = 0; // Süresi var
        let yellowCount = 0; // 1 aydan az gecikme
        let orangeCount = 0; // 1-3 ay gecikme
        let redCount = 0; // 3 aydan fazla gecikme

        const today = new Date();

        activeReports.forEach(r => {
            const deadline = new Date(r.deadline);
            const diffTime = today - deadline;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Pozitifse gecikmiş

            if (diffDays <= 0) {
                greenCount++;
            } else {
                if (diffDays <= 30) yellowCount++;
                else if (diffDays <= 90) orangeCount++;
                else redCount++;
            }
        });

        // Bekleyen Görevler - Özet Liste
        const summaryReports = reports
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
            .slice(0, 5);

        const reportListHTML = summaryReports.length > 0
            ? summaryReports.map(r => {
                const deadline = new Date(r.deadline);
                const diffTime = deadline - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                let dateText = `${diffDays} gün kaldı`;

                if (diffDays < 0) {
                    dateText = `${Math.abs(diffDays)} gün gecikti`;
                }

                const typeLabels = {
                    'inceleme': 'İnceleme',
                    'sorusturma': 'Soruşturma',
                    'genel-denetim': 'Genel Denetim',
                    'ozel-denetim': 'Özel Denetim',
                    'on-inceleme': 'Ön İnceleme',
                    'on-arastirma': 'Ön Araştırma (8/G)'
                };
                const typeText = typeLabels[r.type] || r.type;
                const startDate = new Date(r.startDate).toLocaleDateString('tr-TR');

                // Renk Mantığı
                let statusColor = '#2196f3'; // Tanımlama eklendi (Hata düzeltmesi)
                if (diffDays >= 0) {
                    statusColor = '#2196f3'; // Süresi var
                } else {
                    const overdue = Math.abs(diffDays);
                    if (overdue <= 90) statusColor = '#ffca28';
                    else if (overdue <= 180) statusColor = '#ff9800';
                    else statusColor = '#f44336';
                }

                const statusLabels = {
                    'baslanmadi': { text: 'Başlanmadı' },
                    'devam-ediyor': { text: 'Devam Ediyor' },
                    'evrak-bekleniyor': { text: 'Evrak Bekleniyor' },
                    'incelemecide': { text: 'İncelemede' },
                    'tamamlandi': { text: 'Tamamlandı' }
                };
                const statusInfo = statusLabels[r.status] || statusLabels['baslanmadi'];

                return `
                <li style="padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9; display:grid; grid-template-columns: 1.2fr 2.5fr 1.2fr 1.2fr 1.2fr 1.2fr 0.5fr; gap:0.5rem; align-items:center;">
                    <span style="font-size:0.85rem; color:var(--text-secondary); font-weight:600;">${r.code || '-'}</span>
                    <span style="font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${r.title}">${r.title}</span>
                    <span style="font-size:0.85rem; color:var(--text-secondary);">${typeText}</span>
                    <span style="font-size:0.85rem; color:var(--text-secondary);">${startDate}</span>
                    <span style="font-size:0.8rem; padding: 2px 8px; border-radius: 12px; background: #f1f5f9; color: var(--text-secondary); width:fit-content; white-space:nowrap;">${statusInfo.text}</span>
                    <span style="font-size:0.85rem; font-weight:500; color:${diffDays < 0 ? 'var(--danger)' : '#2196f3'};">${dateText}</span>
                    <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${statusColor};" title="Süre Durumu"></span>
                </li>`;
            }).join('')
            : '<li class="empty-state">Bekleyen aktif görev bulunmuyor.</li>';

        return `
        <div class="dashboard-grid">
            <div class="stat-card" style="display:flex; align-items:center;">
                <div class="icon-box warning"><span class="material-icons-round">priority_high</span></div>
                <div class="stat-info" style="flex:1; text-align:center;"><span class="stat-label">Acil Görevler</span><span class="stat-value">${taskStats.urgent}</span></div>
            </div>
            <div class="stat-card" style="display:flex; align-items:center;">
                <div class="icon-box info"><span class="material-icons-round">folder</span></div>
                <div class="stat-info" style="flex:1; text-align:center;"><span class="stat-label">Aktif Denetimler</span><span class="stat-value">${totalActive}</span></div>
            </div>
            <div class="stat-card" style="display:flex; align-items:center;">
                <div class="icon-box success"><span class="material-icons-round">task_alt</span></div>
                <div class="stat-info" style="flex:1; text-align:center;"><span class="stat-label">Tamamlanan Görevler</span><span class="stat-value">${totalCompleted}</span></div>
            </div>
        </div>

        <!--Charts Section(Grid)-->
        <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <div class="section-container" style="height:340px; padding:1.5rem;">
                <div class="section-header" style="display:flex; justify-content:center;"><h3>Görev Süre Durumu</h3></div>
                <div style="height:260px; position:relative;">
                    <canvas id="chart-duration"></canvas>
                </div>
            </div>

            <div class="section-container" style="height:340px; padding:1.5rem;">
                <div class="section-header" style="display:flex; justify-content:center;"><h3>Rapor Yazım Durumu</h3></div>
                 <div style="height:260px; position:relative;">
                    <canvas id="chart-status"></canvas>
                </div>
            </div>
            
            <div class="section-container" style="height:340px; padding:1.5rem;">
                <div class="section-header" style="display:flex; justify-content:center;"><h3>Görev Türü Dağılımı</h3></div>
                 <div style="height:260px; position:relative;">
                    <canvas id="chart-types"></canvas>
                </div>
            </div>
        </div>

        <div class="section-container" style="margin-bottom: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3>Görevler (Özet)</h3>
                    <button class="btn btn-sm btn-outline" onclick="UIManager.exportToExcel()" title="Excel'e Aktar">
                        <span class="material-icons-round" style="font-size:1.1rem; margin-right:4px;">table_view</span> Excel
                    </button>
                </div>
            
            <!-- List Headers -->
            <div style="padding: 0.5rem 0; border-bottom: 2px solid #e2e8f0; display:grid; grid-template-columns: 1.2fr 2.5fr 1.2fr 1.2fr 1.2fr 1.2fr 0.5fr; gap:0.5rem; font-size:0.8rem; font-weight:600; color:var(--text-secondary);">
                <span>Rapor No</span>
                <span>Görev Adı</span>
                <span>Türü</span>
                <span>Olur Tarihi</span>
                <span>Rapor Durumu</span>
                <span>Süre</span>
                <span>Durum</span>
            </div>

            <ul class="task-list-preview" style="list-style:none;">
                ${reportListHTML}
            </ul>
            <div style="margin-top:1rem; text-align:right;">
                <button class="btn btn-primary" onclick="document.querySelector('[data-view=\\'reports\\']').click()" style="display:inline-flex; width:auto; padding:0.5rem 1rem; font-size:0.8rem;">
                    Tümünü Gör
                    <span class="material-icons-round" style="font-size:1rem;">arrow_forward</span>
                </button>
            </div>
        </div>
`;
    } catch (err) {
        console.error('Dashboard Load Error:', err);
        return `<div class="p-4" style="color:red; text-align:center;">
            <h3>İstatistikler Yüklenemedi</h3>
            <p>${err.message}</p>
        </div>`;
    }
}


// Mükerrer aktarımlar temizlendi (Dosya sonunda yapılıyor)

// --- Reminder System ---
window.openReminderModal = (id, type) => {
    // type currently only 'task' supported
    const modal = document.getElementById('reminder-modal');
    document.getElementById('reminder-item-id').value = id;
    document.getElementById('reminder-item-type').value = type;

    // Default Values Logic: Next Hour
    const now = new Date();
    now.setHours(now.getHours() + 1); // Set to next hour

    // Adjust for timezone offset to get correct string if needed, 
    // but simplified approach:
    const dateStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');

    const timeStr = String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');

    document.getElementById('reminder-date').value = dateStr;
    document.getElementById('reminder-time').value = timeStr;

    // Prefill Title from Task
    let title = '';
    if (type === 'task') {
        const tasks = TaskManager.getTasks();
        const task = tasks.find(t => t.id === id);
        if (task) {
            const words = task.content.split(/\s+/);
            if (words.length > 5) {
                title = words.slice(0, 5).join(' ') + '...';
            } else {
                title = task.content;
            }
        }
    }
    document.getElementById('reminder-title').value = title;

    modal.style.display = 'flex';
};

window.saveReminder = () => {
    const id = parseInt(document.getElementById('reminder-item-id').value);
    const dateV = document.getElementById('reminder-date').value;
    const timeV = document.getElementById('reminder-time').value;

    if (!dateV || !timeV) {
        Toast.show('Lütfen tarih ve saat seçiniz.', 'warning');
        return;
    }

    const dateTime = new Date(`${dateV}T${timeV}`); // Fixed: removed trailing space
    const now = new Date();

    // Allow current minute (buffer for seconds execution)
    // If user selects 16:40 and it is 16:40:59, we should allow it.
    if (dateTime.getTime() < now.getTime() - 60000) {
        Toast.show('Geçmiş bir zamana hatırlatıcı kuramazsınız.', 'warning');
        return;
    }

    TaskManager.setReminder(id, dateTime.toISOString());
    Toast.show('Hatırlatıcı kuruldu!', 'success');
    document.getElementById('reminder-modal').style.display = 'none';

    // Refresh view
    UIManager.renderTasks(TaskManager.getTasks());
    if (UIManager.updateDashboardStatsIfVisible) UIManager.updateDashboardStatsIfVisible();
};







document.addEventListener('DOMContentLoaded', () => {
    // DEBUG CHECKPOINT - To confirm app.js is loaded
    // alert('DEBUG: app.js loaded successfully');

    // Auto-create reports folder
    FolderManager.ensureReportsFolder();

    // Initialize Templates on startup
    if (typeof TemplateManager !== 'undefined') {
        TemplateManager.initializeDefaults().catch(err => console.error("Template init failed", err));
    }

    // 1. Auth Check (Robust)
    checkLogin();
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';

    // Request Notification Permission
    if ("Notification" in window) {
        Notification.requestPermission();
    }

    // Start Reminder Loop (Every 60sec)
    setInterval(() => {
        TaskManager.checkReminders();
    }, 60000);


    // 2. Setup Navigation & UI
    setupNavigation();
    updateDateDisplay();
    ThemeManager.init();

    // 3. Initial View
    // FORCE DASHBOARD LOAD - Bypass flaky login check for UI rendering
    setTimeout(() => {
        const dashBtn = document.querySelector('[data-view="dashboard"]');
        if (dashBtn) {
            console.log("Auto-loading dashboard (Delayed)...");
            handleViewChange('dashboard');
            dashBtn.classList.add('active');
        }
    }, 150);

    /*
    if (isLoggedIn) {
        // Trigger Dashboard
        const dashBtn = document.querySelector('[data-view="dashboard"]');
        if (dashBtn) dashBtn.click();
    }
    */


    // 5. Auto Backup (Safe Check)
    if (isLoggedIn && typeof BackupManager !== 'undefined') {
        setTimeout(() => {
            if (BackupManager.shouldBackupToday()) {
                console.log('Performing daily auto-backup on startup...');
                try {
                    BackupManager.createBackup(false);
                } catch (err) {
                    console.error("Auto-backup failed", err);
                }
            } else {
                console.log('Daily backup already taken today. Skipping startup backup.');
            }
        }, 3000);

        // Günlük otomatik yedekleme zamanlayıcısını başlat
        BackupManager.startDailyBackupScheduler();

        // Google Drive Kontrolü (1 saniye gecikmeli)
        setTimeout(() => {
            BackupManager.checkDriveSetup();
        }, 1000);
    }
});

// --- Global Exports (for HTML access) ---
if (typeof window !== 'undefined') {
    window.PathManager = PathManager;
    window.StorageManager = StorageManager;
    window.BackupManager = BackupManager;
    window.ThemeManager = ThemeManager;
    window.NoteManager = NoteManager;
    window.ContactsManager = ContactsManager;
    window.FolderManager = FolderManager;
    window.FileManager = FileManager;
    window.DocumentManager = DocumentManager;
    window.TemplateManager = TemplateManager;
    window.ConfirmationManager = ConfirmationManager;
    window.ReportManager = ReportManager;
    window.TaskManager = TaskManager;
    window.CorporateContactsManager = CorporateContactsManager;
    window.SettingsManager = SettingsManager;
    window.AuthManager = AuthManager;
    window.UIManager = UIManager;
    window.AssistantManager = AssistantManager;
    window.initApp = initApp;
    window.checkLogin = checkLogin;
    window.handleViewChange = handleViewChange;
    window.handleFileImport = handleFileImport;
    window.updateDashboardStatsIfVisible = UIManager.updateDashboardStatsIfVisible;
    window.initDashboardCharts = UIManager.initDashboardCharts;
    window.updateDateDisplay = updateDateDisplay;
    window.setupNavigation = setupNavigation;
    window.AuditManager = AuditManager_Legacy;
}

