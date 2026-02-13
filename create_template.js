const fs = require('fs');
const path = require('path');
// Check for local library first, then global
const xlsxPath = path.join(__dirname, 'libs/xlsx.full.min.js');
let XLSX;

if (fs.existsSync(xlsxPath)) {
    // We need to simulate browser context for some libs or use a node-compatible one.
    // However, xlsx.full.min.js is often a browser build. 
    // Let's try to find a node_modules version first if available.
    try {
        XLSX = require('xlsx');
    } catch (e) {
        console.log("Global xlsx not found. Trying local lib...");
        // This might fail if it's purely a browser lib without CommonJS exports
        // simplified approach: Create a simple array based structure and write manual or use a different approach.
        // Re-reading the project: it HAS node_modules.
        try {
            XLSX = require(path.join(__dirname, 'node_modules/xlsx'));
        } catch (e2) {
            console.error("Cannot load XLSX module. Please run 'npm install xlsx' or ensure node_modules exists.");
            process.exit(1);
        }
    }
} else {
    try {
        XLSX = require('xlsx');
    } catch (e) {
        console.error("XLSX module not found.");
        process.exit(1);
    }
}

const wb = XLSX.utils.book_new();

// 1. Genel Teftiş
const wsData1 = [
    ["Bölüm", "Soru", "Cevap (Evet/Hayır)"],
    ["İdari Konular", "Yurt Müdürlüğü tabelası mevzuata uygun mu?", "", ""],
    ["İdari Konular", "Personel devam çizelgeleri düzenli tutuluyor mu?", "", ""],
    ["Mali Konular", "Satın alma dosyaları standartlara uygun mu?", "", ""],
    ["Öğrenci İşleri", "Öğrenci kayıt kabulleri sisteme girilmiş mi?", "", ""]
];
const ws1 = XLSX.utils.aoa_to_sheet(wsData1);
XLSX.utils.book_append_sheet(wb, ws1, "Genel Teftiş");

// 2. Özel Denetim
const wsData2 = [
    ["Bölüm", "Soru", "Cevap"],
    ["Yemekhane", "Yemek numuneleri 72 saat saklanıyor mu?", "", ""],
    ["Yemekhane", "Mutfak hijyen kurallarına uyuluyor mu?", "", ""],
    ["Kantin", "Fiyat listesi görünür bir yerde asılı mı?", "", ""]
];
const ws2 = XLSX.utils.aoa_to_sheet(wsData2);
XLSX.utils.book_append_sheet(wb, ws2, "Özel Denetim");

// Ensure directory exists
const targetDir = path.join(__dirname, 'Sablonlar');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
}

const targetPath = path.join(targetDir, 'denetim_formu.xlsx');
XLSX.writeFile(wb, targetPath);

console.log(`Template created at: ${targetPath}`);
