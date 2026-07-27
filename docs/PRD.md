# PRD — workspace//kit

## Problem
Starting a new project with AI requires manually assembling, every time, both the process context files (vision, decisions, tasks) and the instruction files specific to each AI tool (CLAUDE.md, AGENTS.md, .cursorrules, etc.) — and it's easy to leave this outdated or incomplete across tools. That burden doesn't end at kickoff either: keeping decisions, tasks, and instructions in sync as a project evolves is itself manual, repeated work (see DECISIONS.md, 2026-07-21 and 2026-07-22 — the product is not scoped to initial setup only). And a workspace that *is* kept up to date has its own failure mode: nothing today measures whether its instruction files have quietly grown too large for an agent to read efficiently, whether cross-references between files still resolve, or what's been saved-but-not-yet-incorporated into the project (see docs/specs/workspace-health-check.md, docs/specs/document-ingestion-queue.md).

## Proposed solution
A project context manager, shipped across three coexisting surfaces (see PROJECT.md, DECISIONS.md 2026-07-21): a standalone HTML artifact, a CLI, and a local Web App. From a project's name, kit (formerly "project type" — see DECISIONS.md, 2026-07-26), description, stack, and limits, it produces both file layers (human + agent) already formatted correctly per tool, plus a starter prompt — and, on the CLI/Web App surfaces, keeps supporting the project on an ongoing basis rather than only at the first generation.

That ongoing support now has a concrete shape, specced 2026-07-26 (see DECISIONS.md and `docs/specs/`):
- A **workspace inspection layer** (`core/inspect.js`) — the shared read-side counterpart to `core/generator.js`, giving every feature below one addressable index of an existing workspace instead of each writing its own parser.
- A **workspace health check** (`workspace-kit doctor`) — measures a workspace's context footprint against concrete thresholds and gives specific, actionable suggestions (split a file, rotate a decision log, fix a broken cross-reference).
- A **git integration layer** — workspace//kit itself tracking file state and driving user-friendly commit/PR/worktree flows, strictly model-agnostic (it never calls or hosts an AI model; that stays the job of whatever agent already works inside the workspace).
- A **cross-tool session log** (`SESSIONS.md`) — a per-session record of which tool touched the workspace and what state it was left in, distinct from narrative product history (CHANGELOG.md, once it exists).
- A **document ingestion queue** (`queue/`) — a durable place to record "I saved this reference, I haven't brought it into the project yet," answerable by reading one file instead of re-investigating from scratch.

## Scope
- Multi-surface generation sharing one generation engine (`core/generator.js`) across surfaces, not independent copies per surface.
- Client-side, no-backend generation is a constraint of the standalone HTML surface specifically (see CONTEXT.md) — not the whole project. The CLI/Web App have their own local runtime.
- Support for multiple **kits** (formerly "project types") with their own folders and anchor file — built-ins are "system kits" (see DECISIONS.md, 2026-07-26).
- Support for multiple agent "targets" (Claude/Cowork, universal AGENTS.md, Cursor, Copilot, Gemini CLI, Windsurf, Skills).
- Ongoing project support on the CLI/Web App surfaces: persistent workspace management, Templates, Docker environment generation, workspace inspection, health check, git integration, session log, document ingestion queue — see their specs under `docs/specs/`.

## Out of scope (for now)
- Direct integration with Notion/GitHub/other remote services to create or sync a workspace remotely.
- Automatically fixing anything the health check flags — v1 diagnoses and suggests, never edits/splits/deletes a file itself (Markdown Orchestrator territory, still unspecced — owner decision pending, see TASKS.md).
- An enterprise multi-user "guardian" approval role for the git integration layer — collides with the current single-user, no-auth scope; revisit only if a real multi-user need materializes.

## Success metrics
- (to be defined in Cowork)
