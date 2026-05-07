# 📜 Prana Atomic Documentation Index
**Version:** 1.2.0  
**Principle:** One runtime responsibility, one reason to change.

> [!IMPORTANT]
> **The Golden Rule:** Documentation precedes implementation. All cross-cutting changes must update the relevant Atomic Doc and verify compliance via the [Audit Layer](#-layer-5-the-audit-layer-delta-tracking).

---

## 🏛️ The Constitution
*The anchor for all downstream contracts and architectural boundaries.*
* [Master Spec](master-spec.md) — **Core Library Architecture & Governance**
* [Infrastructure Layers](boot/infrastructure-layers.md) — **Main-Process vs. Renderer Boundaries**

---

## 🟢 Layer 1: Bootstrap & Foundation
*Modules governing the "Cold-Vault" startup sequence and system integrity.*
* [Startup Orchestrator](boot/startup-orchestrator.md) — **Critical Path: Bootstrap Sequence + Host Dependency Capability Gate**
* [Props Config Principle](props-config-principle.md) — **Cold-Vault Configuration Input**
* [Prana Doctor](boot/prana-doctor.md) — **Post-Bootstrap Diagnostics & Health**
* [Notification Centre](notification/notification-centre.md) — **System-Wide Event & Alert Routing**

---

## 🔵 Layer 2: Secure Persistence
*The orchestration of encrypted drives, hot-cache, and durable archives.*
* [Virtual Drive](storage/virtual-drive.md) — **Encrypted Mount Runtime + Client-Managed Policy Contract**
* [Vault](storage/vault.md) — **AES-256-GCM Durable Archive Operations**
* [SQLite Cache](storage/sqlite-cache.md) — **Hot Operational State (SQL.js)**
* [Encryption Service](storage/encryption-service.md) — **Distributed Cryptography Logic**
* [Vault Folder Structure](storage/vault-folder-structure.md) — **Staging vs. Committed Layout**

---

## 🟡 Layer 3: Data Lifecycle & Sync
*Reconciling local SQLite state with Vault-backed archives.*
* [Sync Protocol](storage/sync-protocol.md) — **Pull/Push Reconciliation Logic**
* [Vault Sync Contract](storage/vault-sync-contract.md) — **Snapshot & Lineage Integrity**
* [Data Integrity Protocol](storage/data-integrity-protocol.md) — **Validation & Corruption Prevention**
* [Cron Recovery Contract](cron/cron-recovery-contract.md) — **Deterministic Job Catch-up**

---

## 🟣 Layer 4: Intelligence & Integration
*External adapters, AI context windowing, and communication channels.*
* [Context Optimization](context/context-optimization.md) — **Token Budget & Compaction**
* [Chat Context Rotation](chat/chat-context-rotation.md) — **Session Rollover Policy**
* [In-App Agent Chat](chat/in-app-agent-chat.md) — **Operator-to-Agent Work Orders**
* [Channel Integration](chat/channel-integration.md) — **External Adapter Routing (Telegram)**
* [Email Subsystem](email/email-management.md) — **Orchestration, Drafts, & Heartbeat**
    * *Sub-modules:* [Orchestrator](email/email-orchestrator-service.md) | [Draft Sync](email/email-draft-sync.md) | [Cron](email/email-cron-heartbeat.md)
* [Google Ecosystem Integration](Integration/google-ecosystem-integration.md) — **Gmail & Browser Bridge**

---

## 📦 Storage App Contracts (Multi-App Ready)
*Rules for integrating host apps (e.g., Dhi) into the Prana runtime.*
* [Storage Contract Index](storage/governance/index.md)
* [Storage Rules](storage/governance/rule.md) — **R1-R5 Mandatory Compliance**
* [Vault Storage Contract: Prana](storage/governance/vault/prana.md)
* [Cache Storage Contract: Prana](storage/governance/cache/prana.md)

---

## 🔍 Layer 5: The Audit Layer (Delta Tracking)
*Tracking the gap between "Documentation as Truth" and "Code as Reality".*
* [Audit Index](audit/index.md) — **Total System Health Overview**
* **Persistence:** [Persistence Audit](audit/persistence-architecture-audit.md) | [Drive Audit](audit/virtual-drive-audit.md) | [Vault Audit](audit/vault-audit.md)
* **Logic:** [Sync/Cache Audit](audit/sqlite-cache-audit.md) | [Encryption Audit](audit/encryption-service-audit.md) | [Doctor Audit](audit/prana-doctor-audit.md)
* **Agents:** [Chat/Context Audit](audit/chat-context-rotation-audit.md) | [Channel Audit](audit/channel-integration-audit.md)
* [v1.2 Feature Audit Reports](audit/v1.2/index.md) — **Domain-by-Domain Implementation Verification**

---

### Quick Navigation Matrix
| I need to... | Go to... |
| :--- | :--- |
| **Debug a Startup Hang** | [Startup Orchestrator](boot/startup-orchestrator.md) |
| **Add a New SQLite Table** | [Storage Rules](storage/governance/rule.md) |
| **Change AI Context Logic** | [Context Optimization](context/context-optimization.md) |
| **Verify Security Compliance** | [Encryption Service Audit](audit/encryption-service-audit.md) |
| **Review v1.2 Audit Results** | [v1.2 Audit Reports](audit/v1.2/index.md) |