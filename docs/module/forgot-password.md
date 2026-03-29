# Forgot Password - Atomic Feature Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Active

## Current State
- Recovery-initiation contract, guardrails, and escalation pathways are fully documented.
- Strict separation from credential mutation flow is clearly defined.

## Target State
- Preserve deterministic challenge and token issuance behavior with strong anti-enumeration posture.
- Maintain policy-safe escalation and auditable recovery traces.

## Gap Notes
- Continued parity validation is needed between documented anomaly thresholds and runtime telemetry behavior.

## Dependencies
- docs/module/login.md
- docs/module/reset-password.md
- docs/module/master-spec.md

## Acceptance Criteria
1. Forgot-password flow never mutates credentials directly.
2. Recovery initiation protects against account enumeration leakage.
3. High-risk attempts trigger policy-aligned escalation and audit events.

## Immediate Roadmap
1. Align recovery telemetry and escalation diagnostics with observability contract.
2. Keep recovery contract parity synchronized with auth service updates.

## A. Intended Functionality
The Forgot Password feature executes a mathematically strict identity verification workflow for recovery initiation. It does **not** reset the password itself, nor can it modify credentials; its sole atomic duty is to prove identity and issue a signed, time-bound recovery artifact to an authenticated channel.

### Explicit Constraints
- **Separation of Concerns:** This unit strictly handles *intent to recover* and *factor challenge*. It never touches the actual credential modification (which belongs to `reset-password.md`).
- **No Direct Execution:** Issuing a token requires human-in-the-loop (via email/SMS/Telegram) or verified autonomous alignment.

## B. Registry Integration
The feature natively calls upon registry policies to govern recovery risks:
- **Agent Profiles:** `eva` (escalation and security), `mira` (intent clarification).
- **Skills:** `automated-policy-validation`, `governance-enforcement`.
- **KPIs:** `token-compliance-rate`, `token-compliance-score`.
- **Data Inputs:** `compliance-audit-trail`, `incident-and-change-log`.
- **Protocols:** `privacy-by-design-protocol`, `compliance-gate-protocol`, `audit-trail-integrity-protocol`.
- **Workflows:** `eva/seed-autonomous-alignment`, `mira/human-in-loop-intent-clarification`.

## C. The Triple-Engine Extraction Logic
This feature entirely relies on the following engine mechanics:

### 1. OpenCLAW (Validation & Logic)
- **Identity-Proof Evaluation:** Reasons over the fraud coefficient of the request. Analyzes IP context and historic request velocity.
- **Token Authorization:** Authorizes the generation of a recovery token only if the `compliance-gate-protocol` conditions are met.

### 2. Goose (Extraction & Sequencing)
- **Extraction:** Harvests the recovery intent (the submitted identifier).
- **Sequencing:** Structures the timeline: `receive_identifier -> verify_challenge_factors_externally -> lock_state -> issue_recovery_artifact`.

### 3. NemoClaw (UI Automation & Navigation)
- **Anchoring:** Binds precisely to the Recovery Identifier form string, the Challenge Panel components, and the Token-Issued Confirmation view.
- **Navigation Contract:** Must prevent dead ends. If a challenge fails, NemoClaw allows a return to the `Login` view seamlessly.

## D. Possible Flows
1. **Initiation:** User clicks "Forgot Password" on the Login screen and submits their registered identifier.
2. **Internal Audit Check:** 
   - The system checks if the user exists in the Vault. 
   - To prevent enumeration attacks, the UI always proceeds to the "Token Issued" confirmation state **regardless of whether the account exists or not**.
3. **Challenge Distribution:** If the account exists, a time-bound cryptographic token is generated and sent via their registered out-of-band channel (e.g., Telegram, Email).
4. **Transition:** The flow ends gracefully here, directing the user to check their external channel. The user will return to the application via the `reset-password` flow.

## E. Validation, Error, and Exception Handling
- **Rate-Limiting:** Capped at 3 recovery attempts per identifier per hour.
- **Anomaly Escalation:** If attempts exceed the limit or the anomaly score is high (e.g., an unfamiliar IP region), a notification is sent to the compliance review thread in internal chat.
- **Invalid Inputs:** Empty or malformed identifiers fail inline UI validation instantly without triggering a backend query.

## F. Hybrid Data Lifecycle
### SQLite (High-Performance/Ephemeral)
- Holds time-bound recovery tokens (typically 15-minute TTL).
- Holds verification attempt counters.
- Stores fraud scoring telemetry temporarily for cross-request evaluation.

### Vault (Secure Commit State/Durable)
- Commits manual operator overrides.
- Logs high-risk recovery attempts and completed compliance evidence dossiers permanently.
