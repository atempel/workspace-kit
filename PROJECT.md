# workspace//kit

## Overview
AI workspace generator: from a project description, produces the human context layer (PROJECT.md, DECISIONS.md, CONTEXT.md, TASKS.md) and the AI instruction layer (CLAUDE.md, AGENTS.md, Cursor/Copilot/Gemini CLI/Windsurf rules, Skills) — all downloadable as a .zip, plus a ready-to-use starter prompt.

**Direction (decided 2026-07-21, see DECISIONS.md):** the product is evolving from a one-shot generator into a **project context manager** — a tool that stays useful across a project's whole lifecycle, not just at kickoff. It will ship across three compatible surfaces: a **CLI**, a more robust **local Web App** (generates *and* manages workspaces), and the current **standalone HTML artifact** (kept as-is while viable, or until a fuller site exists). New features roll out to all three wherever technically possible — some things (git operations, spinning up Docker environments, persistent template/workspace management) can only live in the CLI/Web App, since a standalone HTML artifact can't touch git or a local filesystem process.

## Main goal
Eliminate the manual work of assembling and maintaining context throughout a project — from the first file to ongoing decisions/tasks/changelog upkeep — and make sure that context is born (and stays) in the right format for whichever AI tool is being used.

## Pillars
- **Security & privacy** — the generator and this repository itself should never expose secrets, personal data, or private discussions. Heavy or sensitive content belongs on each user's machine, not in version control.
- **Collaboration** — the generated context layer should make it easy for multiple people (and agents) to pick up a project without re-litigating past decisions. Local-only, per-user state should be isolated so it doesn't get in the way of shared work.

## Project type
Digital product / App (internal tool, standalone artifact)

## Stack
**Standalone HTML artifact (today):** plain HTML + CSS + JS, single-file. JSZip 3.10.1 via cdnjs for in-browser .zip generation. Fonts via Google Fonts (JetBrains Mono + Inter). No build step, no backend — this constraint is scoped to this surface specifically (see CONTEXT.md).
**CLI and local Web App (planned):** their own runtime/local process is still an open choice (e.g. to run git, spin up Docker, persist managed workspaces — see TASKS.md), but the generation logic they'll build on is decided: `core/generator.js`, a plain Node-compatible JS module (zero dependencies, no build step) seeded from the HTML artifact's generation logic — see DECISIONS.md, 2026-07-22. It is not wired into the HTML artifact itself, which keeps its own separate inline copy.

## Status
🟢 v3 live on GitHub — new Figma-referenced visual identity (dark glass-card UI, outlined-wordmark logo, SVG flag language selector) promoted to `src/workspace-kit.html` and pushed on 2026-07-10, full functional parity with v2 (17 project types, PT/EN selector, auto-generated `.gitignore`). Previous version preserved at `src/workspace-kit-v2-archive.html`. README is now bilingual (English + Portuguese).
🟡 2026-07-21 — full project review completed (past TASKS.md backlog, other session history, and open GitHub issues cross-checked); multi-surface direction (CLI + Web App + HTML) and context-manager repositioning decided — see DECISIONS.md. Next: split into specs per surface/theme, each becoming a GitHub issue.

---
Workspace generated to give continuity to the project in Cowork.
