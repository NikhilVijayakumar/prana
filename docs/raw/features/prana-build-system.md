# 📦 Feature: Prana Build System

**Version:** 2.0.0
**Status:** Core / Tooling
**Pattern:** Manifest-Driven Packaging Pipeline
**Capability:** Provides standardized packaging, validation, manifest generation, artifact creation, and publication workflows for applications targeting the Prana Runtime.

---

## 1. Tactical Purpose

The Prana Build System standardizes how applications are packaged and distributed within the Prana ecosystem.

It ensures:

* runtime compatibility validation
* manifest generation
* package consistency
* artifact integrity
* provider-independent distribution

The Build System operates after application compilation.

It does not replace:

```text
npm build
vite build
webpack build
electron-builder
```

Instead it consumes their output.

---

## 2. Design Philosophy

### Build Is Separate From Runtime

Prana Runtime executes applications.

Prana Build System packages applications.

---

### Provider Independence

The Build System must not depend on:

```text
Google Drive
S3
MinIO
Azure Blob
GitHub Releases
```

Storage providers are adapters.

---

### Manifest-Driven Packaging

Applications are packaged with:

```text
Manifest
Declared Service Requirements
Compatibility Metadata
Integrity Hashes
```

allowing runtime validation before installation.

---

## 3. Architectural Position

```text
Application Source
       ↓

npm run build

       ↓

Build Output

       ↓

Prana Build System

       ↓

Distribution Provider

       ↓

Storage Platform
```

---

## 4. Core Responsibilities

### Validation

Verify that build output and manifest satisfy all requirements before packaging proceeds.

Validation MUST block packaging on any failure. An invalid artifact MUST NOT be packaged or published.

---

### Manifest Generation

Generate a versioned, runtime-compatible manifest from declared application metadata.

The manifest is the contract between the build artifact and the runtime installer. It declares compatibility requirements — it does not contain runtime configuration or environment-specific values.

---

### Package Creation

Assemble validated build output, manifest, and integrity metadata into a distributable archive.

The package MUST be self-contained. It MUST NOT reference external paths, machine-specific values, or provider credentials.

---

### Hash Generation

Produce a cryptographic integrity hash covering the complete package contents.

The hash is the verification anchor used by the runtime installer to confirm the package has not been modified in transit.

---

### Publication

Transmit the package and its metadata to a configured distribution provider via the provider adapter contract.

The Build System does not choose the provider — the provider is injected via configuration.

---

## 5. Build Lifecycle

### Stage 1: Build

Application build executes using the application's own build tooling.

Input: Application source

Output: Build output directory (e.g. `dist/`)

The Build System does not execute or control this stage. It consumes its output.

---

### Stage 2: Validation

The Build System validates the build output and manifest before any packaging occurs.

Input: Build output directory + manifest file

Validates:

```text
Manifest presence and structure
Required manifest fields
Runtime version compatibility
Declared service dependencies
Artifact entry point exists
```

Failure behavior: Packaging MUST NOT proceed. The process exits with a validation error. No artifact is created.

---

### Stage 3: Package

Validated build output is assembled into a distributable archive.

Input: Validated build output + manifest

Output: Self-contained archive (e.g. `app.zip`)

The package MUST NOT contain:

```text
Runtime configuration
Credential files
Provider-specific settings
Machine-specific paths
```

---

### Stage 4: Hash Generation

A cryptographic integrity hash is computed over the complete package contents.

Input: Package archive

Algorithm: SHA-256

Output: Hash digest file (e.g. `app.zip.sha256`) and hash value embedded in artifact metadata as `buildHash`.

These are the same value — the hash file is the standalone verification artifact; `buildHash` in artifact metadata is the same digest for programmatic use by the runtime installer.

The hash MUST cover the entire package. It is the verification anchor used by the runtime installer.

**Hash generation failure:** if hash computation fails (e.g., I/O error reading the package archive), the build process MUST halt immediately. The package archive is retained on disk for diagnostic purposes but MUST NOT be published or used without a valid hash. The process exits with a hash generation error.

---

### Stage 5: Publication

The package and its metadata are transmitted to the configured distribution provider.

Input: Package archive + hash + artifact metadata

Output: Published artifact accessible via provider

