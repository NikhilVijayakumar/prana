# Prana Build System — Technical Realization

**Version:** 2.0.0
**Feature Spec:** docs/raw/features/prana-build-system.md
**Architecture Ref:** docs/raw/external-context/astra.md

---

## 1. Overview

The Prana Build System is a standalone CLI tooling concern that operates entirely outside the Electron runtime. It is invoked by application developers after their application's own build tooling (npm/vite/webpack/electron-builder) has completed. It produces a validated, hashed, self-contained distributable archive and publishes it to a configured distribution provider.

Because the Build System runs as a Node.js CLI process — not inside the Electron renderer or main process of a running Prana application — Astra's MVVM boilerplate patterns (IpcService, useDataState, AppStateHandler, AppStateProvider) do not apply and are explicitly out of scope. The Build System is not a feature module within the Prana Electron application. It is pre-deployment tooling that produces inputs consumed by the Prana Runtime.

This document records the technical realization of the Build System's five-stage pipeline, its provider adapter model, its manifest and artifact contracts, and its error and rollback behaviors, all derived strictly from the L1 (Astra architecture) and L2 (feature spec) sources.

---

## 2. Feature Summary

The Build System is a manifest-driven packaging pipeline with five ordered stages:

| Stage | Name | Input | Output |
|-------|------|-------|--------|
| 1 | Build | Application source | Build output directory (e.g. dist/) — not owned by Build System |
| 2 | Validation | Build output + manifest file | Pass/fail decision; blocks all downstream stages on failure |
| 3 | Package | Validated build output + manifest | Self-contained archive (e.g. app.zip) |
| 4 | Hash Generation | Package archive | SHA-256 digest file (.sha256) + buildHash embedded in artifact metadata |
| 5 | Publication | Package + hash + artifact metadata | Published artifact + manifest accessible via provider |

The pipeline is invokable as individual CLI sub-commands (validate, package, publish) or as a single combined release command. Stage 1 is owned by the application's own build tooling; the Build System consumes Stage 1's output and owns Stages 2–5.

---

## 3. Architecture Mapping

### CLI-Only Scope

The Build System is a standalone Node.js CLI tool. It does not run inside the Electron process tree of the Prana application. As a result:

- Astra's `IpcService`, `useDataState`, `AppStateHandler`, and `AppStateProvider` do not apply. These are Electron renderer patterns for runtime feature modules.
- The Build System does not have a renderer process, a ViewModel layer, a repository layer in the Astra sense, or any React component tree.
- Astra's architectural invariants that govern build determinism and dependency safety (Deterministic Build, Dependency Safety) do apply, because the Build System is itself a Node.js package that must produce reproducible output and maintain auditable dependencies.

### Applicable Astra Invariants

| Astra Invariant | Applicability to Build System | Rationale |
|-----------------|------------------------------|-----------|
| Deterministic Build | Applies | Build output must be identical from identical source; no timestamps or random IDs in package contents; lockfile committed |
| Dependency Safety | Applies | CLI dependencies must be auditable, version-pinned, actively maintained, MIT/Apache/BSD licensed |
| MVVM Separation | Does not apply | No renderer, no React, no ViewModel |
| Repository Isolation (IpcService) | Does not apply | No Electron IPC surface |
| Public API Stability | Does not apply | No Astra public API consumed |
| Runtime Boundary | Informational | Build System may import Node.js APIs (fs, path, crypto) freely — this is appropriate for a Node.js CLI, not a violation |

Deterministic Build risk: the Astra Deterministic Build invariant requires no timestamps or random IDs in build output. The hash pipeline MUST use only deterministic inputs — file content, manifest fields, and a canonical serialization order. `Date.now()`, `Math.random()`, or any wall-clock value MUST NOT be included in the hash computation. The `generatedAt` field in artifact metadata is a publication timestamp (not part of the hash input) — its value does not affect the package hash.

### Astra Boilerplate Consumed

None. The Build System does not import from `'astra'`. All processing logic is Prana-owned Node.js code.

---

## 4. Main Process Design

### 4.1 Service Architecture

Although the Build System is not an Electron main process service, the term "main process" is used here to mean the Node.js execution context of the CLI tool itself.

The Build System is composed of the following logical service responsibilities, each owned by Prana:

**ValidationService**
Accepts the build output directory path and the manifest file. Executes all validation rules in order. Returns a structured pass/fail result with per-rule failure details. Does not modify any files. Validation is a pure read-only operation.

