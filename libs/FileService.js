if (typeof FileService === 'undefined') {
    class FileService {
        /**
         * Reads a file and returns its text content.
         * Supports: .txt, .json, .md, .csv (native), .docx (via mammoth), .pdf (via pdf.js)
         * @param {File} file 
         * @returns {Promise<string>}
         */
        static async readFile(file) {
            const extension = file.name.split('.').pop().toLowerCase();
            let result = { text: '', metadata: {} };

            try {
                if (extension === 'txt' || extension === 'md' || extension === 'json' || extension === 'csv' || extension === 'html') {
                    const text = await this.readTextFile(file);
                    result = { text, metadata: { type: 'text', size: text.length } };
                } else if (extension === 'docx') {
                    const text = await this.readDocxFile(file);
                    result = { text, metadata: { type: 'docx', size: text.length } };
                } else if (extension === 'pdf') {
                    result = await this.readPdfFile(file);
                } else if (extension === 'xlsx' || extension === 'xls') {
                    const text = await this.readExcelFile(file);
                    result = { text, metadata: { type: 'excel', size: text.length } };
                } else {
                    return { text: `[Desteklenmeyen Dosya Türü: .${extension}]`, metadata: { error: true } };
                }
                return result;
            } catch (error) {
                console.error("Dosya okuma hatası:", error);
                throw new Error(`Dosya okunamadı: ${error.message}`);
            }
        }

        static readTextFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });
        }

        static async readDocxFile(file) {
            if (!window.mammoth) {
                console.warn("Mammoth.js yüklü değil, DOCX metin olarak okunamadı.");
                return "[SİSTEM UYARISI: DOCX okuma kütüphanesi (Mammoth) eksik. Lütfen geliştiriciye bildirin.]";
            }

            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsArrayBuffer(file);
            });

            const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            return result.value || "[Boş DOCX]";
        }

        static async readPdfFile(file) {
            if (!window.pdfjsLib) {
                console.warn("PDF.js yüklü değil.");
                return { text: "[SİSTEM UYARISI: PDF okuma kütüphanesi eksik.]", metadata: { error: true } };
            }

            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsArrayBuffer(file);
            });

            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            const totalPages = pdf.numPages;

            for (let i = 1; i <= totalPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += `--- Sayfa ${i} ---\n${pageText}\n\n`;
            }

            return {
                text: fullText,
                metadata: { type: 'pdf', pages: totalPages, size: fullText.length }
            };
        }

        static async readExcelFile(file) {
            if (typeof XLSX === 'undefined') {
                return "[SİSTEM UYARISI: Excel okuma kütüphanesi (SheetJS) eksik.]";
            }

            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            let fullText = "";

            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(worksheet);
                fullText += `--- Sayfa: ${sheetName} ---\n${csv}\n\n`;
            });

            return fullText || "[Boş Excel Dosyası]";
        }

        /**
         * Fetches URL content using a proxy or direct fetch if CORS allows.
         * Note: Direct fetching usually fails due to CORS on client-side.
         * We will try a 'no-cors' request which is often opaque, or just simple fetch.
         * Usually relies on a backend proxy. For this MVP, we try direct and handle error.
         * @param {string} url 
         */
        static async fetchUrl(url) {
            try {
                // Using a public CORS proxy for demo purposes (e.g. corsproxy.io) is common in playgrounds
                // But for privacy, we should try direct first or warn user.
                // Let's try to just fetch text directly.
                const response = await fetch(url);
                if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

                const html = await response.text();
                // Simple HTML to Text conversion
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                return tmp.innerText || tmp.textContent;

            } catch (e) {
                // If CORS error, suggest manual copy paste
                console.error("URL Fetch Error (muhtemelen CORS):", e);
                throw new Error(`Linkten veri çekilemedi (Güvenlik/CORS engeli). Lütfen metni kopyalayıp yapıştırın. Hata: ${e.message}`);
            }
        }
    }

    window.FileService = FileService;
}
