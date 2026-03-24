# Setup & Config: System Initialization - Atomic Feature Specification

## 1. Single Reason to Change (SRP)
This document handles updates **exclusively** related to the background loading and hydration sequence that triggers when the Electron application boots up. It is entirely headless.

## 2. Input Data Required
- **Disk IO:** Reading the actual `.yaml` and `.json` registry definitions from the Vault filesystem path.

## 3. Registry Sub-Component Integration
- **Agents:** Loads them into RAM.
- **Skills:** Loads them into RAM.
- **Workflows:** Loads them into RAM.
- **Protocols:** Loads them into RAM.
- **KPIs:** Loads them into RAM.
- **Data Inputs:** Loads them into RAM.

## 4. Triple-Engine Extraction Model
- **OpenCLAW:** Not executing logic here, just being loaded into the binary context.
- **Goose:** Parses schema version drifts if the codebase updated while offline.
- **NemoClaw:** Renders the Splash Screen loading bar to indicate hydration progress.

## 5. Hybrid DB & State Storage Flow
- **Hydration Bridge:** This is the core sync function. The system reads the permanent state from the **Vault** (the Git-backed files) and mathematically translates them into relational tables in **SQLite DB** for fast operational querying.
- **Disconnection Check:** If Model Configurations (which are DB-only) are missing, it blocks the transition to the `Home` screen and forces a `Model Configuration` UI overlay.

## 6. Chat Scenarios (Internal vs External)
- **Internal Chat:** System trace: "System hydrated successfully in 410ms."
- **External Chat:** None.

## 7. Cron & Queue Management
- **Failover / Catch-up Mechanic:** The Initialization logic is the *executor* of all catch-ups. During the final hydration millisecond, it checks all SQLite `last_run` timestamps against `Date.now()`. If gaps exist for crons or queue items, it dispatches the failover routines immediately to the execution engines.
