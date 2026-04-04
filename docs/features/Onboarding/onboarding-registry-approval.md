# Feature: Onboarding — Business Registry & Context Validation

**Version:** 1.1.0  
**Status:** Alpha  
**Services:** `businessContextRegistryService.ts` · `businessContextValidationService.ts`  
**Storage Domain:** `business_registry_context` (SQLite)  
**Capability:** Provides a rigorous validation layer to ensure the host application's business context is sufficiently defined and logically consistent before runtime execution.

---

### 1. Tactical Purpose
The **Business Registry & Context Validation** step prevents "Contextual Hallucination." AI agents require high-fidelity business metadata to make informed decisions. This feature audits the host's provided data (Product names, Missions, KPIs) to ensure there are no "Dangling Contexts" that could lead to an agent providing incorrect or misaligned responses to an operator.

#### 1.1 "It Does" (Scope)
* **Mandatory Field Auditing:** Verifies the presence and minimum character depth of core business fields (e.g., Company Mission, Product Vision).
* **KPI Alignment Check:** Validates that defined Key Performance Indicators (KPIs) are linked to a measurable data source or workflow.
* **Structural Validation:** Ensures that the hierarchy of the registry (Organization → Product → Feature) is logically coherent.
* **Approval Gating:** Provides a "Final Review" surface where the operator must explicitly confirm the accuracy of the ingested business context.
* **Persistence:** Commits the "Validated" snapshot to the `business_registry_context` SQLite table for agentic retrieval.

#### 1.2 "It Does Not" (Boundaries)
* **Edit the Registry:** This is a **Read/Verify** surface; it does not replace the full **Registry Editor** used for deep data entry.
* **Verify Business Truth:** It validates that a mission statement *exists* and is *formatted* correctly; it cannot verify if the mission itself is "good" or "true."
* **Define Business Policy:** The host application remains the owner of the business data; Prana only enforces the *integrity* of that data.

---

### 2. Architectural Dependencies
| Component | Role | Relationship |
| :--- | :--- | :--- |
| **Main Process** | `businessContextRegistryService` | The primary orchestrator for context retrieval and persistence. |
| **Main Process** | `businessContextValidationService` | The engine that runs the "Integrity Rules" against the data. |
| **Feature** | **Governance Lifecycle** | Deeply coupled; uses the outcomes here to map cross-referenced assets. |
| **Data Source** | **Host Application** | Must provide the raw Business Metadata (Products, Missions, KPIs). |



---

### 3. The Validation Pipeline
1.  **Ingestion:** The host application pushes its business registry into the Prana bridge.
2.  **Audit:** The `businessContextValidationService` scans for missing mandatory fields or broken KPI links.
3.  **Visual Report:** The UI surfaces a "Readiness Report" showing which sections are `COMPLETE` and which are `BLOCKING`.
4.  **Confirmation:** The operator reviews the summarized context and clicks "Approve."
5.  **Locking:** The Onboarding Orchestrator marks the registry as `VALID`, allowing the pipeline to proceed to the final **Vaidyar** check.

---

### 4. Implementation References
* **Registry Service:** `src/main/services/businessContextRegistryService.ts`
* **Validation Logic:** `src/main/services/businessContextValidationService.ts`
* **UI:** `src/ui/onboarding-registry-approval/view/OnboardingRegistryApprovalContainer.tsx`

---

### 5. Known Architectural Gaps (Roadmap)
* **[High] Dependency Traceability:** Currently struggles to report *why* a specific KPI is invalid if the underlying data source is missing from a different registry section.
* **[Med] Multi-Language Support:** Validation rules are currently optimized for English-language context; Sanskrit or other regional language nuances are not yet fully supported.
* **[Low] Similarity Scoring:** No current check to see if two products in the registry have overlapping or conflicting mission statements.

---
