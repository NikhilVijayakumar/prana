# Feature: Agent Communication & Channel Orchestration

**Status:** Alpha / In-Development  
**Service:** `orchestrationManager.ts` · `channelRouterService.ts` · `contextEngineService.ts`  
**Storage Domain:** `conversation_cache` / `context_digest` (SQLite)  
**Capability:** Enables multi-modal, persistent communication between operators and agents across in-app surfaces and external adapters (Telegram/Future WhatsApp).

---

## 1. Tactical Purpose
This feature acts as the "Switchboard" for the Prana runtime. It manages the lifecycle of conversations, ensuring that whether an operator is talking to one agent (Individual) or a committee of agents (Group), the context remains optimized, the identities are verified, and the history is persistent.

### 1.1 "It Does" (Scope)
- **Individual Chat:** Facilitates 1:1 operator-to-agent work orders.
- **Group Chat (In-App):** Orchestrates multi-agent environments where agents can observe and respond to the same thread.
- **Channel Routing:** Maps external intents (Telegram) to internal agent personas.
- **Context Rotation:** Automatically compacts long histories into summaries to respect model token limits.
- **Identity Reconciliation:** Maps a single operator identity across multiple channels (e.g., "Nikhil on Telegram" == "Nikhil in-app").

### 1.2 "It Does Not" (Boundaries)
- **Perform Inference:** It routes data to models but does not generate the text itself.
- **Manage Registry:** Does not define agent skills; it only executes them.
- **Store External Credentials:** Does not sync Telegram bot tokens to the Vault.

---

## 2. Architectural Dependencies
| Component | Role | Relationship |
| :--- | :--- | :--- |
| **Main Process** | `contextEngineService` | Manages the "Memory" (summaries vs. raw history). |
| **Main Process** | `channelRouterService` | The Gateway for external adapters. |
| **Main Process** | `queueService` | Manages the execution priority for agent responses. |
| **Renderer** | `DirectorInteractionBar` | The primary operator UI for starting/managing chats. |



---

## 3. Communication Models
### 3.1 Individual (1:1)
- **Logic:** Direct Work-Order.
- **Context:** Isolated to that specific Agent-Operator pair.
- **Availability:** In-App & External.

### 3.2 Group (1:N or M:N)
- **In-App:** privileged operators can summon multiple agents into a single workspace. The `orchestrationManager` broadcasts the thread history to all participating agents.
- **External Integration:** Currently limited by channel adapter capabilities. Telegram supports groups; the `protocolInterceptor` must be updated to track `group_id` alongside `user_id`.

---

## 4. The Context Rotation Protocol
To prevent "Memory Overflow," the system follows a split-buffer architecture:
1. **Raw Buffer:** Stores every message (Audit Trail).
2. **Active Window:** The subset of messages sent to the LLM.
3. **Compaction:** When the **Token Budget** (from `tokenManagerService`) is hit, older messages are processed by a "Summarizer Agent" and stored as a `Context Digest`.

---

## 5. Implementation References
- **Orchestration:** `src/main/services/orchestrationManager.ts`
- **Context Logic:** `src/main/services/contextEngineService.ts`
- **UI Surface:** `src/ui/components/DirectorInteractionBar.tsx`

---

## 6. Known Architectural Gaps (The Roadmap)
- **[High] First-Class Chat Store:** Conversation history is currently ephemeral; it needs a dedicated SQLite table (`conversations`) to support "Load History" on app restart.
- **[Med] Multi-Agent Group Policy:** No logic yet exists to prevent "Agent Loops" (where two agents keep replying to each other in a group).
- **[Med] WhatsApp Bridge:** No adapter exists for WhatsApp transport.
- **[Low] Threading:** The current system is a flat list; no support for "Reply-to" threading exists in the `channelRouter`.

---

### Provision for Group Chat Integration:
To make Group Chat work with external channels (like Telegram), your `channelRouterService` needs to implement **Topic/Room Mapping**. 
* **In-App:** A "Room" is a simple UI filter. 
* **External:** A "Room" is a `chat_id` provided by the API. 
The system should treat them as the same `ConversationEntity` in SQLite to ensure that when you reply in-app, it can push that reply back to the Telegram group.

Does this unified "Switchboard" approach cover your needs for the Agent-to-Agent and Group interactions?