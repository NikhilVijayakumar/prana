#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// ---------- Load Config from wiki-steps.json ----------

const config = JSON.parse(fs.readFileSync("scripts/wiki-steps.json", "utf-8"));

// ---------- Helpers ----------

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function readFileSafe(file) {
  try {
    return fs.readFileSync(file, "utf-8");
  } catch {
    return "";
  }
}

function walkDir(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      results = results.concat(walkDir(full));
    } else if (file.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function summarize(text) {
  let summary = text.split("\n").slice(0, config.summaryLines).join(" ");
  summary = summary.replace(/```[\s\S]*?```/g, "");
  summary = summary.replace(/```.*$/gm, "");
  summary = summary.replace(/`/g, "");
  summary = summary.replace(/[*#]+/g, " ");
  summary = summary.replace(/\s*id="[^"]*"\s*/g, " ");
  summary = summary.replace(/[-]+$/gm, "");
  summary = summary.replace(/[\u{1F300}-\u{1F6FF}]/gu, "");
  summary = summary.replace(/[\u{1F900}-\u{1F9FF}]/gu, "");
  summary = summary.replace(/[\u{2600}-\u{26FF}]/gu, "");
  summary = summary.replace(/[\u{2700}-\u{27BF}]/gu, "");
  summary = summary.replace(/\s+/g, " ").trim();
  return summary.substring(0, 180);
}

function buildTree(dir, depth = config.maxDepth, prefix = "") {
  if (!fs.existsSync(dir) || depth === 0) return "";

  let out = "";
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    out += `${prefix}├── ${item}\n`;

    if (stat.isDirectory()) {
      out += buildTree(full, depth - 1, prefix + "│   ");
    }
  }
  return out;
}

// ---------- Load Data ----------

const pkg = readJSON("package.json");
const readme = readFileSafe("README.md");
const docsFiles = walkDir("docs");

// ---------- Build Sections ----------

function sectionNavigation() {
  return `
## Navigation Guide

**Task-based quick reference:**
- **Add runtime service** → src/main/services/
- **Add UI component** → src/ui/common/components/
- **Add feature doc** → docs/features/
- **Update storage contract** → docs/features/storage/governance/
- **Update top-level docs index** → scripts/wiki-steps.json then node scripts/generate-index.cjs
- **Add screen** → src/ui/[screen-family]/
- **Build/config** → package.json, electron.vite.config.ts

**For detailed docs:** See Feature Details section below.
`;
}

function sectionGlobal() {
  return `
## Global Constants

| Key | Value |
|-----|------|
| Name | ${pkg.name} |
| Version | ${pkg.version} |
| License | ${pkg.license || "N/A"} |
`;
}

function sectionVision() {
  let summary = summarize(readme)
    .replace(/^#+\s*\S+\s*[-—]*\s*/, "")
    .replace(/[*#`_]+/g, "")
    .replace(/Version\s+\d+[.\d]*\s*/g, "")
    .replace(/\s+/g, " ")
    .replace(/[-—]+$/g, "")
    .trim();
  
  return `
## High-Level Vision

Prana is an Electron desktop runtime library providing orchestration, persistence, context management, security, and UI infrastructure for intelligent agent-driven applications.
`;
}

function sectionDependencies() {
  const deps = pkg.dependencies || {};
  const rows = Object.entries(deps)
    .map(([k, v]) => `| ${k} | ${v} |`)
    .join("\n");

  return `
## Dependency Stack

| Library | Version |
|---------|---------|
${rows}
`;
}

function sectionSystemMap() {
  return `
## System Map

\`\`\`
${buildTree("src")}
\`\`\`
`;
}

function sectionConceptMap() {
  const rows = config.conceptMap
    .map((c) => `| ${c.name} | ${c.impl} | ${c.path} |`)
    .join("\n");

  return `
## Concept Mapping

| Concept | Implementation | Location |
|--------|---------------|----------|
${rows}
`;
}

function sectionEditMap() {
  const rows = config.editMap
    .map((e) => `| ${e.task} | ${e.path} |`)
    .join("\n");

  return `
## Edit Map

| Task | Location |
|------|---------|
${rows}
`;
}

function sectionFlows() {
  return `
## Critical Flows

${config.flows
  .map(
    (f) => `### ${f.name}\n${f.steps.join(" → ")}`
  )
  .join("\n\n")}
`;
}

function sectionFeatureDetails() {
  const sections = [];

  if (config.featureDetails) {
    const categories = {
      core: "Core Storage Contracts",
      runtime: "Runtime Systems",
      onboarding: "Onboarding & Registry",
      integration: "Integrations",
      diagnostics: "Diagnostics & Audit"
    };

    for (const [cat, label] of Object.entries(categories)) {
      const items = config.featureDetails[cat];
      if (items && items.length > 0) {
        sections.push(`### ${label}`);
        sections.push("");
        for (const item of items) {
          sections.push(`- **${item.area}** ([${item.doc}](${item.doc}))`);
          sections.push(`  - Services: ${item.services.join(", ")}`);
        }
        sections.push("");
      }
    }
  }

  return `
## Feature Details

${sections.join("\n")}
`;
}

function sectionDocsManifest() {
  return `
## Documentation Manifest

${docsFiles
  .map((file) => {
    const rel = file.replace(/^docs[\\/]/, "").replace(/\\/g, "/");
    const content = readFileSafe(file);
    const summary = summarize(content);
    return `- **${rel}** → ${summary}`;
  })
  .join("\n")}
`;
}

function sectionRules() {
  return `
## Rules

${config.rules.map((r) => `- ${r}`).join("\n")}
`;
}

function sectionAPI() {
  return `
## API Surface

See: src/main/services/ for all runtime services.
See: src/ui/common/components/index.ts for UI component exports.
`;
}

function sectionMaintenance() {
  return `
## Maintenance

- Config: scripts/wiki-steps.json
- Generated: ${new Date().toISOString().split("T")[0]}
- Version: ${pkg.version}
`;
}

// ---------- Section Dispatcher ----------

const sectionMap = {
  navigation: sectionNavigation,
  global: sectionGlobal,
  vision: sectionVision,
  dependencies: sectionDependencies,
  systemMap: sectionSystemMap,
  conceptMap: sectionConceptMap,
  editMap: sectionEditMap,
  flows: sectionFlows,
  featureDetails: sectionFeatureDetails,
  docsManifest: sectionDocsManifest,
  rules: sectionRules,
  api: sectionAPI,
  maintenance: sectionMaintenance,
};

// ---------- Generate ----------

function generate() {
  let output = `# ${config.name.charAt(0).toUpperCase() + config.name.slice(1)} — Documentation Index\n`;

  for (const sec of config.sections) {
    if (sectionMap[sec]) {
      output += sectionMap[sec]();
    }
  }

  fs.writeFileSync("docs/index.md", output);
  console.log("✅ Generated docs/index.md using scripts/wiki-steps.json");
}

generate();