# PR Request for Prana: Decouple Virtual Drive Policy to Client App

Status: Proposal only
Owner repo: Prana
Requested by: Chakra integration flow

## Problem

Current virtual-drive behavior is tightly coupled with Vault and SQLite cache assumptions inside Prana.
Prana currently decides too much about:
- what content goes into the drive
- folder structure inside the drive
- encryption policy and key handling flow

For Chakra and other client apps, these decisions should belong to the client app, not Prana core.

## Proposal

Refactor virtual-drive integration so Prana provides a reusable drive runtime capability, while client apps control drive policy.

Prana should provide:
- Mount/open drive runtime
- Unmount/eject drive runtime
- Health/status and lifecycle hooks
- Pluggable encryption interface

Client app (for example Chakra) should provide:
- What content goes into drive
- Folder structure and naming
- Encryption policy selection
- Key source/flow and unlock strategy

## Required behavior

1. Decouple drive policy from Vault/SQLite-specific assumptions in Prana core.
2. Keep mechanism reusable, but move drive content/schema decisions to client app adapters.
3. Preserve existing mechanism where possible (minimal breaking changes), but make policy injectable.
4. Drive lifecycle:
   - app start -> drive mounts/opens automatically
   - app stop -> drive is ejected/unmounted automatically
5. Encryption model:
   - drive must support encryption
   - drive can be opened by app-managed flow or by a provided key
6. Vault note:
   - vault can keep its current basic encryption behavior
   - this request is to decouple drive-level ownership and policy, not remove vault encryption

## Acceptance criteria

- Prana exposes page-agnostic/client-agnostic drive runtime APIs.
- No hard requirement that drive folder schema is Vault-owned.
- Client app can fully define drive folder structure.
- Client app can fully define which artifacts are written to drive.
- Drive encryption is enforced and unlock is possible via app flow or key.
- Drive mounts on app start and ejects on app stop.
- Existing flows can be migrated without breaking current mechanism.

## Non-goals

- Do not implement Chakra-specific drive schema inside Prana core.
- Do not remove existing vault encryption behavior in this PR.
- Do not force one encryption provider if abstraction can support multiple.

## Suggested implementation direction

- Introduce a drive policy interface/contract in Prana runtime layer.
- Keep mount/unmount and status in core; move content/schema/encryption policy to client adapters.
- Add migration compatibility mode for existing Vault/SQLite-driven behavior.

## Chakra note

Chakra requests this as an upstream Prana architectural PR so client apps control drive policy while Prana remains a reusable runtime foundation.