Failure behavior: Publication failure MUST be reported. No partial publication state is acceptable — the artifact is either fully published or not published.

Publication executes as a two-step sequence: `publishArtifact` followed by `publishManifest`. If `publishManifest` fails after `publishArtifact` succeeds, the build system MUST attempt rollback via `unpublishArtifact`. If rollback fails, the failure MUST be reported with both operations' status. A partially published artifact without corresponding manifest MUST NOT be considered published.

**Double-failure rollback:** if `unpublishArtifact` also fails after `publishManifest` failure, the artifact is in an orphaned state: published to the provider with no corresponding manifest. This state MUST be reported with the status of both failed operations. The version is treated as unpublished from the system's perspective — it is not registered as available. Operator remediation is required to remove the orphaned artifact from the provider.

---

## 6. Application Manifest

Every Prana application must provide a manifest.

---

### Example Manifest

```json
{
  "appId": "prabandha",
  "name": "Prabandha",
  "version": "1.0.0",
  "runtimeVersion": "2.0.0",
  "entryPoint": "main.js",
  "requiredServices": [
    "storage",
    "documents",
    "identity"
  ]
}
```

---

## 7. Manifest Validation

Validation runs before packaging. Any failure MUST block the build process entirely.

### Required Fields

The following fields MUST be present and non-empty:

```text
appId
version
runtimeVersion
entryPoint
```

Missing or empty required fields MUST produce a validation error.

Fields that are present and non-empty but semantically invalid MUST also produce a validation error. Semantic validation rules: `version` and `runtimeVersion` MUST be valid semver strings. `appId` MUST match the pattern `[a-z0-9][a-z0-9-]*`. A field that passes the presence check but fails semantic validation MUST block packaging.

---

### Runtime Compatibility

`runtimeVersion` MUST match a supported runtime version.

Unsupported runtime versions MUST produce a validation error. The Build System does not infer or default a runtime version.

---

### Entry Point

`entryPoint` MUST reference a file that exists in the build output.

A missing or unresolvable entry point MUST produce a validation error.

---

### Service Requirements

Declared services in `requiredServices` MUST be recognized runtime service identifiers as defined by the runtime service registry contract.

Example valid values:

```text
storage
documents
identity
events
```

Unrecognized service identifiers MUST produce a validation error.

---

## 8. Package Specification

### Package Layout

```text
app.zip
│
├── manifest.json
├── build/
└── assets/
```

---

### Package Invariants

A valid package MUST:

```text
Contain manifest.json at root
Contain all build output files
Be self-contained — no external path references
Contain no runtime configuration
Contain no credential files
Contain no provider-specific settings
Contain no machine-specific values
```

A package that violates any invariant MUST NOT be published.

---

### Package Integrity

After creation, the package hash MUST be computed before publication.

The hash and the package travel together as an inseparable pair. A package without a corresponding hash MUST NOT be published.

---

## 9. Artifact Metadata

Generated during packaging. Published alongside the package.

The artifact metadata is the publication contract between the Build System and the distribution provider. It declares what was built, when, and what runtime version it targets.

The runtime installer uses artifact metadata to:

```text
Discover available versions
Verify runtime compatibility before download
Identify the correct package to download
Resolve the download URL for the package
```

---

### Contract

```json
{
  "appId": "prabandha",
  "version": "1.0.0",
  "buildHash": "abc123",
  "runtimeVersion": "2.0.0",
  "downloadUrl": "https://...",
  "generatedAt": "2026-06-23T12:00:00Z"
}
```

`buildHash` is the SHA-256 digest of the package archive. This is the same value as the standalone `.sha256` hash file produced in Stage 4.

`downloadUrl` is the resolvable URL for the package archive, populated by the provider after `publishArtifact` completes.

`generatedAt` is the UTC timestamp of package creation.

Artifact metadata MUST NOT contain:

```text
Runtime configuration values
Credential references
Provider-specific settings
Environment-specific paths
```

---

## 10. Distribution Provider Model

The Build System publishes through provider adapters. The Build System does not select the provider — the provider is injected via configuration.

---

### Provider Contract

