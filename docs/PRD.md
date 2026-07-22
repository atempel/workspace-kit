# PRD — workspace//kit

## Problem
Starting a new project with AI requires manually assembling, every time, both the process context files (vision, decisions, tasks) and the instruction files specific to each AI tool (CLAUDE.md, AGENTS.md, .cursorrules, etc.) — and it's easy to leave this outdated or incomplete across tools. That burden doesn't end at kickoff either: keeping decisions, tasks, and instructions in sync as a project evolves is itself manual, repeated work (see DECISIONS.md, 2026-07-21 and 2026-07-22 — the product is not scoped to initial setup only).

## Proposed solution
A project context manager, shipped across three coexisting surfaces (see PROJECT.md, DECISIONS.md 2026-07-21): a standalone HTML artifact, a CLI, and a local Web App. From a project's name, type, description, stack, and limits, it produces both file layers (human + agent) already formatted correctly per tool, plus a starter prompt — and, on the CLI/Web App surfaces, keeps supporting the project on an ongoing basis rather than only at the first generation.

## Scope
- Multi-surface generation sharing one generation engine (`core/generator.js`) across surfaces, not independent copies per surface.
- Client-side, no-backend generation is a constraint of the standalone HTML surface specifically (see CONTEXT.md) — not the whole project. The CLI/Web App have their own local runtime.
- Support for multiple project types with their own folders and anchor file.
- Support for multiple agent "targets" (Claude/Cowork, universal AGENTS.md, Cursor, Copilot, Gemini CLI, Windsurf, Skills).
- Ongoing project support on the CLI/Web App surfaces: persistent workspace management, Templates, Docker environment generation — see their specs under `docs/specs/`.

## Out of scope (for now)
- Direct integration with Notion/GitHub/other remote services to create or sync a workspace remotely.

## Success metrics
- (to be defined in Cowork)
