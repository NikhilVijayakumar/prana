#!/usr/bin/env python3
"""
Runtime Map — Feature Discovery

Scans docs/raw/features/ to discover all features, resolves mappings
to src/main/features/ and src/main/common/, checks which have
existing runtime-maps, and outputs:
  1. Terminal table for user review
  2. JSON manifest at /tmp/runtime-map-manifest.json

Usage: python scripts/runtime-map-feature-discovery.py
"""

import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

FEATURES_DIR = Path("docs/raw/features")
SRC_FEATURES_DIR = Path("src/main/features")
SRC_COMMON_DIR = Path("src/main/common")
RUNTIME_MAP_DIR = Path("docs/raw/architecture/runtime-map")

EXCLUDE_DIRS = {"__pycache__", "node_modules", ".git", "audit"}

# Hardcoded doc-dir → feature-dir mapping for non-obvious cases
# Key: docs/raw/features/ subdirectory
# Value: list of src/main/features/ directories
FEATURE_DIR_MAP: dict[str, list[str]] = {
    "auth":     ["auth"],
    "boot":     ["operations"],
    "chat":     ["communication", "orchestration", "context"],
    "context":  ["context"],
    "cron":     ["orchestration"],
    "email":    ["communication"],
    "Integration": ["communication"],
    "notification": ["communication", "governance"],
    "Onboarding":   ["governance", "context", "operations", "registry", "intelligence"],
    "queue-scheduling": ["orchestration", "registry"],
    "sandbox":  ["sandbox"],
    "storage":  ["vault", "sync", "operations", "intelligence", "governance"],
    "vaidyar":  ["governance", "operations"],
}

# Specific feature-doc-file → source file patterns (for fine-grained mapping)
# Key: doc relative path (e.g., "email/email.md")
# Value: list of source file glob patterns relative to features dir
FEATURE_FILE_MAP: dict[str, list[str]] = {
    "email/email.md":              ["communication/email*.ts", "communication/google*.ts"],
    "chat/communication.md":       ["communication/channel*.ts", "orchestration/orchestration*.ts", "orchestration/commandRouter*.ts", "orchestration/protocol*.ts", "context/conversation*.ts", "context/contextEngine*.ts"],
    "notification/notification-centre.md": ["communication/notification*Service.ts", "governance/hookSystem*.ts", "governance/vaidyar*.ts"],
    "cron/cron.md":                ["orchestration/cron*.ts"],
    "queue-scheduling/queue-scheduling.md": ["orchestration/cron*.ts", "orchestration/queue*.ts", "registry/taskRegistry*.ts"],
    "boot/startup-orchestrator.md": ["operations/startupOrchestrator*.ts"],
    "context/context-engine.md":   ["context/context*.ts", "context/memory*.ts", "context/business*.ts"],
    "Integration/google-ecosystem-integration.md": ["communication/google*.ts"],
    "storage/vault.md":            ["vault/vaultRegistry*.ts", "vault/vaultMetadata*.ts", "vault/vaultService*.ts"],
    "storage/sync-engine.md":      ["sync/*.ts"],
    "storage/virtual-drive.md":    ["vault/drive*.ts", "vault/virtual*.ts", "registry/mount*.ts"],
    "storage/data-integrity-protocol.md": ["vault/vaultService*.ts", "sync/syncEngine*.ts", "operations/dataFilter*.ts"],
    "storage/vector-search-rag.md": ["intelligence/vectorSearch*.ts", "governance/loopProtection*.ts"],
    "storage/sqlite-cache.md":     [],
    "vaidyar/vaidyar.md":          ["governance/vaidyar*.ts", "governance/systemHealth*.ts", "operations/recovery*.ts"],
    "sandbox/plugin-sandbox-host.md": ["sandbox/pluginSandboxHost*.ts"],
    "sandbox/sandbox-runtime-architecture.md": ["sandbox/sandboxRuntime*.ts", "sandbox/sandboxIpc*.ts", "sandbox/sandboxSupervisor*.ts", "sandbox/pluginSandbox*.ts"],
    "Onboarding/onboarding-channel-configuration.md": ["registry/registryRuntimeStore*.ts"],
    "Onboarding/onboarding-model-configuration.md": ["intelligence/runtimeModel*.ts", "context/tokenManager*.ts"],
    "Onboarding/onboarding-registry-approval.md": ["context/businessContext*.ts", "context/businessContextValidation*.ts"],
    "Onboarding/onboarding-hybrid-explorer-governance-lifecycle.md": ["context/businessAlignment*.ts"],
    "Onboarding/onboarding-pipeline-orchestrator.md": ["governance/onboardingStage*.ts", "operations/startupOrchestrator*.ts"],
    "auth/authentication.md":      ["auth/*.ts"],
}

