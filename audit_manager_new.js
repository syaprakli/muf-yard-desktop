
// --- Audit Manager (Multi-File Support & Dynamic Types) ---
// Migrated from Exported Page
// Migrated from Exported Page
window.AuditManager = {
    data: null, // Parsed Excel Structure (Sheets & Questions)
    activeFormTab: 0,
    activeSection: 'info', // 'info', 'notes', 'photos', 'form'
    currentAuditId: null,
    currentAuditName: null,
    currentAuditType: null, // 'il_mudurlugu', 'kyk_yurt', etc.
    currentTemplate: null, // 'template_yurt.xlsx' etc.

    // Hardcoded Templates for Fallback (CORS/Browser support)
    TEMPLATES: {
        'Özel Yurt/template_ozel_yurt.xlsx': [
            {
                name: "Özel Yurt Denetimi", items: [
                    { type: 'question', id: 'q1', text: 'Kurum açma izin belgesi mevcut mu?', area: 'Genel' },
                    { type: 'question', id: 'q2', text: 'Yangın merdiveni ve çıkışları açık ve kullanılabilir mi?', area: 'Güvenlik' },
                    { type: 'question', id: 'q3', text: 'Yemekhane hijyen kurallarına uygun mu?', area: 'Sağlık' },
                    { type: 'question', id: 'q4', text: 'Öğrenci kayıt defteri güncel tutuluyor mu?', area: 'İdari' },
                    { type: 'question', id: 'q5', text: 'Personel çalışma izinleri tam mı?', area: 'Personel' },
                    { type: 'question', id: 'q6', text: 'Isıtma ve havalandırma sistemleri çalışıyor mu?', area: 'Teknik' },
                    { type: 'question', id: 'q7', text: 'Güvenlik kameraları aktif mi?', area: 'Güvenlik' },
                    { type: 'question', id: 'q8', text: 'Ecza dolabı ve ilk yardım malzemeleri tam mı?', area: 'Sağlık' }
                ]
            }
        ],
        'Federasyon/template_federasyon.xlsx': [
            {
                name: "Federasyon Denetimi", items: [
                    { type: 'question', id: 'q1', text: 'Federasyon ana statüsü mevzuata uygun mu?', area: 'Hukuk' },
                    { type: 'question', id: 'q2', text: 'Genel kurul tutanakları usulüne uygun tutulmuş mu?', area: 'İdari' },
                    { type: 'question', id: 'q3', text: 'Yönetim kurulu karar defteri mevcut ve onaylı mı?', area: 'İdari' },
                    { type: 'question', id: 'q4', text: 'Harcamalar bütçe talimatına uygun yapılmış mı?', area: 'Mali' },
                    { type: 'question', id: 'q5', text: 'Personel özlük dosyaları tam mı?', area: 'Personel' },
                    { type: 'question', id: 'q6', text: 'Sponsorluk sözleşmeleri dosyalanmış mı?', area: 'Mali' },
                    { type: 'question', id: 'q7', text: 'Mal ve hizmet alımları ihale yönetmeliğine uygun mu?', area: 'Mali' },
                    { type: 'question', id: 'q8', text: 'Demirbaş eşya defteri güncel mi?', area: 'İdari' }
                ]
            }
        ],
        'Kulüp/template_kulup.xlsx': [
            {
                name: "Spor Kulübü Denetimi", items: [
                    { type: 'question', id: 'q1', text: 'Dernekler masası / Spor İl Müd. tescil belgesi var mı?', area: 'Hukuk' },
                    { type: 'question', id: 'q2', text: 'Üye kayıt defteri güncel mi?', area: 'İdari' },
                    { type: 'question', id: 'q3', text: 'Karar defteri noter tasdikli mi?', area: 'İdari' },
                    { type: 'question', id: 'q4', text: 'Alındı belgeleri ve faturalar düzenli saklanıyor mu?', area: 'Mali' },
                    { type: 'question', id: 'q5', text: 'Antrenör sözleşmeleri ve vizeleri tam mı?', area: 'Sportif' },
                    { type: 'question', id: 'q6', text: 'Sporcu lisansları güncel mi?', area: 'Sportif' },
                    { type: 'question', id: 'q7', text: 'Yıllık beyanname zamanında verilmiş mi?', area: 'Hukuk' },
                    { type: 'question', id: 'q8', text: 'Lokal açma izni var mı (varsa)?', area: 'İdari' }
                ]
            }
        ],
        'İl Denetim/il.xlsx': [
            {
                name: "İl Müdürlüğü Denetimi", items: [
                    { type: 'question', id: 'q1', text: 'Yatırım projeleri planlamaya uygun ilerliyor mu?', area: 'Yatırım' },
                    { type: 'question', id: 'q2', text: 'Tesislerin bakım ve onarımı düzenli yapılıyor mu?', area: 'Tesisler' },
                    { type: 'question', id: 'q3', text: 'Personel devam takibi yapılıyor mu?', area: 'Personel' },
                    { type: 'question', id: 'q4', text: 'Gelen/Giden evrak kayıtları düzenli mi?', area: 'İdari' },
                    { type: 'question', id: 'q5', text: 'Taşınır işlem fişleri güncel mi?', area: 'Mali' }
                ]
            }
        ],
        'Kyk Yurt Denetim Şablonu/template_yurt.xlsx': [
            {
                name: "KYK Yurt Denetimi", items: [
                    { type: 'question', id: 'q1', text: 'Öğrenci giriş-çıkış sistemi aktif mi?', area: 'Güvenlik' },
                    { type: 'question', id: 'q2', text: 'Yemekhane numune alma işlemi yapılıyor mu?', area: 'Sağlık' },
                    { type: 'question', id: 'q3', text: 'Kantin fiyat listesi asılı mı?', area: 'İşletme' },
                    { type: 'question', id: 'q4', text: 'Oda temizlik kontrolleri yapılıyor mu?', area: 'Temizlik' },
                    { type: 'question', id: 'q5', text: 'Yangın tüplerinin dolumu güncel mi?', area: 'Güvenlik' }
                ]
            }
        ]
    },

    // 1. Dashboard View (Integrated from Exported Page)
    initView: () => {
        const container = document.getElementById('content-area');

        // Basic Template for Dashboard
        container.innerHTML = `
            <div id="view-denetim-dashboard" class="view-section">
                <!-- HEADER ACTIONS & CARDS -->
                <div class="header-actions" style="margin-bottom:1.5rem;">
                    <h3>Denetim</h3>
                    <p style="color:var(--text-secondary);">Lütfen denetim türünü seçiniz:</p>
                    
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-top:1rem;">
                        
                        <!-- 1. İl Müd -->
                         <div class="card stat-card" onclick="AuditManager.promptNewAudit('il_mudurlugu', 'İl Denetim/il.xlsx')" style="cursor:pointer; border-left:4px solid var(--primary-color);">
                            <div class="icon-box info"><span class="material-icons-round">account_balance</span></div>
                            <div><div style="font-weight:600;">İl Müdürlüğü</div><div style="font-size:0.8rem; color:var(--text-secondary);">Genel Denetim</div></div>
                        </div>

                        <!-- 2. KYK Yurt -->
                        <div class="card stat-card" onclick="AuditManager.promptNewAudit('kyk_yurt', 'Kyk Yurt Denetim Şablonu/template_yurt.xlsx')" style="cursor:pointer; border-left:4px solid var(--warning);">
                            <div class="icon-box warning"><span class="material-icons-round">apartment</span></div>
                            <div><div style="font-weight:600;">KYK Yurt</div><div style="font-size:0.8rem; color:var(--text-secondary);">Yurt Denetimi</div></div>
                        </div>

                        <!-- 3. Özel Yurt (Yakında) -->
                         <div class="card stat-card" style="opacity:0.6; grayscale(1); cursor:not-allowed; border-left:4px solid var(--success); position:relative;">
                            <div style="position:absolute; top:8px; right:8px; background:#f1f5f9; color:#64748b; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:bold; border:1px solid #e2e8f0;">YAKINDA</div>
                            <div class="icon-box success"><span class="material-icons-round">home_work</span></div>
                            <div><div style="font-weight:600;">Özel Yurt</div><div style="font-size:0.8rem; color:var(--text-secondary);">Barınma Denetimi</div></div>
                        </div>

                        <!-- 4. Federasyon (Yakında) -->
                        <div class="card stat-card" style="opacity:0.6; grayscale(1); cursor:not-allowed; border-left:4px solid #8b5cf6; position:relative;">
                            <div style="position:absolute; top:8px; right:8px; background:#f1f5f9; color:#64748b; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:bold; border:1px solid #e2e8f0;">YAKINDA</div>
                            <div class="icon-box" style="background:#8b5cf6;"><span class="material-icons-round">sports_soccer</span></div>
                            <div><div style="font-weight:600;">Federasyon</div><div style="font-size:0.8rem; color:var(--text-secondary);">Federasyon Denetimi</div></div>
                        </div>

                        <!-- 5. Kulüp (Yakında) -->
                        <div class="card stat-card" style="opacity:0.6; grayscale(1); cursor:not-allowed; border-left:4px solid #ef4444; position:relative;">
                            <div style="position:absolute; top:8px; right:8px; background:#f1f5f9; color:#64748b; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:bold; border:1px solid #e2e8f0;">YAKINDA</div>
                            <div class="icon-box" style="background:#ef4444;"><span class="material-icons-round">groups</span></div>
                            <div><div style="font-weight:600;">Kulüp</div><div style="font-size:0.8rem; color:var(--text-secondary);">Spor Kulübü Denetimi</div></div>
                        </div>

                        <!-- 6. Diğer (Yakında) -->
                         <div class="card stat-card" style="opacity:0.6; grayscale(1); cursor:not-allowed; border-left:4px solid #64748b; position:relative;">
                            <div style="position:absolute; top:8px; right:8px; background:#f1f5f9; color:#64748b; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:bold; border:1px solid #e2e8f0;">YAKINDA</div>
                            <div class="icon-box" style="background:#64748b;"><span class="material-icons-round">folder_open</span></div>
                            <div><div style="font-weight:600;">Genel / Diğer</div><div style="font-size:0.8rem; color:var(--text-secondary);">Serbest Denetim</div></div>
                        </div>
                    </div>
                </div>

                <div class="list-section" style="margin-top:2rem;">
                    <h3>Dosyalar</h3>
                    <div id="audit-list-container">
                        <div class="spinner"></div> Yükleniyor...
                    </div>
                </div>
            </div>`;

        // Render list via AuditManager
        setTimeout(AuditManager.initListView, 100);
    },

    initListView: () => {
        const container = document.getElementById('audit-list-container');
        if (!container) return;

        const audits = StorageManager.get('audit_records', []);
        const reports = typeof ReportManager !== 'undefined' ? ReportManager.getReports() : [];

        if (audits.length === 0) {
            container.innerHTML = `<p style="color:var(--text-secondary); font-style:italic; padding:1rem; text-align:center;">Henüz aktif bir denetim dosyası yok. Yukarıdan bir tür seçerek başlayın.</p>`;
            return;
        }

        // Grouping
        const groups = {};
        audits.forEach(audit => {
            const taskId = audit.taskId || audit.data?.taskId || 'independent';
            if (!groups[taskId]) groups[taskId] = [];
            groups[taskId].push(audit);
        });

        let html = '';

        Object.keys(groups).forEach(taskId => {
            let groupTitle = 'Bağımsız Denetimler';
            let groupIcon = 'folder_open';

            if (taskId !== 'independent') {
                const reportId = taskId.startsWith('report_') ? parseInt(taskId.replace('report_', '')) : parseInt(taskId);
                const report = reports.find(r => r.id === reportId);
                groupTitle = report ? (report.code ? `${report.code} - ${report.title}` : report.title) : 'Bilinmeyen Görev';
                groupIcon = 'assignment';
            }

            html += `
                <div class="audit-group" style="margin-bottom:2rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; padding-bottom:0.5rem; border-bottom:2px solid #e2e8f0;">
                         <span class="material-icons-round" style="color:var(--primary-color);">${groupIcon}</span>
                         <h4 style="margin:0; font-size:1.1rem; color:var(--text-main);">${groupTitle}</h4>
                         <span style="margin-left:auto; background:#f1f5f9; padding:2px 8px; border-radius:12px; font-size:0.75rem; color:var(--text-secondary);">${groups[taskId].length} Dosya</span>
                    </div>
                    <div class="audit-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:1rem;">
                        ${groups[taskId].map(audit => {
                let typeLabel = 'Bilinmiyor';
                let icon = 'folder';
                if (audit.type === 'il_mudurlugu') { typeLabel = 'İl Müd. Denetimi'; icon = 'account_balance'; }
                else if (audit.type === 'kyk_yurt') { typeLabel = 'KYK Yurt Denetimi'; icon = 'apartment'; }
                else if (audit.type === 'ozel_yurt') { typeLabel = 'Özel Yurt Denetimi'; icon = 'home_work'; }
                else if (audit.type === 'federasyon') { typeLabel = 'Federasyon Denetimi'; icon = 'sports_soccer'; }
                else if (audit.type === 'kulup') { typeLabel = 'Kulüp Denetimi'; icon = 'groups'; }

                return `
                            <div class="card" style="cursor:pointer; transition:transform 0.2s; border:1px solid var(--border-color); display:flex; gap:1rem; align-items:center;" onclick="AuditManager.loadAudit('${audit.id}')">
                                <div style="background:var(--bg-main); width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--primary-color);">
                                    <span class="material-icons-round">${icon}</span>
                                </div>
                                <div style="flex:1;">
                                    <div style="font-weight:600; font-size:1rem; margin-bottom:0.1rem;">${audit.name}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary);">${typeLabel}</div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${new Date(audit.updatedAt).toLocaleDateString('tr-TR')}</div>
                                </div>
                                <button class="btn btn-icon" onclick="event.stopPropagation(); AuditManager.deleteAudit('${audit.id}')" title="Sil">
                                    <span class="material-icons-round" style="color:var(--danger); font-size:1.2rem;">delete</span>
                                </button>
                            </div>`;
            }).join('')}
                    </div>
                </div>`;
        });

        container.innerHTML = html;
    },

    // 2. Start New Audit
    promptNewAudit: (type, templateFile) => {
        // Redirect to Preparation Screen
        AuditManager.showPreparationScreen(type, templateFile);
    },

    showPreparationScreen: (type, template) => {
        const modalId = 'audit-prep-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        // Get Active Tasks for Dropdown
        let tasks = [];
        let reports = [];
        const taskMgr = window.TaskManager || (typeof TaskManager !== 'undefined' ? TaskManager : null);
        const reportMgr = window.ReportManager || (typeof ReportManager !== 'undefined' ? ReportManager : null);

        if (taskMgr) {
            const allTasks = taskMgr.getTasks() || [];
            tasks = allTasks.filter(t => !t.completed);
        }

        if (reportMgr) {
            const allReports = reportMgr.getReports() || [];
            // Raporlardan durumuna göre filtrele (opsiyonel, şimdilik hepsini gösterelim)
            reports = allReports.filter(r => r.status !== 'tamamlandi');
        }

        let taskOptions = '';

        if (reports.length > 0) {
            taskOptions += `<optgroup label="📂 Görevler Sayfası">`;
            taskOptions += reports.map(r => `<option value="report_${r.id}">${r.code ? r.code + ' - ' : ''}${r.title || 'İsimsiz Rapor'}</option>`).join('');
            taskOptions += `</optgroup>`;
        }

        const modalOverlay = document.createElement('div');
        modalOverlay.id = modalId;
        modalOverlay.className = 'modal-overlay';
        modalOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000; display:flex; justify-content:center; align-items:center;';

        const defaultName = type === 'il_mudurlugu' ? 'İl Müdürlüğü Denetimi 2025' : 'Denetim Dosyası';

        modalOverlay.innerHTML = `
            <div class="modal-card" style="width: 500px; max-width: 90%; background:var(--bg-card); padding:2rem; border-radius:1rem; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                 <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                    <h3 style="margin:0;">Denetim Hazırlığı</h3>
                    <span class="material-icons-round close-btn" style="cursor:pointer;" onclick="document.getElementById('${modalId}').remove()">close</span>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom:1.5rem;">
                        <label style="display:block; margin-bottom:0.5rem; font-weight:500;">Dosya Adı / Başlık</label>
                        <input type="text" id="prep-audit-name" class="form-input" value="${defaultName}" 
                            style="width:100%; padding:0.75rem; border:1px solid var(--border-color); border-radius:0.5rem; background:var(--bg-main); color:var(--text-main);">
                    </div>

                    <div class="form-group" style="margin-bottom:1.5rem;">
                        <label style="display:block; margin-bottom:0.5rem; font-weight:500;">İlgili Görev (Opsiyonel)</label>
                        <select id="prep-task-select" class="form-input" style="width:100%; padding:0.5rem; border:1px solid var(--border-color); border-radius:0.5rem;">
                            <option value="">-- Görev Seçiniz --</option>
                            ${taskOptions}
                        </select>
                        <small style="color:var(--text-secondary);">Seçilen görev ile denetim dosyası ilişkilendirilecektir.</small>
                    </div>

                    <div style="margin-top:2rem; text-align:right;">
                        <button class="btn btn-primary" style="width:100%;" onclick="AuditManager.startAuditFromPrep('${type}', '${template}')">
                            <span class="material-icons-round">play_arrow</span> Denetimi Başlat
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);
    },

    startAuditFromPrep: (type, template) => {
        const rawId = document.getElementById('prep-task-select').value;
        const auditNameInput = document.getElementById('prep-audit-name');
        const name = auditNameInput ? auditNameInput.value.trim() : '';

        const modal = document.getElementById('audit-prep-modal');

        if (!name) {
            Toast.show('Lütfen bir denetim adı giriniz.', 'warning');
            return;
        }

        if (modal) modal.remove();

        // Process Task/Report ID
        let taskId = null;
        if (rawId) {
            taskId = rawId;
        }

        AuditManager.createNewAudit(name, type, template, taskId);
    },

    createNewAudit: (name, type, templateFile, taskId = null) => {
        const newId = 'audit_' + Date.now();
        let folderPath = null;

        // Electron: Create Folder
        if (typeof require !== 'undefined') {
            try {
                const fs = require('fs');
                const path = require('path');
                const rootDir = PathManager.join('Denetim Dosyalari');
                if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir, { recursive: true });

                const typeDir = path.join(rootDir, type);
                if (!fs.existsSync(typeDir)) fs.mkdirSync(typeDir, { recursive: true });

                const safeName = name.replace(/[\u003c\u003e:\"/\\\\|?*]/g, '_');
                folderPath = path.join(typeDir, safeName);
                if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

            } catch (e) { console.error('Folder create error:', e); }
        }

        const newAudit = {
            id: newId,
            name: name,
            type: type,
            template: templateFile,
            folderPath: folderPath, // Keep folderPath for Electron
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active',
            taskId: taskId,
            data: {
                info: {},
                form: {},
                notes: '',
                photos: []
            },
            progress: 0
        };

        StorageManager.addToArray('audit_records', newAudit);

        // LINK TASK
        if (taskId && typeof TaskManager !== 'undefined') {
            TaskManager.linkAudit(taskId, newId);
        }

        AuditManager.loadAudit(newAudit.id);
    },

    deleteAudit: async (id) => {
        if (!confirm('Bu denetim dosyası silinecek. Emin misiniz?')) return;

        StorageManager.removeFromArray('audit_records', 'id', id);

        // Refresh logic: only re-render dashboard if we are on that view
        if (document.getElementById('view-denetim-dashboard')) {
            AuditManager.initListView();
        }
        Toast.show('Dosya silindi.', 'success');
    },

    // 3. Load & Edit
    loadAudit: (id) => {
        const audits = StorageManager.get('audit_records', []);
        const record = audits.find(a => a.id === id);

        if (!record) {
            Toast.show('Kayıt bulunamadı.', 'error');
            AuditManager.initView();
            return;
        }

        AuditManager.currentAuditId = id;
        AuditManager.currentAuditName = record.name;
        AuditManager.currentAuditType = record.type;
        AuditManager.currentTemplate = record.template;
        AuditManager.activeSection = 'info';

        AuditManager.renderEditor();
        AuditManager.loadFormTemplate(record.template);
    },

    renderEditor: () => {
        const container = document.getElementById('content-area');
        const getTabStyle = (section) => {
            const isActive = AuditManager.activeSection === section;
            return `padding: 0.75rem 1.5rem; cursor: pointer; border-bottom: 2px solid ${isActive ? 'var(--primary-color)' : 'transparent'}; color: ${isActive ? 'var(--primary-color)' : 'var(--text-secondary)'}; font-weight: ${isActive ? '600' : '400'}; transition: all 0.2s; font-size:0.95rem;`;
        };

        const typeLabels = {
            'il_mudurlugu': 'İl Müd.',
            'kyk_yurt': 'KYK Yurt',
            'ozel_yurt': 'Özel Yurt',
            'federasyon': 'Federasyon',
            'kulup': 'Kulüp'
        };

        const typeLabel = typeLabels[AuditManager.currentAuditType] || 'Denetim';

        container.innerHTML = `
            <div id="view-audit-editor" class="view-section" style="height: 100vh; display: flex; flex-direction: column;">
                <!-- Header -->
                <div class="audit-header" style="display:flex; justify-content:space-between; padding-bottom:1rem; border-bottom:1px solid var(--border-color); margin-bottom:1rem;">
                    <div class="audit-header-top" style="display:flex; align-items:center; gap:1rem;">
                        <button class="btn btn-icon audit-back-button" onclick="AuditManager.initView()" title="Geri">
                            <span class="material-icons-round">arrow_back</span>
                        </button>
                        <div class="audit-header-title">
                            <h3 style="margin:0;">${AuditManager.currentAuditName}</h3>
                            <span class="badge" style="font-size:0.75rem; background:#eff6ff; color:#2563eb; padding:2px 8px; border-radius:12px;">${typeLabel}</span>
                        </div>
                    </div>
                    
                    <div class="audit-header-actions" style="display:flex; gap:0.5rem;">
                        <button class="btn btn-outline" onclick="AuditManager.exportToExcel()" title="Excel'e Aktar">
                            <span class="material-icons-round">file_download</span> Excel
                        </button>
                        <button class="btn btn-primary" onclick="AuditManager.saveAll()">
                            <span class="material-icons-round">save</span> Kaydet
                        </button>
                    </div>
                </div>

                <!-- Tabs -->
                <div style="display:flex; border-bottom:1px solid var(--border-color); flex-shrink: 0; margin-bottom:1rem;">
                    <div onclick="AuditManager.switchSection('info')" style="${getTabStyle('info')}">Genel Bilgiler</div>
                    <div onclick="AuditManager.switchSection('notes')" style="${getTabStyle('notes')}">Notlar</div>
                    <div onclick="AuditManager.switchSection('photos')" style="${getTabStyle('photos')}">Fotoğraflar</div>
                    <div onclick="AuditManager.switchSection('form')" style="${getTabStyle('form')}">Kontrol Listesi</div>
                </div>

                <!-- Content -->
                <div id="audit-section-content" class="card" style="padding: 1rem; flex: 1; overflow-y: auto; margin-top:0;">
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
        const info = data.info || {};

        if (AuditManager.activeSection === 'info') {
            // DYNAMIC INFO FIELDS BASED ON TYPE
            let fieldsHtml = '';

            if (AuditManager.currentAuditType === 'il_mudurlugu') {
                fieldsHtml = `
                    <div class="form-group"><label>İl Müdürü Adı Soyadı</label><input type="text" onchange="AuditManager.updateInfo('directorName', this.value)" value="${info.directorName || ''}"></div>
                    <div class="form-group"><label>Personel Sayısı</label><input type="text" onchange="AuditManager.updateInfo('staffCount', this.value)" value="${info.staffCount || ''}"></div>
                    <div class="form-group"><label>Tesis Sayısı</label><input type="text" onchange="AuditManager.updateInfo('facilityCount', this.value)" value="${info.facilityCount || ''}"></div>
                    <div class="form-group"><label>Denetim Tarihi</label><input type="date" onchange="AuditManager.updateInfo('auditDate', this.value)" value="${info.auditDate || ''}"></div>
                `;
            } else if (AuditManager.currentAuditType === 'kyk_yurt' || AuditManager.currentAuditType === 'ozel_yurt') {
                fieldsHtml = `
                    <div class="form-group"><label>Yurt Müdürü Adı Soyadı</label><input type="text" onchange="AuditManager.updateInfo('managerName', this.value)" value="${info.managerName || ''}"></div>
                    <div class="form-group"><label>Kapasite</label><input type="text" onchange="AuditManager.updateInfo('capacity', this.value)" value="${info.capacity || ''}"></div>
                    <div class="form-group"><label>Mevcut Öğrenci</label><input type="text" onchange="AuditManager.updateInfo('studentCount', this.value)" value="${info.studentCount || ''}"></div>
                    <div class="form-group"><label>Blok Sayısı</label><input type="text" onchange="AuditManager.updateInfo('blockCount', this.value)" value="${info.blockCount || ''}"></div>
                `;
            } else {
                fieldsHtml = `
                    <div class="form-group"><label>Yetkili Kişi</label><input type="text" onchange="AuditManager.updateInfo('authName', this.value)" value="${info.authName || ''}"></div>
                    <div class="form-group"><label>Kuruluş Yılı</label><input type="text" onchange="AuditManager.updateInfo('foundYear', this.value)" value="${info.foundYear || ''}"></div>
                    <div class="form-group"><label>Adres / İletişim</label><input type="text" onchange="AuditManager.updateInfo('contact', this.value)" value="${info.contact || ''}"></div>
                `;
            }

            contentDiv.innerHTML = `
                <div style="max-width: 800px; margin: 0 auto;">
                    <h4 style="margin-bottom:1rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">${AuditManager.currentAuditName} Bilgileri</h4>
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1rem;">
                        ${fieldsHtml}
                        <div class="form-group" style="grid-column: span 2;">
                            <label>Notlar</label>
                            <textarea onchange="AuditManager.updateInfo('generalInfoNotes', this.value)" rows="3">${info.generalInfoNotes || ''}</textarea>
                        </div>
                    </div>
                </div>`;

        } else if (AuditManager.activeSection === 'notes') {
            contentDiv.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column;">
                     <textarea style="flex: 1; padding: 1rem; border: 1px solid var(--border-color); border-radius: 0.5rem; font-family: inherit; line-height: 1.6; resize: none;"
                        placeholder="Genel tespitlerinizi buraya yazabilirsiniz..."
                        onchange="AuditManager.updateGeneralNotes(this.value)">${data.generalNotes || ''}</textarea>
                </div>`;

        } else if (AuditManager.activeSection === 'photos') {
            const photos = data.photos || [];
            const photosHtml = photos.map((photo, idx) => `
                <div style="position: relative; width: 140px; height: 140px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background:#eee;">
                    <img src="${photo}" style="width: 100%; height: 100%; object-fit: cover; cursor:pointer;" onclick="AuditManager.viewPhoto('${photo}')">
                    <button onclick="AuditManager.deletePhoto(${idx})" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px;">&times;</button>
                </div>
            `).join('');

            contentDiv.innerHTML = `
                <div>
                     <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                        <h4>Galeri</h4>
                        <button class="btn btn-outline" onclick="document.getElementById('photo-upload').click()">+ Fotoğraf Ekle</button>
                        <input type="file" id="photo-upload" accept="image/*" style="display: none;" onchange="AuditManager.handlePhotoUpload(this)">
                     </div>
                     <div style="display: flex; flex-wrap: wrap; gap: 0.8rem;">
                        ${photos.length > 0 ? photosHtml : '<p style="color:var(--text-secondary);">Henüz fotoğraf yok.</p>'}
                     </div>
                </div>`;
        } else if (AuditManager.activeSection === 'form') {
            AuditManager.renderFormTab(contentDiv);
        }
    },

    renderFormTab: (container) => {
        if (!container) container = document.getElementById('audit-section-content');
        if (AuditManager.data === null) {
            container.innerHTML = `<div class="empty-state"><p><span class="material-icons-round spin">sync</span> Şablon yükleniyor...</p></div>`;
            return;
        }
        if (AuditManager.data.length === 0) {
            // FALLBACK UI IF TEMPLATE IS EMPTY OR FAILED
            container.innerHTML = `
                <div class="empty-state" style="color:var(--text-secondary); text-align:center;">
                    <p>Şablon yüklenemedi veya boş. Yine de serbest notlar alabilirsiniz.</p>
                </div>`;
            return;
        }

        const record = AuditManager.getRecord();
        const savedState = record.data.form || {};

        let areas = new Set();
        let subtitles = new Set();

        const activeSheet = AuditManager.data[AuditManager.activeFormTab];

        if (activeSheet && activeSheet.items) {
            activeSheet.items.forEach(item => {
                if (item.area) areas.add(item.area);
                if (item.category) subtitles.add(item.category);
            });
        }

        const isFederation = AuditManager.currentAuditType === 'federasyon';
        const isYurt = AuditManager.currentAuditType.includes('yurt');
        const isIlMudurlugu = AuditManager.currentAuditType === 'il_mudurlugu';

        if (isFederation && areas.size === 0 && AuditManager.data.length > 1) {
            AuditManager.data.forEach(s => areas.add(s.name));
        }

        const filterArea = document.getElementById('filter-area-select') ? document.getElementById('filter-area-select').value : '';
        const rawSubtitle = document.getElementById('filter-subtitle-select') ? document.getElementById('filter-subtitle-select').value : '';
        const filterSubtitle = rawSubtitle.startsWith('sheet:') ? '' : rawSubtitle;
        const searchQuery = document.getElementById('audit-search-input') ? document.getElementById('audit-search-input').value.toLocaleLowerCase('tr-TR') : '';

        let itemsHtml = '';
        if (activeSheet && activeSheet.items) {
            activeSheet.items.forEach(item => {
                if (filterArea && item.area && item.area !== filterArea) return;
                if (filterSubtitle && item.category && item.category !== filterSubtitle) return;
                if (searchQuery && !item.text.toLocaleLowerCase('tr-TR').includes(searchQuery)) return;

                if (item.type === 'header') {
                    itemsHtml += `<div style="background:var(--bg-main); padding:0.5rem; margin-top:1rem; border-left:3px solid var(--primary-color); font-weight:600;">${item.title}</div>`;
                } else if (item.type === 'question') {
                    const yesChecked = savedState[item.id] === 'yes' ? 'checked' : '';
                    const noChecked = savedState[item.id] === 'no' ? 'checked' : '';
                    const inspectorNote = savedState[`inspector_note_${item.id}`] || '';
                    const sheetName = activeSheet.name;

                    let metaInfo = '';
                    if (item.area || item.category) {
                        metaInfo = `<div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.25rem; display:flex; align-items:center; flex-wrap:wrap; gap:0.25rem;">
                            ${item.area ? `<span style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${item.area}</span>` : ''}
                            ${item.category ? `<span style="background:#fff7ed; color:#c2410c; padding:2px 6px; border-radius:4px;">${item.category}</span>` : ''}
                        </div>`;
                    }

                    itemsHtml += `<div class="audit-item" style="padding:1rem; border-bottom:1px solid var(--border-color);">
                            ${metaInfo}
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.8rem;">
                                <div style="margin-right: 1rem; font-weight:500;">${item.text}</div>
                            </div>
                            <div style="display:flex; gap:1.5rem; align-items:center; margin-bottom:0.8rem;">
                                <label style="cursor:pointer; display:flex; align-items:center;"><input type="radio" name="${item.id}" value="yes" ${yesChecked} onchange="AuditManager.updateFormState('${item.id}', 'yes')"> <span style="margin-left:6px;">Evet, Uygun</span></label>
                                <label style="cursor:pointer; display:flex; align-items:center;"><input type="radio" name="${item.id}" value="no" ${noChecked} onchange="AuditManager.updateFormState('${item.id}', 'no')"> <span style="margin-left:6px; color:var(--danger);">Hayır, Aykırı</span></label>
                            </div>
                            <textarea placeholder="Müfettiş Notu" onchange="AuditManager.updateFormNote('${item.id}', this.value, 'inspector_note')" 
                                style="width:100%; padding:0.5rem; border:1px solid var(--border-color); border-radius:6px; font-family:inherit; min-height:60px; resize:vertical; background:#fbfbfb;">${inspectorNote}</textarea>
                    </div>`;
                }
            });
        }

        const areaOptionsArr = Array.from(areas);
        const areaOptionsHtml = areaOptionsArr.map(a => {
            const isSelected = (filterArea === a) || (isFederation && !filterArea && a === activeSheet.name);
            return `<option value="${a}" ${isSelected ? 'selected' : ''}>${a}</option>`;
        }).join('');

        const subtitleOptionsArr = Array.from(subtitles);
        const subtitleOptionsHtml = subtitleOptionsArr.map(s => `<option value="${s}" ${filterSubtitle === s ? 'selected' : ''}>${s}</option>`).join('');

        const showSheetSelector = !isFederation && !isYurt && !isIlMudurlugu && AuditManager.data.length > 1;
        const sheetSelectorHtml = showSheetSelector ? `
            <select onchange="AuditManager.switchFormTab(this.value)" style="padding:0.4rem; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem; background:#fff; min-width:110px; flex:1; font-weight:600; color:var(--primary-color);">
                ${AuditManager.data.map((sheet, index) => `<option value="${index}" ${index === AuditManager.activeFormTab ? 'selected' : ''}>${sheet.name}</option>`).join('')}
            </select>
        ` : '';

        const filtersHtml = `
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; width:100%;">
                ${sheetSelectorHtml}
                <span class="material-icons-round" style="color:var(--text-secondary); font-size:1.2rem;">filter_alt</span>
                ${isYurt ? `
                    <select id="filter-subtitle-select" onchange="AuditManager.handleYurtFilter(this.value)" style="padding:0.4rem; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem; background:#fff; min-width:140px; flex:1; font-weight:600; color:var(--primary-color);">
                        <option value="">Tüm Kategoriler</option>
                        ${AuditManager.data.map((s, idx) => `<option value="sheet:${idx}" ${AuditManager.activeFormTab === idx && !filterSubtitle ? 'selected' : ''}>${s.name}</option>`).join('')}
                        ${subtitleOptionsHtml}
                    </select>
                    <input type="hidden" id="filter-area-select" value="">
                ` : `
                    <select id="filter-area-select" onchange="${isFederation ? 'AuditManager.handleAreaChange(this.value)' : 'AuditManager.renderFormTab()'}" 
                        style="padding:0.4rem; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem; background:#fff; flex:1; min-width:110px; ${areaOptionsArr.length === 0 ? 'display:none;' : ''}">
                        <option value="">${isIlMudurlugu ? 'Tüm Alanlar' : 'Tüm Alanlar'}</option>
                        ${areaOptionsHtml}
                    </select>
                    <select id="filter-subtitle-select" onchange="AuditManager.renderFormTab()" 
                        style="padding:0.4rem; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem; background:#fff; flex:1; min-width:110px; ${subtitleOptionsArr.length === 0 ? 'display:none;' : ''}">
                        <option value="">Tüm Alt Başlıklar</option>
                        ${subtitleOptionsHtml}
                    </select>
                `}
                <div style="position:relative; flex:1; min-width: 150px;">
                    <span class="material-icons-round" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:1.1rem; color:var(--text-secondary);">search</span>
                    <input type="text" id="audit-search-input" placeholder="Ara..." oninput="AuditManager.renderFormTab()" value="${searchQuery || ''}"
                        style="width:100%; padding:0.4rem 0.4rem 0.4rem 2rem; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem; background:#fff;">
                </div>
            </div>`;

        const itemsListContainer = document.getElementById('audit-items-list');
        if (itemsListContainer && document.getElementById('audit-search-input')) {
            itemsListContainer.innerHTML = itemsHtml;
            const filtersHeader = document.getElementById('audit-filters-header');
            if (filtersHeader) {
                filtersHeader.innerHTML = filtersHtml;
            }
            return;
        }

        // FLEXBOX LAYOUT REFACTOR
        // Determine available height based on container or window
        // container is usually 'audit-section-content'
        container.style.cssText = "display:flex; flex-direction:column; height:calc(100vh - 140px); overflow:hidden;";

        container.innerHTML = `
            <div id="audit-filters-header" style="flex:0 0 auto; z-index:10; display:flex; flex-wrap:wrap; gap:0.5rem; padding:0.75rem; background:#ffffff; border-bottom:1px solid var(--border-color); align-items:center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                ${filtersHtml}
            </div>
            <div id="audit-items-list" style="flex:1; overflow-y:auto; padding-bottom:2rem;">${itemsHtml}</div>`;
    },

    handleYurtFilter: (val) => {
        if (val.startsWith('sheet:')) {
            const idx = parseInt(val.split(':')[1]);
            AuditManager.activeFormTab = idx;
            const filterSubtitleSelect = document.getElementById('filter-subtitle-select');
            if (filterSubtitleSelect) filterSubtitleSelect.value = '';
            AuditManager.renderFormTab();
        } else {
            const filterSubtitleSelect = document.getElementById('filter-subtitle-select');
            if (filterSubtitleSelect) {
                const currentVal = filterSubtitleSelect.value;
                if (currentVal.startsWith('sheet:')) {
                    filterSubtitleSelect.value = '';
                }
            }
            AuditManager.renderFormTab();
        }
    },

    handleAreaChange: (val) => {
        const sheetIdx = AuditManager.data.findIndex(s => s.name === val);
        if (sheetIdx !== -1) {
            AuditManager.activeFormTab = sheetIdx;
        }
        AuditManager.renderFormTab();
    },

    switchFormTab: (index) => {
        AuditManager.activeFormTab = parseInt(index);
        AuditManager.renderEditor();
    },

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

            // Item-level Real-time Sync
            if (typeof SyncManager !== 'undefined') {
                SyncManager.syncAuditRecord(record);
            }
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
    updateFormState: (id, value) => {
        const record = AuditManager.getRecord();
        if (!record.data.form) record.data.form = {};
        record.data.form[id] = value;
        AuditManager.saveRecord(record);
    },
    updateFormNote: (id, value, noteType = 'note') => {
        const record = AuditManager.getRecord();
        if (!record.data.form) record.data.form = {};
        record.data.form[`${noteType}_${id}`] = value;
        AuditManager.saveRecord(record);
    },

    saveAll: () => {
        const record = AuditManager.getRecord();
        if (record && record.id) {
            AuditManager.saveRecord(record);
            Toast.show('Değişiklikler kaydedildi.', 'success');
        } else {
            Toast.show('Kaydedilecek veri bulunamadı.', 'error');
        }
    },

    loadFormTemplate: (templateName) => {
        if (!templateName) {
            // No template assigned, set empty data to allow UI to render (empty state)
            AuditManager.data = [];
            AuditManager.renderEditor();
            return;
        }

        setTimeout(async () => {
            try {
                // Determine Path
                const isElectron = (typeof require !== 'undefined') || (typeof window !== 'undefined' && typeof window.require !== 'undefined');
                let fileBuffer;

                if (isElectron) {
                    const fs = (typeof require !== 'undefined' ? require('fs') : window.require('fs'));
                    const path = (typeof require !== 'undefined' ? require('path') : window.require('path'));

                    let tPath = path.join(__dirname, 'Sablonlar', templateName);

                    // Simple path checks
                    if (!fs.existsSync(tPath)) tPath = path.join(process.cwd(), 'Sablonlar', templateName);
                    if (!fs.existsSync(tPath) && process.resourcesPath) tPath = path.join(process.resourcesPath, 'Sablonlar', templateName);

                    if (fs.existsSync(tPath)) {
                        console.log('Loading template from:', tPath);
                        fileBuffer = fs.readFileSync(tPath);
                    } else {
                        console.error('Template not found in:', tPath);
                        throw new Error('Dosya bulunamadı: ' + templateName);
                    }
                } else {
                    // BROWSER (GitHub Fetch)
                    console.log(`Browser Mode: Fetching ${templateName} from GitHub...`);
                    const GITHUB_BASE = 'https://raw.githubusercontent.com/syaprakli/muf-yard-desktop/main/Sablonlar/';
                    const fetchUrl = GITHUB_BASE + encodeURI(templateName);

                    const response = await fetch(fetchUrl);
                    if (!response.ok) throw new Error(`GitHub (${response.status})`);
                    fileBuffer = await response.arrayBuffer();
                }

                const workbook = XLSX.read(fileBuffer, { type: 'array' });
                let sheets = [];

                // --- SMART PARSING LOGIC ---
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                    let sheetItems = [];

                    if (rows.length > 2) {
                        // 1. Detect Question Column
                        let questionColIdx = -1;

                        // Strategy A: Header Search (Priority)
                        const searchHeaders = ['Teftiş Maddesi', 'Denetim Konusu', 'Soru', 'Denetim Sorusu'];
                        for (let r = 0; r < Math.min(rows.length, 5); r++) {
                            const row = rows[r];
                            if (!row) continue;
                            row.forEach((cell, idx) => {
                                if (cell && typeof cell === 'string') {
                                    if (searchHeaders.some(h => cell.includes(h))) {
                                        questionColIdx = idx;
                                        console.log(`Sheet '${sheetName}': Header detected '${cell}' at index ${idx}`);
                                    }
                                }
                            });
                            if (questionColIdx !== -1) break;
                        }

                        // Strategy B: Longest Text Heuristic (Fallback)
                        if (questionColIdx === -1) {
                            let colScores = {};
                            let maxCol = 0;

                            // Sample first 20 rows
                            for (let i = 0; i < Math.min(rows.length, 20); i++) {
                                const r = rows[i];
                                if (!r) continue;
                                r.forEach((cell, idx) => {
                                    if (cell && cell.toString().length > 15 && !cell.toString().startsWith('http')) { // Exclude URLs
                                        colScores[idx] = (colScores[idx] || 0) + 1;
                                        if (idx > maxCol) maxCol = idx;
                                    }
                                });
                            }

                            // Find best column
                            let maxScore = -1;
                            for (let c = 0; c <= maxCol; c++) {
                                if (colScores[c] > maxScore) {
                                    maxScore = colScores[c];
                                    questionColIdx = c;
                                }
                            }
                            if (questionColIdx === -1) questionColIdx = 0; // Absolute fallback
                            console.log(`Sheet '${sheetName}': Heuristic detected index ${questionColIdx}`);
                        }

                        console.log(`Sheet '${sheetName}': Detected Question Column Index -> ${questionColIdx}`);

                        // 2. Parse Rows
                        for (let i = 0; i < rows.length; i++) {
                            const r = rows[i];
                            if (!r) continue;
                            const cQ = (r[questionColIdx] || '').toString().trim(); // Question

                            // Skip headers or short texts
                            if (cQ.length < 5) continue;
                            const lowerQ = cQ.toLowerCase();
                            if (lowerQ === 'denetim sorusu' || lowerQ === 'soru' || lowerQ.includes('teftiş maddesi')) continue;

                            // EXTRACT METADATA FOR FILTERS (Specific to il.xlsx structure)
                            let area = sheetName;
                            let category = '';

                            // Determine if this is il.xlsx structure (Column 5=Area, Column 6=Category)
                            // We check if we are in 'Teftiş Noktaları' sheet or similar
                            if (rows[1] && rows[1][5] && rows[1][8]) { // Check for typical il.xlsx signature
                                area = (r[5] || sheetName).toString().trim(); // Column F usually
                                category = (r[6] || '').toString().trim();    // Column G usually
                            }

                            const uid = (sheetName + i).replace(/[^a-z0-9]/gi, '_');
                            sheetItems.push({
                                type: 'question',
                                id: uid,
                                text: cQ,
                                area: area,
                                category: category
                            });
                        }
                    }
                    if (sheetItems.length > 0) sheets.push({ name: sheetName, items: sheetItems });
                });

                AuditManager.data = sheets;
                if (AuditManager.activeSection === 'form') AuditManager.renderEditor();

            } catch (err) {
                console.warn('Template load failed, using fallback:', err);

                // Initialize TEMPLATES if missing
                if (!AuditManager.TEMPLATES) {
                    AuditManager.TEMPLATES = {
                        'il.xlsx': [
                            {
                                name: 'Teftiş Noktaları',
                                items: [
                                    { type: 'question', id: 'il_q1', text: 'Özel spor tesisi açılış dosyalarında; belediye izin belgesi, itfaiye raporu, sağlık raporu ve kolluk kuvveti görüşü eksiksiz midir?', area: 'SPOR', category: 'Belge Kontrolü' },
                                    { type: 'question', id: 'il_q2', text: 'Tesis bünyesindeki antrenör, masör veya eğiticilerle yapılan sözleşmelerin tasdikli suretleri dosyalarında mevcut mudur?', area: 'SPOR', category: 'Belge Kontrolü' },
                                    { type: 'question', id: 'il_q3', text: 'Gençlik ve Spor Kulübü dernek tüzükleri ve genel kurul tutanakları incelenmiş midir?', area: 'GENÇLİK', category: 'İdari' }
                                ]
                            },
                            { name: 'Mevzuat Bankası', items: [] }
                        ],
                        'yurt_denetim_formu.xlsx': [
                            { name: 'Giriş', items: [{ type: 'question', id: 'kyk_q1', text: 'Yurt giriş-çıkış turnike sistemi aktif mi?', area: 'Güvenlik' }] },
                            { name: 'Yemekhane', items: [{ type: 'question', id: 'kyk_q2', text: 'Yemek numuneleri usulüne uygun saklanıyor mu?', area: 'Yemekhane' }] }
                        ],
                        'template_ozel_yurt.xlsx': [
                            { name: 'Genel', items: [{ type: 'question', id: 'ozel_q1', text: 'Yurt açma izin belgesi mevcut mu?', area: 'Ruhsat' }] }
                        ]
                    };
                }
                // Contiuing to fallback logic...

                // CHECK HARDCODED FALLBACKS (Fuzzy Match)
                if (AuditManager.TEMPLATES) {
                    const cleanName = templateName.trim();
                    const fallbackKey = Object.keys(AuditManager.TEMPLATES).find(k => k.trim() === cleanName);

                    if (fallbackKey) {
                        console.log(`Fallback found for '${templateName}' -> '${fallbackKey}'`);
                        AuditManager.data = AuditManager.TEMPLATES[fallbackKey];

                        // Force switch to form tab so user sees questions immediately
                        AuditManager.activeSection = 'form';
                        AuditManager.renderEditor();

                        Toast.show('Dosya erişim izni (CORS) nedeniyle varsayılan şablon yüklendi.', 'info');
                        return;
                    } else {
                        console.error(`Fallback NOT found for '${templateName}'. Available:`, Object.keys(AuditManager.TEMPLATES));
                    }
                }

                // Fallback: Generate a default structure so the UI works
                AuditManager.data = [
                    {
                        name: "Genel Denetim",
                        items: [
                            { type: 'header', title: 'Otomatik Oluşturulan Form (Şablon Bulunamadı)' },
                            { type: 'question', id: 'q1', text: 'Genel düzen ve temizlik uygun mu?', area: 'Genel' },
                            { type: 'question', id: 'q2', text: 'Personel kılık kıyafeti uygun mu?', area: 'Personel' },
                            { type: 'question', id: 'q3', text: 'Evrak düzeni mevzuata uygun mu?', area: 'İdari' }
                        ]
                    }
                ];

                if (AuditManager.activeSection === 'form') AuditManager.renderEditor();
                Toast.show('Şablon dosyası bulunamadı, varsayılan form yüklendi.', 'warning');
            }
        }, 100);
    },

    handlePhotoUpload: async (input) => {
        if (!input.files[0]) return;
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const record = AuditManager.getRecord();
            if (!record.data.photos) record.data.photos = [];
            record.data.photos.push(e.target.result);
            AuditManager.saveRecord(record);
            AuditManager.renderEditor();
        };
        reader.readAsDataURL(file);
    },

    deletePhoto: (idx) => {
        const record = AuditManager.getRecord();
        record.data.photos.splice(idx, 1);
        AuditManager.saveRecord(record);
        AuditManager.renderEditor();
    },

    viewPhoto: (src) => {
        const html = `<div onclick="this.remove()" style="position:fixed; top:0; left:0; width:100%; height:100%; z-index:10010; background:rgba(0,0,0,0.9); display:flex; justify-content:center; align-items:center;">
            <img src="${src}" style="max-width:90%; max-height:90%;">
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    exportToExcel: () => {
        const record = AuditManager.getRecord();
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([{ NOTE: "Export Placeholder" }]);
        XLSX.utils.book_append_sheet(wb, ws, "Rapor");
        XLSX.writeFile(wb, `${record.name}.xlsx`);
    }
};

// --- EXPORTS ---
if (typeof window !== 'undefined') {
    window.AuditManager = AuditManager;
    console.log("AuditManager (Migrated) initialized.");
}
