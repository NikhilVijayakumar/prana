# Phase 04: Communication Enhancements — Context

## Implementation Decisions

### 1. WhatsApp Connection Protocol
* **Approach**: We will use the "Linked Device" protocol via the **Baileys** library (or equivalent Web socket scraping bridge), mimicking the exact functionality of the Windows App.
* **Limitation**: Official WhatsApp Business APIs or Twilio are NOT used; rely exclusively on the web scraping bridge.

### 2. Identity and Sandboxing (Whitelisting)
* **Storage Location**: Authorized user phone numbers and designated group IDs (JIDs) must be dynamically persisted and loaded from the **SQLite Cache**. Note: Different apps/vaults have different whitelisted groups and numbers.
* **Strict Silos**: 
  * The agent will only parse, respond to, and engage with recognized group JIDs and explicitly whitelisted phone numbers.
  * **Level 0 Fallback**: If an authorized group is active but an **unknown number** inside that group sends a message, the agent treats the sender strictly with "Level 0" permissions (General Info only).

*(Note: These identical siloing/whitelisting rules must also be enforced natively for the Telegram adapter).*

### 3. Agent Loop Protection & Mitigation (Channel-Agnostic Core Service)
We will enforce comprehensive multi-engine loop protection (Semantic + State-based). This capability MUST be abstracted as a channel-independent core service (e.g., `LoopProtectionService`) decoupled from the WhatsApp adapter. This ensures it applies universally across all current channels (WhatsApp, Telegram, In-App) and future integrations (Slack, Google Chat, etc.).

* **Step 1: The Counter Limit** 
  * Enforce a hard stop at `max_turns` (e.g., 5 turns) per unique Task/Thread ID. Overstepping breaks the interaction abruptly.
* **Step 2: Embedded Similarity Check** 
  * Integrate a local embedding model (such as BGE-Micro) that calculates the Cosine Similarity of the last 3 generated messages. 
  * Cutoff Trigger: If Cosine Similarity > `0.9` (indicating an agent hallucinating in circles or repeating text), immediately halt the agent loop.
* **Step 3: Human-in-the-Loop Escalation**
  * When a cutoff is triggered by either limit, the system broadcasts a dedicated **"Escalation"** message to the designated WhatsApp group and the in-app UI. 
  * The agent remains locked in that loop until the human operator visibly responds with a predefined keyword (e.g., "Proceed").

## Excluded from Scope
* Development of standalone LLM logic or inference capabilities (the agent only intercepts, limits, and routes payload via the orchestration engines).
* Standalone WhatsApp credential syncs directly traversing external unencrypted configurations. 

## Research Directives (For gsd-project-researcher)
* Investigate the best integration path for Baileys (or equivalent Web Socket WhatsApp bridge) alongside Electron/Node without crashing the Main process bounds.
* Find optimal deployment pipelines for embedding models like BGE-Micro compatible with our local ecosystem (e.g., ONNX runtime or specialized lightweight local nodes natively shipped with or proxied by Prana) specifically for fast (>0.9) Cosine Similarity evaluations.
