# Feature: Onboarding — Channel & Routing Setup

**Version:** 1.1.0  
**Status:** Stable  
**Service:** `registryRuntimeStoreService.ts`  
**Storage Domain:** `channel_configuration` (SQLite)  
**Capability:** Configures and validates external communication gateways to enable the **Channel Integration** and **Agent Communication** features.

---

### 1. Tactical Purpose
The **Channel & Routing Setup** ensures that the Prana runtime has the correct "Address Book" for external messaging. By validating bot tokens and chat identifiers during onboarding, it prevents runtime failures where an agent attempts to send a critical alert to an unreachable or unauthorized channel.

#### 1.1 "It Does" (Scope)
* **Credential Capture:** Securely receives Bot Tokens, API Keys, and unique Chat/Group IDs from the host application.
* **Connectivity Verification:** Performs a real-time handshake with the external provider (e.g., Telegram `getMe`) to verify the token is active.
* **Route Mapping:** Associates specific inbound channels with internal agent work-order pipelines.
* **Persona Authorization:** Links external IDs to authorized operator personas to prevent unauthorized command execution.
* **Persistence:** Saves validated channel metadata to the `channel_configuration` SQLite table.

#### 1.2 "It Does Not" (Boundaries)
* **Execute Message Routing:** It does not handle the "In-Flight" logic of sending or receiving messages (see **Channel Integration**).
* **Manage Transport Drivers:** It does not contain the low-level HTTP/WebSocket code for Telegram; it delegates the check to the respective service.
* **Store Global Secrets:** While it captures tokens, the primary encryption at rest for these secrets is governed by the **Vault**.

---

### 2. Architectural Dependencies
| Component | Role | Relationship |
| :--- | :--- | :--- |
| **Main Process** | `registryRuntimeStoreService` | The primary store for channel-to-agent mapping. |
| **Feature** | **Channel Integration** | Consumes the IDs and Tokens configured here for live routing. |
| **Feature** | **Vaidyar** | Verifies the "Health Pulse" of the configured channel before finishing onboarding. |
| **Data Source** | **Host Application** | Must provide the specific tokens and channel types (Telegram/WhatsApp). |

---

### 3. The Connection Handshake
1.  **Input:** The host application provides a Bot Token and a Target Chat ID.
2.  **Ping:** The `registryRuntimeStoreService` attempts a "Pulse Check" via the provider's API.
3.  **Discovery:** If successful, the system retrieves the Bot's Username and permissions.
4.  **Verification:** The **Vaidyar** ensures the network path is open (no firewall blocks).
5.  **Commit:** The Onboarding Orchestrator marks the channel as `VALID`.

---

### 4. Implementation References
* **Storage Logic:** `src/main/services/registryRuntimeStoreService.ts`
* **Routing Contract:** `docs/features/channel-integration.md`
* **UI:** `src/ui/onboarding-channel-configuration/view/OnboardingChannelConfigurationContainer.tsx`

---

### 5. Known Architectural Gaps (Roadmap)
* **[High] Multi-Channel Identity:** No current mechanism to link a single operator across different channels (e.g., "User A on Telegram" is the same as "User A on WhatsApp").
* **[Med] Webhook Management:** Currently optimized for "Polling" modes; no automated webhook registration surface exists in this setup step.
* **[Low] Rate Limit Config:** No UI exists to define "Quiet Hours" or rate-limiting per channel during the setup phase.

---