Validation rules realized:
- Manifest presence: manifest file must exist at the declared path.
- Required fields: appId, version, runtimeVersion, entryPoint must be present and non-empty.
- Runtime compatibility: runtimeVersion must match a supported runtime version drawn from the runtime service registry contract. The Build System does not infer or default a version.
- Entry point resolution: entryPoint must reference a file that exists within the build output directory.
- Service identifier recognition: each entry in requiredServices must be a recognized runtime service identifier (storage, documents, identity, events, or other values defined by the runtime service registry contract).

Any single validation failure blocks all downstream stages. The ValidationService returns the full list of failures, not just the first.

**PackagingService**
Accepts validated build output directory and manifest. Assembles the canonical package layout:

```
app.zip
├── manifest.json  (at root)
├── build/         (all build output files)
└── assets/        (if present)
```

Enforces package invariants:
- manifest.json present at root
- All build output files included
- No external path references
- No runtime configuration, credential files, provider-specific settings, or machine-specific values

The PackagingService does not run if ValidationService has not passed.

**HashService**
Accepts the package archive path. Computes a SHA-256 digest over the complete package archive contents. Produces two outputs from the same digest value:
- A standalone hash digest file (app.zip.sha256) as the standalone verification artifact.
- The `buildHash` field value for inclusion in ArtifactMetadata, identical in value to the digest file.

The hash covers the entire archive. The package must not be modified after hashing.

**ArtifactMetadataService**
Constructs the ArtifactMetadata record:
- appId: from manifest
- version: from manifest
- buildHash: SHA-256 digest from HashService
- runtimeVersion: from manifest
- downloadUrl: populated by the provider after publishArtifact completes
- generatedAt: UTC timestamp of package creation

ArtifactMetadata must not contain: runtime configuration values, credential references, provider-specific settings, or environment-specific paths.

**PublicationOrchestrator**
Coordinates Stage 5. Receives the package archive, hash, and artifact metadata. Executes the two-step publication sequence:
1. publishArtifact — transmits the package archive and hash to the configured provider.
2. publishManifest — transmits the artifact metadata to the configured provider.

Rollback behavior: If publishManifest fails after publishArtifact succeeds, the orchestrator MUST attempt rollback via unpublishArtifact. If rollback also fails, both failures must be reported with full status of each operation. A partially published state (artifact present, manifest absent) is not an acceptable terminal state.

**ProviderRegistry**
Loads the configured provider from external configuration (e.g. provider: "google-drive"). Instantiates the correct IDistributionProvider adapter. The Build System does not select the provider — it reads the provider identifier from configuration and delegates all provider-specific behavior to the adapter.

### 4.2 IPC Channel Contract

N/A. The Build System is a standalone Node.js CLI tool. It does not run inside the Electron application's process tree and therefore has no IPC surface. There are no ipcMain handlers, no IpcService invocations, and no ServerResponse shapes in this context. IPC is a runtime concern; the Build System is a pre-deployment tooling concern.

### 4.3 SQLite Schema

N/A. The Build System does not maintain runtime state in SQLite. It is a stateless pipeline — it reads inputs from the filesystem, processes them, and writes outputs to the filesystem and to the configured distribution provider. No persistent runtime state is required. SQLite is a Prana Runtime concern; the Build System does not interact with the Prana Runtime's database.

### 4.4 Startup and Teardown

The Build System is invoked as a CLI command. Startup and teardown are implicit in the Node.js process lifecycle.

**CLI entry points and their lifecycle:**

`prana-build validate`
- Startup: load configuration, instantiate ValidationService.
- Execute: run all validation rules against the declared build output directory and manifest.
- Teardown: exit 0 on pass; exit with non-zero code and validation failure details on any rule failure.

`prana-build package`
- Startup: load configuration, instantiate ValidationService and PackagingService.
- Execute: validate, then package. Blocked if validation fails.
- Teardown: exit 0 on success; exit non-zero on validation failure or packaging error.

`prana-build publish`
- Startup: load configuration, instantiate PublicationOrchestrator and ProviderRegistry.
- Execute: transmit package, hash, and metadata to provider. Execute two-step publication sequence with rollback on partial failure.
- Teardown: exit 0 on full publication success; exit non-zero on failure, with full status of each sub-operation reported.

