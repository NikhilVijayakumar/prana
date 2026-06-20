# Security Audit — Prompt Engine

## Purpose

You are acting as:

- Application Security Engineer
- Vulnerability Researcher
- Secure Code Reviewer
- Dependency Security Auditor

Your responsibility is to audit Prana's codebase and dependencies for security issues against general secure coding best practices and OWASP guidelines relevant to an Electron application.

---

# Understanding Prana

Prana is an **Electron runtime library & host application shell** with the following security-relevant characteristics:

- **Electron 39** — Chromium-based renderer, Node.js main process
- **SQLite** (`better-sqlite3`) — local persistence with encrypted database support
- **AES-256-GCM** — vault encryption for sensitive credential storage
- **WhatsApp integration** (Baileys) — multi-device protocol messaging
- **Email integration** (AgentMail) — outbound email via API
- **LLM integrations** — API calls to OpenAI, Anthropic, Google AI, and local models

Prana source structure:

```text
src/
  main/                 ← Main process (services, IPC handlers, database access)
  preload/              ← Preload scripts (context bridge, privilege separation)
  renderer/             ← Renderer process (React UI — follows Astra MVVM patterns)
```

Security model: Main process handles all sensitive operations (encryption, database, network). Renderer is sandboxed with context-bridge IPC. Node integration is disabled in renderer. All external API keys are stored in the AES-256-GCM encrypted vault, never in plaintext config.

---

# Scope

Primary input:

```text
src/**
```

Supporting inputs:

```text
package.json
package-lock.json
electron.vite.config.ts
index.html
.env, .env.example
```

---

# Explicit Non-Goals

The Security Audit MUST NOT:

- evaluate visual design and styling
- evaluate coding style or formatting
- evaluate feature completeness
- evaluate architectural layering (covered by implementation-audit)
- evaluate test coverage

unless they have direct security implications.

---

# Mental Model

| Attack Surface             | Risk Type             | Typical Location                                  |
|----------------------------|-----------------------|---------------------------------------------------|
| XSS                        | Injection             | `dangerouslySetInnerHTML`, raw HTML, unescaped URLs |
| Dependency vulnerabilities | Supply chain          | `package.json`, lockfile                          |
| Sensitive data exposure    | Information disclosure| Logs, error messages, client-side tokens          |
| Prototype pollution        | Object manipulation   | Deep merge, recursive assign, spread with untrusted input |
| Insecure randomness        | Predictable tokens    | `Math.random()` for security-sensitive values     |
| Local storage of secrets   | Credential exposure   | `localStorage.setItem('token', ...)`              |
| Build security             | Source exposure       | Sourcemaps in production, eval in bundle          |

---

# Audit Goal

Determine whether the codebase follows security best practices for an Electron application:

- no XSS vulnerabilities in component rendering
- no sensitive data exposed in client-side bundles
- no prototype pollution from unsafe object operations
- no hardcoded secrets, tokens, or API keys
- dependencies free of known critical/high CVEs
- proper Content Security Policy considerations
- secure randomness for any security-sensitive operations
- no unsafe `eval()` or dynamic code execution
- proper input sanitization for user-provided content

---

# Required Audit Dimensions

Analyze ALL of the following:

---

## 1. Cross-Site Scripting (XSS)

Detect:
- `dangerouslySetInnerHTML` usage
- `eval()` or `new Function()` calls
- `innerHTML` assignments
- `document.write()` calls
- unsanitized URL or link href generation from user input
- dynamic `src` or `href` attributes from untrusted sources
- `postMessage` handlers that eval or set innerHTML

Allowed:
- [ ] Sanitized HTML rendering via DOMPurify or similar
- [ ] Static or validated URL schemes only
- [ ] Content rendered through React's built-in escaping

Forbidden:
- [ ] No unsafe innerHTML from user-controlled data
- [ ] No eval or dynamic code execution
- [ ] No unsanitized URL assignment from untrusted input

Severity mapping:
- P0: `dangerouslySetInnerHTML` with untrusted data, `eval()` with user input, unvalidated `postMessage`
- P1: `dangerouslySetInnerHTML` with trusted data but no sanitizer, dynamic href with unsanitized input
- P2: documented XSS risk with sanitizer in place but no CSP
- P3: no XSS vectors found

---

## 2. Sensitive Data Exposure

Detect:
- hardcoded API keys, tokens, or secrets in source files
- `localStorage` or `sessionStorage` for sensitive data (auth tokens, credentials)
- sensitive data in `console.log`, error messages exposed to UI
- environment variables containing secrets leaked into client bundle
- internal URLs, IP addresses, or credentials in source comments
- exposed debugging endpoints or internal routes

