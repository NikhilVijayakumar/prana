# OpenCLAW Feature Readiness Checklist - Atomic Universal Specification

## A. Operational Intent
Define enforceable checklist gates that must pass before enabling a feature path in production.

## B. Registry Dependency
- Agent Profiles: eva, julia, arya
- Skills: automated-policy-validation, execution-governance, risk-disclosure-mapping
- Protocols: compliance-gate-protocol, clean-architecture-gate-protocol, incident-escalation-protocol
- Workflows: julia/sop-autonomous-tech-health, eva/seed-human-in-loop-escalation

## C. The Triple-Engine Extraction Logic
### OpenCLAW
Evaluate checklist completion and determine go, hold, or reject with rule-level justifications.

### Goose
Extract checklist evidence tasks and completion order for release decisions.

### NemoClaw
Render checklist UI, evidence upload anchors, and gate result controls.

## D. Hybrid Data Lifecycle
### SQLite (High-Performance)
Persist checklist status, evidence references, and gate timing.

### Vault (Secure Commit State)
Commit signed go-live decisions and full checklist evidence package.

## E. Channel and Execution
- Cronjobs: Pre-release and nightly readiness revalidation.
- Internal Chat: Release readiness channel.
- External Channels: Telegram alert for failed critical release gates.
- Dynamic UI Contract: System and module screens must be schema-driven by registry YAML/JSON definitions.
- No-Dead-End Navigation: Every screen must expose Back and Home controls for Electron no-URL execution.
- Manual Override: Show Current State and Proposed Improvement before every registry-impacting commit.