`prana-build release` (combined command)
- Startup: load configuration, instantiate all services.
- Execute: validate → package → hash → publish, in strict order. Any stage failure stops the pipeline.
- Teardown: exit 0 on successful end-to-end release; exit non-zero at the first failed stage with the stage name and failure details reported.

**Configuration loading** occurs at startup of every command. The external configuration file (e.g. prana-build.json or equivalent) declares the provider identifier. Provider-specific configuration is handled by the provider adapter, not the Build System.

---

## 5. Renderer Design (Astra MVVM)

N/A. The Build System is a standalone Node.js CLI tool that runs outside the Electron application entirely. It has no renderer process, no React component tree, no ViewModel hooks, no AppStateHandler, and no AppStateProvider. Astra's MVVM patterns (useDataState, IpcService, AppStateHandler, AppStateProvider) are Electron renderer patterns for runtime feature modules and do not apply to pre-deployment tooling.

There is no renderer design for the Prana Build System.

---

## 6. Responsibility Realization Matrix

| L2 Responsibility | Realized By | Notes |
|-------------------|-------------|-------|
| Runtime compatibility validation | ValidationService — runtimeVersion rule | Must match supported runtime version; no defaulting |
| Manifest presence and structure validation | ValidationService — manifest presence + required fields rules | appId, version, runtimeVersion, entryPoint must be present and non-empty |
| Entry point existence validation | ValidationService — entry point resolution rule | File must exist in build output directory |
| Service dependency validation | ValidationService — service identifier recognition rule | Each requiredServices entry must be a recognized runtime service identifier |
| Blocking packaging on validation failure | ValidationService return contract + PackagingService precondition | Packaging MUST NOT proceed on any validation failure; process exits with validation error |
| Manifest generation | ArtifactMetadataService (metadata) + PackagingService (embeds manifest.json in archive) | Manifest is authored by the application; Build System validates and packages it |
| Package creation | PackagingService | Assembles canonical layout; enforces all package invariants |
| Package self-containment enforcement | PackagingService invariant checks | No external paths, runtime config, credentials, provider settings, machine-specific values |
| SHA-256 hash generation | HashService | Covers complete package archive; produces standalone .sha256 file and buildHash for ArtifactMetadata |
| Artifact metadata construction | ArtifactMetadataService | Constructs full ArtifactMetadata contract; downloadUrl populated post-publishArtifact |
| Publication to distribution provider | PublicationOrchestrator + IDistributionProvider adapter | Two-step sequence: publishArtifact then publishManifest |
| Publication atomicity | PublicationOrchestrator rollback behavior | Artifact-without-manifest state MUST be rolled back via unpublishArtifact |
| Provider independence | ProviderRegistry + IDistributionProvider contract | Provider injected via configuration; Build System has no provider-specific logic |
| Provider credential isolation | IDistributionProvider adapter (provider-internal) | Build System does not read, store, or manage credentials |
| CLI invocation surface | CLI entry points: validate, package, publish, release | Each command maps to an ordered subset of the five-stage pipeline |
| External configuration support | Configuration loader at CLI startup | Declares provider identifier; provider-specific config handled by adapter |
| Cross-platform portability | PackagingService invariants + no machine-specific values | Packages must work on Windows, Linux, macOS |

---

## 7. Workflow Realization

### Workflow: prana-build validate

1. Load configuration.
2. Locate manifest file at declared path. Failure: manifest not found → validation error, exit non-zero.
3. Parse manifest structure. Failure: malformed structure → validation error, exit non-zero.
4. Check required fields (appId, version, runtimeVersion, entryPoint) are present and non-empty. Failure on any missing/empty field → validation error, exit non-zero.
5. Check runtimeVersion against supported runtime version list. Failure if unsupported → validation error, exit non-zero.
6. Resolve entryPoint against build output directory. Failure if file does not exist → validation error, exit non-zero.
7. Check each requiredServices entry against recognized runtime service identifier list. Failure on any unrecognized identifier → validation error, exit non-zero.
8. All rules pass → exit 0.

### Workflow: prana-build package

1. Execute full validate workflow (steps 1–8 above). Any failure → exit non-zero, packaging does not begin.
2. Assemble package archive with canonical layout: manifest.json at root, build/ directory, assets/ directory (if present).
3. Verify package invariants (no external paths, no runtime config, no credentials, no provider settings, no machine-specific values). Failure on any invariant violation → packaging error, exit non-zero.
4. Write archive to output path (e.g. app.zip). Success → exit 0.

