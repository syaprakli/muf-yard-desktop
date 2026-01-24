if (typeof AIService === 'undefined') {
    class AIService {
        constructor() {
            const storedKey = localStorage.getItem('gemini_api_key');
            this.apiKey = (storedKey && storedKey !== 'null' && storedKey !== 'undefined') ? storedKey.trim() : null;
            this.model = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';
        }

        saveKey(provider, key) {
            if (provider === 'gemini') {
                const cleanKey = key ? key.trim() : null;
                this.apiKey = cleanKey;
                localStorage.setItem('gemini_api_key', cleanKey);
            }
        }

        saveModel(model) {
            this.model = model;
            localStorage.setItem('gemini_model', model);
        }

        async fetchModels() {
            if (!this.apiKey) throw new Error("API Key ayarlanmamış.");

            try {
                // Modelleri çekmek için v1beta daha fazla detay verebilir
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error.message || `API Hatası ${response.status}`);
                }
                const data = await response.json();
                return data.models.filter(m => m.name.includes('gemini'));
            } catch (error) {
                console.error("Model çekme hatası:", error);
                throw error;
            }
        }

        async testConnection(provider) {
            if (!this.apiKey) return false;
            try {
                const result = await this.chat("Merhaba, bağlandık mı?", "Sadece 'Evet' de.");
                return result.includes("Evet");
            } catch (e) {
                console.error("Test hatası:", e);
                throw e;
            }
        }

        async chat(prompt, systemInstruction = null, images = []) {
            if (!this.apiKey) throw new Error("API Anahtarı eksik.");

            // Model ismini temizle/düzenle (Örn: models/gemini-1.5-flash)
            let modelName = this.model;
            if (!modelName.startsWith('models/')) modelName = `models/${modelName}`;

            const versions = ['v1beta', 'v1'];
            let lastError = null;

            for (const version of versions) {
                const url = `https://generativelanguage.googleapis.com/${version}/${modelName}:generateContent?key=${this.apiKey}`;

                const requestBody = { contents: [{ parts: [] }] };

                // Handle Text Prompt
                let textPrompt = typeof prompt === 'string' ? prompt : prompt.text;
                if (textPrompt) {
                    requestBody.contents[0].parts.push({ text: textPrompt });
                }

                // Handle Separate Images Array (New Style)
                if (images && Array.isArray(images) && images.length > 0) {
                    images.forEach(img => {
                        // img should be { inlineData: { mimeType: "...", data: "..." } }
                        requestBody.contents[0].parts.push(img);
                    });
                }

                // Handle Legacy Object Prompt with Single Image
                if (typeof prompt === 'object' && prompt.image) {
                    requestBody.contents[0].parts.push({
                        inlineData: {
                            mimeType: prompt.image.mimeType,
                            data: prompt.image.data
                        }
                    });
                }

                // System Instructions
                if (systemInstruction && version === 'v1beta') {
                    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
                } else if (systemInstruction && version === 'v1') {
                    // Prepend system instruction for v1 if text exists
                    if (requestBody.contents[0].parts[0].text) {
                        requestBody.contents[0].parts[0].text = `Sistem Talimatı: ${systemInstruction}\n\nKullanıcı: ${requestBody.contents[0].parts[0].text}`;
                    }
                }

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                            return data.candidates[0].content.parts[0].text;
                        }
                    } else {
                        const err = await response.json().catch(() => ({}));
                        lastError = err.error?.message || `API Hatası (Kod: ${response.status})`;
                        // Eğer model bulunamadıysa bir genel sürümü dene, yoksa döngü devam etsin
                        console.warn(`Gemini API ${version} denemesi başarısız:`, lastError);
                    }
                } catch (error) {
                    lastError = error.message;
                    console.error(`Gemini API ${version} ağ hatası:`, error);
                }
            }

            throw new Error(lastError || "AI yanıt vermedi. Lütfen 'Yenile' butonu ile modelleri güncelleyip tekrar deneyin.");
        }
    }

    // Global olarak erişilebilir hale getir
    window.aiService = new AIService();
}
