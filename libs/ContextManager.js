if (typeof ContextManager === 'undefined') {
    class ContextManager {
        constructor() {
            this.activeDocument = null;
            this.legislation = JSON.parse(localStorage.getItem('context_legislation') || '[]');
            // Tone: friendly (Dengeli/Samimi), formal (Resmi), relaxed (Rahat)
            // Scope: legislative (Mevzuat Odaklı), creative (Serbest/Yorum)
            this.settings = JSON.parse(localStorage.getItem('context_settings') || '{"tone": "friendly", "scope": "legislative", "rules": []}');
        }

        addLegislation(content, name, type = 'text', mimeType = 'text/plain') {
            // content can be string (text) or base64 (image)
            this.legislation.push({ name, content, type, mimeType, timestamp: Date.now() });
            this.save();
        }

        removeLegislation(index) {
            if (index > -1 && index < this.legislation.length) {
                this.legislation.splice(index, 1);
                this.save();
                return true;
            }
            return false;
        }

        clearLegislation() {
            this.legislation = [];
            this.save();
        }

        save() {
            // Safety check for localStorage quota
            try {
                localStorage.setItem('context_legislation', JSON.stringify(this.legislation));
            } catch (e) {
                console.error("Storage full", e);
                // If full, try removing the last added item
                this.legislation.pop();
                alert("Hafıza dolu! Son yüklenen dosya kaydedilemedi.");
            }
        }


        // --- Settings & Rules Management ---
        saveSettings() {
            localStorage.setItem('context_settings', JSON.stringify(this.settings));
        }

        updateSetting(key, value) {
            this.settings[key] = value;
            this.saveSettings();
        }

        addRule(ruleText) {
            if (ruleText && !this.settings.rules.includes(ruleText)) {
                this.settings.rules.push(ruleText);
                this.saveSettings();
                return true;
            }
            return false;
        }

        removeRule(index) {
            if (index > -1 && index < this.settings.rules.length) {
                this.settings.rules.splice(index, 1);
                this.saveSettings();
                return true;
            }
            return false;
        }

        getSystemInstruction() {
            const { tone, scope, rules } = this.settings;

            let toneInstruction = "";
            const tonePresets = {
                'formal': "Çok resmi, kurumsal ve 'Siz' diliyle konuş. Asla laubali olma. Ciddi bir devlet görevlisi gibi davran.",
                'relaxed': "Çok rahat, arkadaşça ve 'Sen' diliyle konuş. Esprili olabilirsin, kasmana gerek yok. Abi/Kardeş gibi konuş.",
                'friendly': "Samimi ama saygılı bir Türkçe kullan. 'Hocam', 'Üstadım' gibi hitaplara uyum sağla ama cıvıklaşma. Müfettiş Yardımcısı ağırlığını koru."
            };
            // Eğer preset varsa onu kullan, yoksa kullanıcının girdiği özel tanımı kullan
            toneInstruction = tonePresets[tone] || `Özel Tavır Talimatı: ${tone}`;

            let scopeInstruction = "";
            const scopePresets = {
                'legislative': "SADECE mevzuat, kanun ve yönetmeliklere dayanarak cevap ver. Kendi yorumunu katma. Kesin bilgi ver.",
                'creative': "Mevzuata ek olarak genel bilgi, yorum ve önerilerini de paylaşabilirsin. Konuyu genişletebilirsin."
            };
            // Eğer preset varsa onu kullan, yoksa kullanıcının girdiği özel tanımı kullan
            scopeInstruction = scopePresets[scope] || `Özel Kapsam Talimatı: ${scope}`;

            let customRules = "";
            if (rules.length > 0) {
                customRules = "\nÖZEL KULLANICI KURALLARI (BUNLARA KESİNLİKLE UY):\n" + rules.map(r => `- ${r}`).join("\n");
            }

            return `Sen Müfettiş Asistanı 'Dijital MüfYard'sın.
${toneInstruction}
${scopeInstruction}

Görevin: Müfettişlere yardımcı olmak.

YETENEKLERİN:
1. MEVZUAT & ANALİZ: Belgeleri okur ve analiz edersin.
2. SOHBET: Kullanıcının moduna göre sohbet edersin.
3. İŞLEM: Not alır, görev eklersin.

ÖNEMLİ KURALLAR:
- Kullanıcıya saygısızlık etme. Hakaret edilirse nazikçe uyar.
- Bilmediğin konuda dürüst ol.
${customRules}

KOMUT FORMATLARI:
[[ACTION: {"action": "createTask", "data": {"title": "Başlık", "priority": "normal"}} ]]
[[ACTION: {"action": "createNote", "data": {"title": "Başlık", "content": "İçerik"}} ]]`;
        }

        async getCombinedContext(userPrompt) {
            let context = "";
            const lowerPrompt = userPrompt.toLowerCase();

            // 0. Sohbet Geçmişi (Yakın Hafıza)
            const history = JSON.parse(localStorage.getItem('chat_history') || '[]');
            if (history.length > 0) {
                const recentHistory = history.slice(-6); // Son 6 mesajı hatırla
                context += "--- SOHBET GEÇMİŞİ (HATIRLAMAN GEREKENLER) ---\n";
                recentHistory.forEach(msg => {
                    const speaker = msg.role === 'user' ? 'Kullanıcı' : 'Sen';
                    context += `${speaker}: ${msg.content}\n`;
                });
                context += "\n";
            }

            // 1. Yüklenen Belgeler (Mevzuat, Excel, PDF, Resim)
            let imageAttachments = [];

            if (this.legislation.length > 0) {
                context += "--- YÜKLENEN BELGE VE VERİLER (Hafıza) ---\n";
                this.legislation.forEach(l => {
                    if (l.type === 'image') {
                        imageAttachments.push({
                            inlineData: {
                                mimeType: l.mimeType,
                                data: l.content // Base64 string
                            }
                        });
                        context += `[Görsel Dosyası: ${l.name}] (Görsel eklendi)\n`;
                    } else {
                        // Text content (Handle legacy 'text' property if 'content' is missing)
                        const safeContent = l.content || l.text || "";
                        context += `[Dosya: ${l.name}]\n${safeContent.substring(0, 500000)}\n\n`; // Limit text size
                    }
                });
            }




            // 2. Uygulama Verileri (Görevler) - Daha geniş tetikleme
            if (lowerPrompt.includes("görev") || lowerPrompt.includes("işler") || lowerPrompt.includes("yapılacaklar") || lowerPrompt.includes("neler var")) {
                const tasks = window.TaskManager?.getTasks() || [];
                if (tasks.length > 0) {
                    context += "--- MEVCUT GÖREVLER (SİSTEMDE KAYITLI) ---\n";
                    tasks.forEach(t => {
                        context += `- [${t.priority}] ${t.content} (${t.completed ? 'Tamamlandı' : 'Bekliyor'})\n`;
                    });
                    context += "\n";
                } else {
                    context += "--- GÖREV BİLGİSİ ---\nŞu an sistemde bekleyen veya kayıtlı görev bulunmuyor.\n\n";
                }
            }

            // 3. Rapor Verileri
            if (lowerPrompt.includes("rapor")) {
                const reports = window.ReportManager?.getReports() || [];
                if (reports.length > 0) {
                    context += "--- AKTİF RAPORLAR ---\n";
                    reports.forEach(r => {
                        context += `- ${r.code}: ${r.title} (${r.status})\n`;
                    });
                    context += "\n";
                }
            }

            // 4. Rehber Verileri (Kişisel & Kurumsal)
            if (lowerPrompt.includes("rehber") || lowerPrompt.includes("kim") || lowerPrompt.includes("telefon") || lowerPrompt.includes("numara") || lowerPrompt.includes("dahili")) {
                context += "--- REHBER BİLGİLERİ ---\n";

                // Kişisel Rehber
                const personalContacts = window.ContactsManager?.getContacts() || [];
                if (personalContacts.length > 0) {
                    context += "[Kişisel Rehberim]:\n";
                    personalContacts.forEach(c => {
                        context += `- ${c.name} (${c.role}): ${c.phone} / ${c.email}\n`;
                    });
                }

                // Kurumsal Rehber (Filtreleyerek ekle - çok büyük olabilir)
                const corpData = window.CorporateContactsManager?.data || [];
                if (corpData.length > 0) {
                    context += "\n[Kurumsal Rehber (Eşleşenler)]:\n";
                    // Prompt içinde geçen isim varsa onu bul, yoksa genel bir özet veya uyarı ver
                    // Şimdilik basit bir içerik kontrolü yapalım
                    let foundAny = false;
                    corpData.forEach(item => {
                        if (item.type === 'person') {
                            // Eğer kullanıcı spesifik bir isim sorduysa sadece onu ekle, 
                            // yoksa çok fazla veri olur.
                            const nameParts = item.name.toLowerCase().split(' ');
                            const isMatch = nameParts.some(part => part.length > 2 && lowerPrompt.includes(part));

                            if (isMatch) {
                                context += `- ${item.name} (${item.role}): Tel: ${item.phone}, Dahili: ${item.ext}, Konum: ${item.location}\n`;
                                foundAny = true;
                            }
                        }
                    });
                    if (!foundAny) {
                        context += "(Aradığınız kişi kurumsal rehberde bulunamadı veya spesifik bir isim belirtmediniz.)\n";
                    }
                }
                context += "\n";
            }

            // 5. Takvim Verileri (Her zaman veya "takvim", "randevu" kelimeleriyle)
            if (lowerPrompt.includes("takvim") || lowerPrompt.includes("randevu") || lowerPrompt.includes("program") || lowerPrompt.includes("bugün") || lowerPrompt.includes("yarın")) {
                const events = window.CalendarManager?.events || []; // CalendarManager var mı kontrol et
                if (events.length > 0) {
                    context += "--- TAKVİM GEÇMİŞİ VE GELECEĞİ ---\n";
                    // Basitçe son ve gelecek etkinlikleri filtreleyelim
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    events.forEach(ev => {
                        const evDate = new Date(ev.dateStr); // YYYY-MM-DD varsayımı
                        if (evDate >= today) {
                            context += `- [${ev.dateStr}] ${ev.title}\n`;
                        }
                    });
                    context += "\n";
                } else {
                    context += "--- TAKVİM ---\n(Takvimde kayıtlı gelecek etkinlik yok.)\n\n";
                }
            }

            // 6. Ayarlar / Sistem Durumu
            if (lowerPrompt.includes("ayar") || lowerPrompt.includes("versiyon") || lowerPrompt.includes("sürüm") || lowerPrompt.includes("durum")) {
                context += "--- SİSTEM BİLGİLERİ ---\n";
                context += `- Uygulama: Dijital MüfYard v1.0\n`;
                context += `- Kullanıcı: ${window.AuthManager?.getUser()?.fullname || 'Misafir'}\n`;
                context += `- Tema: ${localStorage.getItem('theme') || 'Varsayılan'}\n\n`;
            }

            return { text: context, images: imageAttachments };
        }
    }

    window.ContextManager = new ContextManager();
}
