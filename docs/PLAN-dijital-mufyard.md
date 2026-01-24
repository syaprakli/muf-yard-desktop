# PLAN-dijital-mufyard.md - Dijital MüfYard 2.0 (AI Upgrade)

> **Status:** PROPOSED
> **Goal:** Transform the rule-based "Dijital MüfYard" into a cloud-powered, document-aware, agentic assistant.

---

## 1. Vision & Scope (User Selections)
- **Intelligence:** Cloud API (OpenAI/Gemini) for maximum reasoning capability.
- **Knowledge:** Full Document Mastery (RAG) - Can read/analyze reports (`.docx`, `.xlsx`, `.pdf`).
- **Agency:** Active - Can draft documents, modify tasks, and perform actions.

---

## 2. Architecture: "The Brain"

### A. Connectivity (Cloud Layer)
We will implement a **BYOK (Bring Your Own Key)** architecture to ensure privacy and control.
- **Settings:** New "Yapay Zeka" tab in Settings.
- **Providers:** Support for Google Gemini (Free tier available) and OpenAI.
- **Security:** Keys stored in system Keychain (via Electron `safeStorage`) if possible, or encrypted LocalStorage.

### B. Context Engine (RAG Layer)
Instead of a heavy vector database, we will use a **Dynamic Context Loader** suitable for desktop usage:
1.  **File Reader:** `mammoth` (DOCX), `xlsx` (Excel), `pdf-parse` (PDF) integration.
2.  **Context Window Manager:** Smart selection of text to fit into the AI's context window.
   - *User:* "Bu raporun özetini çıkar." -> *System:* Reads currently open report file -> Sends text to API.

### C. Action Layer (Tool Use)
The AI will be equipped with "Tools" (Function Calling) to interact with the app:
- `get_tasks()`: List active tasks.
- `create_task(content, priority)`: Add new items.
- `query_database(table)`: Search contacts or audit forms.
- `create_draft_document(template, data)`: Fill a Word template.

---

## 3. Implementation Phases

### Phase 1: The Brain (API Integration)
- [ ] Create `AIService.js` module.
- [ ] Implement API Key input UI in Settings.
- [ ] Create basic "Chat with LLM" loop (replacing current if/else logic).
- **Deliverable:** You can chat with Gemini/GPT inside MufYard.

### Phase 2: The Eyes (Document Reading)
- [ ] Integrate file parsers (`mammoth`, etc.).
- [ ] Add "Bu Dosyayla Sohbet Et" button in Files/Reports view.
- [ ] Implement context injection logic.
- **Deliverable:** You can ask questions about your Word/Excel files.

### Phase 3: The Hands (Agentic Actions)
- [ ] Define JSON schemas for Function Calling.
- [ ] Map AI intents to `TaskManager` and `ReportManager` methods.
- [ ] Implement "Draft Mode" (AI generates text -> User saves as DOCX).
- **Deliverable:** "Bana bir görev ekle" or "Şu rapor için üst yazı hazırla" commands work.

---

## 4. Verification & Safety
- **Privacy Warning:** Explicit UI indication when data is being sent to the cloud.
- **Human-in-the-loop:** AI never deletes or sends emails without "Confirm" click.
- **Cost Control:** Token usage tracking (optional).

---

## Next Steps
1. **Approve Plan:** Review this structure.
2. **Select Provider:** Do you want to start with **Google Gemini** (Free API available) or **OpenAI**?
3. **Execute:** We will start with Phase 1 (API Connectivity).
