# 💾 Feature: Storage Architecture

**Version:** 2.0.0
**Status:** Stable / Core
**Capability:** Provides unified storage architecture and synchronization principles across Local, Vault, Document, and Sheet domains.

```text
                        ┌──────────────────────┐
                        │  Runtime Services    │
                        │  Applications        │
                        └──────────┬───────────┘
                                   │
                                   ▼

                      ┌─────────────────────────┐
                      │ SQLite Runtime Store    │
                      │ (Single Access Surface) │
                      └──────────┬──────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │              │               │               │
          ▼              ▼               ▼               ▼

   Local Domain    Vault Domain   Document Domain   Sheet Domain

          │              │               │               │

          ▼              ▼               ▼               ▼

   Local Machine    Git Repository   Google Docs    Google Sheets
      Storage
```

---

## 1. Domain Classification

Prana persistence is divided into four logical domains.

### Local Domain

Device-scoped, non-durable runtime state. Exists only in SQLite. Never synchronized to any external system.

**Storage behavior:**

* Any runtime service may write
* Readable only within the local process
* No synchronization occurs — ever
* Deletion does not affect system or data integrity
* Lifecycle is tied to the local installation

**Data characteristics:**

* Ephemeral by design
* Machine-specific
* Not version-controlled
* Not recoverable from external source

**Typical content:**

* UI state (window layout, navigation position)
* User preferences and theme settings
* Temporary cache entries
* Downloaded assets pending processing

---

### Vault Domain

Durable, system-owned state. Exists in SQLite (as projection) and in the Vault file store (as authoritative record). Synchronized to Git for versioning and recovery.

**Storage behavior:**

* Only the Sync Engine may write to Vault
* Runtime components read via SQLite projection only — never direct Vault access
* All writes are persisted in Git as version-controlled commits
* Writes are atomic: SQLite projection and Vault record must remain consistent
* Lifecycle is permanent — survives application reinstallation and system restarts

**Data characteristics:**

* System-owned, not user-editable
* Version-controlled via Git
* Internally consistent — not exposed to external systems
* Recoverable from Git history

**Typical content:**

* System registry state
* Runtime configuration
* Application-level metadata
* Committed knowledge artifacts

---

### Document Domain

Human-authored content synchronized from an external document provider. The external provider is the source of truth. SQLite holds a read projection used by the runtime.

**Storage behavior:**

* External provider (e.g. Google Docs) is the authoritative source
* SQLite projection is inbound-only — runtime does not write back to the provider without explicit configuration
* Projection is refreshed via Storage Scheduler on a configured schedule
* Sync direction: PULL (provider → SQLite); PUSH is future capability
* Lifecycle follows the external document — deletion in provider marks projection stale

**Data characteristics:**

* Externally editable and collaborative
* Projected locally as Markdown or structured text
* Content may change between sync cycles
* Not version-controlled internally (provider handles versioning)

**Typical content:**

* Policies and documentation
* Research and reference material
* Knowledge articles

---

### Sheet Domain

Structured tabular data synchronized from an external sheet provider. The external provider is the source of truth. SQLite holds a structured projection queryable by the runtime.

**Storage behavior:**

* External provider (e.g. Google Sheets) is the authoritative source
* SQLite projection is inbound-only — runtime does not write back without explicit configuration
* Projection is refreshed via Storage Scheduler on a configured schedule
* Sync direction: PULL (provider → SQLite); PUSH is future capability
* Lifecycle follows the external sheet — deletion in provider marks projection stale

**Data characteristics:**

* Externally editable as structured rows and columns
* Projected locally as relational tables in SQLite
* Schema is derived from provider structure at sync time
* Not version-controlled internally

**Typical content:**

* Master data and reference tables
* Catalog and lookup data
* Structured business datasets

---

## 2. Core Storage Principle

### Single Runtime Access Surface

All runtime components interact exclusively with SQLite.

```text
Application
   │
Service
   ▼

SQLite Runtime Store
```

No component accesses:

* Git
* Vault
* Google Docs
* Google Sheets
* Google Drive

directly.

All external interaction must occur through synchronization services.

---

## 3. SQLite Runtime Store

### Purpose

SQLite is the operational storage substrate for the entire runtime.

It is not a temporary cache.

It contains:

```text
Local State
Vault Projection
Document Projection
Sheet Projection
Runtime Metadata
Synchronization Metadata
```

---

### Responsibilities

Prana owns:

* Database lifecycle
* WAL configuration
* Connection management
* Synchronization metadata
* Domain registration

Applications own:

* Business schemas
* Migrations
* Domain entities

---

### Runtime Storage Categories

#### Local Runtime Data

```text
User Preferences
Theme Settings
Window State
Navigation State
Cache Entries
```

Persistence Mode:

```text
LOCAL
```

---

#### Vault Projection Data

```text
System Registry State
Runtime Configuration
Application Metadata
Committed Knowledge Artifacts
```

Persistence Mode:

```text
VAULT
```

---

