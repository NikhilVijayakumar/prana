# Vault Storage Contract: Prana

## Scope
Defines the durable archive domains for the Prana app in vault storage.

## Contract State
This file defines structure and intended mapping. Domains can remain planned until implementation is approved.

## Tree Contract
Vault is treated as git-tree documentation.

```text
vault/
	prana/
		registry/
			runtime/
			approvals/
		knowledge/
			documents/
			indexes/
		email/
			artifacts/
			review/
		audit/
			exports/
			compliance/
```

Large branches may be split into additional subtrees as the app grows.

## Required Mirror Rule
Every domain listed here must also exist in `../cache/prana.md` with the same domain key.

## Domain Map
| Domain Key | Vault Path Pattern | Purpose | Cache Mirror Required |
| --- | --- | --- | --- |
| `registry` | `vault/prana/registry/**` | Approved runtime registry snapshots and promoted definitions | Yes |
| `knowledge_documents` | `vault/prana/knowledge/**` | Durable knowledge artifacts approved for archive | Yes |
| `email_artifacts` | `vault/prana/email/**` | Approved email intelligence artifacts retained long-term | Yes |
| `audit_exports` | `vault/prana/audit/**` | Durable audit bundles and compliance exports | Yes |

## Implementation Hints
- Expected integration points include vault publish/read paths and sync providers.
- Paths are logical patterns; physical archive layout can evolve without changing domain keys.

## Change Rules
- Do not add a new vault domain unless the same domain key is added in cache contract.
- If a vault domain is deprecated, update cache mapping in the same PR.
- Keep the app root folder (`vault/prana`) stable unless a migration plan is approved.