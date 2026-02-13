const CalendarManager = {
    currentDate: new Date(),

    currentDate: new Date(),
    selectedDateStr: '',
    activeNoteId: null,

    initCalendarView: () => {
        CalendarManager.renderCalendar();
    },

    changeMonth: (offset) => {
        CalendarManager.currentDate.setMonth(CalendarManager.currentDate.getMonth() + offset);
        CalendarManager.renderCalendar();
    },

    openNoteModal: (day) => {
        const month = CalendarManager.currentDate.getMonth();
        const year = CalendarManager.currentDate.getFullYear();
        CalendarManager.selectedDateStr = `${day} ${CalendarManager.getMonthName(month)} ${year}`;

        const modal = document.getElementById('calendar-note-modal');
        const title = document.getElementById('calendar-note-date');
        const input = document.getElementById('calendar-note-input');

        if (modal && title && input) {
            // Check for existing note
            const notes = typeof NoteManager !== 'undefined' ? NoteManager.getNotes() : [];
            const existingNote = notes.find(n => n.content.startsWith(`[${CalendarManager.selectedDateStr}]`));

            if (existingNote) {
                CalendarManager.activeNoteId = existingNote.id;
                title.textContent = `${CalendarManager.selectedDateStr} - Notu Düzenle`;
                // Strip the date prefix for editing
                const cleanContent = existingNote.content.replace(`[${CalendarManager.selectedDateStr}]`, '').trim();
                input.value = cleanContent;
            } else {
                CalendarManager.activeNoteId = null;
                title.textContent = `${CalendarManager.selectedDateStr} - Not Ekle`;
                input.value = '';
            }

            modal.style.display = 'flex';
            input.focus();
        }
    },

    saveNoteFromModal: () => {
        const input = document.getElementById('calendar-note-input');
        const noteContent = input.value.trim();

        if (noteContent) {
            if (typeof NoteManager !== 'undefined') {
                const fullContent = `[${CalendarManager.selectedDateStr}] ${noteContent}`;

                if (CalendarManager.activeNoteId) {
                    NoteManager.updateNote(CalendarManager.activeNoteId, fullContent);
                    Toast.show('Not güncellendi!', 'success');
                } else {
                    NoteManager.addNote(fullContent);
                    Toast.show('Not kaydedildi!', 'success');
                }

                // Reset state
                CalendarManager.activeNoteId = null;
                input.value = '';
                document.getElementById('calendar-note-modal').style.display = 'none';

                // Takvimi anında güncelle
                CalendarManager.renderCalendar();
            } else {
                Toast.show('Hata: NoteManager bulunamadı.', 'error');
            }
        } else {
            Toast.show('Lütfen bir not yazın.', 'warning');
        }
    },

    addNoteForDay: (day) => {
        // Legacy Prompt Fallback
        const month = CalendarManager.currentDate.getMonth();
        const year = CalendarManager.currentDate.getFullYear();
        const dateStr = `${day} ${CalendarManager.getMonthName(month)} ${year}`;

        const noteContent = prompt(`${dateStr} için notunuzu girin:`);

        if (noteContent && noteContent.trim() !== '') {
            if (typeof NoteManager !== 'undefined') {
                const fullContent = `[${dateStr}] ${noteContent}`;
                NoteManager.addNote(fullContent);
                Toast.show('Not başarıyla eklendi! "Hızlı Notlar" bölümünden görebilirsiniz.', 'success');
                CalendarManager.renderCalendar();
            } else {
                Toast.show('Hata: Not yöneticisi bulunamadı.', 'error');
            }
        }
    },

    getMonthName: (monthIndex) => {
        const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        return monthNames[monthIndex];
    },

    renderCalendar: () => {
        const container = document.getElementById('content-area');
        if (!container) return;

        const now = CalendarManager.currentDate;
        const realToday = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        container.innerHTML = `
            <div class="section-container">
                <div class="calendar-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <div style="font-size:1.5rem; font-weight:bold; color:var(--text-main);">${CalendarManager.getMonthName(currentMonth)} ${currentYear}</div>
                    <div style="display:flex; gap:0.5rem;">
                         <button class="btn-icon" onclick="CalendarManager.changeMonth(-1)" style="cursor:pointer; padding:0.5rem; border:1px solid #e2e8f0; border-radius:8px; background:#fff;">
                            <span class="material-icons-round">chevron_left</span>
                         </button>
                         <button class="btn-icon" onclick="CalendarManager.changeMonth(1)" style="cursor:pointer; padding:0.5rem; border:1px solid #e2e8f0; border-radius:8px; background:#fff;">
                            <span class="material-icons-round">chevron_right</span>
                         </button>
                    </div>
                </div>
                <!-- Drag Info -->
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.5rem; text-align:center;">
                    <span class="material-icons-round" style="font-size:0.9rem; vertical-align:middle;">drag_indicator</span>
                    Tarihleri değiştirmek için kutucukları sürükleyip bırakabilirsiniz.
                </div>
                <div class="calendar-grid" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:0.5rem; padding:0; background:transparent; box-shadow:none;">
                    <div class="cal-day-header">Pazartesi</div>
                    <div class="cal-day-header">Salı</div>
                    <div class="cal-day-header">Çarşamba</div>
                    <div class="cal-day-header">Perşembe</div>
                    <div class="cal-day-header">Cuma</div>
                    <div class="cal-day-header">Cumartesi</div>
                    <div class="cal-day-header">Pazar</div>
                    <!-- JS ile Doldurulacak -->
                </div>
                 <div style="margin-top:1rem; font-size:0.85rem; color:var(--text-secondary); display:flex; gap:1rem; align-items:center;">
                    <div style="display:flex; align-items:center; gap:0.25rem;"><span style="width:10px; height:10px; background:#b91c1c; border-radius:2px;"></span> Önemli Günler</div>
                    <div style="display:flex; align-items:center; gap:0.25rem;"><span style="width:10px; height:10px; background:#e3f2fd; border-radius:2px;"></span> Rapor Başlangıcı</div>
                    <div style="display:flex; align-items:center; gap:0.25rem;"><span style="width:10px; height:10px; background:#fff3e0; border-radius:2px;"></span> Rapor Teslimi</div>
                </div>
            </div>
        `;

        const grid = container.querySelector('.calendar-grid');

        // Ayın ilk günü (1'i) hangi güne denk geliyor?
        let firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0-6
        firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        // Boş Hücreler
        for (let i = 0; i < firstDayIndex; i++) {
            grid.innerHTML += `<div style="height:85px; background:#f8fafc; border-radius:8px;"></div>`;
        }

        const reports = typeof ReportManager !== 'undefined' ? ReportManager.getReports() : [];
        const notes = typeof NoteManager !== 'undefined' ? NoteManager.getNotes() : [];

        // Özel Günler Listesi
        const specialDays = {
            '1-1': 'Yılbaşı',
            '23-4': '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı',
            '30-4': 'Denetim Haftası (30 Nisan)',
            '2-5': 'Denetim Haftası (Kutlama)',
            '1-5': 'Emek ve Dayanışma Günü',
            '19-5': '19 Mayıs Atatürk\'ü Anma, Gençlik ve Spor Bayramı',
            '15-7': '15 Temmuz Demokrasi ve Milli Birlik Günü',
            '30-8': '30 Ağustos Zafer Bayramı',
            '29-10': '29 Ekim Cumhuriyet Bayramı'
        };

        // Günleri Doldur
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const displayDateStr = `${day} ${CalendarManager.getMonthName(currentMonth)} ${currentYear}`;
            const specialDayKey = `${day}-${currentMonth + 1}`;
            const specialDayName = specialDays[specialDayKey];

            // Check if this day has a note from calendar
            const dayNote = notes.find(n => n.content.startsWith(`[${displayDateStr}]`));

            const isToday = (day === realToday.getDate() && currentMonth === realToday.getMonth() && currentYear === realToday.getFullYear());

            let noteIconHTML = '';
            if (dayNote) {
                const cleanContent = dayNote.content.replace(`[${displayDateStr}]`, '').trim();
                noteIconHTML = `<span class="material-icons-round" style="font-size:1rem; color:#0ea5e9; vertical-align:middle; margin-left:4px; cursor:help;" title="Not: ${cleanContent}">description</span>`;
            }

            let contentHTML = `<div style="font-weight:bold; color:${isToday ? 'var(--primary-color)' : 'var(--text-secondary)'}; margin-bottom:0.4rem; display:flex; justify-content:space-between; align-items:center; pointer-events:none;">
                <div style="display:flex; align-items:center;">
                    <span>${day}</span>
                    ${noteIconHTML}
                </div>
                ${isToday ? '<span style="font-size:0.65rem; background:#dbeafe; color:#1e40af; padding:1px 4px; border-radius:4px;">BUGÜN</span>' : ''}
            </div>`;

            if (specialDayName) {
                contentHTML += `<div style="font-size:0.75rem; background:#b91c1c; color:#fff; padding:3px 6px; border-radius:4px; margin-bottom:2px; font-weight:600; text-align:center;">${specialDayName}</div>`;
            }

            reports.forEach(rep => {
                // Static Items
                if (rep.startDate === dateStr) {
                    contentHTML += `<div class="cal-event" data-type="start" title="${rep.title}">B: ${rep.code}</div>`;
                }
                if (rep.deadline === dateStr) {
                    contentHTML += `<div class="cal-event" data-type="deadline" title="${rep.title}">T: ${rep.code}</div>`;
                }
            });

            // Hover note hint
            contentHTML += `<div class="add-note-hint" style="margin-top:auto; text-align:center; font-size:0.7rem; color:#94a3b8; display:none;">+ Not</div>`;

            grid.innerHTML += `
                <div onclick="window.CalendarManager.openNoteModal(${day})" 
                     onmouseenter="this.querySelector('.add-note-hint').style.display='block'; this.style.borderColor='var(--primary-color)';"
                     onmouseleave="this.querySelector('.add-note-hint').style.display='none'; this.style.borderColor='${isToday ? 'var(--primary-color)' : '#e2e8f0'}';"
                     style="height:85px; background:#fff; border:1px solid ${isToday ? 'var(--primary-color)' : '#e2e8f0'}; border-radius:8px; padding:0.3rem; overflow-y:auto; cursor:pointer; display:flex; flex-direction:column; transition:all 0.2s; ${isToday ? 'box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.1);' : ''}">
                    ${contentHTML}
                </div>
            `;
        }
    }
};

window.CalendarManager = CalendarManager;
