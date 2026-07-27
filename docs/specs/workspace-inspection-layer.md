# Spec — Workspace inspection layer

Status: draft, pending review. Source: Notion page "Notas de Áudio 26/07" (2026-07-26); scoped out of docs/specs/local-web-app.md's (→ #29) "open an existing workspace" P0 bullet into its own foundational spec, per TASKS.md's "Workspace inspection layer" section. No GitHub issue number yet — to be created after this spec is reviewed.

## Problem Statement
Everything workspace//kit has built so far *writes* a workspace: `core/generator.js`, the standalone HTML artifact, and the planned CLI all turn a project description into a set of files, once. Nothing today reads one back. That gap was invisible as long as workspace-kit was a one-shot generator, but it's now blocking a whole cluster of features that all need the same thing — a way to open an existing folder and know what's actually in it: which files exist, how big they are, what individual instructions live inside the agent-layer files, and how the files reference each other (the "RAG by Markdown" edges already named in CONTEXT.md). Without a shared module for this, the workspace health check, the Markdown Orchestrator integration, the cross-tool session log, the document ingestion queue, git file-state tracking, and the Local Web App's own "open an existing workspace" bullet would each grow their own ad hoc folder-walker and markdown parser — five or six slightly different, slowly diverging implementations of the same read. This spec defines the one read-side module — the counterpart to `core/generator.js` — that all of them build on instead.

