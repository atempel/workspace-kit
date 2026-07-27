# Tasks — workspace//kit

This file is an index. Each planned feature below is a heading + a one-line pointer to its full spec (`docs/specs/*.md`) and GitHub issue — that's where the detailed requirements, Non-Goals, and open questions live. Don't duplicate spec content back into this file; if a bullet needs the level of detail a spec has, it belongs in the spec.

See `queue/` for saved-but-not-yet-ingested references (`grep -l "Status: Pending" queue/*.md` lists open ones), and `SESSIONS.md` for the per-session tool-handoff log — neither is enumerated here, see DECISIONS.md, 2026-07-27.

## Next
- [ ] Take the high-fidelity prototype back from Claude Design (see `docs/design/prototype-prp.md`, written 2026-07-27) and reconcile `DESIGN.md` (first-pass draft, same date) against whatever came out of it — including the open question of whether the new light/dark direction stays scoped to the Local Web App or reconciles with the standalone HTML artifact's existing terminal identity.
- [ ] Add option for user to enable Git files in the generation (asking if the folder will be a git repo). If the user doesn't mark it, files and instructions on files won't include nothing about git. We also need to plan and implement specific git instructions in the files (AGENT.md) so the agents using it know how to work in git, collaborate with worktree, commit, create PRs, etc. — scope note (2026-07-26): this is about *generated text* (instructions teaching an agent to use git/worktrees inside a workspace). Workspace//kit itself operating git is a separate capability — see "Git as the integration layer" below.
- [x] ~~Review starter-prompt wording per language~~ — done 2026-07-27: added the chat-language-vs-documentation-language line to the PT starter prompt (English needed none), in both `src/workspace-kit.html` and `core/generator.js` (kept in sync per DECISIONS.md's manual-backport policy), fixture updated, `test:fixtures`/`test:parity` both pass. Still open: whether to add a form option to opt into native-language docs — that's a new feature/UX decision, left for the owner.
- [ ] Project onboarding in the generated instructions: guide the user to fill in PROJECT/DECISIONS/CONTEXT/TASKS, plan and explore the project in the first conversation with the agent
- [ ] Recurring task suggestions in the generated files, adapted to the folder structure and chosen project type
- [ ] Wording in the generated texts that nudges the agent to suggest organizational improvements non-destructively — solve the "first-run instruction" problem (should fire once, at project start) ending up permanently in CLAUDE.md/AGENTS.md and repeating in every future conversation
- [ ] Add "I'm a visual person" checkbox to the form: when checked, append instructions to the generated files (CLAUDE.md/AGENTS.md and per-tool variants) nudging the agent to favor visual representations — diagrams, mockups, charts, visualizations — over text-only answers when the task allows it
- [x] ~~Resolve the "Phase 1 vs. context manager" tension~~ — resolved 2026-07-22, see DECISIONS.md.
- [x] ~~Adopt the CHANGELOG.md + ADR-style DECISIONS.md rotation pattern for this repo's own docs~~ — DECISIONS.md half executed 2026-07-26 (8 oldest entries rotated to `decisions/` with an index). CHANGELOG.md deliberately not created yet — premature until CONTEXT.md accumulates narrative history to split out. Full spec + issue: docs/specs/context-manager-conventions.md → [#34](https://github.com/atempel/workspace-kit/issues/34)
- [x] ~~Propagate the 2026-07-26 positioning + "kits" rename decision into CONTEXT.md's vocabulary section~~ — done 2026-07-27: added the "Kit"/"system kit" vocabulary entry, updated the "Anchor file" definition, and logged the model-agnostic/positioning constraint alongside PROJECT.md/docs/PRD.md (updated 2026-07-27).
- [ ] Rename "project type" to **"kit"** (built-ins become "system kits") — decided 2026-07-26, to happen now, before the CLI exposes "project type" in its public flag/prompt surface. Touches: UI strings + `TYPE_CONFIG` naming in both copies of the generation logic, `core/fixtures.json` + parity harness, `research/project-types/`, README/PROJECT.md/specs wording. Deliberately distinct from "Templates" (no naming collision). **Needs review** (per CLAUDE.md, structural changes to `src/workspace-kit.html` go through plan mode) — parked for the owner to walk through together rather than applied unattended. Source: Notion page "Notas de Áudio 26/07" (2026-07-26).
- [x] ~~Adopt a per-feature parallel workstream approach ...; record the stated non-functional bar in PROJECT.md's pillars / CONTEXT.md's constraints~~ — non-functional bar (modern, complete, modular, functional, secure, reliable) recorded in both files 2026-07-27. The parallel-workstream-per-feature convention itself is already how docs/specs/ + TASKS.md are organized (one spec + one issue per feature); no further doc change needed.
- [x] ~~Keep TASKS.md itself lean~~ — resolved 2026-07-26: this file was reorganized into an index (heading + pointer + spec/issue link per section); Markdown Orchestrator and the Shared instruction library were demoted to the two bullets below since neither has a spec yet.
- [ ] Parked: **Markdown Orchestrator integration** — would give per-instruction observability/toggle control over a workspace (builds on the Workspace inspection layer, docs/specs/workspace-inspection-layer.md → [#77](https://github.com/atempel/workspace-kit/issues/77)). Blocked on an owner decision: how the owner's separate, existing "Markdown Orchestrator" project folds in (port/vendor its code vs. reimplement fresh inside workspace//kit's own conventions). No spec written until that's answered. Source: Notion page "Notas de Áudio 26/07" (2026-07-26).
- [ ] Parked: **Shared instruction library across projects** — a single source of truth for instructions repeated across the owner's many projects (e.g. how to use Git/GitHub, general best practices), so projects stay consistent instead of each drifting its own copy. Deliberately sequenced after the Templates MVP (docs/specs/templates-feature.md → [#32](https://github.com/atempel/workspace-kit/issues/32)) — it directly contradicts that spec's "no live link between a template and workspaces generated from it" Non-Goal, which needs reconciling before a spec gets written. Source: Notion page "Notas de Áudio 26/07" (2026-07-26).

### CLI generator (planning — 2026-07-21)
Foundational surface: generates workspaces from a terminal instead of only the browser artifact. Full spec + issue: docs/specs/cli-generator.md → [#20](https://github.com/atempel/workspace-kit/issues/20). Supersedes the older, narrower "CLI init" line (issue #6).
- [x] ~~Shared-generation-engine blocker~~ — resolved 2026-07-22, `core/generator.js` created as a standalone shared module (see DECISIONS.md).
- [x] ~~Parity test harness~~ — `core/parity-check.js`/`core/check-fixtures.js` confirm `core/generator.js` matches `src/workspace-kit.html`'s output (see DECISIONS.md).

### Local Web App (planning — 2026-07-21)
Generates *and* manages workspaces; hosts capabilities the standalone HTML can't (git, Templates management, Docker spin-up). Full spec + issue: docs/specs/local-web-app.md → [#29](https://github.com/atempel/workspace-kit/issues/29). Its "open an existing workspace" P0 bullet is being absorbed into the Workspace inspection layer below rather than built as its own reader.

### Workspace inspection layer (planning — 2026-07-26)
Foundational read-side counterpart to `core/generator.js` — one shared way to open and index an existing workspace (files, sizes, parsed instructions, cross-reference graph) that several features below build on instead of each growing their own parser. Full spec + issue: docs/specs/workspace-inspection-layer.md → [#77](https://github.com/atempel/workspace-kit/issues/77).

### Workspace health check — "system doctor" (planning — ingested from voice note, 2026-07-26)
Evaluates a workspace's instruction/file-size health and gives concrete improvement suggestions — likely the CLI's natural second command (`workspace-kit doctor`). Full spec + issue: docs/specs/workspace-health-check.md → [#78](https://github.com/atempel/workspace-kit/issues/78).

### Cross-tool session log (planning — ingested from voice note, 2026-07-26)
A per-session log recording what happened where across tools (Claude Design/Cowork/Claude Code) — cheapest of the 2026-07-26 batch, ships as plain generated text on all three surfaces. Full spec + issue: docs/specs/cross-tool-session-log.md → [#81](https://github.com/atempel/workspace-kit/issues/81).

### Git as the integration layer (planning — ingested from voice note, 2026-07-26)
Workspace//kit itself operating git (file-state tracking, worktrees, user-friendly commit/PR flows) — strictly model-agnostic (see DECISIONS.md, 2026-07-26), CLI/Web-App-only. Full spec + issue: docs/specs/git-integration-layer.md → [#79](https://github.com/atempel/workspace-kit/issues/79). Design brief for a Claude Design prototype (no UI existed yet for this spec): docs/design/git-layer-dashboard-brief.md.

### Document ingestion queue (planning — ingested from voice note, 2026-07-26)
A per-workspace queue for references saved but not yet incorporated; dogfooded immediately in this repo's own `queue/` folder. Full spec + issue: docs/specs/document-ingestion-queue.md → [#80](https://github.com/atempel/workspace-kit/issues/80).

### Templates feature (planning — ingested from voice notes, 2026-07-14 and 2026-07-26)
Lets a user define and reuse their own workspace structure via a form + merge tags. The home nav already has a non-functional "Templates" pill (`navTemplates` in `src/workspace-kit.html`). Full spec + issue: docs/specs/templates-feature.md → [#32](https://github.com/atempel/workspace-kit/issues/32).
- [x] ~~Open decision: single HTML file vs. full app vs. HTML+backend~~ — resolved 2026-07-21, see DECISIONS.md.
- [x] ~~Rename question: should built-in "project types" be called "templates"?~~ — resolved 2026-07-26: no, built-ins are renamed "kits" instead (see `## Next`), avoiding a naming collision with this feature.

### Docker environment generation (planning — requested 2026-07-21, extended 2026-07-26)
Generates a Dockerfile/docker-compose per workspace, adapted per kit; templates can now also carry a Docker environment definition. Full spec + issue: docs/specs/docker-environment-generation.md → [#33](https://github.com/atempel/workspace-kit/issues/33).
- [x] ~~Surface split to clarify~~ — resolved 2026-07-21, see DECISIONS.md.

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
- [x] Full project review (past TASKS.md, other session history, open GitHub issues); multi-surface direction + context-manager repositioning decided; 5 specs written (docs/specs/) and issues opened (#20, #29, #32, #33, #34) (2026-07-21)
- [x] Checked all Workspace//Kit voice notes/docs in Notion against the repo; confirmed "Notas de áudio Workspace Kit 14/07" was already fully ingested and "Notas de Áudio 26/07" was not; ingested the latter, resolving the model-agnostic and "kits" rename decisions along the way (2026-07-26)
- [x] Wrote 5 new specs (workspace-inspection-layer, workspace-health-check, git-integration-layer, document-ingestion-queue, cross-tool-session-log) and opened their curated GitHub issues (#77–#81) with P0 requirements as GitHub sub-issues; disabled the auto-issue-per-bullet workflow (`update-issues.yml`, now `workflow_dispatch`-only) after it flooded ~41 granular issues from a single TASKS.md push; reorganized this file into a lean index pointing at specs instead of duplicating their content (2026-07-26)
- [x] Resolved the CHANGELOG.md vs. SESSIONS.md boundary (orthogonal axes, see DECISIONS.md); dogfooded `SESSIONS.md` and `queue/` in this repo (populated with the two real voice-note references); refreshed docs/PRD.md and PROJECT.md to reflect the 5 specs written 2026-07-26 and the kit rename; added standing "every session"/queue instructions to AGENTS.md. No code touched — repo is ready for Claude Code to start implementing the specs (2026-07-27)
