# GAP-020: Global Collaboration Handshake and Agent Directory

## Summary

Current runtime supports single-owner work orders with limited delegation primitives, but lacks a first-class global collaboration layer with explicit handshakes, RFI memo contracts, and role-aware agent directory enforcement.

## Requested Capability

- Global workflows spanning multiple roles with explicit transfer points.
- Inter-agent communication through internal memo/RFI channel.
- Context packet transfer on every handshake.
- Director visibility over internal chat without approving every micro-handoff.
- Collaborative KPIs and blocked-state classification as WAITING_ON_[ROLE].

## Evidence from External Audit

- `openclaw-main/skills/gh-issues/SKILL.md`: phase-based multi-agent orchestration exists, but transfer payloads are mostly unstructured.
- `goose-main/crates/goose/src/recipe/mod.rs`: sub-recipe value maps provide structured context passing.
- `goose-main/crates/goose/src/conversation/message.rs`: action-required message gates provide explicit approval checkpoints.

## Internal Gaps Identified

1. No global workflow namespace with collaborator contracts:
   - Existing workflows are primarily agent-local and lack explicit collaborator maps.
2. Missing Internal Memo/RFI schema in runtime:
   - Work orders had no dedicated memo objects or status-tracked handshake records.
3. Agent Directory not enforced at runtime for collaboration:
   - Agent list exists, but no canonical registry-backed directory is required in handshake startup checks.
4. Blocked dependency states were implicit:
   - Runtime states did not represent WAITING_ON_[ROLE] as a first-class collaboration condition.
5. Collaboration KPIs were absent:
   - Existing KPIs focused on individual/operational metrics, not cross-role handshake performance.

## Refactor Actions Implemented

- Added global workflow registry entry:
  - `src/core/registry/workflows/global/product-campaign-global-collaboration.yaml`
- Expanded workflow schema and loader support:
  - collaborators and handoff_rules contracts
  - dependency-required agents for approved-role checks
- Added inter-agent memo governance protocol:
  - `src/core/registry/protocols/internal-memo-rfi-protocol.yaml`
- Added secretary router capability and required directory input:
  - `src/core/registry/skills/secretary-global-router.md`
  - `src/core/registry/data-inputs/agent-directory-registry.json`
- Added collaboration KPIs:
  - `src/core/registry/kpis/handshake-success-rate.json`
  - `src/core/registry/kpis/cross-role-resolution-time.json`
- Upgraded runtime work-order model:
  - internal memo and handshake records
  - WAITING role state and suite status surface as WAITING_ON_[ROLE]

## Residual Risks

- Runtime still relies on in-memory work order storage; restart clears memo and handshake history.
- Director oversight UI is type-ready but not yet rendered as a dedicated internal collaboration timeline view.
- Required role approval checks are represented in workflow definitions but should be additionally enforced by onboarding-runtime guard logic before execution begins.

## Recommendation

Implement persistent handshake ledger in runtime sqlite and expose director timeline APIs for internal memo stream playback.
