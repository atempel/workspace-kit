# PRD — workspace//kit

## Problem
Starting a new project with AI requires manually assembling, every time, both the process context files (vision, decisions, tasks) and the instruction files specific to each AI tool (CLAUDE.md, AGENTS.md, .cursorrules, etc.) — and it's easy to leave this outdated or incomplete across tools.

## Proposed solution
A workspace generator: from a project's name, type, description, stack, and limits, it produces both file layers already formatted correctly per tool, plus a starter prompt, packaged into a .zip ready to drop into any agent with workspace access.

## Scope
- Client-side generation (HTML/JS + JSZip), no backend.
- Support for multiple project types with their own folders and anchor file.
- Support for multiple agent "targets" (Claude/Cowork, universal AGENTS.md, Cursor, Copilot, Gemini CLI, Windsurf, Skills).

## Out of scope (for now)
- Persistence across sessions (the user fills the form and downloads; nothing is saved).
- Editing templates through the UI (today templates are fixed in the code).
- Direct integration with Notion/GitHub to create the workspace remotely.

## Success metrics
- (to be defined in Cowork)
