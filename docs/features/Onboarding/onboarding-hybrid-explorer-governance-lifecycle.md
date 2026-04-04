# Feature: Onboarding — Hybrid Explorer Governance Lifecycle

**Version:** 1.1.0  
**Status:** Research / In-Development  
**Service:** `businessAlignmentService.ts`  
**Storage Domain:** `governance_graph` (SQLite)  
**Capability:** Maps the multi-dimensional "Knowledge Graph" of dependencies across Skills, Protocols, and Data Inputs to ensure operational alignment.

---

### 1. Tactical Purpose
The **Hybrid Explorer Governance Lifecycle** acts as the "Architect" that verifies the blueprint. In an agentic system, a disconnect between a **Business Goal** and a **Technical Skill** leads to silent failure. This feature performs a graph-based analysis to ensure that every "Command" an agent might receive has a "Resource" (Skill) and a "Rulebook" (Protocol) to execute it.

#### 1.1 "It Does" (Scope)
* **Dependency Mapping:** Visualizes the relationship between high-level **KPIs** and the required **Protocols/Skills**.
* **Identification of "Dangling Dependencies":** Flags logical gaps (e.g., "A Protocol exists for *Email Triage*, but no *IMAP Connection* skill is configured").
* **Cross-Reference Auditing:** Ensures that if a **Protocol** requires a specific **Data Input**, that input is actually reachable via the current **Channel Configuration**.
* **Lifecycle Gating:** Blocks the final "Onboarding Complete" signal if critical technical paths are broken.
* **Integrity Scoring:** Calculates a "Business Alignment Score" based on how much of the registry is functionally actionable.

#### 1.2 "It Does Not" (Boundaries)
* **Auto-Remediate Gaps:** It identifies that a "Skill" is missing, but it does not attempt to "Write" or "Install" that skill for the user.
* **Execute Workflows:** This is a **Static Analysis** gate; it checks if the *wiring* is correct, not if the *current* is flowing (see **Vaidyar** for live checks).
* **Define Business Strategy:** It verifies *Alignment*, not *Profitability* or *Strategy*.

---

### 2. Architectural Dependencies
| Component | Role | Relationship |
| :--- | :--- | :--- |
| **Main Process** | `businessAlignmentService` | The "Inference Engine" that builds and traverses the governance graph. |
| **Main Process** | `businessContextValidationService` | Provides the raw "Business Intent" data to be mapped. |
| **Feature** | **Registry Approval** | Consumes the alignment report to show "Blocking Gaps" in the UI. |
| **Feature** | **Vaidyar** | Consults the graph to determine which live pulses are most critical. |

---

### 3. The Governance Handshake (The "Graph Scan")
1.  **Ingestion:** The orchestrator pushes the combined Model, Channel, and Business Registry into the `businessAlignmentService`.
2.  **Graph Construction:** Prana builds a temporary "Directed Acyclic Graph" (DAG) of all host assets.
3.  **Pathfinding:** The service attempts to find a valid execution path for every defined **KPI**.
4.  **Gap Discovery:** If a path is broken (e.g., a "Skill" node is missing its "Protocol" parent), a **Dangling Dependency** event is logged.
5.  **Reporting:** The UI surfaces a "Governance Map" highlighting the broken paths.

---

### 4. Implementation References
* **Graph Logic:** `src/main/services/businessAlignmentService.ts`
* **Lifecycle Contract:** `docs/governance/explorer-lifecycle.md`
* **UI:** `src/ui/onboarding-registry-approval/view/OnboardingRegistryApprovalContainer.tsx`

---

### 5. Known Architectural Gaps (Roadmap)
* **[High] Visual Graph Viewer:** Currently, gaps are reported as a text list; a visual "Graph Inspector" is needed for complex business environments.
* **[Med] Semantic Matching:** Relies on strict ID/Name matching; it does not yet use NLP to realize that a skill named "Mail Fetcher" satisfies a protocol named "Email Intake."
* **[Low] Circular Dependency Detection:** While rare in onboarding, the system needs to prevent "Logic Loops" in multi-agent skill-chains.

---
