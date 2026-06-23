# 💾 Feature: Storage Architecture

**Version:** 2.0.0
**Status:** Stable / Core
**Capability:** Provides unified storage architecture and synchronization principles across Local, Vault, Document, and Sheet domains.

```text
                     ┌──────────────────────┐
                     │  Runtime Services    │
                     │  Applications        │
                     │  Agents              │
                     └──────────┬───────────┘
                                │
                                ▼

                   ┌─────────────────────────┐
                   │ SQLite Runtime Store    │
                   │ (Single Access Surface) │
                   └──────────┬──────────────┘
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼

      Local Domain     Vault Domain    Workspace Domain

             │                │                │

             ▼                ▼                ▼

      Local Machine       Git Repository   Google Workspace
         Storage                           Docs / Sheets
                                            Slides / Drive
```

---

## 1. Domain Classification

Prana persistence is divided into four logical domains.

### Local Domain

Machine-specific runtime state.

Examples:

* Window layouts
* Theme settings
* Session state
* Cache artifacts
* Temporary files
* Downloaded assets

Characteristics:

* Device scoped
* Not synchronized
* Not shared
* May be deleted without affecting system integrity

---

### Vault Domain

Durable system state.

Examples:

* Agent definitions
* Workflow definitions
* Plugin configuration
* Registry metadata
* Application configuration
* Knowledge structures

Characteristics:

* System owned
* Version controlled
* Git synchronized
* Internal only
* Not externally editable

---

### Document Domain

Human-authored knowledge.

Examples:

* Policies
* Documentation
* Research
* Meeting notes
* Knowledge articles

Characteristics:

* Editable externally
* Collaborative
* Projected locally
* Searchable by agents

---

### Sheet Domain

Structured business data.

Examples:

* Master data
* Reference tables
* Catalogs
* Product definitions
* KPI tracking

Characteristics:

* Editable externally
* Structured
* Queryable
* Synchronizable

---

## 2. Core Storage Principle

### Single Runtime Access Surface

All runtime components interact exclusively with SQLite.

```text
Agent
   │
Application
   │
Plugin
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
Workflow Definitions
Agent Definitions
Plugin Registry
System Configuration
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

Vault provides durable storage for system-owned state.

Vault is not intended to store user-authored collaborative content.

Vault acts as:

```text
System Archive
Configuration Store
Registry Store
Knowledge Structure Store
```

---

### External Synchronization

```text
Vault
   ↓
Git
```

Git provides:

* Version history
* Backup
* Replication
* Recovery

Git is not accessed directly by runtime modules.

---

### Vault Contents

```text
vault/
├── registry/
├── configuration/
├── workflows/
├── plugins/
├── agents/
├── metadata/
└── snapshots/
```

---

## 5. Workspace Domain

### Purpose

Workspace Domain provides integration with collaborative external systems.

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

For synchronized domains:

```text
Source Artifact
       ↕
SQLite Projection
```

must remain logically equivalent.

Examples:

```text
Vault Workflow
       ↕
Workflow Table

Google Doc
       ↕
Markdown Projection

Google Sheet
       ↕
Structured Table Projection
```

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
Context Engine
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
Workspace Domain
   ├── Google Workspace
   ├── Microsoft 365
   ├── Notion
   └── Confluence

Repository Domain
   ├── GitHub
   ├── GitLab
   └── Bitbucket

Communication Domain
   ├── Email
   ├── Slack
   └── Teams
```

All domains project into:

```text
SQLite Runtime Store
```

which remains the single operational access surface for the entire Prana runtime.

This structure is much closer to the architecture you've described than the original "SQLite Cache + Vault" document because it explicitly models **Local, Vault, Document, and Sheet domains**, while keeping SQLite as the unified runtime substrate and Google Workspace as an external knowledge surface rather than a persistence backend.
