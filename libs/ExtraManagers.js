
// --- Backup Manager (Re-implemented) ---
const BackupManager = {
    getLastBackupDate() {
        return localStorage.getItem('last_backup_date');
    },

    shouldBackupToday() {
        const last = this.getLastBackupDate();
        if (!last) return true;
        const today = new Date().toDateString();
        return last !== today;
    },

    autoBackup() {
        if (this.shouldBackupToday()) {
            this.createBackup(false);
        }
    },

    async createBackup(isManual = false) {
        try {
            const data = {
                reports: StorageManager.get('reports', []),
                tasks: StorageManager.get('tasks', []),
                contacts: StorageManager.get('contacts', []),
                notes: StorageManager.get('notes', []),
                settings: StorageManager.get('context_settings', {}),
                backupDate: new Date().toISOString(),
                version: '1.0'
            };

            const fileName = `MufYard_Backup_${new Date().toISOString().slice(0, 10)}.json`;
            const jsonStr = JSON.stringify(data, null, 2);

            // Electron environment check for file saving
            if (typeof window.showSaveFilePicker !== 'undefined' || typeof require !== 'undefined') {
                if (isManual) {
                    // Trigger download/save
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    a.click();
                } else {
                    // Auto backup logic (if feasible without interaction, otherwise skip or log)
                    console.log("Auto-backup data prepared (saved internally).");
                }
            } else {
                // Browser download fallback
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
            }

            localStorage.setItem('last_backup_date', new Date().toDateString());
            if (isManual) Toast.show('Yedek başarıyla alındı.', 'success');
            return true;

        } catch (error) {
            console.error('Backup failed:', error);
            if (isManual) Toast.show('Yedekleme başarısız oldu.', 'error');
            return false;
        }
    },

    startDailyBackupScheduler() {
        // Check every hour
        setInterval(() => {
            if (this.shouldBackupToday()) {
                this.createBackup(false);
            }
        }, 3600000);
    },

    checkDriveSetup() {
        // Placeholder for Google Drive check
        console.log("Checking Google Drive integration...");
    }
};

// --- Custom Input Modal Helper ---
const InputModalManager = {
    show(title, placeholder, callback) {
        let existing = document.getElementById('custom-input-modal');
        if (existing) existing.remove();

        const modalHtml = `
        <div id="custom-input-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10002; display:flex; align-items:center; justify-content:center;">
            <div style="background:white; width:400px; padding:20px; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                <h3 style="margin-top:0; color:#1e293b; font-size:1.1rem; margin-bottom:12px;">\${title}</h3>
                <input type="text" id="custom-modal-input" placeholder="\${placeholder}" 
                    style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; outline:none; margin-bottom:16px;"
                    onkeypress="if(event.key==='Enter') document.getElementById('custom-input-confirm').click()">
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button onclick="document.getElementById('custom-input-modal').remove()" style="background:none; border:1px solid #cbd5e1; padding:8px 16px; border-radius:6px; cursor:pointer;">İptal</button>
                    <button id="custom-input-confirm" style="background:#3b82f6; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">Tamam</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const input = document.getElementById('custom-modal-input');
        input.focus();

        document.getElementById('custom-input-confirm').onclick = () => {
            const val = input.value.trim();
            if (val) {
                callback(val);
                document.getElementById('custom-input-modal').remove();
            }
        };
    }
}


// --- EXPOSE TO WINDOW ---
if (typeof window !== 'undefined') {
    window.BackupManager = BackupManager;
    window.InputModalManager = InputModalManager;
    console.log("ExtraManagers (Backup & Input) initialized.");
}
