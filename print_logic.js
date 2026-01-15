function printReport(id) {
    const reports = ReportManager.getReports();
    const report = reports.find(r => r.id === id);
    if (!report) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Rapor Detayı - ${report.code}</title>
            <style>
                body { font-family: 'Times New Roman', Times, serif; padding: 2rem; }
                h1 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 1rem; }
                .meta-table { width: 100%; border-collapse: collapse; margin-top: 2rem; }
                .meta-table th, .meta-table td { border: 1px solid #000; padding: 8px; text-align: left; }
                .meta-table th { background: #f0f0f0; width: 30%; }
                .checklist-section { margin-top: 2rem; }
                .checklist-item { margin-bottom: 0.5rem; display: flex; align-items: center; }
                .checkbox-box { width: 16px; height: 16px; border: 1px solid #000; margin-right: 10px; display: inline-block; }
                .checked { background: #000; }
                .footer { margin-top: 4rem; text-align: right; }
            </style>
        </head>
        <body>
            <h1>Müfettişlik Teftiş Raporu</h1>
            
            <table class="meta-table">
                <tr><th>Rapor Kodu</th><td>${report.code || '-'}</td></tr>
                <tr><th>Konu / Başlık</th><td>${report.title}</td></tr>
                <tr><th>Rapor Türü</th><td>${report.type.toUpperCase()}</td></tr>
                <tr><th>Başlama Tarihi</th><td>${new Date(report.startDate).toLocaleDateString('tr-TR')}</td></tr>
                <tr><th>Bitiş Tarihi</th><td>${new Date(report.deadline).toLocaleDateString('tr-TR')}</td></tr>
                <tr><th>Süre</th><td>${report.duration} Gün</td></tr>
                <tr><th>Durum</th><td>${report.status.toUpperCase()}</td></tr>
            </table>

            <div class="checklist-section">
                <h3>İş Adımları / Checklist</h3>
                ${(report.checklist || []).map(item => `
                    <div class="checklist-item">
                        <div class="checkbox-box ${item.completed ? 'checked' : ''}"></div>
                        <span>${item.text}</span>
                    </div>
                `).join('')}
                ${(!report.checklist || report.checklist.length === 0) ? '<p>Ekli iş adımı yok.</p>' : ''}
            </div>

            <div class="footer">
                <p>İmza</p>
                <br><br>
                <p>_____________________</p>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}
