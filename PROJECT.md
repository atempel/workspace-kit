# workspace//kit

## Overview
AI workspace generator: from a project description, produces the human context layer (PROJECT.md, DECISIONS.md, CONTEXT.md, TASKS.md) and the AI instruction layer (CLAUDE.md, AGENTS.md, Cursor/Copilot/Gemini CLI/Windsurf rules, Skills) — all downloadable as a .zip, plus a ready-to-use starter prompt.

## Main goal
Eliminate the manual work of assembling context every time a new project starts — and make sure that context is born in the right format for whichever AI tool is being used.

## Pillars
- **Security & privacy** — the generator and this repository itself should never expose secrets, personal data, or private discussions. Heavy or sensitive content belongs on each user's machine, not in version control.
- **Collaboration** — the generated context layer should make it easy for multiple people (and agents) to pick up a project without re-litigating past decisions. Local-only, per-user state should be isolated so it doesn't get in the way of shared work.

## Project type
Digital product / App (internal tool, standalone artifact)

## Stack
Plain HTML + CSS + JS, single-file. JSZip 3.10.1 via cdnjs for in-browser .zip generation. Fonts via Google Fonts (JetBrains Mono + Inter). No build step, no backend.

## Status
🟢 v2 functional, live on GitHub — repository in English, PT/EN selector shipped in the artifact, 17 project types, and auto-generated `.gitignore` (local-only folders per project type).

---
Workspace generated to give continuity to the project in Cowork.
