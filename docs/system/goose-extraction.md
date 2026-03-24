# Goose Extraction - Atomic Universal Specification

## A. Operational Intent
Specify deterministic task extraction and step sequencing behavior for every feature pipeline.

## B. Registry Dependency
- Agent Profiles: mira, elina, arya
- Skills: command-decomposition-logic, queue-health-management, milestone-decomposition
- Protocols: intent-parsing-protocol, queue-prioritization-protocol, deterministic-handoff-protocol
- Workflows: mira/sop-autonomous-routing, mira/seed-autonomous-alignment

## C. The Triple-Engine Extraction Logic
### OpenCLAW
Validate that extracted step plans satisfy feature constraints and dependency preconditions.

### Goose
Tokenize intent, derive atomic tasks, order by dependency and urgency, emit executable task graph.

### NemoClaw
Visualize and verify extracted task graph through UI stepper and trace panels.

## D. Hybrid Data Lifecycle
### SQLite (High-Performance)
Persist task graph nodes, step status, and sequencing confidence scores.

### Vault (Secure Commit State)
Commit extraction audit traces for escalated or overridden plans.

## E. Channel and Execution
- Cronjobs: Continuous extraction quality scoring and nightly retraining signals.
- Internal Chat: Extraction diagnostics channel for operators.
- External Channels: No default external channel.
- Dynamic UI Contract: System and module screens must be schema-driven by registry YAML/JSON definitions.
- No-Dead-End Navigation: Every screen must expose Back and Home controls for Electron no-URL execution.
- Manual Override: Show Current State and Proposed Improvement before every registry-impacting commit.