```typescript
interface IDistributionProvider {

    publishArtifact(
        artifact: BuildArtifact
    ): Promise<void>;

    unpublishArtifact(
        appId: string,
        version: string
    ): Promise<void>;

    publishManifest(
        manifest: BuildManifest
    ): Promise<void>;

    getLatestVersion(
        appId: string
    ): Promise<string>;

    getArtifactMetadata(
        appId: string,
        version: string
    ): Promise<ArtifactMetadata>;

}
```

`publishArtifact` transmits the package archive and its hash.

`unpublishArtifact` removes a previously published artifact. Used for rollback when `publishManifest` fails.

`publishManifest` transmits the artifact metadata.

`getLatestVersion` enables version discovery by the runtime installer.

`getArtifactMetadata` returns the full artifact metadata for a specific version, including `downloadUrl` and `buildHash`. Used by the runtime installer to resolve the download URL and verify integrity before fetch.

All operations are required. A provider that does not implement all of them MUST NOT be used for publication.

---

### Provider Isolation

The Build System:

```text
Does not read provider credentials
Does not manage provider authentication
Does not depend on any specific provider implementation
```

Credentials and authentication are provider-internal concerns.

---

## 11. Supported Providers

### Google Drive Provider

Initial implementation.

Purpose:

```text
Publish
Download
Version Discovery
```

---

### Future Providers

```text
S3
MinIO
Azure Blob
GitHub Releases
Local Storage
```

---

## 12. Build/Runtime Boundary

The Build System must not inject runtime configuration.

The Build System must not package:

```text
Database Paths
Credential Files
Google Secrets
Provider Settings
```

---

### Runtime Responsibility

Runtime resolves:

```text
Storage Providers
Document Providers
Identity Providers
Configuration Sources
```

at application startup.

---

### Build Responsibility

Build defines only:

```text
Requirements
Compatibility
Metadata
```

---

## 13. Packaging CLI

Example workflow:

```text
npm run build

prana-build validate

prana-build package

prana-build publish
```

---

### Combined Command

```text
prana-build release
```

Executes:

```text
Validate
Package
Hash
Publish
```

---

## 14. Configuration

The Build System must support external configuration.

---

### Build System Configuration Contract

The Build System requires a configuration file (default: `prana-build.json` in the project root, overridable via `--config` flag).

**Required fields:**

```text
provider   — the distribution provider identifier (e.g. "google-drive")
```

**Optional fields:** none defined in the core Build System.

If the configuration file is absent or `provider` is missing, the Build System MUST halt with a configuration error before any build stage begins.

### Example

```json
{
  "provider": "google-drive"
}
```

---

### Provider-Specific Configuration

Handled by the provider.

Not by the Build System.

---

## 15. Security Model

The Build System must:

```text
Validate Artifacts
Generate Integrity Hashes
Verify Manifest Structure
Prevent Invalid Packaging
```

---

The Build System must not:

```text
Store Credentials
Store Runtime Secrets
Modify Runtime Configuration
```

---

## 16. Design Invariants

### Build Output First

The Build System consumes build output.

It does not replace application build tooling.

---

### Provider Independence

Distribution must be adapter-driven.

---

### Runtime Independence

Packages must not contain runtime-specific paths or machine-specific values.

---

### Manifest Driven

Runtime compatibility is declared through manifests.

---

### Portable Artifacts

Packages must remain portable across:

```text
Windows
Linux
macOS
```

---

### Publication Atomicity

A published artifact without a corresponding manifest is a partial state. The build system MUST ensure both are present or neither is present.

---

## 17. Ecosystem Position

Prana defines:

```text
Manifest Specification
Package Specification
Runtime Compatibility Rules
Distribution Provider Contract
```

---

External tooling may implement:

```text
Google Drive Publisher
S3 Publisher
MinIO Publisher
Azure Publisher
CI Publisher
```

using the same Build System contracts.

---

## 18. Completion Status

The Prana Build System is the standardized packaging and distribution framework for Prana applications.

It provides:

```text
Validation
Manifest Generation
Packaging
Hash Generation
Publication
```

while remaining independent of:

```text
Application Build Tools
Runtime Configuration
Distribution Providers
Platform-Specific Paths
```

and ensuring all packaged applications remain compatible with the Prana Runtime ecosystem.
