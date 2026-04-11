# Project Structure

The project represents a monorepo-style split between Electron Main backend features, Electron Renderer UI features, and comprehensive structural documentation.

## Directory Layout
- **`src/`**
  - **`main/`**
    - `index.ts`: Electron lifecycle and window management boot points.
    - `preload.ts`: `contextBridge` context mappings to link Renderer safely to Main.
    - **`services/`**: Root namespace for ~100+ stateful and infrastructural TypeScript services (`startupOrchestrator`, `runtimeConfig`, etc.).
      - `agents/`: Agent specific task executions.
      - `types/`: Shared domain payloads.
  - **`ui/`**
    - `main.tsx`: React mounting entrypoint.
    - **Feature groupings** (e.g., `splash/`, `authentication/`, `vault/`, `infrastructure/`): Each holds specific visual logic corresponding to product features.
    - `layout/`, `components/`, `shared-components/`: Common UI representations and the shell chrome.
    - `constants/`, `context/`, `hooks/`, `state/`: Custom functional scaffolding.
  - **`services/`**: Cross-layer shared domains.
  
- **`docs/ features/`** 
  - Comprehensive functional documentation separated by domain (e.g. `storage`, `boot`, `ui`). Forms the declarative backbone of the application.
  - `audit/`: Implementation-to-documentation parity tracking.

- **`tests/`**
  - Playwright E2E suites. Vitest unit tests generally co-locate with src.