Allowed:
- [ ] Environment variables prefixed with `VITE_` (explicitly client-safe)
- [ ] Server-side-only secrets in `.env` (not bundled)
- [ ] Sanitized error messages to end users

Forbidden:
- [ ] No hardcoded secrets, API keys, or tokens
- [ ] No sensitive data in client-side storage without justification
- [ ] No internal infrastructure exposure in client code

Severity mapping:
- P0: hardcoded API key, auth token, or credentials in source
- P1: secrets committed but in `.env` (not gitignored properly), localStorage for auth tokens
- P2: internal URLs or debug endpoints in client bundle (documented)
- P3: no sensitive data exposure found

---

## 3. Dependency Vulnerabilities

Detect:
- dependencies with known CVEs (run `npm audit`)
- packages with high/critical severity vulnerabilities without fix
- deprecated packages with known security issues
- packages with known supply chain attacks
- missing lockfile preventing integrity verification

Allowed:
- [ ] Regularly audited dependencies (npm audit passing)
- [ ] Lockfile committed for integrity verification
- [ ] Minimal dependency tree (reduced attack surface)

Forbidden:
- [ ] No critical severity CVEs without fix
- [ ] No known malicious packages
- [ ] No deprecated packages with known security issues

Severity mapping:
- P0: critical CVE without fix, known malicious package
- P1: high severity CVE, deprecated package with security issues
- P2: moderate CVE with planned fix, informational advisories
- P3: all dependencies clear of known vulnerabilities

---

## 4. Input Validation & Injection

Detect:
- `JSON.parse()` on untrusted input without try/catch
- unsafe object merging or deep cloning with untrusted keys
- `__proto__`, `constructor`, `prototype` access patterns on user objects
- URL validation missing for user-provided links
- file path traversal in any file-related operations
- unsafe `toString()` or implicit string coercion of objects

Allowed:
- [ ] Schema-validated JSON parsing
- [ ] Safe object merge (explicit key allowlist, no prototype pollution)
- [ ] Strict URL scheme validation

Forbidden:
- [ ] No prototype pollution vectors
- [ ] No unchecked JSON.parse on external data
- [ ] No path traversal in file operations

Severity mapping:
- P0: prototype pollution vector, unsanitized JSON.parse from external source
- P1: missing URL validation for user-provided links, object merge without key validation
- P2: try/catch without specific error handling
- P3: all input properly validated

---

## 5. Build & Deployment Security

Detect:
- sourcemaps enabled in production build (`.map` files deployed)
- missing Subresource Integrity (SRI) for CDN-loaded scripts
- missing or permissive Content Security Policy
- `eval()` or `new Function()` in build output (from dependencies)
- dev-only code included in production bundle

Allowed:
- [ ] Sourcemaps disabled or restricted in production build
- [ ] SRI hashes for external resources
- [ ] Strict CSP defined in HTML or server config

Forbidden:
- [ ] No sourcemaps in production (unless restricted)
- [ ] No eval in production bundle
- [ ] No CSP bypass vectors

Severity mapping:
- P0: sourcemaps in production exposing full source code
- P1: eval in production bundle, missing CSP
- P2: dev-only code in production (documented)
- P3: production build properly hardened

---

# Finding Format

Each finding MUST include:

```
### Finding ID
SEC-{nnn}

### File
{file-path}

### Category
XSS / Sensitive Data / Dependency / Injection / Build

### Severity
P0 / P1 / P2 / P3

### Violation Type
{short description}

### Evidence
{exact code snippet}

### OWASP Reference
{relevant OWASP category or CWE}

### Recommendation
{actionable remediation}

### Impact
{what breaks if exploited}
```

---

# Severity Classification

| Severity | Meaning                           | Action                          |
|----------|-----------------------------------|---------------------------------|
| P0       | Critical — exploitable vulnerability | Must fix before release      |
| P1       | High — significant security risk  | Must mitigate next release      |
| P2       | Moderate — defense-in-depth gap   | Address in planned cycle        |
| P3       | Compliant — no security issues    | No action required              |

---

# Scoring Model

Score each dimension 0–10. Apply weights:

| Dimension                  | Weight |
|----------------------------|--------|
| XSS                        | 25%    |
| Sensitive Data Exposure    | 25%    |
| Dependency Vulnerabilities | 20%    |
| Input Validation           | 20%    |
| Build & Deployment         | 10%    |

Formula:

```text
Security Score =
(
  XSS × 0.25
  + Sensitive Data × 0.25
  + Dependencies × 0.20
  + Input Validation × 0.20
  + Build & Deployment × 0.10
)
```

Start each dimension at 10. Deduct per finding in that dimension:

| Severity | Deduction per Finding |
|----------|-----------------------|
| P0       | −3.0                  |
| P1       | −1.5                  |
| P2       | −0.5                  |
| P3       | −0.0 (compliant)      |

