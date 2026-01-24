// --- Audit Manager (Multi-File Support) ---
const AuditManager = {
    data: [], // Parsed Excel Structure (Sheets & Questions)
    activeFormTab: 0, // Tab index for the Excel Form sheets
    activeSection: 'info', // Top-level section: 'info', 'notes', 'photos', 'form'
    currentAuditId: null,
    currentAuditName: null,

    // 1. Dashboard View (List of Audits)
    initView: () => {
        const container = document.getElementById('content-area');
        const audits = StorageManager.get('audit_records', []);

        // --- Migration Logic: Recover Old Data ---
        const oldData = StorageManager.get('audit_form_state');
        if (oldData && Object.keys(oldData).length > 0) {
            const recoveryId = 'audit_recovery_' + Date.now();
            const recoveryRecord = {
                id: recoveryId,
                name: 'Otomatik Yedek (Eski Veriler)',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                data: { form: oldData, info: {}, notes: '', photos: [] }, // Migrated to new structure
                progress: 0
            };
            // Add to audits list and save
            audits.unshift(recoveryRecord);
            StorageManager.set('audit_records', audits);

            // Clear old data to prevent re-migration
            StorageManager.set('audit_form_state', null);

            Toast.show('Eski verileriniz "Otomatik Yedek" olarak kurtarıldı.', 'info');
        }

        let auditListHtml = '';
        if (audits.length === 0) {
            auditListHtml = `
                <div class="empty-state">
                    <span class="material-icons-round" style="font-size:3rem; color:var(--text-muted); opacity:0.5;">folder_open</span>
                    <p>Henüz kayıtlı bir denetim yok.</p>
                </div>`;
        } else {
            const reports = (typeof ReportManager !== 'undefined') ? ReportManager.getReports() : [];

            auditListHtml = `<div class="audit-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:1rem;">
                ${audits.map(audit => {
                const linkedReport = audit.linkedReportId ? reports.find(r => r.id == audit.linkedReportId) : null;
                const linkedHtml = linkedReport ? `<div style="font-size:0.75rem; color:var(--primary-color); margin-top:0.25rem;">Bağlantılı İş: ${linkedReport.code ? linkedReport.code : ''} ${linkedReport.title}</div>` : '';

                return `
                    <div class="card" style="cursor:pointer; transition:transform 0.2s; border:1px solid var(--border-color);" onclick="AuditManager.loadAudit('${audit.id}')">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="font-weight:600; font-size:1.05rem; margin-bottom:0.5rem;">${audit.name}</div>
                            <button class="btn btn-icon" onclick="event.stopPropagation(); AuditManager.deleteAudit('${audit.id}')" title="Sil">
                                <span class="material-icons-round" style="color:var(--danger); font-size:1.2rem;">delete</span>
                            </button>
                        </div>
                        <div style="font-size:0.85rem; color:var(--text-secondary);">
                            <div>Tarih: ${new Date(audit.updatedAt || audit.createdAt).toLocaleDateString('tr-TR')}</div>
                            <div style="margin-top:0.25rem;">Durum: %${audit.progress || 0} tamamlandı</div>
                            ${linkedHtml}
                        </div>
                    </div>`;
            }).join('')}
            </div>`;
        }

        container.innerHTML = `
            <div id="view-audit-dashboard" class="view-section">
                <div class="header-actions" style="justify-content:space-between; margin-bottom:1.5rem;">
                    <h3>Denetim Dosyaları</h3>
                    <button class="btn btn-primary" onclick="AuditManager.promptNewAudit()">
                        <span class="material-icons-round">add</span> Yeni Denetim Başlat
                    </button>
                </div>
                ${auditListHtml}
            </div>`;
    },

    // 2. Start New Audit Flow
    promptNewAudit: () => {
        // Mevcut Görevleri Al
        const reports = (typeof ReportManager !== 'undefined') ? ReportManager.getReports() : [];
        const activeReports = reports.filter(r => r.status !== 'tamamlandi');

        const reportOptions = activeReports.map(r =>
            `<option value="${r.id}" data-title="${r.title}">${r.code ? r.code + ' - ' : ''}${r.title}</option>`
        ).join('');

        // Create dynamic modal
        const modalId = 'new-audit-modal-' + Date.now();
        const modalHtml = `
        <div id="${modalId}" class="modal" style="display:flex; justify-content:center; align-items:center; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000;">
            <div class="modal-content" style="background:var(--bg-card); padding:2rem; border-radius:1rem; width:450px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                <h3 style="margin-bottom:1rem; color:var(--text-main);">Yeni Denetim Başlat</h3>
                
                <div class="form-group" style="margin-bottom:1rem;">
                    <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary); font-size:0.9rem;">Hangi İş İçin?</label>
                    <select id="${modalId}-report-select" style="width:100%; padding:0.75rem; border:1px solid var(--border-color); border-radius:0.5rem; background:var(--bg-main); color:var(--text-main); font-size:1rem;">
                        <option value="">-- Görev Seçin (Veya Boş Bırakın) --</option>
                        ${reportOptions}
                    </select>
                </div>

                <div class="form-group" style="margin-bottom:1.5rem;">
                    <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary); font-size:0.9rem;">Denetim Dosyası İsmi</label>
                    <input type="text" id="${modalId}-input" placeholder="Örn: A Yurt Müdürlüğü" 
                        style="width:100%; padding:0.75rem; border:1px solid var(--border-color); border-radius:0.5rem; background:var(--bg-main); color:var(--text-main); font-size:1rem;">
                </div>

                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn btn-outline" onclick="document.getElementById('${modalId}').remove()">İptal</button>
                    <button class="btn btn-primary" id="${modalId}-btn">Oluştur</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const select = document.getElementById(`${modalId}-report-select`);
        const input = document.getElementById(`${modalId}-input`);
        const btn = document.getElementById(`${modalId}-btn`);

        // Görev seçildiğinde ismi otomatik doldur
        select.onchange = () => {
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption.value) {
                input.value = selectedOption.getAttribute('data-title');
            }
        };

        input.focus();

        const create = () => {
            const name = input.value.trim();
            const linkedReportId = select.value;
            if (name) {
                AuditManager.createNewAudit(name, linkedReportId);
                document.getElementById(modalId).remove();
            } else {
                Toast.show('Lütfen bir isim giriniz.', 'warning');
            }
        };

        btn.onclick = create;
        input.onkeypress = (e) => {
            if (e.key === 'Enter') create();
        };

        // Close on escape
        input.onkeydown = (e) => {
            if (e.key === 'Escape') document.getElementById(modalId).remove();
        };
    },

    createNewAudit: (name, linkedReportId = null) => {
        const newId = 'audit_' + Date.now();
        let folderPath = null;

        // PC Modu (Electron) ise Fiziksel Klasör Oluştur
        if (typeof require !== 'undefined' && linkedReportId) {
            try {
                const reports = ReportManager.getReports();
                const report = reports.find(r => r.id == linkedReportId);
                if (report) {
                    const taskFolder = FolderManager.getFolderForReport(report);
                    const fs = require('fs');
                    const path = require('path');

                    // Hiyerarşi: Ana Görev > Yurt denetimi > Yurt İsmi
                    const baseAuditDir = path.join(taskFolder, 'Yurt denetimi');
                    const safeName = name.replace(/[\u003c\u003e:\"/\\\\|?*]/g, '_');
                    folderPath = path.join(baseAuditDir, safeName);

                    if (!fs.existsSync(folderPath)) {
                        fs.mkdirSync(folderPath, { recursive: true });
                    }
                }
            } catch (e) {
                console.error('Klasör oluşturma hatası:', e);
            }
        }

        const newRecord = {
            id: newId,
            name: name,
            linkedReportId: linkedReportId,
            folderPath: folderPath, // Fiziksel yol kaydedildi
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            data: { form: {}, info: {}, notes: '', photos: [] },
            progress: 0
        };

        StorageManager.addToArray('audit_records', newRecord);
        AuditManager.loadAudit(newId);
    },

    deleteAudit: (id) => {
        if (confirm('Bu denetim dosyası silinecek. Emin misiniz?')) {
            StorageManager.removeFromArray('audit_records', 'id', id);
            AuditManager.initView(); // Refresh list
            Toast.show('Dosya silindi.', 'success');
        }
    },

    // 3. Load & Edit Audit (Profile View)
    loadAudit: (id) => {
        // Find record
        const audits = StorageManager.get('audit_records', []);
        const record = audits.find(a => a.id === id);

        if (!record) {
            Toast.show('Kayıt bulunamadı.', 'error');
            AuditManager.initView();
            return;
        }

        AuditManager.currentAuditId = id;
        AuditManager.currentAuditName = record.name;
        AuditManager.activeSection = 'info'; // Default to Info tab

        // Setup UI for Editing
        AuditManager.renderEditor();
        AuditManager.loadFormTemplate(); // Load Excel structure for form tab
    },

    renderEditor: () => {
        const container = document.getElementById('content-area');

        // Tab Styles
        const getTabStyle = (section) => {
            const isActive = AuditManager.activeSection === section;
            return `padding: 0.75rem 1.5rem; cursor: pointer; border-bottom: 2px solid ${isActive ? 'var(--primary-color)' : 'transparent'}; color: ${isActive ? 'var(--primary-color)' : 'var(--text-secondary)'}; font-weight: ${isActive ? '600' : '400'}; transition: all 0.2s; font-size:0.95rem;`;
        };

        container.innerHTML = `
            <div id="view-audit-editor" class="view-section" style="height: 100vh; display: flex; flex-direction: column;">
                <!-- Header -->
                <div class="header-actions" style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom: 0.5rem; flex-shrink: 0;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                         <button class="btn btn-icon" onclick="AuditManager.initView()" title="Geri">
                            <span class="material-icons-round">arrow_back</span>
                        </button>
                        <div>
                            <h3 style="margin:0;">${AuditManager.currentAuditName}</h3>
                            <span style="font-size:0.8rem; color:var(--text-secondary);">Denetim Dosyası</span>
                        </div>
                    </div>
                    
                    <!-- Save Button positioned Top-Right -->
                    <button class="btn btn-outline" onclick="AuditManager.saveAll()" style="border:none; color:var(--text-secondary); margin-left:auto;">
                        <span class="material-icons-round" style="margin-right:0.25rem;">save</span> Kaydet
                    </button>
                </div>

                <!-- Section Tabs -->
                <div style="display:flex; border-bottom:1px solid var(--border-color); flex-shrink: 0;">
                    <div onclick="AuditManager.switchSection('info')" style="${getTabStyle('info')}">Yurt Bilgileri</div>
                    <div onclick="AuditManager.switchSection('notes')" style="${getTabStyle('notes')}">Notlar</div>
                    <div onclick="AuditManager.switchSection('photos')" style="${getTabStyle('photos')}">Fotoğraflar</div>
                    <div onclick="AuditManager.switchSection('form')" style="${getTabStyle('form')}">Denetim Formu</div>
                </div>

                <!-- Dynamic Content Area -->
                <div id="audit-section-content" class="card" style="padding: 1rem; flex: 1; overflow-y: auto; margin-top:0;">
                    <!-- Content will be injected here -->
                </div>
            </div>`;

        AuditManager.renderSectionContent();
    },

    switchSection: (section) => {
        AuditManager.activeSection = section;
        AuditManager.renderEditor();
    },

    renderSectionContent: () => {
        const contentDiv = document.getElementById('audit-section-content');
        if (!contentDiv) return;

        const record = AuditManager.getRecord();
        const data = record.data || {};

        if (AuditManager.activeSection === 'info') {
            // --- INFO TAB ---
            const info = data.info || {};
            contentDiv.innerHTML = `
                <div style="max-width: 800px; margin: 0 auto; padding-top:0.5rem;">
                    <h4 style="margin-bottom:1rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem; font-size:1rem;">Genel Bilgiler</h4>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                        <div class="form-group">
                            <label>Yurt Müdürünün Adı Soyadı</label>
                            <input type="text" onchange="AuditManager.updateInfo('managerName', this.value)" value="${info.managerName || ''}" placeholder="Ad Soyad" style="width:100%; padding:0.6rem; border:1px solid var(--border-color); border-radius:4px;">
                        </div>
                         <div class="form-group">
                            <label>Yurt Kapasitesi</label>
                            <input type="text" onchange="AuditManager.updateInfo('capacity', this.value)" value="${info.capacity || ''}" placeholder="Örn: 500" style="width:100%; padding:0.6rem; border:1px solid var(--border-color); border-radius:4px;">
                        </div>
                        <div class="form-group">
                            <label>Personel Sayısı</label>
                            <input type="text" onchange="AuditManager.updateInfo('staffCount', this.value)" value="${info.staffCount || ''}" placeholder="Örn: 25" style="width:100%; padding:0.6rem; border:1px solid var(--border-color); border-radius:4px;">
                        </div>
                        <div class="form-group">
                            <label>Blok Sayısı</label>
                            <input type="text" onchange="AuditManager.updateInfo('blockCount', this.value)" value="${info.blockCount || ''}" placeholder="Örn: 3" style="width:100%; padding:0.6rem; border:1px solid var(--border-color); border-radius:4px;">
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Adres</label>
                            <textarea onchange="AuditManager.updateInfo('address', this.value)" rows="3" placeholder="Yurt adresi..." style="width:100%; padding:0.6rem; border:1px solid var(--border-color); border-radius:4px;">${info.address || ''}</textarea>
                        </div>
                    </div>
                </div>`;

        } else if (AuditManager.activeSection === 'notes') {
            // --- NOTES TAB ---
            const notes = data.generalNotes || '';
            contentDiv.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column; padding-top:0.5rem;">
                     <h4 style="margin-bottom:0.5rem; font-size:1rem;">Denetim Notları</h4>
                     <textarea style="flex: 1; padding: 1rem; border: 1px solid var(--border-color); border-radius: 0.5rem; font-family: inherit; line-height: 1.6; resize: none;"
                        placeholder="Yurt ile ilgili genel tespitlerinizi buraya yazabilirsiniz..."
                        onchange="AuditManager.updateGeneralNotes(this.value)">${notes}</textarea>
                </div>`;

        } else if (AuditManager.activeSection === 'photos') {
            // --- PHOTOS TAB ---
            const photos = data.photos || [];
            const photosHtml = photos.map((photo, idx) => `
                <div style="position: relative; width: 140px; height: 140px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background:#eee;">
                    <img src="${photo}" style="width: 100%; height: 100%; object-fit: cover; cursor:pointer;" onclick="AuditManager.viewPhoto('${photo}')">
                    <button onclick="AuditManager.deletePhoto(${idx})" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;">&times;</button>
                </div>
            `).join('');

            contentDiv.innerHTML = `
                <div style="padding-top:0.5rem;">
                     <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">
                        <h4 style="margin:0; font-size:1rem;">Fotoğraf Galerisi</h4>
                        <button class="btn btn-outline" onclick="document.getElementById('photo-upload').click()" style="padding:0.4rem 0.8rem; font-size:0.85rem;">
                            <span class="material-icons-round" style="font-size:1.1rem;">add_a_photo</span> Ekle
                        </button>
                        <input type="file" id="photo-upload" accept="image/*" style="display: none;" onchange="AuditManager.handlePhotoUpload(this)">
                     </div>
                     <div style="display: flex; flex-wrap: wrap; gap: 0.8rem;">
                        ${photos.length > 0 ? photosHtml : '<p style="color:var(--text-secondary); font-size:0.9rem;">Henüz fotoğraf eklenmemiş.</p>'}
                     </div>
                </div>`;

        } else if (AuditManager.activeSection === 'form') {
            // --- FORM TAB ---
            AuditManager.renderFormTab(contentDiv);
        }
    },

    renderFormTab: (container) => {
        if (!AuditManager.data || AuditManager.data.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <p>Form şablonu yükleniyor...</p>
                ${AuditManager.data.length === 0 ? '<button class="btn btn-outline" onclick="AuditManager.loadFormTemplate()">Tekrar Dene</button>' : ''}
            </div>`;
            return;
        }

        const record = AuditManager.getRecord();
        const savedState = record.data.form || record.data || {}; // Fallback for migration

        // Tabs for Sheets + Excel Button aligned
        const tabsHtml = `
            <div style="display:flex; overflow-x:auto; padding-bottom:0.5rem; gap:0.5rem; flex:1; margin-right:1rem;">
                ${AuditManager.data.map((sheet, index) => {
            const isActive = index === AuditManager.activeFormTab;
            return `<button onclick="AuditManager.switchFormTab(${index})" 
                        style="padding:0.4rem 0.9rem; background:${isActive ? 'var(--primary-color)' : 'transparent'}; color:${isActive ? '#fff' : 'var(--text-main)'}; border:1px solid ${isActive ? 'var(--primary-color)' : 'var(--border-color)'}; border-radius:2rem; cursor:pointer; font-size:0.8rem; white-space:nowrap; transition:all 0.2s;">
                        ${sheet.name}
                    </button>`;
        }).join('')}
            </div>`;

        const activeSheet = AuditManager.data[AuditManager.activeFormTab];
        let itemsHtml = '';

        if (activeSheet && activeSheet.items) {
            activeSheet.items.forEach(item => {
                if (item.type === 'header') {
                    itemsHtml += `<div style="background:var(--bg-main); padding:0.5rem; margin-top:1rem; border-left:3px solid var(--primary-color); font-weight:600; font-size:0.9rem;">${item.title}</div>`;
                } else if (item.type === 'question') {
                    const yesChecked = savedState[item.id] === 'yes' ? 'checked' : '';
                    const noChecked = savedState[item.id] === 'no' ? 'checked' : '';
                    const note = savedState[`note_${item.id}`] || '';

                    itemsHtml += `<div class="audit-item" style="padding:0.8rem; border-bottom:1px solid var(--border-color);">
                            <div style="margin-bottom:0.4rem; font-size:0.9rem;">${item.text}</div>
                            <div style="display:flex; gap:1rem; align-items:center;">
                                <label style="cursor:pointer; display:flex; align-items:center; font-size:0.9rem;"><input type="radio" name="${item.id}" value="yes" ${yesChecked} onchange="AuditManager.updateFormState('${item.id}', 'yes')"> <span style="margin-left:4px;">Evet</span></label>
                                <label style="cursor:pointer; display:flex; align-items:center; font-size:0.9rem;"><input type="radio" name="${item.id}" value="no" ${noChecked} onchange="AuditManager.updateFormState('${item.id}', 'no')"> <span style="margin-left:4px;">Hayır</span></label>
                                <input type="text" placeholder="Not..." value="${note}" onchange="AuditManager.updateFormNote('${item.id}', this.value)" style="flex:1; padding:0.3rem 0.5rem; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem;">
                            </div>
                    </div>`;
                }
            });
        }

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; border-bottom:1px solid var(--border-color); padding-bottom:0.25rem; padding-top:0.5rem;">
                ${tabsHtml}
                 <button class="btn btn-outline" onclick="AuditManager.exportToExcel()" style="color:var(--success); border-color:var(--success); font-size:0.8rem; padding:0.4rem 0.8rem; white-space:nowrap; display:flex; align-items:center; gap:0.3rem;">
                    <span class="material-icons-round" style="font-size:1rem;">file_download</span> Excel
                </button>
            </div>
            
            <div style="background:var(--bg-card); border-radius:8px;">${itemsHtml}</div>
        `;
    },

    switchFormTab: (index) => {
        AuditManager.activeFormTab = index;
        AuditManager.renderEditor();
    },

    // --- DATA UPDATES ---
    getRecord: () => {
        const audits = StorageManager.get('audit_records', []);
        return audits.find(a => a.id === AuditManager.currentAuditId) || { data: {} };
    },

    saveRecord: (record) => {
        const audits = StorageManager.get('audit_records', []);
        const idx = audits.findIndex(a => a.id === record.id);
        if (idx !== -1) {
            audits[idx] = record;
            audits[idx].updatedAt = new Date().toISOString();
            StorageManager.set('audit_records', audits);
        }
    },

    updateInfo: (field, value) => {
        const record = AuditManager.getRecord();
        if (!record.data.info) record.data.info = {};
        record.data.info[field] = value;
        AuditManager.saveRecord(record);
    },

    updateGeneralNotes: (value) => {
        const record = AuditManager.getRecord();
        record.data.generalNotes = value;
        AuditManager.saveRecord(record);
    },

    handlePhotoUpload: async (input) => {
        if (input.files && input.files[0]) {
            try {
                const file = input.files[0];
                const Toast = window.Toast || { show: console.log };

                Toast.show('Fotoğraf işleniyor...', 'info');

                const compressedDataUrl = await AuditManager.compressImage(file);
                const record = AuditManager.getRecord();

                // PC Modu (Electron) ise Fiziksel Kaydet
                if (typeof require !== 'undefined' && record.folderPath) {
                    const fs = require('fs');
                    const path = require('path');

                    try {
                        const now = new Date();
                        const timestamp = now.toISOString().replace(/[:.]/g, '-');
                        const fileName = `foto_${timestamp}.jpg`;
                        const targetPath = path.join(record.folderPath, fileName);

                        // Base64 to Buffer
                        const base64Data = compressedDataUrl.replace(/^data:image\/\w+;base64,/, "");
                        const buffer = Buffer.from(base64Data, 'base64');

                        fs.writeFileSync(targetPath, buffer);

                        // Fiziksel yolu da kaydet (veya base64 devam etsin görüntüleme için)
                        if (!record.data.photos) record.data.photos = [];
                        record.data.photos.push(compressedDataUrl); // Hızlı render için base64 tutmaya devam ediyoruz
                    } catch (fsErr) {
                        console.error('Fiziksel fotoğraf kaydı hatası:', fsErr);
                    }
                } else {
                    // Mobile/Web Modu: Sadece hafızaya (base64)
                    if (!record.data.photos) record.data.photos = [];
                    record.data.photos.push(compressedDataUrl);
                }

                AuditManager.saveRecord(record);
                AuditManager.renderEditor();
                Toast.show('Fotoğraf eklendi.', 'success');
            } catch (error) {
                console.error('Fotoğraf yükleme hatası:', error);
                const Toast = window.Toast || { show: console.error };
                Toast.show('Fotoğraf işlenirken hata oluştu: ' + (error.message || error), 'error');
            }
            input.value = ''; // Reset input
        }
    },

    compressImage: (file) => {
        return new Promise((resolve, reject) => {
            const maxWidth = 1024;
            const maxHeight = 1024;
            const quality = 0.7;

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round(height * (maxWidth / width));
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round(width * (maxHeight / height));
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = (error) => reject(new Error('Görsel yüklenemedi.'));
            };
            reader.onerror = (error) => reject(new Error('Dosya okunamadı.'));
        });
    },

    deletePhoto: (index) => {
        if (confirm('Fotoğraf silinsin mi?')) {
            const record = AuditManager.getRecord();
            record.data.photos.splice(index, 1);
            AuditManager.saveRecord(record);
            AuditManager.renderEditor();
        }
    },

    viewPhoto: (src) => {
        const modalHtml = `
            <div id="photo-viewer" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10001; display:flex; justify-content:center; align-items:center;" onclick="this.remove()">
                <img src="${src}" style="max-width:90%; max-height:90%; border-radius:4px;">
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    updateFormState: (id, value) => {
        const record = AuditManager.getRecord();
        if (!record.data.form) record.data.form = {};
        record.data.form[id] = value;
        AuditManager.saveRecord(record);
    },

    updateFormNote: (id, value) => {
        const record = AuditManager.getRecord();
        if (!record.data.form) record.data.form = {};
        record.data.form[`note_${id}`] = value;
        AuditManager.saveRecord(record);
    },

    saveAll: () => {
        Toast.show('Tüm değişiklikler kaydedildi.', 'success');
    },

    exportToExcel: async () => {
        try {
            if (typeof XLSX === 'undefined') return;

            let workbook;
            let fileName;

            // --- ELECTRON ENVIRONMENT ---
            if (typeof require !== 'undefined') {
                const fs = require('fs');
                const path = require('path');

                // Öncelik 1: Uygulama İçi (Embedded/ASAR)
                let templatePath = path.join(__dirname, 'Sablonlar', 'denetim_formu.xlsx');

                // Fallback: Bulunamazsa cwd kontrol et (Dev ortamı için)
                if (!fs.existsSync(templatePath)) {
                    templatePath = path.join(process.cwd(), 'Sablonlar', 'denetim_formu.xlsx');
                }

                // Fallback: Resources
                if (!fs.existsSync(templatePath) && process.resourcesPath) {
                    templatePath = path.join(process.resourcesPath, 'Sablonlar', 'denetim_formu.xlsx');
                }

                const fileBuffer = fs.readFileSync(templatePath);
                workbook = XLSX.read(fileBuffer, { type: 'buffer' });

                // File Name
                const record = AuditManager.getRecord();
                const safeName = record.name.replace(/[^a-z0-9]/gi, '_');
                const dateStr = new Date().toISOString().slice(0, 10);
                fileName = `${safeName}_Raporu_${dateStr}.xlsx`;

                // Desktop Save Path logic (Electron specific)
                // We will use standard write which might save to app folder or desktop depending on path
                // But let's stick to the modification logic below first
            }
            // --- BROWSER ENVIRONMENT ---
            else {
                const response = await fetch('Sablonlar/denetim_formu.xlsx');
                if (!response.ok) throw new Error('Şablon dosyası indirilemedi');
                const arrayBuffer = await response.arrayBuffer();
                workbook = XLSX.read(arrayBuffer, { type: 'array' });

                const record = AuditManager.getRecord();
                const safeName = record.name.replace(/[^a-z0-9]/gi, '_');
                const dateStr = new Date().toISOString().slice(0, 10);
                fileName = `${safeName}_Raporu_${dateStr}.xlsx`;
            }

            // --- COMMON LOGIC: FILL WORKBOOK ---
            const record = AuditManager.getRecord();
            const savedState = record.data.form || record.data || {};

            AuditManager.data.forEach(sheetObj => {
                const worksheet = workbook.Sheets[sheetObj.name];
                if (!worksheet) return;
                sheetObj.items.forEach(item => {
                    if (item.type !== 'question') return;
                    const ans = savedState[item.id];
                    const note = savedState[`note_${item.id}`];

                    const parts = item.id.split('_');
                    const rowIndex = parseInt(parts[parts.length - 1]);

                    if (!isNaN(rowIndex)) {
                        const cellRefEvet = XLSX.utils.encode_cell({ c: 1, r: rowIndex });
                        const cellRefHayir = XLSX.utils.encode_cell({ c: 2, r: rowIndex });
                        const cellRefNot = XLSX.utils.encode_cell({ c: 3, r: rowIndex });

                        if (ans === 'yes') {
                            worksheet[cellRefEvet] = { t: 's', v: 'X' };
                            if (worksheet[cellRefHayir]) delete worksheet[cellRefHayir];
                        } else if (ans === 'no') {
                            worksheet[cellRefHayir] = { t: 's', v: 'X' };
                            if (worksheet[cellRefEvet]) delete worksheet[cellRefEvet];
                        }
                        if (note) worksheet[cellRefNot] = { t: 's', v: note };
                    }
                });
            });

            // --- SAVE / DOWNLOAD ---
            if (typeof require !== 'undefined') {
                // Electron: Kaydet
                const fs = require('fs');
                const path = require('path');
                const record = AuditManager.getRecord();

                let targetSavePath;
                if (record.folderPath && fs.existsSync(record.folderPath)) {
                    // Bağlantılı Görev Klasörüne Kaydet
                    targetSavePath = path.join(record.folderPath, fileName);
                    XLSX.writeFile(workbook, targetSavePath);
                    Toast.show(`Rapor görev klasörüne kaydedildi:\n${fileName}`, 'success');
                } else {
                    // Bağlantı yoksa Masaüstüne Kaydet
                    targetSavePath = path.join(process.env.USERPROFILE, 'Desktop', fileName);
                    XLSX.writeFile(workbook, targetSavePath);
                    Toast.show(`Masaüstüne kaydedildi:\n${fileName}`, 'success');
                }
            } else {
                // Browser: Trigger Download
                XLSX.writeFile(workbook, fileName);
                Toast.show('Rapor indirildi.', 'success');
            }

        } catch (e) {
            console.error(e);
            Toast.show('Hata: ' + e.message, 'error');
        }
    },

    loadFormTemplate: () => {
        if (AuditManager.data && AuditManager.data.length > 0) return;

        setTimeout(async () => {
            try {
                if (typeof XLSX === 'undefined') throw new Error('XLSX eksik.');

                let fileBuffer;

                // --- ELECTRON / NODE ENVIRONMENT ---
                if (typeof require !== 'undefined') {
                    const fs = require('fs');
                    const path = require('path');

                    // Öncelik 1: Uygulama İçi (Embedded/ASAR)
                    let filePath = path.join(__dirname, 'Sablonlar', 'denetim_formu.xlsx');

                    // Fallback: Bulunamazsa cwd kontrol et (Dev ortamı için)
                    if (!fs.existsSync(filePath)) {
                        filePath = path.join(process.cwd(), 'Sablonlar', 'denetim_formu.xlsx');
                    }

                    // Fallback: Resources (Eski yapı kalıntısı veya harici kaynak)
                    if (!fs.existsSync(filePath) && process.resourcesPath) {
                        filePath = path.join(process.resourcesPath, 'Sablonlar', 'denetim_formu.xlsx');
                    }

                    fileBuffer = fs.readFileSync(filePath);
                }
                // --- BROWSER / GITHUB PAGES ENVIRONMENT ---
                else {
                    const response = await fetch('Sablonlar/denetim_formu.xlsx');
                    if (!response.ok) throw new Error('Şablon dosyası indirilemedi');
                    fileBuffer = await response.arrayBuffer();
                }

                // Common Parsing Logic
                const workbook = XLSX.read(fileBuffer, { type: 'array' }); // type: 'array' works for both buffer and ArrayBuffer
                let sheets = [];
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                    if (rows.length < 2) return;
                    let sheetItems = [];
                    let currentSection = sheetName.trim();
                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0) continue;
                        const col0 = String(row[0] || '').trim();
                        const col1 = String(row[1] || '').trim();
                        const col2 = String(row[2] || '').trim();
                        if (col1 === 'Evet' && col2 === 'Hayır') {
                            if (col0 && col0 !== currentSection) { currentSection = col0; sheetItems.push({ type: 'header', title: currentSection }); }
                            continue;
                        }
                        if (col0 && !col1 && !col2) {
                            const uniqueId = `${sheetName}_${i}`.replace(/\s/g, '_');
                            sheetItems.push({ type: 'question', id: uniqueId, text: col0, section: currentSection });
                        }
                    }
                    if (sheetItems.length > 0) sheets.push({ name: sheetName.trim(), items: sheetItems });
                });
                AuditManager.data = sheets;
                if (AuditManager.activeSection === 'form') AuditManager.renderEditor();

            } catch (error) {
                console.error("Şablon Yükleme Hatası:", error);
                Toast.show("Şablon yüklenemedi: " + error.message, 'error');
            }
        }, 50);
    }
};
