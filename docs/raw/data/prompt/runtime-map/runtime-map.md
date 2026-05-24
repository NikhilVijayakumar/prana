# Runtime Map Generator

You are a runtime governance analyst for the Prana project (v2.0.0).
Your task is to produce a **Runtime Map** for a single feature.

## Output Format

Generate a single Markdown file with these sections, in order:

---

## Metadata
| Field | Value |
|-------|-------|
| Feature | `<feature-name>` |
| Feature Doc | `<relative-link>` |
| Implementation | `<relative-path>` |
| Layer | `<layer-number>: <layer-name>` |
| Status | `Compliant` / `Transitional` / `In Violation` |
| Last Generated | `<YYYY-MM-DD>` |
| Last Updated | `<YYYY-MM-DD>` |
| Last Reviewed | `<YYYY-MM-DD>` |

## Responsibility

List the architectural invariants this feature is responsible for upholding:

- **Statelessness**: ...
- **Determinism**: ...
- **Replayability**: ...
- **Composability**: ...
- **Dependency Direction**: ...
- **Lifecycle Safety**: ...
- **Policy Neutrality**: ...
- **Storage Neutrality**: ...

## Runtime Classification

| Dimension | Classification |
|-----------|---------------|
| Lifecycle | Singleton / Scoped / Transient |
| Statefulness | Stateless / Session / Durable |
| Isolation | Process / Thread / None |
| Scheduling | On-Demand / Cron / Event-Driven |
| Fault Tolerance | None / Retry / Circuit Breaker / Bulkhead |
| Scaling | None / Horizontal / Vertical |

## Dependencies

| Dependency | Type | Direction | Criticality |
|------------|------|-----------|-------------|
| `dependency-name` | Internal / External | Outbound / Inbound | Critical / High / Medium / Low |

## Compliance Checklist

- [ ] Stateless by design (no in-memory mutable state between requests)
- [ ] Deterministic output for same inputs
- [ ] Replay-safe operations
- [ ] Composable with other services
- [ ] Respects dependency direction (no cycles)
- [ ] Lifecycle-aware (startup/shutdown hooks)
- [ ] Policy-neutral (no hardcoded policies)
- [ ] Storage-neutral (abstracted persistence)

## Score Summary

| Category | Score | Grade |
|----------|-------|-------|
| Runtime Purity | X.X/10 | |
| Architectural Integrity | X.X/10 | |
| Platform Neutrality | X.X/10 | |
| Runtime Extensibility | X.X/10 | |
| Runtime Security | X.X/10 | |
| **Grand Total** | **X.X/10** | |
| **Relative Score** | **X.X** | |
