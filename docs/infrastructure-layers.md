# Infrastructure Layers - Atomic Universal Specification

## A. Operational Intent
Control platform reliability primitives: stability mode, IPC quality, and runtime protection for all modules.

## B. Registry Dependency
- Agent Profiles: julia, elina, mira
- Skills: drift-detection-logic, self-healing-orchestration, execution-governance
- Protocols: stability-mode-governance-protocol, crisis-lockdown-protocol, incident-escalation-protocol
- Workflows: julia/sop-autonomous-tech-health, mira/contextual-self-healing

## C. The Triple-Engine Extraction Logic
### OpenCLAW
Infer degradation cause and decide between self-heal, graceful degradation, or crisis lock.

### Goose
Extract telemetry incidents into ordered remediation actions with SLA-aware priorities.

### NemoClaw
Navigate system health console, stability toggles, and incident timeline UI anchors.

## D. Hybrid Data Lifecycle
### SQLite (High-Performance)
Store IPC latency streams, resource pressure windows, and recovery attempt queues.

### Vault (Secure Commit State)
Commit incident postmortems, approved crisis actions, and resilience baseline updates.

## E. Channel and Execution
- Cronjobs: Continuous telemetry rollup and hourly health audit.
- Internal Chat: Ops incident war-room channel integration.
- External Channels: Telegram page for crisis activation and recovery milestones.
- Dynamic UI Contract: Render form fields, thresholds, and stage controls directly from registry YAML/JSON schemas; do not hardcode input contracts.
- No-Dead-End Navigation: Every detail page must expose Back to previous context and Home to workspace root to satisfy Electron no-URL flow constraints.
- Manual Override: Every registry-backed view must show Current State and Proposed Improvement side-by-side before commit.