#### Document Projection Data

```text
Markdown Documents
Knowledge Articles
Research Content
```

Persistence Mode:

```text
DOCUMENT
```

---

#### Sheet Projection Data

```text
Master Data
Reference Data
Business Tables
```

Persistence Mode:

```text
SHEET
```

---

## 4. Vault Domain

### Purpose

Vault provides durable, version-controlled storage for system-owned state. It is the authoritative record for all data classified under the Vault domain.

Vault is not for user-authored collaborative content — that belongs to the Document or Sheet domains.

Vault acts as:

```text
System Archive
Configuration Store
Registry Store
Knowledge Artifact Store
```

---

### Write Rules

* Only the Sync Engine may write to Vault
* Writes must be atomic — SQLite projection and Vault file must update together
* No runtime component reads Vault directly — all reads go through SQLite projection

---

### External Synchronization

```text
Vault
   ↕
Git
```

Git provides:

* Version history
* Point-in-time recovery
* Replication and backup

Git is not accessed directly by runtime modules. The Sync Engine owns all Git operations.

---

### Vault Contents

```text
vault/
├── registry/
├── configuration/
├── metadata/
└── snapshots/
```

---

## 5. External Workspace Integration

### Purpose

Google Workspace is the external system backing the Document and Sheet domains. It is not itself a storage domain — it is the remote provider that domain adapters synchronize against.

Workspace is considered:

```text
External
Untrusted
Optional
```

The runtime must remain operational without Workspace connectivity.

---

### Supported Providers

#### Google Docs

Human-authored documents.

#### Google Sheets

Structured business data.

#### Google Slides

Presentation content.

**Scope note:** Google Slides is supported for discovery and metadata tracking only. No storage domain exists for Slides content. Slides are not subject to the Mirror Constraint. Full Slides synchronization (storage domain + sync pipeline) is out of scope for the current version.

#### Google Drive

Discovery and file management surface.

---

### Workspace Bridge

Workspace synchronization occurs through the Workspace Bridge.

Responsibilities:

```text
Discovery
Metadata Sync
Extraction
Projection
Change Detection
Synchronization
```

---

## 6. Synchronization Architecture

### Sync Engine

The Sync Engine is the only authorized mutator between domains.

```text
SQLite
   ↕
Sync Engine
   ↕
Domain Adapters
```

The Sync Engine's full behavioral contract — including the domain adapter interface, execution model, failure modes, and post-write validation — is specified in `sync-engine.md`.

---

### Domain Adapters

#### Vault Adapter

```text
SQLite
   ↕
Vault
   ↕
Git
```

---

#### Document Adapter

```text
SQLite
   ↕
Document Domain
   ↕
Google Docs
```

---

#### Sheet Adapter

```text
SQLite
   ↕
Sheet Domain
   ↕
Google Sheets
```

---

## 7. Mirror Constraint

For every synchronized domain, the source artifact and its SQLite projection must remain logically equivalent at all times.

```text
Source Artifact
       ↕
SQLite Projection
```

**Per domain:**

```text
Vault Record
       ↕
SQLite Vault Projection

Google Doc
       ↕
SQLite Document Projection (Markdown)

Google Sheet
       ↕
SQLite Sheet Projection (Structured Table)
```

**Enforcement rules:**

* A domain record MUST NOT be considered synchronized unless both sides are consistent
* Projection MUST be updated before the sync state transitions to a terminal state
* Divergence between source and projection MUST trigger a RECONCILE job via Storage Scheduler

Mirror Constraint enforcement responsibilities during sync operations — including VERIFY, RECONCILE, and post-write validation — are specified in `storage-scheduler.md` and `sync-engine.md`.

---

## 8. Storage Governance

### Local Data

May exist only in SQLite.

```text
LOCAL
```

No synchronization required.

---

### Vault Data

Must exist in:

```text
SQLite
+
Vault
```

---

### Document Data

Must exist in:

```text
SQLite
+
Document Provider
```

Optional archival projection may exist locally.

---

### Sheet Data

Must exist in:

```text
SQLite
+
Sheet Provider
```

Optional archival projection may exist locally.

---

## 9. Security Boundaries

### Trusted Zone

```text
SQLite
Vault
Sync Engine
```

---

### Semi-Trusted Zone

```text
Git
```

Versioned persistence.

---

### Untrusted Zone

```text
Google Workspace
External Providers
Third-Party Systems
```

All data entering the system must pass through:

```text
Discovery
→ Validation
→ Projection
→ Synchronization
```

---

## 10. Future Domain Model

The architecture should support additional domains without modifying runtime services.

Examples:

```text
Extended Document Providers
   ├── Google Workspace (current)
   ├── Microsoft 365
   ├── Notion
   └── Confluence

Repository Domain
   ├── GitHub
   ├── GitLab
   └── Bitbucket

Communication Domain
   ├── Slack
   └── Teams
```

All domains project into:

```text
SQLite Runtime Store
```

which remains the single operational access surface for the entire Prana runtime.