### Workflow: prana-build publish

1. Load configuration and instantiate ProviderRegistry.
2. Resolve provider adapter from configuration.
3. Execute HashService over the package archive if not already computed. Compute SHA-256 digest.
4. Construct ArtifactMetadata (without downloadUrl — populated by provider after step 5).
5. Call provider.publishArtifact(artifact). On failure → report error, exit non-zero. No rollback needed (nothing was published yet).
6. Receive downloadUrl from provider response. Update ArtifactMetadata.downloadUrl.
7. Call provider.publishManifest(metadata). On success → exit 0.
8. If publishManifest fails → attempt provider.unpublishArtifact(appId, version) for rollback.
   - Rollback succeeds → report publishManifest failure, exit non-zero.
   - Rollback fails → report both publishManifest failure and unpublishArtifact failure with full status of each, exit non-zero.

### Workflow: prana-build release (combined)

1. Execute validate workflow. Any failure → exit non-zero, pipeline stops.
2. Execute package workflow. Any failure → exit non-zero, pipeline stops.
3. Execute HashService. Any failure → exit non-zero, pipeline stops.
4. Execute publish workflow (steps 1–8 of publish workflow above).

### Workflow: Runtime installer version discovery

The runtime installer calls provider.getLatestVersion(appId) to discover the latest published version. This is a provider adapter operation, not a Build System pipeline stage. The Build System defines the contract; the provider implements it.

### Workflow: Runtime installer artifact resolution

The runtime installer calls provider.getArtifactMetadata(appId, version) to retrieve the full artifact metadata including downloadUrl and buildHash, then downloads the package archive and verifies its SHA-256 digest against buildHash before installation. This is a consumer workflow of the Build System's outputs, not a Build System pipeline stage.

---

## 8. State Realization

### 8.1 Main Process / CLI States

The Build System is a stateless pipeline invoked per CLI command. Process state is implicit in the pipeline stage and is not persisted between invocations.

| CLI State | Description | Terminal |
|-----------|-------------|----------|
| IDLE | Process not running | — |
| VALIDATING | ValidationService executing all rules | No |
| VALIDATION_FAILED | One or more validation rules failed; pipeline blocked | Yes (exit non-zero) |
| PACKAGING | PackagingService assembling archive | No |
| PACKAGING_FAILED | Archive assembly failed or invariant violated | Yes (exit non-zero) |
| HASHING | HashService computing SHA-256 digest | No |
| HASHING_FAILED | Digest computation failed | Yes (exit non-zero) |
| PUBLISHING_ARTIFACT | provider.publishArtifact executing | No |
| PUBLISHING_ARTIFACT_FAILED | publishArtifact failed | Yes (exit non-zero) |
| PUBLISHING_MANIFEST | provider.publishManifest executing | No |
| PUBLISHING_MANIFEST_FAILED | publishManifest failed; rollback initiated | No (transitions to ROLLING_BACK) |
| ROLLING_BACK | provider.unpublishArtifact executing | No |
| ROLLBACK_SUCCEEDED | Artifact removed; clean failure reported | Yes (exit non-zero) |
| ROLLBACK_FAILED | Both publishManifest and unpublishArtifact failed; both reported | Yes (exit non-zero) |
| RELEASED | All stages completed successfully | Yes (exit 0) |

### 8.2 Renderer AppState Mapping

N/A. The Build System has no renderer process. AppState, StateType, and AppStateHandler are not applicable.

---

## 9. Boilerplate Application Mapping

| Astra Boilerplate | Applied to Build System? | Explanation |
|-------------------|--------------------------|-------------|
| IpcService | No | No Electron IPC surface; Build System is a Node.js CLI, not an Electron renderer feature module |
| ServerResponse | No | No IPC response normalization needed; CLI operates on direct Node.js return values and process exit codes |
| useDataState | No | No React or ViewModel layer; no INIT→LOADING→COMPLETED lifecycle management |
| AppStateHandler | No | No React renderer; no UI state routing |
| AppStateProvider | No | No renderer root; not applicable |
| Deterministic Build invariant | Yes | Build System must produce identical package output from identical input; no timestamps or random IDs in package contents; lockfile committed for CLI tool dependencies |
| Dependency Safety invariant | Yes | CLI tool dependencies must be auditable, minimal, version-pinned, actively maintained, MIT/Apache/BSD licensed |

Prana does not consume any Astra boilerplate exports for the Build System. All Build System logic is Prana-owned Node.js code.

