# Spec — Local Web App (MVP)

Status: draft, pending review. Part of the 2026-07-21 multi-surface direction (see PROJECT.md, DECISIONS.md).

## Problem Statement
The HTML artifact and the planned CLI both solve *generation* — turning a project description into a workspace, once. Neither solves what happens after: as workspace//kit repositions itself as a project context manager rather than a one-shot generator, there's no surface today for going back into a workspace you already generated to add something, review its state, or manage more than one project at a time. The Local Web App is that surface — a more robust, persistent home for both generating and managing workspaces.

## Goals
- Generate workspaces with full parity with the HTML/CLI generators (same 17 types, same human/agent layers), from a local web UI instead of a single-shot form or terminal prompts.
- Let a user come back to a previously generated workspace and see its state (which files exist, which agent formats are enabled) without re-reading the raw folder by hand.
- Support adding to an existing workspace after the fact (e.g. enabling an agent format that wasn't picked at creation time) — the first real "management" capability, deliberately kept small for MVP.
- Serve as the runtime host for capabilities that structurally can't live in the standalone HTML artifact: git operations, and (per their own specs) Templates management and Docker environment spin-up.

## Non-Goals
- **Full workspace lifecycle management** (task sync, decision-log rotation automation, multi-project dashboards) — that's the long-term "context manager" vision, not MVP. MVP is: generate, view, and make small additive edits to one workspace at a time.
- **Templates feature and Docker environment generation** — both get their own specs and build *on top of* the Web App once it exists; this spec doesn't implement either.
- **Multi-user / hosted / cloud version** — explicitly "local" per the 2026-07-21 decision; no auth, no multi-tenant concerns, no deployment story for MVP.
- **Replacing the standalone HTML artifact** — the HTML artifact stays available per the multi-surface decision; the Web App is additive, not a deprecation.
- ~~**Design-system-level polish**~~ — **retired 2026-07-28.** This Non-Goal assumed the Web App would functionally reuse the artifact's terminal identity. A high-fidelity prototype now exists ("Workspace Kit Dashboard") with its own decided stack and visual identity (React/Tailwind/shadcn, neutral base, dark+light) — see DECISIONS.md, 2026-07-28, and `docs/specs/web-app-dashboard.md`, which owns the whole read-side UI as its own spec.

## User Stories
- As a developer, I want to generate a new workspace from a local web UI so that I get the same generation experience as the HTML artifact, but running locally with file-system access instead of triggering a download.
- As a developer, I want the app to `git init` (and optionally make the first commit) when I generate a workspace, so that I don't do it by hand right after.
- As a developer, I want to open a workspace I generated last week and see which agent files and folders it has, so that I don't have to open a file explorer to remember what's there.
- As a developer, I want to add an agent format (e.g. add Cursor rules to a workspace that only had CLAUDE.md/AGENTS.md) without regenerating the whole thing, so that small changes don't force a full redo.
- As Alexandre, I want the Web App's generation logic to share a single source of truth with the CLI and, ideally, the HTML artifact, so the three surfaces don't drift (same open question as the CLI spec — this is the same underlying risk, not a separate one).

## Requirements

**Must-Have (P0)**
- Local web server + UI, generation flow at parity with the CLI/HTML generator (same fields, same 17 types, same output files).
  - Acceptance: output file set and content match the HTML/CLI generators for the same inputs.
- Writes directly to a folder the user picks (native file/folder access, not a .zip download).
  - Acceptance: after generation, the chosen folder on disk contains the full generated workspace with no manual extraction step.
- Optional `git init` + first commit on generation (same as the CLI's `--git` flag).
- ~~"Open an existing workspace" flow~~ — **superseded 2026-07-26/28.** The read itself belongs to `docs/specs/workspace-inspection-layer.md` (#77) and the rendering to `docs/specs/web-app-dashboard.md`; this bullet stays here only as the origin of both. Its acceptance criterion (a folder with none of the expected files shows a clear "not a workspace-kit workspace" state rather than erroring) is carried forward verbatim in both successors.
- "Add to an existing workspace" — minimally, enabling an additional agent-format file (e.g. add `.cursor/rules/` to a workspace that didn't have it) using the same generation templates as initial creation.
  - Acceptance: the added file(s) match what initial generation would have produced for that same agent format, and existing files are left untouched.

**Nice-to-Have (P1)**
- Local history/list of workspaces the app has generated or opened, so returning users don't have to re-navigate to the folder manually.
- Editing PROJECT/DECISIONS/CONTEXT/TASKS content directly in the app (basic markdown editing), instead of only adding new files.
- Visual diff/preview before writing changes to an existing workspace.

**Future Considerations (P2)**
- Templates management UI (create/name/reuse templates) — belongs to the Templates spec once this app exists to host it.
- Docker environment generation/spin-up UI — belongs to the Docker spec once this app exists to host it.
- Task/decision-log rotation tooling (CHANGELOG.md split-out, ADR-style DECISIONS.md rotation) as an in-app feature, per the context-manager-conventions spec.
- Multi-project dashboard view.

## Success Metrics
**Leading:** whether generation output stays at parity with the CLI/HTML across all 17 types (target: 100%, same verification approach as the CLI spec); whether "open an existing workspace" correctly reads real workspaces generated by any of the three surfaces.
**Lagging:** whether Alexandre starts using the Web App as the primary way to both start *and* revisit projects, rather than only using the HTML artifact/CLI for the initial generation step (again, self-usage is the realistic signal pre-launch).

## Open Questions
- **(Resolved 2026-07-21, see DECISIONS.md)** Same generation-logic-sharing question as the CLI spec: the Web App, CLI, and HTML artifact will share one centralized generation engine, not independent copies of the templates — needed for Templates to be portable across surfaces. Still open: the exact technical shape of that shared module (see the DECISIONS.md entry's engineering follow-up).
- **(Engineering)** Local server stack: plain Node HTTP server, or a small framework (Express/Fastify)? No strong constraint stated yet — reasonable default is whatever the CLI ends up using, to maximize shared code.
- **(Engineering)** File-system access model: Node backend with a browser front-end talking to a local server (most flexible, easiest to share code with the CLI) vs. a fully client-side approach using the File System Access API (fewer moving parts, but more browser-compatibility risk and no route to running git/Docker later). Given the Web App's whole reason for existing is doing things the HTML artifact can't (git, later Docker), a local-server-backed approach seems necessary — but worth confirming before building.
- **(Product — Alexandre)** How much of "management" (beyond the P0 add-a-format case) is actually wanted in v1 vs. deferred? The TASKS.md note "see how much of that management also goes to the CLI" is still open — worth deciding once this MVP is in hand rather than up front.

## Design Reference
The read-side UI for this surface is prototyped and specced separately: `docs/specs/web-app-dashboard.md`, built from `docs/design/workspace-kit-dashboard.dc.html`. This spec keeps the generation/management mechanics; that one keeps the screens.

## Timeline Considerations
No hard deadline. Foundational alongside the CLI spec — Templates and Docker environment generation both build on whichever of these two ships first (or both, if built together). Reasonable to scope this MVP tightly (P0 list above) rather than let "context manager" ambitions expand it before it exists at all.

## Implementation status
**Server side started 2026-07-29:** `core/server.js` + `workspace-kit serve` provide the read-only local JSON surface (`/api/dashboard`, `/api/index`, `/api/doctor`, `/api/status`), confirming the local-Node-server decision of the same date. It is read-only by construction and must not grow write endpoints ahead of #79's blocked commit/PR/worktree questions.

**Still open:** the generation flow (P0 parity with CLI/HTML), writing to a user-picked folder, `git init` on generation, "add to an existing workspace", and the front end itself.

