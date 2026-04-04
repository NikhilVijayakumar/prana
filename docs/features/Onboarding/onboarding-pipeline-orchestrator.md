This is the final, refined **Feature Contract** for the **Onboarding Pipeline Orchestrator**. 

I have removed all specific host-app references (**Dhi**) and focused strictly on the **Protocol-driven relationship** between Prana and any connected host. This makes the documentation truly "Library-First" and architecture-neutral.

---

# Feature: Onboarding Pipeline Orchestrator

**Version:** 1.1.0  
**Status:** Stable  
**Pattern:** Master-Detail MVVM  
**Service:** `onboardingOrchestratorService.ts`  
**Storage Domain:** `onboarding_registry` (SQLite)  
**Capability:** Provides a host-agnostic state machine to transition a connected application through the mandatory governance stages required for a secure runtime.

---

## 1. Tactical Purpose
The **Onboarding Pipeline Orchestrator** is the gatekeeper of the Prana library. It ensures that no host application can access core orchestration or agentic features until a **Minimum Viable Governance (MVG)** state is achieved. It abstracts the complexity of step-sequencing, allowing the UI to remain a "dumb" presenter of the current state while Prana manages the underlying logic and persistence.



---

## 2. Scope & Boundaries

### 2.1 "It Does" (Scope)
* **Enforce Sequential Integrity:** Implements a strict "No-Skip" policy where Stage $N+1$ is locked until Stage $N$ returns a `VALID` signal to the service.
* **Persistent State Tracking:** Saves the current step index, completion percentages, and the final `ONBOARDING_COMPLETE` flag to the `onboarding_registry` table in SQLite.
* **State Recovery:** Automatically restores the user’s exact position in the onboarding flow across application restarts.
* **Metadata Handover:** Collects validated metadata from sub-features (e.g., API keys, Channel IDs) and prepares them for the final **Vaidyar** system pulse.
* **Status Broadcasting:** Emits standardized IPC events (`app:onboarding-state`) to keep the host UI in sync with the backend state machine.

### 2.2 "It Does Not" (Boundaries)
* **Validate Sub-Feature Data:** It does not know how to check a Telegram token or a Model ID; it delegates that responsibility to the respective sub-features and listens for the result.
* **Define Business Policy:** It manages the *pathway* to compliance, not the specific *rules* of the business registry (see `Registry Approval`).
* **Inhibit Custom UI:** While it manages the state, it does not dictate the host's CSS or layout, provided the host complies with the IPC protocol.

---

## 3. Architectural Dependencies
| Component | Role | Relationship |
| :--- | :--- | :--- |
| **Main Process** | `onboardingOrchestratorService` | The "Brain" executing the state transition logic. |
| **Renderer** | `OnboardingContainer` | The Master view component that switches sub-feature views based on IPC state. |
| **Feature** | **Vaidyar** | The final mandatory step is a "Full System Pulse" diagnostic. |
| **Storage** | `sqliteConfigStore` | Persists the global readiness flags for the Cold-Vault boot sequence. |

---

## 4. The Standard Onboarding Sequence
The Orchestrator moves through four discrete, mandatory stages by default:

1.  **Intelligence Setup:** Identification of the AI Model and Context Window limits provided by the host.
2.  **Connection Setup:** Configuration of external communication channels (e.g., Telegram, WhatsApp adapters).
3.  **Governance Setup:** Validation of the host's product registry, mission context, and KPI alignment.
4.  **Integrity Check (Vaidyar):** A final comprehensive diagnostic scan to ensure all previous configurations are physically reachable and operational.



---

## 5. Implementation References
* **State Engine:** `src/main/services/onboardingOrchestratorService.ts`
* **UI Shell:** `src/ui/onboarding/view/OnboardingContainer.tsx`
* **IPC Surface:** `app:onboarding-state` (Subscribe) | `app:onboarding-submit` (Invoke)

---

## 6. Known Architectural Gaps (Roadmap)
* **[High] Conditional Branching:** The current path is linear; it needs to support "Optional" steps based on the host app's requirements (e.g., skipping Channel setup).
* **[Med] Reset/Re-Onboard:** No standardized trigger exists to wipe the `onboarding_registry` and restart the initiation journey.
* **[Low] Telemetry:** No current mechanism to track "Time-to-Completion" for individual steps to identify friction in the setup process.

---
