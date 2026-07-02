# Tasks — workspace//kit

## In progress
- [ ] Plan new tasks

## Next
- [ ] Generate a `.gitignore` as part of the workspace output — to be discussed: what it should cover (per project type? secrets/env files? IDE/OS cruft? build artifacts?)
- [ ] Review starter-prompt wording per language: the English prompt needs no extra instruction; Portuguese (and any other non-English language) should add a line distinguishing chat language (matches the selector) from documentation language (stays English by default) — the AI should not default to writing docs in the chat language unless the user explicitly asks. Consider adding a form option to opt into native-language docs.
- [ ] Replace the PT/EN text buttons in `src/workspace-kit.html` with flag icons for the language selector
- [ ] Fix desktop layout bug in `src/workspace-kit.html`: the two-column `.grid`/`.col` layout breaks on wide viewports (card 5 renders beside card 1, card 2 renders below card 1 instead of stacking under card 1 in its own column) — needs investigation before a fix; structural change, review before applying per CLAUDE.md
- [ ] CLI init: command-line version of the generator, to run before opening the AI agent (today only the web form/artifact exists)
- [ ] Project onboarding in the generated instructions: guide the user to fill in PROJECT/DECISIONS/CONTEXT/TASKS, plan and explore the project in the first conversation with the agent
- [ ] Recurring task suggestions in the generated files, adapted to the folder structure and chosen project type
- [ ] Wording in the generated texts that nudges the agent to suggest organizational improvements non-destructively — solve the "first-run instruction" problem (should fire once, at project start) ending up permanently in CLAUDE.md/AGENTS.md and repeating in every future conversation

## Done
- [x] v1: working form + .zip generation (PROJECT/DECISIONS/CONTEXT/TASKS + per-type folders)
- [x] v2: multi-agent layer (CLAUDE.md/AGENTS.md/Cursor/Copilot/Gemini CLI/Windsurf/Skill), 11 project types, logo
- [x] Continuity workspace generated for use in Cowork
- [x] Project pushed to GitHub (atempel/workspace-kit) with logo and README (2026-07-01)
- [x] Repository docs translated to English; pesquisa/ moved to research/ (2026-07-01)
- [x] PT/EN language selector added to the generated HTML (`src/workspace-kit.html`), English default — covers UI text, generated file templates, and generated folder names (2026-07-01)
