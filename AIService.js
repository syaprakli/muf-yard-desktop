const AIService = {
    // Default Configuration
    config: {
        apiKey: '',
        model: 'gemini-1.5-flash',
        activeModeId: 'default_1',
        responseLength: 'detailed', // 'short' or 'detailed'
        customRules: [], // Array of strings
        contextFiles: [], // Array of {name, content, type}
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
    },

    saveConfig: () => {
        localStorage.setItem('ai_config', JSON.stringify(AIService.config));
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
        // Check duplicate
        if (!AIService.config.contextFiles.find(f => f.name === fileObj.name)) {
            AIService.config.contextFiles.push(fileObj);
            AIService.saveConfig();
            return true;
        }
        return false;
    },

    deleteContextFile: (fileName) => {
        AIService.config.contextFiles = AIService.config.contextFiles.filter(f => f.name !== fileName);
        AIService.saveConfig();
    },

    clearAllContext: () => {
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

        // Training Context
        if (AIService.config.contextFiles.length > 0) {
            systemPrompt += "EĞİTİM VERİLERİ (Cevap verirken bu bilgileri kullan):\n";
            AIService.config.contextFiles.forEach(f => {
                systemPrompt += `--- DOSYA: ${f.name} ---\n${f.content.substring(0, 10000)}...\n----------------\n`;
                // Note: Truncated for token limit safety in this demo, ideal is RAG or full context if small.
            });
            systemPrompt += "\n";
        }

        // 2. Prepare Payload
        // We prepend system prompt to the first message or send as system_instruction if supported via REST, 
        // but for simplicity via simple fetch, we can prepend it to the user message or history.
        // Better approach: Prepend to history as a 'model' or 'user' instruction.

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