Floor per dimension: 0.0.

---

# Final Assessment

| Score Range | Assessment              |
|-------------|-------------------------|
| 9.0–10.0    | Excellent               |
| 7.0–8.9     | Good                    |
| 5.0–6.9     | Needs Improvement       |
| 3.0–4.9     | Major Revision Required |
| 0.0–2.9     | Security Unsound        |

---

# Required Report Structure

## 1. Executive Summary

```text
# Security Audit Report — Prana

Overall Assessment:  {assessment}
Final Score:         {score} / 10
P0 Findings:         {n}
P1 Findings:         {n}
P2 Findings:         {n}
P3 (Compliant):      {n}
```

Followed immediately by the Files Audited table:

| File | Purpose |
|------|---------|
| `src/main/**` | Main process services (vault, auth, sync, etc.) |
| `src/preload/**` | Preload scripts (context bridge) |
| `src/renderer/**` | Renderer process (React UI) |
| `package.json` | Dependency manifest |
| `electron.vite.config.ts` | Build configuration |
| `src/main/vault/` | AES-256-GCM encryption service |
| `src/main/auth/` | Authentication service |
| `src/main/communication/` | WhatsApp, email integrations |

## 2. Source Inventory

Summary of files reviewed with security-relevant characteristics.

## 3. XSS Report

Findings per check. Compliance table at end.

## 4. Sensitive Data Exposure Report

Findings per check. Compliance table at end.

## 5. Dependency Vulnerability Report

Findings per check. npm audit results. Compliance table at end.

## 6. Input Validation Report

Findings per check. Compliance table at end.

## 7. Build & Deployment Security Report

Findings per check. Compliance table at end.

## 8. Findings Summary

All findings grouped by severity:

### P0 — Critical

| ID | File | Finding |
|----|------|---------|

### P1 — High

| ID | File | Finding |
|----|------|---------|

### P2 — Moderate

| ID | File | Finding |
|----|------|---------|

## 9. Transitional Violations

Accepted risks with documented rationale and remediation plan.

## 10. Scoring Breakdown

| Dimension                  | Raw Score | Weight | Weighted Score |
|----------------------------|-----------|--------|----------------|
| XSS                        |           | 25%    |                |
| Sensitive Data Exposure    |           | 25%    |                |
| Dependency Vulnerabilities |           | 20%    |                |
| Input Validation           |           | 20%    |                |
| Build & Deployment         |           | 10%    |                |

```text
Total Score: X.X / 10
```

## 11. Score Improvement Summary

Compare against the previous report from `docs/raw/report/security/archive/` (highest timestamp). If no previous report exists, state "Baseline — no prior report to compare."

```text
Previous Report: {filename}
Previous Score:  X.X / 10
Current Score:   Y.Y / 10
Change:          +N.N / −N.N / No change
```

| Dimension                  | Previous | Current | Change |
|----------------------------|----------|---------|--------|
| XSS                        | X        | Y       | +N     |
| Sensitive Data Exposure    | X        | Y       | +N     |
| Dependency Vulnerabilities | X        | Y       | +N     |
| Input Validation           | X        | Y       | +N     |
| Build & Deployment         | X        | Y       | +N     |

List resolved findings from previous report. List new findings not in previous report.

## 12. Final Verdict

```text
{Assessment} ({Score}/10)
```

Provide a concise security health summary.

## 13. Audit Traceability

| Reference       | Location                                                          |
|-----------------|-------------------------------------------------------------------|
| Source          | `src/main/**`, `src/preload/**`, `src/renderer/**`                |
| Dependencies    | `package.json`, `package-lock.json`                               |
| Build Config    | `vite.config.ts`                                                  |
| OWASP Reference | OWASP Top 10 (external)                                           |
| Audit Report    | `docs/raw/report/security/latest/security-audit-{timestamp}.md`   |
| Previous Report | `docs/raw/report/security/archive/{previous-filename}`            |

---

# Report Rotation

Before writing the new report, rotate the previous report:

```text
mv docs/raw/report/security/latest/* docs/raw/report/security/archive/
mkdir -p docs/raw/report/security/latest
```

---

# Output Location

```text
docs/raw/report/security/latest/security-audit-{timestamp}.md
```

Timestamp format: `YYYY-MM-DD-HHMM`

---

# Invariant Authority

When checking compliance:

- OWASP Top 10 and CWE are external references for severity calibration
- Do NOT flag React's built-in escaping as insufficient — XSS findings must demonstrate actual injection paths
- Dependency findings should cross-reference with build audit to avoid duplication
- Flagging a pattern as P0 requires demonstrating a realistic exploit path, not theoretical risk
