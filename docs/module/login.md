# Login - Atomic Feature Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Active

## Current State
- Login contract and closed-loop access posture are fully documented.
- Conditional onboarding-aware routing and security controls are defined.
- Credential verification now reads from local SQLite auth state only.

## Target State
- Preserve strict no-registration and immutable credential verification boundaries.
- Maintain deterministic routing and stronger audit coverage for high-risk events.

## Gap Notes
- Security posture is strong, but ongoing parity validation is required between documented escalation policy and runtime telemetry surfaces.

## Dependencies
- docs/module/forgot-password.md
- docs/module/reset-password.md
- docs/module/master-spec.md

## Acceptance Criteria
1. Login remains read-and-verify only with no credential mutation path.
2. Onboarding-complete state deterministically drives route selection.
3. Lockout and escalation policy triggers are auditable and consistent.
4. Login does not require Vault to read or verify credentials.

## Immediate Roadmap
1. Tighten audit trace visibility for lockout and escalation events.
2. Maintain parity checks between auth contracts and runtime safeguards.

## A. Intended Functionality
The Login feature is strictly responsible for validating credentials, issuing volatile authenticated sessions, mapping the user's registry intent, and conditionally routing them based on their onboarding state.

### Explicit Constraints
- **Registration Absence:** There is **NO REGISTRATION** flow within this system boundary. All agents, administrators, and virtual employees are pre-provisioned via the Governance Lab or Vault. New user creation from the login interface is explicitly unsupported by design to maintain a closed-loop security posture.
- **Credential Immutability:** The Login feature may never alter, rotate, or modify credentials. It is strictly read-and-verify. (For modifications, refer to `forgot-password.md` and `reset-password.md`).
- **Local-Only Credential Store:** Credential hashes and recovery artifacts are stored in local SQLite auth storage and never sync to Vault or repo state.

## B. Registry Integration
The Login feature coordinates directly with the system registry to execute securely:
- **Agent Profiles:** `mira` (autonomous routing), `eva` (escalation and policy gating).
- **Skills:** `command-decomposition-logic`, `automated-policy-validation`.
- **KPIs:** `compliance-pass-rate`, `decision-cycle-time`.
- **Data Inputs:** `audit-log-jsonl`, `compliance-audit-trail`.
- **Protocols:** `intent-parsing-protocol`, `privacy-by-design-protocol`, `incident-escalation-protocol`.
- **Workflows:** `mira/sop-autonomous-routing`, `eva/seed-human-in-loop-escalation`.

## C. The Triple-Engine Extraction Logic
This feature entirely relies on the following engine mechanics:

### 1. OpenCLAW (Validation & Logic)
- **Fraud/Risk Posture Evaluation:** Computes an anomaly score based on IP velocity and brute-force indicators.
- **Decision Engine:** Decides whether to `allow`, require a `step-up challenge`, or `deny` the attempt outright.
- **Routing Logic Validation:** Consults runtime SQLite-backed approved state for onboarding and startup readiness context.

### 2. Goose (Extraction & Sequencing)
- **Extraction:** Harvests identity payload (identifier, password hash, device constraints).
- **Sequencing:** Dispatches chronological sequence: `validate_input -> verify_identity -> check_onboarding_state -> issue_session_ticket -> record_telemetry`.

### 3. NemoClaw (UI Automation & Navigation)
- **Anchoring:** Binds to form identifiers (login field, password parameter), Submit CTAs, and Failure/Retry Banners.
- **Navigation Contract:** No dead ends. The failure states must cleanly reload the challenge view, with recovery links mapped directly to Forgot Password.
- **Routing Action:** If `onboarding_complete == true`, NemoClaw automatically navigates the session to `Home`. If `false` or missing, NemoClaw strictly navigates to `Onboarding`.

## D. Conditional Navigation & Flows
The exact chronological operation flow is as follows:
1. **Input Submission:** User submits credentials to the Login UI.
2. **Evaluation:** Credentials checked against local SQLite auth state.
3. **Session Minting:** If valid, an ephemeral session ticket is minted.
4. **Vault Drive Mount Attempt:** If configured, the dedicated Vault virtual drive is mounted after successful credential verification.
5. **Conditional Routing Gate:** Runtime-approved onboarding state determines whether to continue to protected flows or onboarding surfaces.

## E. Validation, Error, and Exception Handling
- **Invalid Credentials:** Reject immediately. Do not specify whether username or password was incorrect.
- **Brute-Force Threshold:** After 5 failed attempts within 15 minutes, the account identifier enters a hard lockout state.
- **Escalation Trigger:** Lockouts trigger the `eva/seed-human-in-loop-escalation` workflow, routing an incident alert to the internal ops chat, halting further automated retries until operator override.
- **Service Timeout:** If local auth SQLite fails to respond within 2000ms, fail locally and return a generic `Service Unavailable` error, preserving the session attempt telemetry to an offline buffer.

## F. Hybrid Data Lifecycle
### SQLite (High-Performance/Ephemeral)
- Persists local credential hashes in auth SQLite storage.
- Persists local forgot/reset recovery state.
- Persists active session state.
- Persists short-TTL refresh tokens.
- Maintains the volatile per-device attempt counter (cleared every 15 mins).

### Vault (Secure Commit State/Durable)
- Does not participate in credential verification.
- May be mounted after successful login for user-facing vault access.
- Stores long-term failed-login incident dossiers that cross the compliance threshold.