## Goals
- Give every consumer listed above one shared, addressable index of an existing workspace: file existence, per-file size/line/character/estimated-token counts, individually parsed instructions from the agent-layer files, and the cross-reference graph between files.
- Mirror `core/generator.js`'s conventions (zero runtime dependencies, no build step, plain Node-compatible JS) so the write-side and read-side engines feel like one family of tooling, not two different projects.
- Confirm this as its own foundational piece — one spec, one eventual issue, one module — rather than letting each consuming feature spec quietly grow its own workspace parser.
- Reliably distinguish "this is a workspace-kit workspace" from "this is just a folder" (including a workspace that's been hand-edited since generation, not just a pristine generator-output), since several consumers need that judgment call and shouldn't each reinvent it.
- Supersede and absorb docs/specs/local-web-app.md's (→ #29) "open an existing workspace" P0 bullet — that flow becomes a thin rendering layer over this module's output rather than its own reader.

## Non-Goals
- **Health scoring, thresholds, or improvement suggestions** — computing the index and metrics is this spec's job; deciding what counts as "too big" or producing a suggestion ("split this file," "rotate this log") is docs/specs/workspace-health-check.md's job, built on top of this module's output.
- **Toggling instructions on/off or a hidden/isolated-folder mechanism** — the Markdown Orchestrator integration (see TASKS.md) consumes this module's parsed instruction units to build its enable/disable UI, but owns that mutation mechanism itself. This module parses and addresses instructions; it doesn't move or hide them.
- **Git status (staged/unstaged/committed) or worktree orchestration** — docs/specs/git-integration-layer.md's job. This module indexes file content and structure, not git state, though that spec's file-state tracking is expected to use this module's file index as its substrate.
- **Writing, generating, or modifying any workspace file** — this is explicitly the *read* counterpart to `core/generator.js`; generation stays there, and any future in-place editing capability (e.g. docs/specs/local-web-app.md's → #29 "add to an existing workspace") is a separate, later capability that may consume this module's output but isn't part of it.
- **A rendered UI for any consumer** — this spec ships an addressable data structure (a module/API), not a screen. The Local Web App's workspace summary view, the health check's report, the orchestrator's toggle list, etc. are each owned by their own consuming spec.
- **Standalone HTML artifact support** — per the 2026-07-21 multi-surface policy, reading an arbitrary folder from disk needs a local process. The HTML artifact can only ever inspect content a user pastes or uploads directly into it, which is a much narrower, separate capability if ever built — not in scope here.
- **Deciding the token-counting method** — heuristic (chars/4), a real tokenizer dependency, or model-specific counting are all still open (see Open Questions); this spec defines the index's shape, not the specific counting implementation.

## User Stories
- As the developer building the workspace health check (docs/specs/workspace-health-check.md), I want per-file size/line/character/token counts already computed so that I can define thresholds and verdicts without writing my own file walker.
- As the developer building the Markdown Orchestrator integration, I want agent-layer files already parsed into individually addressable instruction units so that I can build the on/off toggle mechanism on stable IDs instead of re-parsing markdown myself.
- As the developer building the Local Web App's "open an existing workspace" flow (docs/specs/local-web-app.md → #29), I want a single call that returns which files exist and their basic metadata so that the read-only workspace summary is a thin rendering layer over this module's output, not its own reader.
- As the developer building git file-state tracking (docs/specs/git-integration-layer.md), I want the file index addressable by path so that git status can be joined against a known file list instead of re-walking the folder myself.
- As the developer building the cross-tool session log and document ingestion queue (docs/specs/cross-tool-session-log.md, docs/specs/document-ingestion-queue.md), I want a reliable "is this a workspace-kit workspace" check so that each feature doesn't independently reinvent that detection.
- As Alexandre, I want the cross-reference graph ("RAG by Markdown" edges) computed once by a shared module so that every consumer that cares which files link to which reads a consistent graph instead of drifting on its own interpretation.

## Requirements

**Must-Have (P0)**
- `core/inspect.js`: a new module mirroring `core/generator.js`'s conventions — zero runtime dependencies, no build step, plain Node-compatible JS (`module.exports` at minimum; whether it also needs a `window.*` global like `core/generator.js` is an open question, see below, since no browser surface consumes it today).
  - Acceptance: the module has no dependency beyond Node's built-ins (`fs`, `path`) and runs with a bare `node -e "require('./core/inspect.js')"`.
- Recursive file discovery over a target folder, recognizing workspace-kit's known file set (human layer, agent layer, per-kit anchor files, generated folders) while still returning an index for a folder that only partially matches or has been hand-edited since generation.
  - Acceptance: opening a real generated workspace fixture returns entries for every file physically present; opening a folder with none of the expected files returns a clear "not a workspace-kit workspace" result rather than throwing (needed as-is by docs/specs/local-web-app.md's → #29 P0 acceptance criterion).
- Per-file metrics: size in bytes, line count, character count, and an estimated token count.
  - Acceptance: metrics for a sample fixture file match trivial hand-verification (e.g. line count matches `wc -l`, byte size matches the OS-reported file size).
- Instruction parsing: parse the agent-layer files (CLAUDE.md, AGENTS.md, `.cursor/rules/`, `.github/copilot-instructions.md`, GEMINI.md, `.windsurf/rules/`, Skill files) into individually addressable instruction units, each with a stable ID and enough location info (file path + line range) to be referenced later without re-parsing.
  - Acceptance: parsing a fixture agent file with N heading-delimited sections returns N instruction units with stable, re-derivable IDs across repeated runs on the same unchanged file.
- Cross-reference graph: parse markdown links and known reference conventions between workspace files (e.g. `@AGENTS.md`-style imports, prose mentions of `PROJECT.md`/`DECISIONS.md`/`TASKS.md`, standard `[text](path)` links) into a graph of edges between files.
  - Acceptance: given a fixture workspace with known cross-references (e.g. CLAUDE.md → AGENTS.md via `@AGENTS.md`, PROJECT.md → DECISIONS.md/CONTEXT.md/TASKS.md via its own generated text), the returned graph contains exactly those edges — no missing edges, no fabricated ones.
- Read-only guarantee: inspecting a workspace never writes, moves, or deletes any file in it.
  - Acceptance: running the full inspection against a real workspace produces zero filesystem writes, verified by comparing file mtimes/checksums before and after the call.
- CLI/Web-App-only by construction, per the 2026-07-21 multi-surface policy — no HTML-artifact code path.
  - Acceptance: the module has no DOM dependency and is never wired into `src/workspace-kit.html`.

**Nice-to-Have (P1)**
- Ignore-pattern support (skip `node_modules/`, `.git/`, and folders marked `localOnly` by the generated `.gitignore` convention) so scanning a real, lived-in repository doesn't choke on irrelevant or heavy content.
- A minimal CLI-consumable debug entry point (e.g. a `workspace-kit inspect` command dumping the index as JSON) usable for manual debugging even before the health check or orchestrator exist to consume it programmatically.
- Incremental re-scan support (skip re-reading files whose mtime hasn't changed since a previous scan), useful once the Web App holds a long-lived process rather than running one-shot.

**Future Considerations (P2)**
- Live/watched inspection (a file-watcher that re-indexes on change) instead of only on-demand scans — relevant once the Local Web App is a persistent local server rather than a request/response tool.
- A pluggable or model-specific tokenizer, once a concrete target model/tool is picked for the token-count feature (see Open Questions) — today's implementation should not hardcode assumptions that would block swapping this in later.

## Success Metrics
**Leading:** whether a hand-built fixture workspace (following the same pattern as `core/fixtures.json`) round-trips through the module and produces an exact expected index — every file, every count, every instruction unit, every graph edge — with zero manual fixes needed.
**Lagging:** whether the consuming specs (workspace health check, Markdown Orchestrator, cross-tool session log, document ingestion queue, git integration layer, Local Web App) actually import and call this module instead of each writing their own folder walker — the real test of whether the "foundational, shared piece" framing held up once those specs reach implementation.

## Open Questions
- **(Product/Engineering)** Where does estimated token counting come from: a heuristic (chars/4), a real tokenizer dependency (which would break `core/generator.js`'s zero-dependency convention this module is meant to mirror), or a model-specific counter? Explicitly unresolved — carried over from TASKS.md, not decided as part of this spec.
- **(Engineering, shared with Markdown Orchestrator)** What counts as one "instruction" — a bullet, a heading section, a whole file? This spec proposes heading-section granularity as a working default so other specs aren't blocked, but the Markdown Orchestrator integration is expected to define the definitive unit; the two need to converge on one shared definition rather than diverging.
- **(Engineering)** Does `core/inspect.js` need a `window.*` global export like `core/generator.js`'s UMD-lite pattern, given no browser/HTML-artifact surface consumes it in this spec's scope? Reasonable default is Node-only (`module.exports`) unless a concrete in-browser test harness need emerges.
- **(Engineering, blocking on Local Web App spec)** This module assumes direct Node `fs` access. If the Local Web App ends up using a client-side File System Access API instead of a local Node server (open question in docs/specs/local-web-app.md → #29), this module's API surface may need to move or be re-exposed accordingly.
- **(Resolved by this spec)** TASKS.md's "confirm this as a distinct foundational piece (own spec + issue)" — resolved: yes, it's its own spec here, distinct from any single consuming feature.

## Timeline Considerations
Foundational and blocking: the workspace health check, Markdown Orchestrator integration, cross-tool session log, document ingestion queue, and git integration layer specs all depend on this module existing before (or genuinely alongside) their own implementation work, and it directly supersedes the Local Web App's "open an existing workspace" P0 bullet. No hard deadline of its own, but it should be sequenced early relative to those five, rather than left to whichever consumer needs it first — that's exactly the per-feature duplication this spec exists to prevent.
