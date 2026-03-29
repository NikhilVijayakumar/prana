# Notification Centre - Atomic Universal Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- Notification intent, escalation channels, and registry dependencies are documented.
- Alerting behavior is specified with severity and suppression expectations.

## Target State
- Deterministic alert lifecycle with auditable escalation, dedupe controls, and policy-safe external dispatch behavior.
- Strong parity between notification contracts and runtime incident/recovery observability.

## Gap Notes
- Contract breadth is clear, but parity between all documented channel behaviors and runtime implementations remains partial.

## Dependencies
- docs/module/infrastructure-layers.md
- docs/module/master-spec.md

## Acceptance Criteria
1. Notification severity handling follows deterministic protocol rules.
2. Alert dedupe and escalation pathways are auditable.
3. External notifications honor governance allowlists and crisis policies.

## Immediate Roadmap
1. Align notification diagnostics and incident telemetry with observability contract.
2. Map alert pipeline parity checks into implementation wave validation.

## A. Operational Intent
Centralize severity-aware alert delivery while preventing notification fatigue and preserving escalation integrity.

## B. Registry Dependency
- Agent Profiles: mira, eva, julia
- Skills: incident-forensics, automated-policy-validation, queue-health-management
- Protocols: incident-escalation-protocol, conflict-escalation-protocol, queue-prioritization-protocol
- Workflows: mira/crisis-command-prioritization, eva/seed-human-in-loop-escalation

## C. The Triple-Engine Extraction Logic
### OpenCLAW
Classify alert severity and recommend suppression, grouping, or immediate escalation.

### Goose
Extract raw events into normalized alert objects with owner and action requirements.

### NemoClaw
Navigate alert feed tabs, severity filters, quiet-hour controls, and acknowledge actions.

## D. Hybrid Data Lifecycle
### SQLite (High-Performance)
Maintain live alert queue, dedupe windows, and user delivery preferences.

### Vault (Secure Commit State)
Commit critical alert history, acknowledged escalations, and policy overrides.

## E. Channel and Execution
- Cronjobs: Minute-level alert consolidation and digest generation jobs.
- Internal Chat: Real-time internal alert broadcasting with ack tracking.
- External Channels: Telegram delivery for critical and warning tiers.
- Dynamic UI Contract: Render form fields, thresholds, and stage controls directly from registry YAML/JSON schemas; do not hardcode input contracts.
- No-Dead-End Navigation: Every detail page must expose Back to previous context and Home to workspace root to satisfy Electron no-URL flow constraints.
- Manual Override: Every registry-backed view must show Current State and Proposed Improvement side-by-side before commit.
