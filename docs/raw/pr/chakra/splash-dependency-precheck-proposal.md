# PR Request for Prana: Reusable Host Dependency Capability Service

Status: Proposal only (do not implement in Chakra)
Owner repo: Prana
Requested by: Chakra integration flow

## Summary

Introduce a generic dependency capability implementation in Prana that can be called from any page or flow.

The implementation should verify required host dependencies are available:
- SSH binary (for governance/auth SSH verification path)
- Git binary (for repo operations)
- Virtual drive binary (for mount/sync flow used by runtime)

This implementation must have no dependency on splash UI/container/orchestrator logic.

## Why this is needed

Missing host dependencies can break workflows across multiple surfaces, not only startup.

A reusable service will:
- Fail fast with actionable feedback
- Reduce confusing later-stage errors
- Enable consistent checks from any page/feature in Prana

## Requested behavior

1. Add a generic host dependency capability service in Prana core/runtime services.
2. Service must be callable from any flow (startup, settings, diagnostics, feature pages, etc.).
3. Detect binary availability on host PATH (or configured absolute path if supported).
4. Return structured result:
   - passed: true/false
   - missing: list of missing dependencies
   - diagnostic details per dependency
5. Keep UI and orchestration responsibilities separate:
   - service only returns capability status
   - caller decides how to render/handle failure
6. Provide one shared API contract for all callers so behavior is consistent across pages.

## Acceptance criteria

- Missing SSH is detected and surfaced by the shared dependency capability service.
- Missing Git is detected and surfaced by the shared dependency capability service.
- Missing virtual-drive binary is detected and surfaced by the shared dependency capability service.
- Error message is human-readable and names exact missing dependency.
- Service can be invoked from multiple pages without coupling to splash internals.
- No behavior regression when all dependencies are present.

## Non-goals

- Do not auto-install dependencies.
- Do not change Chakra app behavior directly in this request.
- Do not force splash-specific control flow from this implementation.

## Suggested implementation location in Prana

- Runtime/core service layer (page-agnostic), not splash container/view model.
- Optional adapters in splash/settings/diagnostics can call this shared service.
- Keep contract reusable and UI-agnostic.

## Chakra note

Chakra requests this as an upstream Prana improvement. This document is for PR planning only.
