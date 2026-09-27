---
description: Mandatory agent memory and changelog update rule
globs: ["*"]
alwaysApply: true
---

# Agent Memory & Self-Update Protocol

All AI coding assistants and agents operating on this repository (`Climate_Predection`) must adhere to the following rules:

1. **Read AGENTS.md First:**
   Before beginning any task, read [AGENTS.md](file:///home/rishi/cyclone_predection/AGENTS.md) to understand current state, past decisions, architecture, and established conventions.

2. **Mandatory Changelog Update on Every Change:**
   Whenever you make ANY changes to the codebase (adding features, fixing bugs, refactoring, modifying configurations, updating tests, or implementing roadmap items):
   - You **MUST update [AGENTS.md](file:///home/rishi/cyclone_predection/AGENTS.md)** before ending your turn or completing the task.
   - Record the entry in Section 7 (`Changelog & Agent Activity Log`) with:
     - Timestamp
     - Summary of changes made
     - List of modified files
     - Test verification results (`pytest`, `demo_run.py`, `npm run build`, etc.)
     - Any pending follow-ups or next steps.

3. **Preserve Architectural Invariants:**
   - Unidirectional data pipeline.
   - Deterministic parametric insurance logic (LLMs never determine payout booleans).
   - Numeric grounding validation (`validate_output.py`) for AI advisories.
   - Human-in-the-loop confirmation before dispatch.
   - Graceful fallback for offline database in development mode.
