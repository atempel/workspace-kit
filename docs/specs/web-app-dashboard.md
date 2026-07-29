# Spec — Local Web App dashboard (workspace lifecycle UI)

Status: draft, prototyped. Source: the Claude Design prototype "Workspace Kit Dashboard" (2026-07-27/28), built from `docs/design/prototype-prp.md` and `DESIGN.md`, then extended with a Git section per `docs/design/git-layer-dashboard-brief.md`. The prototype's markup is versioned at `docs/design/workspace-kit-dashboard.dc.html` as the visual reference.

## Problem Statement
Five specs written 2026-07-26 (#77–#81) each define a piece of workspace//kit's "lifecycle" half — inspecting a workspace, checking its health, logging sessions, queuing references, operating git. Each is specced as data and CLI behavior; none of them says what the user actually *sees*. The Local Web App spec (#29) reserves the surface but explicitly deferred visual work ("Design-system-level polish" was a Non-Goal, MVP was to reuse the artifact's terminal look functionally). That deferral is now obsolete: a high-fidelity prototype exists covering all five features as one coherent screen, and it's specific enough to build against. This spec is the bridge — it defines the dashboard UI as its own implementable unit so the five underlying specs stay about data/logic and don't each grow their own UI section.

This spec is the **read/act surface over the other five**; it owns no domain logic of its own. Every number it renders comes from `core/inspect.js` (#77) and its consumers.

## Goals
- Turn the prototype into an implementable spec: one shell, five sections (Overview, Health check, Session log, Queue, Source control), each a thin rendering layer over an existing spec's output.
- Fix the Web App's stack and visual identity as an explicit, logged decision rather than an implicit one carried over from the HTML artifact (see DECISIONS.md, 2026-07-28).
- Keep the boundary hard: this spec renders; #77–#81 compute. If a section needs a number the underlying spec doesn't produce, the fix goes in that spec, not here.
- Ship dark and light as equally first-class, per `DESIGN.md`.

## Non-Goals
- **The generation flow** (project name/description form, kit picker) — that's the existing HTML artifact's and the CLI's territory (#20/#29); this dashboard is the *read* side, opening a workspace that already exists.
- **Domain logic of any kind** — thresholds, token estimation, git classification, cross-reference parsing all belong to #77–#81. This spec must not reimplement or hard-code any of it.
- **The standalone HTML artifact's visual identity** — the artifact keeps its v3 terminal look (`decisions/008-v2-visual-identity.md`) unchanged. The two surfaces are deliberately allowed to look like different products; see `DESIGN.md`'s scope note.
- **Mobile/responsive layout** — desktop-first, matching the prototype and its Cursor/Notion reference points.
- **Multi-project dashboard** — one workspace at a time; the prototype's workspace switcher is a shell affordance, not a portfolio view (that stays #29's P2).
- **Real-time/watched updates** — on-demand scan per the inspection layer's own scope; live file-watching is #77's P2.

## Requirements

**Must-Have (P0)**
- App shell: persistent left sidebar (workspace identity, section nav, recent items) + content area, per the prototype. No top mega-nav.
  - Acceptance: the five sections are reachable from the sidebar and share one shell; switching sections does not reload the workspace scan.
- Overview section rendering `core/inspect.js`'s (#77) output: grouped file list with per-file line count, size, and estimated token count, plus the cross-reference graph as a node/edge diagram.
  - Acceptance: every file and every graph edge shown comes from the inspection layer's returned index — no file list is hard-coded in the UI.
- Broken cross-references surfaced twice: as a badge on the affected file's own row *and* as an annotation in the graph.
  - Acceptance: a workspace with a known dangling link (e.g. PROJECT.md → a missing `docs/PRD.md`) shows both, naming the missing target.
- Health check section rendering #78's report: overall verdict, always-loaded context budget against target, per-file status, and history-growth rows (e.g. "DECISIONS.md — 12/15 entries before rotation") as a distinct block from per-file size status.
  - Acceptance: verdicts and thresholds come from #78's structured output; the UI applies no threshold logic of its own.
- Every token count labeled as an estimate wherever it appears, naming the heuristic (chars ÷ 4, approximate).
  - Acceptance: no screen presents a token figure as an exact count.
- Status language used consistently across all five sections: color + icon + text label together, never color alone (accessibility), with the palette fixed in `DESIGN.md` (green healthy / amber warning / red over-budget or broken / muted neutral).
  - Acceptance: the same status renders identically in the Overview table, the health report, and the queue.
- Session log section rendering `SESSIONS.md` (#81) as a reverse-chronological list, with the tool/surface visually tagged and Did/Left-at fields per entry.
  - Acceptance: entries parse from the real file; the tool tag is derived from the entry, not inferred by the UI.
- Queue section rendering `queue/*.md` (#80): Type/Source/Added/Status/Notes per item, pending items scannable at a glance across a long list.
  - Acceptance: pending vs. ingested is distinguishable without opening any item; the view reflects the same items `grep -l "Status: Pending" queue/*.md` would return.
- Source control section rendering #79: per-file git state rollup, plain-language commit flow, PR flow that stops at "PR opened," worktree list, and the safe-edit warning state.
  - Acceptance: no raw git command appears in the UI; no approve/merge control exists anywhere in this section.
- Empty/error state: pointing the app at a folder that isn't a workspace//kit workspace states that plainly, reports what was scanned, and offers "generate a workspace here" / "pick another folder" — never an error screen.
  - Acceptance: matches #77's "not a workspace-kit workspace" result being a first-class return value, not an exception.

**Nice-to-Have (P1)**
- Command palette (⌘K) for section/file navigation — in the prototype's shell, fits the Cursor/Notion reference directly.
- Worktree conflict flag when two worktrees have touched the same file (#79's P1, already drawn in the prototype).
- Suggestion dismissal state on the health check (prototype has the control; whether dismissals persist, and where, is an Open Question).
- Workspace switcher across recently opened workspaces (shell affordance only, not #29's P2 multi-project dashboard).

**Future Considerations (P2)**
- Session log as a visual timeline rather than a list (#81's P2).
- Rendering the health report from #78's `--json` output directly, so CLI and Web App provably share one analysis (#78's P1).
- In-app editing of the human-layer files (#29's P1) — read-only until the git safe-edit substrate (#79) is real.

## Success Metrics
**Leading:** the built dashboard renders this repo's own workspace and matches the prototype's layout section for section, with every number traceable to an underlying spec's output rather than to UI code.
**Lagging:** whether Alexandre opens the dashboard to answer "is this workspace healthy / what's pending here" instead of reading the raw `.md` files — the same self-usage signal the other specs use, and the only real test of whether a UI over Markdown earns its existence.

## Open Questions
- **(Resolved 2026-07-28, see DECISIONS.md)** Stack: React + Tailwind + shadcn/ui with a build step, scoped to the Web App surface only. The standalone HTML artifact's "no build step, no framework" constraint is unchanged and now explicitly per-surface rather than project-wide.
- **(Resolved by the prototype)** Visual identity for this surface: neutral shadcn base, Inter + JetBrains Mono, amber/teal accent, dark and light equally first-class — distinct from the artifact's v3 terminal identity. Logged in DECISIONS.md; `DESIGN.md`'s corresponding Open Questions should be marked resolved when that file lands (it currently sits uncommitted in the `tasks-progress` worktree).
- **(Engineering)** How the front-end reaches the file system: this depends on #29's still-open local-server vs. File System Access API question, and on #77's note that `core/inspect.js` assumes Node `fs`. The dashboard is blocked on that answer for real data, not for layout.
- **(Engineering)** Whether suggestion dismissals, the workspace list, and theme preference persist — and if so, where (local config file vs. browser storage). Nothing in the prototype implies a store yet.
- **(Product — Alexandre)** Whether the Source control section's actions actually execute git from the UI in v1, or only display state and hand off to the CLI. #79's P0 commit/PR flows imply execution; scoping that to CLI-first would be a legitimate smaller v1.

## Timeline Considerations
Blocked on `core/inspect.js` (#77) for every number it displays — layout can be built against fixture data in parallel, but the dashboard is not meaningfully done before the inspection layer exists. Sequence after #77 and alongside #78, which supplies the richest single section. The Source control section trails #79, which is itself blocked on #77. Nothing here blocks the CLI (#20) — the two surfaces share `core/`, not UI.

## Design Reference
- `docs/design/workspace-kit-dashboard.dc.html` — the prototype markup (versioned; the full Claude Design project export, including its shadcn bundle, is deliberately not committed).
- `docs/design/prototype-prp.md` — the brief the prototype was built from.
- `docs/design/git-layer-dashboard-brief.md` — the follow-up brief that added the Source control section.
- `DESIGN.md` — visual direction (tokens, typography, principles).

## Implementation status
**Data layer complete 2026-07-29.** Every number this spec renders is now produced by `core/` and served by `core/server.js` at `/api/dashboard` in a single round trip — deliberately one scan, so the five sections cannot disagree with each other mid-refresh:

| section | source | status |
|---|---|---|
| Overview (file table + graph, with git column) | `core/inspect.js` (#77) + `core/git.js` (#79) | done |
| Health check | `core/doctor.js` (#78) | done |
| Session log | `core/inspect.js` `parseSessions` (#81) | done |
| Queue | `core/inspect.js` `parseQueueItem` (#80) | done |
| Source control — file states | `core/git.js` (#79) | done |
| Source control — commit / PR / worktree actions | #79 | **blocked** on two owner decisions |

The payload carries a `capabilities` object (`{commit: false, pullRequest: false, worktrees: false}`) so the UI can render those controls as unavailable rather than drawing live-looking buttons over nothing.

**Not started:** the front end itself (React + Tailwind + shadcn per DECISIONS.md, 2026-07-28), which is the remaining work for this spec.

