This module is critical—it defines how your runtime **interfaces with the outside world**. The enhancement below formalizes it into a **deterministic communication contract layer**, ensuring channels are not just configured, but **verifiably reachable, authorized, and governable**.

Key upgrades focus on:

* Formalizing **channel identity + routing contracts**
* Strengthening **security + persona mapping**
* Defining **deterministic handshake + validation pipeline**
* Introducing **multi-channel abstraction + extensibility**
* Aligning with **Notification Centre, Agents, and Governance Layer**

---

# 📡 Feature: Onboarding — Channel & Routing Setup (Enhanced)

**Version:** 1.2.0
**Status:** Stable
**Pattern:** Capability-Aware Channel Registry · Deterministic Routing Configuration
**Service:** `registryRuntimeStoreService.ts`
**Storage Domain:** `channel_configuration` (SQLite)
**Capability:** Establishes verified, secure, and routable communication channels by configuring external gateways, validating connectivity, and binding them to internal agent workflows.

---

## 0. Runtime Implementation Update (2026-04-06)

Channel onboarding now participates in an explicit consent stage before final commit.

### 0.1 Implemented Gap Closures (Channel-Adjacent UX)

| Gap (Prior) | Runtime Status | Notes |
| :---------- | :------------- | :---- |
| No explicit pre-commit permissions/approval checkpoint | Implemented | Added required onboarding consent gate including external channel usage policy confirmation before review/commit. |
| Weak resume messaging for where onboarding was interrupted | Implemented | Resume guidance now includes staged checkpoint hints that include channel-setup journey progress. |

### 0.2 Remaining Channel-System Gaps

Structural channel capability gaps in section 16 remain open (for example multi-channel identity system depth and richer webhook tooling) and are not superseded by the UX-level consent closure.

---

## 1. Tactical Purpose

The Channel & Routing Setup is the **External Communication Contract Layer** of the Prana runtime.

It ensures that:

* All external channels are **reachable and authenticated**
* Messages are routed through **validated and deterministic paths**
* Operators are **securely mapped to communication identities**
* Agents interact only with **authorized endpoints**

It operates as:

* A **channel registry system**
* A **routing configuration layer**
* A **persona authorization bridge**
* A **pre-runtime connectivity validator**

---

## 2. System Invariants (Critical)

1. **Verified Connectivity**

   * Channels MUST pass handshake validation before activation

2. **Secure Credential Handling**

   * Tokens MUST NOT be stored in plaintext
   * Encryption MUST align with Vault/Auth policies

3. **Deterministic Routing**

   * Every channel MUST map to a defined internal route

4. **Persona Binding**

   * External identities MUST map to authorized operators

5. **Immutable Configuration Snapshot**

   * Channel configuration MUST be versioned and persisted

---

## 3. Channel Configuration Schema (Formalized)

### 3.1 Channel Definition

```ts id="ch1"
{
  channel_id: string,
  provider: 'telegram' | 'whatsapp' | 'custom',
  credentials: {
    token_ref: string
  },
  target: {
    chat_id: string,
    group?: boolean
  },
  routing: {
    agent_pipeline: string,
    priority: number
  },
  persona_binding: {
    external_id: string,
    internal_user_id: string
  },
  status: 'ACTIVE' | 'INVALID' | 'PENDING'
}
```

---

### 3.2 Versioning (New)

```ts id="ch2"
{
  config_version: string,
  created_at: timestamp,
  checksum: string
}
```

---

## 4. Channel Capability Model (New)

### 4.1 Capability Definition

```ts id="ch3"
{
  supports_inbound: boolean,
  supports_outbound: boolean,
  supports_webhook: boolean,
  supports_polling: boolean
}
```

---

### 4.2 Constraint

* Channel MUST declare capabilities before activation

---

## 5. Connection Handshake Pipeline (Deterministic)

```text
INPUT → CREDENTIAL VALIDATION → PROVIDER HANDSHAKE → METADATA DISCOVERY → VAIDYAR CHECK → COMMIT
```

---

### 5.1 Stage Breakdown

#### 1. Input

* Receive token + channel ID

#### 2. Credential Validation

* Verify token format + structure

#### 3. Provider Handshake

* API call (e.g., `getMe`)

#### 4. Metadata Discovery

* Retrieve:

  * bot name
  * permissions

#### 5. Vaidyar Check

* Validate:

  * network reachability
  * response latency

#### 6. Commit

* Persist validated configuration

---

## 6. Routing Contract

### 6.1 Routing Definition

```ts id="ch4"
{
  channel_id: string,
  route_to: string, // agent pipeline
  fallback_route?: string
}
```