# Common dependency detection per feature doc
COMMON_DEPS_MAP: dict[str, list[str]] = {
    "auth/authentication.md":     ["config", "storage", "types"],
    "email/email.md":             ["config", "storage"],
    "chat/communication.md":      ["config", "storage", "types"],
    "context/context-engine.md":  ["config", "storage", "types"],
    "cron/cron.md":               ["config", "storage"],
    "storage/sqlite-cache.md":    ["storage"],
    "storage/sync-engine.md":     ["config", "storage"],
    "storage/vault.md":           ["config", "storage"],
    "storage/virtual-drive.md":   ["config", "storage"],
    "storage/data-integrity-protocol.md": ["config", "storage", "types"],
    "storage/vector-search-rag.md": ["config", "storage", "types"],
    "sandbox/plugin-sandbox-host.md": ["config", "storage", "types"],
    "sandbox/sandbox-runtime-architecture.md": ["config", "storage", "types"],
    "notification/notification-centre.md": ["config", "storage"],
    "queue-scheduling/queue-scheduling.md": ["config", "storage"],
    "boot/startup-orchestrator.md": ["config", "storage"],
    "Integration/google-ecosystem-integration.md": ["config", "storage"],
    "Onboarding/onboarding-channel-configuration.md": ["config", "storage", "types"],
    "Onboarding/onboarding-model-configuration.md": ["config", "storage", "types"],
    "Onboarding/onboarding-registry-approval.md": ["config", "storage", "types"],
    "Onboarding/onboarding-hybrid-explorer-governance-lifecycle.md": ["config", "storage"],
    "Onboarding/onboarding-pipeline-orchestrator.md": ["config", "storage"],
    "vaidyar/vaidyar.md":         ["config", "storage", "types"],
}


def kebab_case(name: str) -> str:
    name = name.replace('.md', '').replace('.ts', '').replace('.py', '')
    parts = re.split(r'(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])', name)
    return '-'.join(p.lower() for p in parts if p)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def resolve_source_files(doc_rel: str) -> list[str]:
    """Resolve a feature doc to source file paths."""
    # Handle special cases: common modules
    special_common = {
        "storage/sqlite-cache.md": ["common/storage/sqliteCacheService.ts", "common/storage/sqliteService.ts"],
    }
    if doc_rel in special_common:
        return special_common[doc_rel]

    patterns = FEATURE_FILE_MAP.get(doc_rel, [])
    if patterns:
        files = []
        for pattern in patterns:
            matches = sorted(SRC_FEATURES_DIR.glob(pattern))
            for m in matches:
                if not m.name.endswith(('.test.ts', '.spec.ts', '.d.ts')):
                    files.append(str(m.relative_to(Path("src/main"))))
        return files

    # Fallback: try matching by stem name
    doc_path = FEATURES_DIR / doc_rel
    stem = doc_path.stem.replace('-', '_').replace(' ', '_')
    for feat_dir in SRC_FEATURES_DIR.iterdir():
        if feat_dir.is_dir():
            for f in feat_dir.glob("*.ts"):
                if stem.lower() in f.stem.lower() and not f.name.endswith(('.test.ts', '.spec.ts')):
                    return [str(f.relative_to(Path("src/main")))]

    return []


def resolve_feature_dirs(doc_subdir: str) -> list[str]:
    """Resolve a feature doc subdirectory to feature source directories."""
    dirs = FEATURE_DIR_MAP.get(doc_subdir, [doc_subdir])
    return [d for d in dirs if (SRC_FEATURES_DIR / d).is_dir()]


