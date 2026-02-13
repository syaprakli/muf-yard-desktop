const AIService = {
    // Default Configuration
    config: {
        apiKey: '',
        model: 'gemini-1.5-flash',
        activeModeId: 'default_1',
        responseLength: 'detailed', // 'short' or 'detailed'
        customRules: [], // Array of strings
        contextFiles: [], // Array of {name, type, size} (Content moved to disk)
        modes: [
            {
                id: 'default_1',
                name: 'Resmi (Mevzuatsal)',
                instruction: 'Sen bir Kamu Müfettişi yardımcısın. Cevapların resmi, ciddi ve sadece kanun/yönetmeliklere dayalı olmalı. Yorum katma.'
            },
            {
                id: 'default_2',
                name: 'Sohbet (Serbest)',
                instruction: 'Sen yardımsever bir meslektaşsın. Samimi, anlaşılır ve günlük dilde konuş. Espri yapabilirsin.'
            },
            {
                id: 'default_3',
                name: 'Eğitici',
                instruction: 'Sen bir eğitmensin. Konuları bir öğretmenin öğrencisine anlattığı gibi, örneklerle ve basitleştirerek anlat.'
            }
        ]
    },

    init: () => {
        const savedConfig = localStorage.getItem('ai_config');
        if (savedConfig) {
            AIService.config = { ...AIService.config, ...JSON.parse(savedConfig) };
        }
        AIService.ensureContextFolder();
        AIService.migrateToFiles();
    },

    migrateToFiles: () => {
        // Find files that still have 'content' (old format)
        let needsSave = false;
        if (typeof require !== 'undefined') {
            const fs = require('fs');
            const path = require('path');
            const dir = AIService.getContextDirPath();

            AIService.config.contextFiles.forEach(file => {
                if (file.content) {
                    console.log('Migrating file to disk:', file.name);
                    const filePath = path.join(dir, file.name + '.txt');
                    try {
                        if (!fs.existsSync(filePath)) {
                            fs.writeFileSync(filePath, file.content, 'utf8');
                        }
                        // Update metadata and remove heavy content
                        file.size = file.content.length;
                        delete file.content;
                        needsSave = true;
                    } catch (e) {
                        console.error('Migration failed for:', file.name, e);
                    }
                }
            });

            if (needsSave) {
                console.log('AI Context migration complete. Saving config...');
                AIService.saveConfig();
            }
        }
    },

    saveConfig: () => {
        try {
            localStorage.setItem('ai_config', JSON.stringify(AIService.config));
        } catch (e) {
            console.error('Save Config Error (LocalStorage full?):', e);
            if (e.name === 'QuotaExceededError') {
                Toast.show('Ayarlar kaydedilemedi (Hafıza dolu). Lütfen bazı eğitim dosyalarını silin.', 'error');
            }
        }
    },

    // --- FileSystem Management ---
    getContextDirPath: () => {
        if (typeof PathManager !== 'undefined') {
            return PathManager.join('AI_Context');
        }
        return 'AI_Context';
    },

    ensureContextFolder: () => {
        if (typeof require !== 'undefined') {
            try {
                const fs = require('fs');
                const dir = AIService.getContextDirPath();
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
            } catch (e) {
                console.error('Ensure Context Folder Error:', e);
            }
        }
    },

    // --- Mode Management ---
    addMode: (name, instruction) => {
        const id = 'mode_' + Date.now();
        AIService.config.modes.push({ id, name, instruction });
        AIService.saveConfig();
        return id;
    },

    deleteMode: (id) => {
        AIService.config.modes = AIService.config.modes.filter(m => m.id !== id);
        // If active mode is deleted, switch to default
        if (AIService.config.activeModeId === id) {
            AIService.config.activeModeId = AIService.config.modes[0]?.id || '';
        }
        AIService.saveConfig();
    },

    setActiveMode: (id) => {
        AIService.config.activeModeId = id;
        AIService.saveConfig();
    },

    getActiveMode: () => {
        return AIService.config.modes.find(m => m.id === AIService.config.activeModeId) || AIService.config.modes[0];
    },

    // --- Rule Management ---
    addRule: (ruleText) => {
        if (!AIService.config.customRules.includes(ruleText)) {
            AIService.config.customRules.push(ruleText);
            AIService.saveConfig();
        }
    },

    deleteRule: (ruleText) => {
        AIService.config.customRules = AIService.config.customRules.filter(r => r !== ruleText);
        AIService.saveConfig();
    },

    // --- Training Data (Context) ---
    addContextFile: (fileObj) => {
        // fileObj: { name: 'law.txt', content: '...', type: 'text/plain' }
        AIService.ensureContextFolder();

        // Check duplicate
        if (!AIService.config.contextFiles.find(f => f.name === fileObj.name)) {
            if (typeof require !== 'undefined') {
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const filePath = path.join(AIService.getContextDirPath(), fileObj.name + '.txt');

                    fs.writeFileSync(filePath, fileObj.content, 'utf8');

                    // Store only metadata in config
                    AIService.config.contextFiles.push({
                        name: fileObj.name,
                        type: fileObj.type,
                        size: fileObj.content.length
                    });

                    AIService.saveConfig();
                    return true;
                } catch (e) {
                    console.error('Add Context File Error:', e);
                    Toast.show('Dosya kaydedilemedi: ' + e.message, 'error');
                    return false;
                }
            } else {
                // Fallback for non-electron (rarely used now)
                AIService.config.contextFiles.push(fileObj);
                AIService.saveConfig();
                return true;
            }
        }
        return false;
    },

    deleteContextFile: (fileName) => {
        AIService.config.contextFiles = AIService.config.contextFiles.filter(f => f.name !== fileName);
        if (typeof require !== 'undefined') {
            try {
                const fs = require('fs');
                const path = require('path');
                const filePath = path.join(AIService.getContextDirPath(), fileName + '.txt');
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (e) {
                console.error('Delete Context File Error:', e);
            }
        }
        AIService.saveConfig();
    },

    clearAllContext: () => {
        AIService.config.contextFiles.forEach(f => AIService.deleteContextFile(f.name));
        AIService.config.contextFiles = [];
        AIService.saveConfig();
    },

    // --- API Interaction ---
    testConnection: async (apiKey, model = 'gemini-1.5-flash') => {
        if (!apiKey) return false;
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
            });
            return response.ok;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    sendMessage: async (userMessage, history = []) => {
        if (!AIService.config.apiKey) {
            throw new Error("Lütfen önce Ayarlar'dan bir API Anahtarı girin.");
        }

        // 1. Build System Instruction
        let systemPrompt = "Sen 'Dijital Müfettiş Yardımcısı' adlı yapay zeka asistanısın. Türkçe konuş.\n\n";

        // Mode
        const mode = AIService.getActiveMode();
        if (mode) systemPrompt += `GÖREV MODU (${mode.name}): ${mode.instruction}\n\n`;

        // Response Length
        if (AIService.config.responseLength === 'short') {
            systemPrompt += "CEVAP UZUNLUĞU: Kısa, öz ve net cevaplar ver. Gereksiz detaylardan kaçın.\n\n";
        } else {
            systemPrompt += "CEVAP UZUNLUĞU: Detaylı, açıklayıcı ve kapsamlı cevaplar ver.\n\n";
        }

        // Custom Rules
        if (AIService.config.customRules.length > 0) {
            systemPrompt += "ÖZEL KURALLAR (Bunlara KESİNLİKLE uy):\n";
            AIService.config.customRules.forEach(r => systemPrompt += `- ${r}\n`);
            systemPrompt += "\n";
        }

        // Training Context (Read from Disk)
        if (AIService.config.contextFiles.length > 0) {
            systemPrompt += "EĞİTİM VERİLERİ (Cevap verirken bu bilgileri kullan):\n";

            if (typeof require !== 'undefined') {
                const fs = require('fs');
                const path = require('path');
                const dir = AIService.getContextDirPath();

                AIService.config.contextFiles.forEach(f => {
                    const filePath = path.join(dir, f.name + '.txt');
                    if (fs.existsSync(filePath)) {
                        try {
                            const content = fs.readFileSync(filePath, 'utf8');
                            systemPrompt += `--- DOSYA: ${f.name} ---\n${content.substring(0, 15000)}\n----------------\n`;
                            // Slightly increased limit as we are not stringifying the whole object into localStorage anymore
                        } catch (readErr) {
                            console.error('Read Training File Error:', readErr);
                        }
                    }
                });
            } else {
                // Fallback for non-electron
                AIService.config.contextFiles.forEach(f => {
                    if (f.content) {
                        systemPrompt += `--- DOSYA: ${f.name} ---\n${f.content.substring(0, 5000)}...\n----------------\n`;
                    }
                });
            }
            systemPrompt += "\n";
        }

        const contents = [];

        // Add System Prompt as the very first context (simulated as user message for simple API usage)
        contents.push({
            role: "user",
            parts: [{ text: "SYSTEM INSTRUCTION:\n" + systemPrompt }]
        });
        contents.push({
            role: "model",
            parts: [{ text: "Anlaşıldı. Talimatlara uygun davranacağım." }]
        });

        // Add History
        history.forEach(msg => {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.message }]
            });
        });

        // Add Current Message
        contents.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        // 3. Send Request
        const modelName = AIService.config.model || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${AIService.config.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: contents })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'API Hatası');
            }

            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            console.error("AI Error:", error);
            throw error;
        }
    }
};

// Auto-init
AIService.init();