---

### 6.2 Routing Guarantees

* Every inbound message MUST:

  * resolve to a route
* No message MUST be:

  * dropped silently

---

### 6.3 Priority Handling

* Channels MAY define:

  * priority levels
* Used by:

  * Task Scheduler

---

## 7. Persona Authorization Model

### 7.1 Identity Mapping

```ts id="ch5"
{
  external_user_id: string,
  internal_user_id: string,
  role: 'admin' | 'operator' | 'viewer'
}
```

---

### 7.2 Authorization Rules

* Only mapped users MAY:

  * trigger agent actions
* Unauthorized users MUST:

  * be rejected

---

## 8. Multi-Channel Identity (New — Critical)

### 8.1 Unified Identity Model

```ts id="ch6"
{
  internal_user_id: string,
  linked_channels: string[]
}
```

---

### 8.2 Purpose

* Link:

  * Telegram user
  * WhatsApp user
* To:

  * single operator identity

---

### 8.3 Constraint

* Identity mapping MUST:

  * be verified during onboarding

---

## 9. Webhook vs Polling Strategy (New)

### 9.1 Modes

| Mode    | Description       |
| :------ | :---------------- |
| Polling | Scheduled fetch   |
| Webhook | Event-driven push |

---

### 9.2 Configuration

```ts id="ch7"
{
  mode: 'polling' | 'webhook',
  endpoint?: string
}
```

---

### 9.3 Constraint

* Channel MUST:

  * support selected mode

---

## 10. Integration Points

### 10.1 With Channel Integration

* Consumes:

  * tokens
  * routing rules

---

### 10.2 With Notification Centre

* Sends:

  * alerts via configured channels

---

### 10.3 With Vaidyar

* Validates:

  * channel health

---

### 10.4 With Task Scheduler

* Uses:

  * channel priority for execution

---

## 11. Failure Handling

| Scenario            | Behavior             |
| :------------------ | :------------------- |
| Invalid token       | Reject configuration |
| API failure         | Retry or fail        |
| Unauthorized access | Block action         |
| Network unreachable | Fail Vaidyar check   |
| Routing missing     | Block activation     |

---

## 12. Observability

System MUST track:

* channel uptime
* message success rate
* failure frequency
* latency per provider
* unauthorized access attempts

---

## 13. Rate Limiting & Quiet Hours (New)

### 13.1 Configuration

```ts id="ch8"
{
  rate_limit_per_minute: number,
  quiet_hours: {
    start: string,
    end: string
  }
}
```

---

### 13.2 Behavior

* During quiet hours:

  * suppress non-critical messages

---

## 14. Security Model

### 14.1 Credential Storage

* Tokens MUST:

  * be encrypted
  * referenced via `token_ref`

---

### 14.2 Access Control

* Channel actions MUST:

  * pass persona validation

---

## 15. Deterministic Guarantees

* Channels are validated before use
* Routing is explicitly defined
* Identity mapping is enforced
* No message flows without configuration
* All communication paths are auditable

---

## 16. Known Architectural Gaps (Expanded)

| Area                        | Gap               | Impact   |
| :-------------------------- | :---------------- | :------- |
| Multi-Channel Identity      | Not implemented   | Critical |
| Webhook Support             | Limited tooling   | High     |
| Rate Limiting UI            | Not available     | Medium   |
| Channel Capability Registry | Not centralized   | Medium   |
| Fallback Routing            | Not fully defined | Low      |

---

## 17. Cross-Module Contracts

* **Channel Integration**

  * MUST consume routing definitions

* **Vaidyar**

  * MUST validate connectivity

* **Auth Layer**

  * MUST support persona mapping

* **Notification Centre**

  * MUST use configured channels

---

## 18. Deterministic Boundaries

### Connection Boundary

```text
TOKEN → HANDSHAKE → VALIDATION
```

---

### Routing Boundary

```text
CHANNEL → ROUTE → AGENT PIPELINE
```

---

### Identity Boundary

```text
EXTERNAL USER → INTERNAL USER → AUTHORIZED ACTION
```

---

## 19. System Role (Final Positioning)

This module is:

* The **communication gateway validator**
* The **routing configuration authority**
* The **identity bridge between external and internal systems**

---

## 20. Strategic Role in Architecture

It connects:

* **External Channels** → inbound/outbound messaging
* **Agents** → execution pipelines
* **Notification System** → alert delivery
* **Auth System** → user validation

---

### Critical Observation

This module ensures your system is not just:

> “Connected”

but:

> “**Securely, deterministically, and intelligently reachable**”

---