---

## 10. Permission Realization

The Build System operates as a Node.js CLI process. Runtime permissions are Node.js process-level, not Electron renderer permissions.

| Operation | Permission Required | Owner |
|-----------|--------------------|---------| 
| Read build output directory | Filesystem read access at the build output path | Executing user / CI environment |
| Read manifest file | Filesystem read access at the manifest path | Executing user / CI environment |
| Write package archive | Filesystem write access at the output path | Executing user / CI environment |
| Write hash digest file | Filesystem write access at the output path | Executing user / CI environment |
| Publish to distribution provider | Provider adapter authentication (provider-internal) | Provider adapter; credentials not held by Build System |
| Read configuration file | Filesystem read access at the configuration file path | Executing user / CI environment |

The Build System does not request, store, or manage credentials. All provider authentication is provider-internal.

---

## 11. Validation Realization

All validation is performed by ValidationService in Stage 2. Validation is all-or-nothing: any failure blocks the pipeline.

| Validation Rule | Input | Failure Condition | Failure Behavior |
|-----------------|-------|-------------------|------------------|
| Manifest presence | Build output path + manifest path | Manifest file does not exist at declared path | Validation error; pipeline blocked; exit non-zero |
| Manifest structure | Manifest file contents | Manifest cannot be parsed as valid JSON with expected shape | Validation error; pipeline blocked; exit non-zero |
| Required field: appId | Manifest | Missing or empty | Validation error; pipeline blocked; exit non-zero |
| Required field: version | Manifest | Missing or empty | Validation error; pipeline blocked; exit non-zero |
| Required field: runtimeVersion | Manifest | Missing or empty | Validation error; pipeline blocked; exit non-zero |
| Required field: entryPoint | Manifest | Missing or empty | Validation error; pipeline blocked; exit non-zero |
| Runtime compatibility | Manifest.runtimeVersion | Does not match a supported runtime version; no defaulting or inference | Validation error; pipeline blocked; exit non-zero |
| Entry point resolution | Manifest.entryPoint + build output directory | File referenced by entryPoint does not exist in build output directory | Validation error; pipeline blocked; exit non-zero |
| Service identifier recognition | Manifest.requiredServices | Any entry is not a recognized runtime service identifier | Validation error; pipeline blocked; exit non-zero |
| Plugin manifest validation (if plugins declared) | Manifest.plugins (optional array) | If `plugins` is present, each entry MUST declare `pluginId` and `version`. Unrecognized or structurally invalid plugin entries produce a validation error; pipeline blocked; exit non-zero. If `plugins` is absent, this rule is skipped. |
| Package invariants (post-assembly) | Assembled archive | External path references, runtime config, credentials, provider settings, or machine-specific values detected | Packaging error; archive not written; exit non-zero |

Package invariant enforcement mechanism: the PackagingService scans each file being added to the archive against a detection policy before inclusion. Three categories of detection are applied: (1) **Credential file detection** — files matching credential filename patterns (environment variable files, certificate and private key files, secrets files) are detected by filename convention matching against a configurable blocklist; any credential file match MUST halt packaging with a validation error. (2) **Machine-specific path detection** — files containing absolute path strings referencing the current machine's home directory or temp directory are flagged; these are logged but do not halt packaging. (3) **Provider-specific config detection** — files matching known provider configuration file name patterns are flagged; these are logged but do not halt packaging. The specific filename patterns in the blocklist are implementation-level details defined in code configuration, not in this document. The architectural rule is: credential-category matches halt packaging; non-credential matches are operator-notified warnings.

ValidationService returns the complete list of all failures, not only the first failure encountered.

---

## 12. Error Realization

