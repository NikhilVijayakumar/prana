# Tech Stack

## Core Technologies
- **Runtime Environment:** Node.js, Electron (v39.2.6)
- **Language:** TypeScript (v5.9.3)
- **Frontend Framework:** React (v19.2.1), React DOM
- **UI Library:** Material-UI (MUI v7.3.9), Emotion, Astra (custom component library)
- **State Management & Architecture:** MVVM (Container → ViewModel → View), React hooks/context
- **Data Storage:** SQLite (`sql.js`), Encrypted Vault Storage
- **Bundler:** Vite (`electron-vite`, `vite`)

## Utilities & Libraries
- **Encryption:** `bcryptjs` for hashing
- **Scheduling:** `cron-parser`
- **Markdown / Document Processing:** `marked`, `turndown`, `mammoth` (Word docx), `html-to-docx`
- **AI/LLM Utilities:** `js-tiktoken` for LLM token management
- **Router:** `react-router-dom`

## Quality & DX
- **Testing:** Vitest (Unit), Playwright (E2E)
- **Linting & Formatting:** ESLint, Prettier
