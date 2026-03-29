# Infrastructure Layers - Atomic Universal Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Active

## Current State
- Reliability primitives, escalation pathways, and resilience responsibilities are documented.
- Runtime health and orchestration services are active with policy-driven operational intent.

## Target State
- Expand deterministic degradation policies and incident replay visibility across all subsystem failures.
- Maintain strict contract boundaries for crisis lock and recovery workflows.

## Gap Notes
- Some cross-module observability and degradation contracts are still fragmented across feature documents.

## Dependencies
- docs/module/startup-orchestrator.md
- docs/module/cron-recovery-contract.md
- docs/module/master-spec.md

## Acceptance Criteria
1. Reliability controls map to explicit protocol and workflow governance.
2. Degradation outcomes are deterministic and auditable.
3. Critical incident pathways maintain redacted and policy-safe diagnostics.

## Immediate Roadmap
1. Consolidate resilience diagnostics references across module contracts.
2. Align crisis escalation and recovery reporting with master-spec observability rules.

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
