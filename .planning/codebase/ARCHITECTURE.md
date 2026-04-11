# System Architecture

Prana is a desktop runtime library functioning as an Electron application shell. It consists of a multi-process architecture with distinct layers:

## Main Process (Service-Oriented Backend)
Operates as the orchestration backbone with ~100+ TypeScript services.
- **Bootstrapping Layer:** `startupOrchestratorService`, configured via `app:bootstrap-host` IPC by the host app (e.g. Dhi, using Cold-Vault Principle).
- **Storage & Infrastructure:**
  - **Virtual Drive Layer:** `driveControllerService` manages encrypted system and vault mounts.
  - **Vault Cache (SQLite):** Acts as the hot operational state for fast read/writes.
  - **Durable Vault:** Encrypted archives serving as long-term storage with strict syncing logic (`syncProviderService`).
- **Agents & Context Management:** 
  - `orchestrationManager`, `channelRouter` to funnel workloads.
  - Context Engine and token budgets for intelligent AI context windows (chat compaction).
- **Scheduling:** Multi-lane universal queue (`cronSchedulerService`, `queueOrchestrator`).

## Renderer Process (MVVM UI)
- All UI aspects strictly follow the MVVM (Model-View-ViewModel) pattern ensuring clean separation between structural scaffolding, logical state processing, and visual representation.
- Preload Bridge (`contextBridge`) provides typed IPC access. The Renderer never accesses `process.env` directly.

## Governing Principles
1. **Cold-Vault Bootstrap:** Props config are strictly input validation snapshots, mapped directly into SQLite runtime config meta table.
2. **Atomic Contracts:** One screen / system logic = One markdown spec document in `docs/features`.
3. **Data Integrity:** Failures at bootstrap lead to explicit UI Error states rather than silent whitespace crashes.

## State Management Flow
Renderer components dispatch requests over IPC $\rightarrow$ Main Process updates SQLite cache/Vault $\rightarrow$ State propagation back to views is handled via IPC Hook Systems, Notification Centres, and sync engine reconciliations.
