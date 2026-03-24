# Vault Folder Structure - Atomic Feature Specification

## A. Intended Functionality
The Vault Folder Structure feature strictly defines, enforces, and navigates the deterministic topology for all long-term artifacts. It acts as the filesystem router for the secure Vault tier.

### Explicit Constraints
- **Strict Immutability Rules:** Core system folders cannot be renamed or deleted by any user or agent. Only team-level and agent-level subdirectories may be modified, and only via approved protocol workflows.
- **No Orphan Paths:** Every file must belong to a explicitly permissioned directory node governed by the registry schema.

## B. Registry Integration
The structure is not arbitrary; it is governed by specific agents holding taxonomy skills:
- **Agent Profiles:** `nora` (compliance/organization), `eva` (escalation), `mira` (orchestration).
- **Skills:** `organizational-design-strategy`, `governance-enforcement`.
- **KPIs:** `codebase-compliance-score`, `context-loss-rate`.
- **Data Inputs:** `compliance-audit-trail`, `vault-context-index`.
- **Protocols:** `vault-access-tiering-protocol`, `privacy-by-design-protocol`, `git-governance-handshake-protocol`.
- **Workflows:** `nora/seed-autonomous-alignment`, `eva/seed-human-in-loop-escalation`.

## C. The Triple-Engine Extraction Logic
This feature entirely relies on the following engine mechanics:

### 1. OpenCLAW (Validation & Logic)
- **Policy Conformance:** Validates any proposed move/copy/create action against the directory permission schema.
- **Risk Evaluation:** If an agent attempts to move a "confidential" privacy-classified file into a "public" workspace tier, OpenCLAW rejects the operation immediately.

### 2. Goose (Extraction & Sequencing)
- **Extraction:** Harvests artifact metadata (e.g., file extension, created_by, privacy_tier) when a file is ingested.
- **Routing Sequence:** Evaluates extracted metadata -> maps to deterministic vault path -> issues file movement command.

### 3. NemoClaw (UI Automation & Navigation)
- **Anchoring:** Binds to the Vault Tree Explorer components, the Path Validation Modals, and the File Move/Confirm CTAs.
- **Navigation Contract:** Exposes a clear path breadcrumb. Moving files triggers a schema-driven "Current State vs Proposed State" side-by-side modal before commit.

## D. Conditional Navigation & Flows
1. **Directory Creation Request:** User/Agent determines a new taxonomy node is needed.
2. **Path Resolution:** OpenCLAW maps the proposed tree against the registry boundaries.
3. **Approval Gate:** If the directory is within a "Team" context, autonomous approval is granted. If modifying a "Core" context, the `eva/seed-human-in-loop-escalation` workflow forces a UI prompt for an Administrator override.
4. **Final Commit:** The directory contract is signed and executed inside the Vault.

## E. Validation, Error, and Exception Handling
- **Path Collision:** If an identical filename/path exists, fail immediately with a `409 Conflict` UI toast (no soft overwriting).
- **Tier Breach:** Emits a loud visual warning in NemoClaw if moving a sensitive file to a lower security tier.
- **Audit Drift:** A daily cronjob checks the filesystem tree against the registry's directory contract schema. Any un-accounted folders are flagged and isolated to a Quarantine view.

## F. Hybrid Data Lifecycle
### SQLite (High-Performance/Ephemeral)
- Maintains the materialized path index cache (FTS/Vector lookups).
- Stores fast map indices for instant UI rendering of the filesystem tree without querying the disk repeatedly.

### Vault (Secure Commit State/Durable)
- Represents the actual disk subsystem where the encrypted files sit.
- Stores the cryptographically signed structured directory definitions mapping.
