# Integration: Google Ecosystem Intake and Policy Sync - Atomic Feature Specification

## Master-Spec Reference
- Source of truth: docs/module/master-spec.md
- Capability status: Partial

## Current State
- Integration contract for Gmail, Zapier, and MCP intake is documented with governance-safe staging intent.
- Baseline services exist with partial parity for full ecosystem automation depth.

## Target State
- Deterministic ingestion-to-action pipeline with explicit approval, audit, and fallback behavior.
- Full cross-module parity between intake, policy synchronization, and escalation channels.

## Gap Notes
- Connector depth, operational fallback behavior, and policy sync completeness still require phased implementation parity.

## Dependencies
- docs/module/infrastructure-layers.md
- docs/module/onboarding-channel-configuration.md
- docs/module/master-spec.md

## Acceptance Criteria
1. Intake payloads are normalized and auditable before downstream action generation.
2. Policy-impact changes are staged for explicit approval before commit.
3. Fallback paths preserve audit continuity under connector failure.

## Immediate Roadmap
1. Expand runtime connector parity and deterministic error handling.
2. Align integration diagnostics with master-spec observability contract.

## 1. Single Reason to Change (SRP)
This document handles updates exclusively related to ingesting dedicated admin email and meeting transcriptions through Gmail, Zapier, and MCP, then converting them into Action Items with governance-safe policy synchronization.

## 2. Input Data Required
- Dedicated admin mailbox identity.
- Ingestion connector metadata (Gmail API, Zapier webhook, MCP server, Telegram fallback).
- Raw meeting transcript or email body.
- Decision signals and policy impact classification.

## 3. Registry Sub-Component Integration
- Agents: mira (orchestration), eva (compliance), elina (execution), arya (approval).
- Skills: automated-policy-validation, multi-agent-sync-orchestration.
- Workflows: google-ecosystem-action-intelligence, governance-policy-update.
- Protocols: google-ecosystem-ingestion-protocol, external-channel-communication-protocol.
- KPIs: audit-trail-completeness-score, handshake-success-rate.
- Data Inputs: google-ecosystem-admin-intelligence-feed, decisions, compliance-policy-md.

## 4. Triple-Engine Extraction Model
- OpenCLAW: Connector auth boundary, payload guardrails, and external channel policy enforcement.
- Goose: MCP connector surface for Gmail and ecosystem integrations; normalized tool output.
- NemoClaw: Optional Telegram bridge fallback for controlled inbox or notification routing.

## 5. Hybrid DB and State Storage Flow
- Intake: Connector payloads normalized into the admin intelligence feed.
- Synthesis: Action Items and decisions are written into operational traces.
- Governance: Policy deltas are staged for director approval before commit.

## 6. Chat Scenarios (Internal vs External)
- Internal Chat: Agents coordinate action-item extraction and policy-impact decisions.
- External Chat: Optional Telegram fallback or digest notification channel, subject to allowlists and governance mode.

## 7. Cron and Queue Management
- Queue Management: Action Items are sequenced through operational queue controls.
- Failover: Primary Gmail or MCP outages can fail over to Telegram fallback ingestion or delayed retries with audit continuity.
