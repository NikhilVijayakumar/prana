# Policy Neutrality Invariant

````md id="2byl1s"
# Policy Neutrality Invariant

## Purpose

Prana is a reusable orchestration runtime library.

The runtime must orchestrate policy evaluation,
NOT define business policy.

All business rules, tenant semantics, approval logic,
organizational behavior, entitlement logic,
and domain-specific decision-making belong to:
- client applications
- injected policy providers
- external governance systems

The runtime core must remain domain-neutral and organization-neutral.

---

# Architectural Rule

Runtime services may coordinate policy execution
but may not encode business meaning.

Core runtime layers must not:
- define tenant rules
- define approval logic
- define role semantics
- define pricing behavior
- define organizational workflows
- define product/business decisions
- define customer segmentation logic

All policy decisions must be externalized through contracts.

---

# Allowed Patterns

## Policy Capability Injection

Allowed:

```ts
interface PolicyCapability {
  evaluate(input): Promise<PolicyResult>
}
````

Reason:
Runtime coordinates policy without owning business semantics.

---

## Generic Policy Evaluation

Allowed:

```ts id="bmxm9s"
await policyCapability.evaluate(context)
```

Reason:
Decision ownership is externalized.

---

## Configuration-Driven Behavior

Allowed:

```ts id="xk1h4l"
runtime.start({
  policyProvider
})
```

Reason:
Client defines governance behavior.

---

## Generic Workflow Coordination

Allowed:

```ts id="8m7jzw"
await orchestration.execute(step)
```

Reason:
Runtime coordinates execution only.

---

## Domain-Agnostic Validation

Allowed:

```ts id="g3vl5u"
z.object({
  id: z.string()
})
```

Reason:
Structural validation is not business policy.

---

# Forbidden Patterns

## Hardcoded Role Logic

Forbidden:

```ts id="5uc4cn"
if (user.role === 'admin')
```

Reason:
Runtime becomes organization-aware.

---

## Embedded Approval Semantics

Forbidden:

```ts id="a4r6fz"
if (amount > 10000) requireDirectorApproval()
```

Reason:
Business governance leaks into runtime.

---

## Tenant-Specific Logic

Forbidden:

```ts id="pfu1om"
if (tenant.plan === 'enterprise')
```

Reason:
Runtime becomes business-aware.

---

## Product Entitlement Rules

Forbidden:

```ts id="6clvmt"
if (!subscription.active)
```

inside runtime orchestration.

Reason:
Subscription semantics belong to clients.

---

## Organization Semantics

Forbidden:

```ts id="8lfb6f"
departmentHierarchy.approve()
```

inside runtime core.

Reason:
Runtime becomes organizationally coupled.

---

## Business Workflow Ownership

Forbidden:

```ts id="m8c8lm"
approveInvoiceWorkflow()
```

inside orchestration kernel.

Reason:
Runtime owns domain semantics.

---

## Embedded Compliance Decisions

Forbidden:

```ts id="z3tt4m"
if (country === 'US') enforceRule()
```

inside core runtime.

Reason:
Compliance policy must be externalized.

---

# Detection Heuristics

Flag the following patterns:

---

## Business Vocabulary

Detect:

* subscription
* invoice
* customer
* enterprise
* billing
* premium
* admin
* employee
* manager
* director
* approval

inside runtime orchestration layers.

---

## Role-Based Conditionals

Detect:

```ts id="azmohw"
role ===
permission ===
tenant ===
plan ===
```

inside core runtime services.

---

## Business Threshold Logic

Detect:

* pricing thresholds
* approval thresholds
* entitlement checks

embedded in runtime code.

---

## Organization-Coupled Behavior

Detect:

* department
* hierarchy
* manager approval
* employee workflows

inside runtime orchestration.

---

## Embedded Compliance Rules

Detect:

* country-specific enforcement
* legal jurisdiction branching
* regulatory branching

inside runtime core.

---

# Severity Levels

## P0 — Critical

Runtime directly owns business policy.

Examples:

* role systems
* approval logic
* entitlement systems
* customer segmentation

Must fix before release.

---

## P1 — High

Business semantics partially embedded.

Examples:

* tenant-specific branching
* organization assumptions
* workflow semantics

Must migrate.

---

## P2 — Transitional

Legacy domain coupling with migration plan.

Allowed temporarily only.

---

## P3 — Informational

Runtime remains domain-neutral.

No action required.

---

# Refactoring Guidance

## Replace Embedded Rules With Policy Providers

BAD:

```ts id="qlq3rk"
if (user.role === 'admin')
```

GOOD:

```ts id="qv1waf"
policyCapability.evaluate(context)
```

---

## Externalize Business Semantics

BAD:

```ts id="m7vjlwm"
approveInvoice()
```

GOOD:

```ts id="3wwl2v"
executeWorkflowStep(step)
```

---

## Remove Tenant Knowledge

BAD:

```ts id="84r7h5"
if (tenant.plan === 'premium')
```

GOOD:

```ts id="3u6x8s"
capabilityProvider.resolveFeatures()
```

---

## Move Compliance Logic Outward

BAD:

```ts id="v2d2rf"
if (country === 'EU')
```

GOOD:

```ts id="6yhnys"
complianceCapability.evaluate()
```

---

# Runtime Impact

Violating policy neutrality causes:

* domain lock-in
* client inflexibility
* orchestration contamination
* difficult extensibility
* multi-tenant rigidity
* business coupling
* upgrade friction
* runtime politicization

The runtime becomes an application platform
instead of a reusable orchestration kernel.

---

# Migration Notes

## Transitional Policy Coupling Must Include

```ts id="wjlwmz"
/**
 * @deprecated-policy-coupling
 * Domain:
 * Replacement capability:
 * Removal target:
 */
```

---

## Migration Strategy

1. Identify embedded business semantics
2. Extract policy interfaces
3. Inject policy capabilities
4. Remove domain assumptions
5. Externalize organizational logic

---

# Validation Requirements

A runtime service is compliant only if:

* no business semantics exist in core runtime
* policy evaluation is externalized
* organization logic is externalized
* tenant behavior is configurable
* workflow meaning belongs to clients
* compliance behavior is injectable

---

# Compliance Goal

Prana must behave as:

* a policy-neutral orchestration runtime
* a domain-agnostic execution kernel
* a reusable coordination substrate

NOT:

* a business platform
* a workflow policy engine
* an entitlement system
* an organization-aware runtime

```
```