| L2 Failure Scenario | Stage | Error Behavior | Reported To |
|--------------------|-------|----------------|-------------|
| Manifest not found | 2: Validation | Validation error; pipeline blocked; no artifact created | CLI stderr + exit non-zero |
| Required field missing or empty | 2: Validation | Validation error with field name; pipeline blocked | CLI stderr + exit non-zero |
| Unsupported runtimeVersion | 2: Validation | Validation error with declared version; pipeline blocked | CLI stderr + exit non-zero |
| Entry point file missing from build output | 2: Validation | Validation error with declared entryPoint; pipeline blocked | CLI stderr + exit non-zero |
| Unrecognized service identifier | 2: Validation | Validation error with identifier name; pipeline blocked | CLI stderr + exit non-zero |
| Package invariant violated | 3: Package | Packaging error; archive not written | CLI stderr + exit non-zero |
| Filesystem write failure (archive or hash file) | 3–4 | I/O error; pipeline stopped | CLI stderr + exit non-zero |
| Hash computation failure | 4: Hash | Hashing error; publication blocked | CLI stderr + exit non-zero |
| publishArtifact failure | 5: Publication | Publication error; no partial state; pipeline stopped | CLI stderr + exit non-zero |
| publishManifest failure after publishArtifact success | 5: Publication | Rollback initiated via unpublishArtifact | CLI stderr + exit non-zero |
| Rollback (unpublishArtifact) failure | 5: Publication (rollback) | Both publishManifest failure and rollback failure reported with full status of each | CLI stderr + exit non-zero |
| Provider not found in configuration | Startup | Configuration error; no stage executes | CLI stderr + exit non-zero |
| Provider does not implement full IDistributionProvider contract | Startup / publication | Provider contract violation error; publication blocked | CLI stderr + exit non-zero |

The Build System must never leave a partially published state without reporting it. An artifact published without a corresponding manifest is always a failure state, not a success state.

---

## 13. Integration Realization

### 13.1 Internal Prana Integrations

**Runtime Service Registry**
The ValidationService must consult the runtime service registry contract to determine the list of recognized runtime service identifiers and the list of supported runtimeVersion values. The exact mechanism (embedded constant list, imported registry module, or configuration file) is not specified in L2 and constitutes an open question (see Section 17).

**Prana Runtime (consumer)**
The Build System does not integrate with the running Prana Runtime. The runtime is a consumer of the Build System's outputs: it reads artifact metadata via the distribution provider to discover, download, and verify applications. This is a one-way dependency: Build System produces, Runtime consumes.

### 13.2 IPC Surface

N/A. The Build System is a standalone CLI tool with no Electron IPC surface. It does not expose ipcMain handlers, does not use IpcService, and does not return ServerResponse shapes.

### 13.3 External Systems

**Distribution Provider (IDistributionProvider)**
The Build System integrates with the configured distribution provider through the IDistributionProvider adapter contract. All provider-specific communication (authentication, upload protocols, URL generation) is encapsulated in the adapter. The Build System only calls the five defined operations: publishArtifact, unpublishArtifact, publishManifest, getLatestVersion, getArtifactMetadata.

The initial supported provider is Google Drive. Future providers (S3, MinIO, Azure Blob, GitHub Releases, Local Storage) may be added by implementing the same IDistributionProvider contract.

**Application Build Tooling (upstream)**
The Build System consumes the output of the application's own build tooling (npm/vite/webpack/electron-builder). It does not invoke, configure, or control application build tooling. The integration point is the build output directory.

---

## 14. Ownership Mapping

### 14.1 Responsibility Ownership

| Responsibility | Owner |
|---------------|-------|
| ValidationService | Prana |
| PackagingService | Prana |
| HashService | Prana |
| ArtifactMetadataService | Prana |
| PublicationOrchestrator | Prana |
| ProviderRegistry | Prana |
| IDistributionProvider contract definition | Prana |
| Google Drive provider adapter implementation | Prana |
| Future provider adapter implementations | Prana (or external tooling implementing the contract) |
| CLI entry points (validate, package, publish, release) | Prana |
| Configuration loader | Prana |
| Manifest specification (what fields are required, what values are valid) | Prana |
| Package specification (canonical layout, invariants) | Prana |
| Runtime compatibility rules (supported runtimeVersion values) | Prana |
| Runtime service registry contract (recognized service identifiers) | Prana |
| Application build tooling (npm/vite/webpack/electron-builder) | Application developer (not Prana) |
| Provider credentials and authentication | Provider adapter (not Build System) |
| Runtime installer behavior (download, verify, install) | Prana Runtime (not Build System) |

### 14.2 Astra vs Prana Ownership

| Concern | Astra Owns | Prana Owns |
|---------|------------|------------|
| IpcService (Electron IPC transport) | Yes — not applicable to Build System | Consumes in runtime feature modules; not applicable here |
| ServerResponse (IPC response shape) | Yes — not applicable to Build System | Used in runtime IPC handlers; not applicable here |
| useDataState, AppStateHandler, AppStateProvider | Yes — not applicable to Build System | Consumed in renderer feature modules; not applicable here |
| Deterministic build rules | Defines invariant | Implements for Build System's own CLI package |
| Dependency safety rules | Defines invariant | Implements for Build System's own CLI package |
| All Build System pipeline logic | Not applicable | Prana owns entirely |
| IDistributionProvider contract | Not applicable | Prana owns |
| Manifest specification | Not applicable | Prana owns |
| Package specification | Not applicable | Prana owns |

