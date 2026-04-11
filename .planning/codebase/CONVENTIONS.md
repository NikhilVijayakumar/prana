# Coding Conventions

## Documentation First Constraint
1. **Atomic Documentation:** All codebase cross-cutting changes must begin with a corresponding Markdown spec under `docs/features/`.
2. **One file, One rule:** Each documentation file defines exactly one runtime responsibility or screen contract.
3. Every Vault module mapped must be explicitly detailed and audited within the storage constraints (`docs/features/storage/governance`).

## Core Architecture Design
- **Cold-Vault Bootstrapping:** Prana Main cannot implicitly infer its environment. It must be explicitly furnished payloads (IPC `app:bootstrap-host`) upon boot via external hosts.
- **Fail-Fast Error Handling:** Exceptions on boot or unrecoverable sync states surface natively as `ErrorState` components rather than silent white-screen crashes.
- **Service Dependency Boundaries:** Main process modules act as encapsulated services returning promises and communicating via Hooks, avoiding synchronous direct process blocking outside critical boot seqs.
- **IPC Exclusivity:** The Renderer must use strictly typed IPC bridges via Preload. Direct node integrations (like `fs`, `path`, `process.env`) are explicitly disallowed.

## UI Principles
- **MVVM Adherence:** (Container $\rightarrow$ ViewModel $\rightarrow$ View) logic strictness. Views are pure presenational dumps. ViewModels handle state. Containers handle wiring (IPC/APIs).
- **Branding Sync:** Branding payload must transit securely and be fetched via IPC rather than window objects (mitigating volatile memory-leaks).
