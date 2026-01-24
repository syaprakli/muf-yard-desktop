if (typeof ActionService === 'undefined') {
    class ActionService {
        static async handleAction(actionObj) {
            console.log("Action Received:", actionObj);

            if (!actionObj || !actionObj.action) return false;

            const { action, data } = actionObj;

            try {
                switch (action) {
                    case 'createTask':
                        return await this.createTask(data);
                    case 'createNote':
                        return await this.createNote(data);
                    case 'setReminder': // Optional extended capability
                        return await this.setReminder(data);
                    default:
                        console.warn("Unknown action:", action);
                        return false;
                }
            } catch (error) {
                console.error("Action Execution Failed:", error);
                Toast.show(`İşlem hatası: ${error.message}`, 'error');
                return false;
            }
        }

        static async createTask(data) {
            // data: { title, priority, description }
            if (!data || !data.title) throw new Error("Görev başlığı eksik.");

            const priority = data.priority || 'normal';
            const task = window.TaskManager.addTask(data.title, priority);

            // If description provided, maybe append to title or handle differently
            // For now, simpler is better.

            Toast.show(`Görev Oluşturuldu: ${data.title}`, 'success');

            // Refresh UI if on tasks view
            const currentView = document.querySelector('.nav-item.active');
            if (currentView && currentView.dataset.view === 'tasks') {
                window.UIManager.renderTasks(window.TaskManager.getTasks());
            }

            return true;
        }

        static async createNote(data) {
            // data: { title, content }
            if (!data || (!data.content && !data.title)) throw new Error("Not başlığı veya içeriği eksik.");

            const title = data.title || 'Yeni Not';
            const content = data.content || '';
            window.NoteManager.addNote(title, content);

            Toast.show(`Not Kaydedildi: ${title}`, 'success');

            // Refresh UI if on notes view
            const currentView = document.querySelector('.nav-item.active');
            if (currentView && currentView.dataset.view === 'notes') {
                window.UIManager.renderNotes(window.NoteManager.getNotes());
            }

            return true;
        }

        static async setReminder(data) {
            // data: { taskId, dateStr } (Advanced - requires finding task first)
            // For now, simpler: "Create task WITH reminder" might be better handling in createTask
            // Or this handles purely alerts. Let's keep it simple implementation for now.
            return false;
        }
    }

    window.ActionService = ActionService;
}