def find_runtime_map(stem: str) -> Path | None:
    """Find an existing runtime-map matching this feature doc stem."""
    candidates = [
        RUNTIME_MAP_DIR / f"{stem}.md",
        RUNTIME_MAP_DIR / f"{kebab_case(stem)}.md",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def collect_features() -> list[dict]:
    features = []
    for subdir in sorted(os.listdir(FEATURES_DIR)):
        if subdir.startswith('.') or subdir in EXCLUDE_DIRS:
            continue
        subdir_path = FEATURES_DIR / subdir
        if not subdir_path.is_dir():
            continue

        for doc_file in sorted(subdir_path.rglob("*.md")):
            if doc_file.name == "index.md":
                continue

            doc_rel = str(doc_file.relative_to(FEATURES_DIR))
            doc_stem = doc_file.stem  # e.g., "email", "plugin-sandbox-host"

            # Skip viewer screens — they are UI-only (Electron renderer)
            if doc_stem.startswith("viewer-"):
                continue

            # Skip storage/governance/ docs — they are contract specs, not features
            rel_to_subdir = doc_file.relative_to(subdir_path)
            if "governance" in rel_to_subdir.parts:
                continue

            # Resolve source files
            source_files = resolve_source_files(doc_rel)
            feat_dirs = resolve_feature_dirs(subdir)
            common_deps = COMMON_DEPS_MAP.get(doc_rel, [])

            # Check for existing runtime-map
            # Runtime-map file name = doc stem (e.g., email.md, plugin-sandbox-host.md)
            runtime_map_path = RUNTIME_MAP_DIR / f"{doc_stem}.md"
            runtime_map_exists = runtime_map_path.exists()

            # Determine status
            if runtime_map_exists:
                doc_mtime = datetime.fromtimestamp(
                    doc_file.stat().st_mtime, tz=timezone.utc
                )
                map_mtime = datetime.fromtimestamp(
                    runtime_map_path.stat().st_mtime, tz=timezone.utc
                )
                # Check source file mtimes too
                max_src_mtime = doc_mtime
                for sf in source_files:
                    src_path = Path("src/main") / sf
                    if src_path.exists():
                        st = datetime.fromtimestamp(src_path.stat().st_mtime, tz=timezone.utc)
                        if st > max_src_mtime:
                            max_src_mtime = st
                needs_update = max_src_mtime > map_mtime
                status = "stale" if needs_update else "up-to-date"
                map_last_updated = map_mtime.strftime('%Y-%m-%d %H:%M')
            else:
                needs_update = False
                status = "missing"
                map_last_updated = None

            features.append({
                "featureName": doc_stem,
                "featureDoc": str(doc_file),
                "sourceFiles": source_files,
                "featureDirs": feat_dirs,
                "commonDependencies": common_deps,
                "existingMap": str(runtime_map_path) if runtime_map_exists else None,
                "status": status,
                "needsUpdate": needs_update,
                "mapLastUpdated": map_last_updated,
                "sourceHashes": [sha256_file(Path("src/main") / sf) for sf in source_files],
            })

    return features


def main():
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
    print(f"Runtime Map Feature Discovery — {now}")
    print(f"Scanning: {FEATURES_DIR}\n")

    features = collect_features()

    # Group by status
    by_status: dict[str, list[dict]] = {}
    for f in features:
        by_status.setdefault(f["status"], []).append(f)

    # Print table
    print(f"{'─' * 100}")
    print(f"{'Feature':30s} {'Source Files':36s} {'Status':12s} {'Common':16s}")
    print(f"{'─' * 100}")
    for f in features:
        src_col = str(len(f["sourceFiles"])) + " file(s)" if f["sourceFiles"] else "—"
        common_col = ", ".join(f["commonDependencies"]) if f["commonDependencies"] else "—"
        print(
            f"{f['featureName']:30s} "
            f"{src_col:36s} "
            f"{f['status']:12s} "
            f"{common_col:16s}"
        )
    print(f"{'─' * 100}")
    print(f"\nSummary:")
    print(f"  Total features:    {len(features)}")
    for s in ["missing", "stale", "up-to-date"]:
        count = len(by_status.get(s, []))
        if count:
            print(f"  {s:18s} {count}")
    print()

    # Print features with no source files (need attention)
    no_src = [f for f in features if not f["sourceFiles"]]
    if no_src:
        print(f"⚠  Features with unresolved source files ({len(no_src)}):")
        for f in no_src:
            print(f"     {f['featureName']:40s} — {f['featureDoc']}")
        print()

    # Write JSON manifest
    manifest = {
        "generatedAt": now,
        "totalFeatures": len(features),
        "features": features,
    }
    manifest_path = Path("/tmp/runtime-map-manifest.json")
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f"Manifest written to {manifest_path}")
    print(f"✓ Discovery complete")


if __name__ == '__main__':
    main()