---

## 15. Architecture Traceability Matrix

| Architectural Decision | L1 Source | Applied |
|-----------------------|-----------|---------|
| Astra MVVM patterns do not apply to CLI tools | L1: Architecture Patterns — MVVM, Feature Structure; L1: Boilerplate Code | Confirmed inapplicable; documented in Sections 3, 5, 9 |
| IpcService and ServerResponse not used by Build System | L1: Repository (ELECTRON) pattern; L1: Integration Contracts | Confirmed inapplicable; Build System has no IPC surface |
| Deterministic Build invariant applies | L1: Architectural Invariants — Deterministic Build | Build System must produce reproducible archives; no timestamps or random IDs in package contents; lockfile committed |
| Dependency Safety invariant applies | L1: Architectural Invariants — Dependency Safety | CLI dependencies must be auditable, version-pinned, maintained, license-compliant |
| Runtime Boundary — Build System may use Node.js APIs | L1: Runtime Boundary invariant (applies to Astra core; Build System is consumer, not Astra core) | Build System is a Node.js tool and may import Node.js filesystem and crypto APIs freely |
| Astra does not own Electron runtime (ipcMain, SQLite, BrowserWindow) | L1: Astra does not own Electron runtime | Build System is further outside Astra's scope than the runtime itself; all Build System code is Prana-owned |

---

## 16. Feature Traceability Matrix

| L2 Section | L2 Requirement | Realized In |
|------------|---------------|-------------|
| §4 Core Responsibilities — Validation | Validation MUST block packaging on failure; invalid artifact MUST NOT be packaged | Section 4.1 ValidationService; Section 11 Validation Realization; Section 12 Error Realization |
| §4 Core Responsibilities — Manifest Generation | Generate versioned, runtime-compatible manifest | Section 4.1 ArtifactMetadataService; Section 6 (manifest is application-authored; Build System validates and packages it) |
| §4 Core Responsibilities — Package Creation | Self-contained archive; MUST NOT reference external paths or machine-specific values | Section 4.1 PackagingService; Section 11 package invariant validation |
| §4 Core Responsibilities — Hash Generation | SHA-256; covers complete package; verification anchor for runtime installer | Section 4.1 HashService; Section 7 Workflow Realization |
| §4 Core Responsibilities — Publication | Transmit via provider adapter; provider injected via configuration | Section 4.1 PublicationOrchestrator + ProviderRegistry; Section 13.3 |
| §5 Build Lifecycle — Stage 1 | Build System does not own Stage 1; consumes output | Section 2 Feature Summary; Section 4.1 note |
| §5 Build Lifecycle — Stage 2 | Validation with enumerated rules | Section 4.1 ValidationService; Section 11 |
| §5 Build Lifecycle — Stage 3 | Package invariants enumerated | Section 4.1 PackagingService; Section 8 Package Specification |
| §5 Build Lifecycle — Stage 4 | SHA-256; both digest file and buildHash field; same value | Section 4.1 HashService |
| §5 Build Lifecycle — Stage 5 | Two-step publication; rollback on partial failure | Section 4.1 PublicationOrchestrator; Section 7 publish workflow; Section 12 |
| §6 Application Manifest | appId, name, version, runtimeVersion, entryPoint, requiredServices | Section 11 Validation Realization |
| §7 Manifest Validation — Required Fields | appId, version, runtimeVersion, entryPoint must be present and non-empty | Section 11 |
| §7 Manifest Validation — Runtime Compatibility | runtimeVersion must match supported version; no defaulting | Section 11 |
| §7 Manifest Validation — Entry Point | File must exist in build output | Section 11 |
| §7 Manifest Validation — Service Requirements | Each requiredServices entry must be recognized identifier | Section 11 |
| §8 Package Specification — Layout | manifest.json at root, build/, assets/ | Section 4.1 PackagingService canonical layout |
| §8 Package Specification — Invariants | Seven enumerated invariants | Section 11 package invariant validation |
| §8 Package Integrity | Hash computed before publication; package and hash inseparable | Section 4.1 HashService + PublicationOrchestrator precondition |
| §9 Artifact Metadata | Contract fields and restrictions | Section 4.1 ArtifactMetadataService |
| §10 Distribution Provider Model | IDistributionProvider contract; five operations required | Section 4.1 ProviderRegistry; Section 13.3 |
| §10 Provider Isolation | No credentials, no authentication, no provider-specific logic in Build System | Section 4.1 ProviderRegistry; Section 10 Permission Realization |
| §11 Supported Providers | Google Drive initial; future providers | Section 13.3 |
| §12 Build/Runtime Boundary | Build System must not inject runtime configuration | Section 3 Architecture Mapping; Section 4.2 (IPC N/A); Section 4.3 (SQLite N/A) |
| §13 Packaging CLI | validate, package, publish, release sub-commands | Section 4.4 Startup and Teardown |
| §14 Configuration | External configuration; provider-specific config in adapter | Section 4.1 ProviderRegistry; Section 4.4 |
| §15 Security Model | Validate artifacts; generate hashes; verify manifest; prevent invalid packaging; no credentials | Section 11; Section 12; Section 10 |
| §16 Design Invariants | Build Output First; Provider Independence; Runtime Independence; Manifest Driven; Portable Artifacts; Publication Atomicity | Section 4.1 (invariants per service); Section 7 (workflows); Section 12 (error realization) |
| §16 Publication Atomicity | Both artifact and manifest present or neither | Section 7 publish workflow rollback; Section 12 |

