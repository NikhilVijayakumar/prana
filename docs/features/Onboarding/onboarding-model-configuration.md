# Feature: Onboarding — Model & Context Configuration

**Version:** 1.1.0  
**Status:** Stable  
**Services:** `runtimeModelAccessService.ts` · `tokenManagerService.ts`  
**Storage Domain:** `model_configuration` (SQLite)  
**Capability:** Captures AI model provider specifications and context window constraints to calibrate the **Cognitive Memory Layer** and **Context Optimizer**.

---

### 1. Tactical Purpose
This feature ensures the Prana runtime is "Token-Aware." By capturing the precise limits of the selected AI model, Prana can prevent context overflow and optimize split-buffer memory rotation. It defines the cognitive boundaries within which all agents in the host application will operate.

#### 1.1 "It Does" (Scope)
* **Capture Model Metadata:** Records the `model_name`, `provider_id`, and `api_version`.
* **Calibrate Token Budgets:** Captures `max_context_tokens` and `max_output_tokens` to seed the `TokenManager`.
* **Seed the Context Optimizer:** Feeds the threshold values used to trigger **Context Compaction** (summarization).
* **Validate Configuration:** Ensures the host-provided model supports required capabilities (e.g., tool calling or specific encoding).
* **Persist Snapshots:** Saves the configuration to the `model_configuration` SQLite table for retrieval during the **Cold-Vault** bootstrap.

#### 1.2 "It Does Not" (Boundaries)
* **Perform Inference:** It does not communicate with the LLM for chat; it only stores the "Rules of Engagement."
* **Manage Global API Keys:** While it associates keys with models, the primary lifecycle of secrets is handled by the **Vault** or **Auth Stack**.
* **Provide Default Model Lists:** Prana remains agnostic; the host application is responsible for providing the available model options via the IPC bridge.

---

### 2. Architectural Dependencies
| Component | Role | Relationship |
| :--- | :--- | :--- |
| **Main Process** | `runtimeModelAccessService` | Manages the provider registry and validated settings. |
| **Main Process** | `tokenManagerService` | Consumes `max_tokens` to enforce runtime safety limits. |
| **Feature** | **Cognitive Memory** | Uses this config to determine when to rotate or compact history. |
| **Data Source** | **Host Application** | Must provide the dynamic list of available models/providers. |



---

### 3. The Calibration Handshake
1.  **Selection:** The operator selects a model from the list injected by the host application.
2.  **Calibration:** The `tokenManagerService` pulls the known context limit (e.g., 128k tokens) for that model.
3.  **Thresholding:** The system sets the **Rotation Threshold** (e.g., "Trigger compaction at 80% capacity").
4.  **Verification:** The **Vaidyar** performs a pulse check to ensure the model endpoint is reachable with the current configuration.
5.  **Commit:** The Onboarding Orchestrator marks this stage as `VALID`.

---

### 4. Implementation References
* **Logic:** `src/main/services/runtimeModelAccessService.ts`
* **Budgeting:** `src/main/services/tokenManagerService.ts`
* **UI:** `src/ui/onboarding-model-configuration/view/OnboardingModelConfigurationContainer.tsx`

---

### 5. Known Architectural Gaps (Roadmap)
* **[High] Dynamic Context Testing:** No feature currently exists to "Test" a minimal prompt with the selected model during this configuration step to verify latency.
* **[Med] Multi-Model Profiles:** The system currently assumes a global model for the host; it does not yet support different models for different agents (e.g., a "fast" model for triage vs. a "smart" model for analysis).
* **[Low] Cost Estimation:** No visual feedback is provided regarding the estimated cost-per-token of the selected model.

---
