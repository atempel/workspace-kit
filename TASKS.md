# Tasks — workspace//kit

## Next
- [ ] Ask the user about the DESIGN.md, he was creating one last time by himself (Delete this task when done).
- [ ] Add option for user to enable Git files in the generation (asking if the folder will be a git repo). If the user doesn't mark it, files and instructions on files won't include nothing about git. We also need to plan and implement specific git instructions in the files (AGENT.md) so the agents using it know how to work in git, collaborate with worktree, commit, create PRs, etc.
- [ ] Review starter-prompt wording per language: the English prompt needs no extra instruction; Portuguese (and any other non-English language) should add a line distinguishing chat language (matches the selector) from documentation language (stays English by default) — the AI should not default to writing docs in the chat language unless the user explicitly asks. Consider adding a form option to opt into native-language docs.
- [ ] CLI init: command-line version of the generator, to run before opening the AI agent (today only the web form/artifact exists) — see docs/specs/cli-generator.md
- [ ] Project onboarding in the generated instructions: guide the user to fill in PROJECT/DECISIONS/CONTEXT/TASKS, plan and explore the project in the first conversation with the agent
- [ ] Recurring task suggestions in the generated files, adapted to the folder structure and chosen project type
- [ ] Wording in the generated texts that nudges the agent to suggest organizational improvements non-destructively — solve the "first-run instruction" problem (should fire once, at project start) ending up permanently in CLAUDE.md/AGENTS.md and repeating in every future conversation
- [ ] Add "I'm a visual person" checkbox to the form: when checked, append instructions to the generated files (CLAUDE.md/AGENTS.md and per-tool variants) nudging the agent to favor visual representations — diagrams, mockups, charts, visualizations — over text-only answers when the task allows it
- [ ] **Resolve the "Phase 1 vs. context manager" tension flagged in DECISIONS.md (2026-07-21):** a past session framed workspace-kit as strictly "Phase 1" (guided initial setup only, execution/handoff explicitly out of scope); the new context-manager repositioning implies an ongoing role beyond initial setup. Needs an explicit call before it affects spec-splitting.
- [ ] Adopt the CHANGELOG.md + ADR-style DECISIONS.md rotation pattern for **this repo's own docs** — see docs/specs/context-manager-conventions.md

### Local Web App (planning — 2026-07-21)
Foundational surface: generates *and* manages workspaces, hosts capabilities the standalone HTML can't (git, Templates management, Docker spin-up). Full spec: docs/specs/local-web-app.md.
- [ ] Scope and build the MVP per the spec's P0 list

### Templates feature (planning — ingested from voice note, 2026-07-14)
Source: Notion page "Notas de áudio Workspace Kit 14/07". The home nav already has a non-functional "Templates" pill (`navTemplates` in `src/workspace-kit.html`) — this fleshes out what it should actually do. Full spec: docs/specs/templates-feature.md.
- [ ] Plan and document the technical structure of the Templates feature
- [x] ~~Open decision: single HTML file vs. full app vs. HTML+backend~~ — resolved 2026-07-21: not either/or, builds across all three surfaces per the multi-surface policy (see DECISIONS.md). Full template *management* (many saved templates, permissions, merge-tag engine) is realistically CLI/Web-App territory; the standalone HTML can still support a lighter, single-template flow (e.g. paste/upload one template, fill its form, download) since that's just more generated text.
- [ ] Define the exact scope of user permissions when building a template (create files, create folders, edit file content)
- [ ] Spec the "merge tag" system: user defines form fields (e.g. "project name") and drops them into the template's `.md` files with a marker (e.g. `%tag%`, `[tag]`), similar to email-marketing merge tags; running Workspace Kit with a template then generates a form from those fields, populates the files, and offers the same download flow as the standard generator (directory preview, download options, starter-prompt configuration)
- [ ] UI: new home option to choose between the standard Workspace Kit and the user's saved templates; auto-select the standard generator when no template exists yet
- [ ] User should be able to name and reuse templates across future projects
- [ ] Future vision (post-MVP, not scoped now): full workspace management / generating new projects from templates — the voice note draws an explicit analogy to Dockerfile/docker-compose (config files that define a structure for an engine to generate)

### Docker environment generation (planning — requested 2026-07-21)
New capability: when generating a workspace, Workspace Kit should also be able to generate a ready-to-use Docker dev environment for it (Dockerfile + docker-compose.yml), so spinning up a container for that project takes only a few steps. Base case: this repo's own `Dockerfile`/`docker-compose.yml` (Node 20 + Claude Code CLI + Python, no DB/JVM by default), created 2026-07-21 — same structure and aspects get reused as the starting template, not rebuilt from scratch. Full spec: docs/specs/docker-environment-generation.md.
- [ ] Reuse the structure of this repo's `Dockerfile`/`docker-compose.yml` as the base template for generated workspaces
- [ ] Adapt the generated Docker template to the chosen project type (the same 17 types already used for folders/anchor files) — e.g. different base image/tooling/services per type (data/ML vs. mobile vs. website, etc.); needs a type → extra packages/services mapping, similar to how folders and anchor files are already mapped per type
- [x] ~~Surface split to clarify~~ — resolved 2026-07-21, per the multi-surface policy (DECISIONS.md): generating the Dockerfile/docker-compose *content* is just more generated text, so it's available from the standalone HTML too (same pattern as CLAUDE.md/AGENTS.md/.gitignore); actually spinning the container up in "a few steps" (running `docker build`/`docker compose up`) needs a local process, so that part is CLI/Web-App-only
- [ ] Define what's user-configurable in the generation form (extra services like DB/Redis, base image/runtime version, optional per-type SDKs/tools)

## Done
- [x] v3 visual redesign promoted to `src/workspace-kit.html`, archived previous version at `src/workspace-kit-v2-archive.html`, removed redundant preview file, and pushed everything to GitHub (atempel/workspace-kit) — new Figma-referenced interface (dark glass-card UI, centered pill nav, sticky workspace-preview sidebar, outlined-wordmark logo, SVG flag language selector) with full v2 functional parity, fixed across 3 review rounds (cropped logo, emoji flags, header/spacing, low text contrast, agent-card overflow + uniform sizing, unnecessary preview-panel scroll) (2026-07-10)
- [x] README made bilingual (English + Portuguese), updated for the v3 visual identity, and a GitHub Release cut for v3 (2026-07-10)
- [x] v1: working form + .zip generation (PROJECT/DECISIONS/CONTEXT/TASKS + per-type folders)
- [x] v2: multi-agent layer (CLAUDE.md/AGENTS.md/Cursor/Copilot/Gemini CLI/Windsurf/Skill), 11 project types, logo
- [x] Continuity workspace generated for use in Cowork
- [x] Project pushed to GitHub (atempel/workspace-kit) with logo and README (2026-07-01)
- [x] Repository docs translated to English; pesquisa/ moved to research/ (2026-07-01)
- [x] PT/EN language selector added to the generated HTML (`src/workspace-kit.html`), English default — covers UI text, generated file templates, and generated folder names (2026-07-01)
- [x] Added 6 new project types (mobile, extension, hardware, course, marketing, podcast) — 11 → 17 total (2026-07-02)
- [x] Generated `.gitignore` per workspace: universal base + per-type local-only folders (2026-07-02)
- [x] Reconciled parallel-session edits to `src/workspace-kit.html` and pushed merged file to GitHub; updated README/PROJECT.md stale "11 types" references (2026-07-02)
- [x] Full project review (past TASKS.md, other session history, open GitHub issues); multi-surface direction + context-manager repositioning decided; 5 specs written (docs/specs/) and issues opened (2026-07-21)