---

## 17. Open Questions

| ID | Question | L2 Source | Impact |
|----|----------|-----------|--------|
| OQ-1 | RESOLVED. The ValidationService accesses recognized runtime service identifiers and supported runtimeVersion values via a bundled registry manifest file included with the Prana Build System package at installation time. This file (`prana-registry.json`) is updated with each Prana runtime release. It contains: `supportedRuntimeVersions` (list of valid semver strings) and `recognizedServices` (list of valid service identifier strings). The ValidationService reads this file from the Build System's installation directory at validation time. If the registry manifest is absent or malformed, validation halts with: 'Build System registry manifest (prana-registry.json) is missing or corrupted — reinstall the Prana Build System.' | §7 Runtime Compatibility | Resolved. |
| OQ-2 | RESOLVED. See OQ-1 — both supported runtimeVersion values and recognized service identifiers are sourced from the same bundled `prana-registry.json` registry manifest file. | §7 Service Requirements | Resolved. |
| OQ-3 | RESOLVED. The `downloadUrl` population mechanism: `publishArtifact` is a two-part operation at the provider level. The provider adapter uploads the artifact and then updates the artifact metadata record with the `downloadUrl`. From the Build System's perspective, `publishArtifact(artifact: BuildArtifact): Promise<PublishResult>` returns a `PublishResult` containing the `downloadUrl`. The L2 provider contract interface declaration of `Promise<void>` is a simplification — the actual return type is `Promise<PublishResult>` where `PublishResult` contains at minimum `{ downloadUrl: string }`. The `downloadUrl` is then embedded in the artifact metadata before `publishManifest` is called. | §9 Artifact Metadata; §10 Provider Contract | Resolved. |
| OQ-4 | What is the output directory and naming convention for the package archive and hash file? L2 uses "app.zip" and "app.zip.sha256" as examples. Is there a defined naming convention based on appId and version (e.g. {appId}-{version}.zip), or is the output path configurable? | §5 Stage 3, Stage 4 | Affects how the runtime installer discovers and names artifacts. |
| OQ-5 | What is the configuration file format and location for prana-build? L2 shows an example JSON fragment with a provider field but does not specify the file name, search path, or whether it is embedded in package.json. | §14 Configuration | Required to implement the configuration loader. |
| OQ-6 | Does the prana-build release command require a pre-existing package archive, or does it always re-run package and hash from source? L2 describes release as executing validate → package → hash → publish in sequence, implying it always starts from source, but this is not explicitly stated. | §13 Packaging CLI | Determines whether the release command is always a full rebuild or can resume from an existing artifact. |
| OQ-7 | Is the name field in the application manifest (shown in the L2 example as "Prabandha") a required field for validation, or is it optional metadata? L2's Required Fields section lists appId, version, runtimeVersion, entryPoint but does not include name. | §6 Example Manifest; §7 Required Fields | Determines whether a missing name field causes a validation failure. |
