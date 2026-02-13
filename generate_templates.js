const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const OUTPUT_DIR = path.join(__dirname, 'Sablonlar');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper to create a basic template
function createTemplate(filename, sheetName, items) {
    const wb = XLSX.utils.book_new();
    // Headers based on what AuditManager expects:
    // Col A (Index 0): Question Text
    // Col B (Index 1): Answer (Leave Empty)
    // Col C (Index 2): Notes (Leave Empty)

    // Actually, AuditManager.js line 921 reads:
    // c0 = r[0] (Text)
    // c1 = r[1] (Answer - skipped if 'evet'/'var')

    // We will create a simple 1-column list of questions for now, 
    // or a 3-column with headers to be safe.

    const wsData = [
        ['Denetim Sorusu', 'Durum', 'Notlar'] // Header
    ];

    items.forEach(item => {
        wsData.push([item, '', '']);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [{ wch: 60 }, { wch: 15 }, { wch: 30 }];

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const filePath = path.join(OUTPUT_DIR, filename);
    XLSX.writeFile(wb, filePath);
    console.log(`Created: ${filename}`);
}

// 1. Ozel Yurt Template (template_ozel_yurt.xlsx)
// Note: User asked for "Ozel Yurt" specially.
createTemplate('template_ozel_yurt.xlsx', 'Özel Yurt Denetimi', [
    'Kurum açma izin belgesi mevcut mu?',
    'Yangın merdiveni ve çıkışları açık ve kullanılabilir mi?',
    'Yemekhane hijyen kurallarına uygun mu?',
    'Öğrenci kayıt defteri güncel tutuluyor mu?',
    'Personel çalışma izinleri tam mı?',
    'Isıtma ve havalandırma sistemleri çalışıyor mu?',
    'Güvenlik kameraları aktif mi?',
    'Ecza dolabı ve ilk yardım malzemeleri tam mı?'
]);

// 2. Federasyon Template (template_federasyon.xlsx)
createTemplate('template_federasyon.xlsx', 'Federasyon Denetimi', [
    'Federasyon ana statüsü mevzuata uygun mu?',
    'Genel kurul tutanakları usulüne uygun tutulmuş mu?',
    'Yönetim kurulu karar defteri mevcut ve onaylı mı?',
    'Harcamalar bütçe talimatına uygun yapılmış mı?',
    'Personel özlük dosyaları tam mı?',
    'Sponsorluk sözleşmeleri dosyalanmış mı?',
    'Mal ve hizmet alımları ihale yönetmeliğine uygun mu?',
    'Demirbaş eşya defteri güncel mi?'
]);

// 3. Kulüp Template (template_kulup.xlsx)
createTemplate('template_kulup.xlsx', 'Kulüp Denetimi', [
    'Dernekler masası / Spor İl Müd. tescil belgesi var mı?',
    'Üye kayıt defteri güncel mi?',
    'Karar defteri noter tasdikli mi?',
    'Alındı belgeleri ve faturalar düzenli saklanıyor mu?',
    'Antrenör sözleşmeleri ve vizeleri tam mı?',
    'Sporcu lisansları güncel mi?',
    'Yıllık beyanname zamanında verilmiş mi?',
    'Lokal açma izni var mı (varsa)?'
]);

console.log('All templates generated successfully.');
