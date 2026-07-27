# Spec — Document ingestion queue

Status: draft, pending review. Source: Notion page "Notas de Áudio 26/07" (2026-07-26), surfaced in TASKS.md alongside the other 2026-07-26 items; grounded in a manual workflow actually performed in a prior session (see Problem Statement).

## Problem Statement
People save references faster than they incorporate them: a Miro board, a voice note, an external doc gets dropped somewhere (a Notion page, a bookmark, a note app) with the intent of "bring this into the project later." Nothing today tracks that intent — so the only way to answer "what have I saved that I haven't brought into the project yet?" is to manually re-investigate from scratch every time.

This isn't hypothetical: in a recent real session, Alexandre had a Notion project card ("Workspace//Kit") with two voice-note pages nested under it, and wasn't sure which had already been incorporated into this repo's docs. An AI agent had to manually search Notion, fetch each page's full content, cross-reference it against TASKS.md/DECISIONS.md/CONTEXT.md and grep the codebase, and report back which was ingested and which wasn't. That entire investigation — repeatable, mechanical, and avoidable — is exactly what this feature should turn into a first-class, low-effort convention: save a reference once as a queue item, and its own file answers "ingested or not" from then on, with no re-investigation required.

## Goals
- Give a workspace a durable, low-effort place to record "I saved this reference, I haven't ingested it yet" as it happens, instead of relying on memory or an ad hoc search later.
- Make "has this been ingested" a question answered by reading one file, not by cross-referencing TASKS.md/DECISIONS.md/CONTEXT.md and the codebase by hand.
- Keep the history of what was ingested and when, without inventing a second history file that duplicates TASKS.md or the cross-tool session log.
- Ship as content-generation only, so it works identically on all three surfaces (CLI, Web App, standalone HTML) from day one.

## Non-Goals
- **Actually fetching or rendering the referenced content** (opening the Miro board, transcribing the voice note, pulling the doc's text) — that requires a local process and touches the no-network constraint in CONTEXT.md ("no backend, no external API calls requiring a key," scoped to the standalone HTML but a real consideration for CLI/Web-App fetch features too). v1 only generates and tracks the reference *stub*, never retrieves what it points to.
- **Automated ingestion detection** (an agent scanning the queue against the actual docs and auto-flipping status) — v1's status change is a manual, agent-or-user-performed edit, same precedent as docs/specs/context-manager-conventions.md → #34's "manually-followed policy, no automation in v1." Automation is a later step once the manual convention proves useful.
- **A separate aggregated index/summary file** — one folder of per-item `.md` files plus a documented grep convention is enough for v1; building a real aggregated view is the kind of thing the Workspace inspection layer (docs/specs/workspace-inspection-layer.md) exists to eventually provide across every feature that needs one, not something this feature should build its own copy of.
- **Overlapping with TASKS.md or the cross-tool session log** — see Open Questions for the exact boundary; the explicit design goal is that these three files never end up doing the same job.
- **Priority/ordering on queue items** — it's a flat set of pending references, not a ranked backlog; if prioritization is ever needed, that's what TASKS.md is already for once an item graduates into an actual task.

## User Stories
- As Alexandre, I want to save a reference (a voice note, a doc, a link, a board) into my workspace the moment I think "I should bring this in later," so that it isn't only living in my memory or in Notion with no trace in the project itself.
- As Alexandre, I want to open a saved reference's own file and immediately see whether it's already been ingested, so that I never again have to ask an agent to manually search Notion and cross-reference three files to answer that question.
- As an agent working in this repo, I want a documented convention for where pending references live and how "ingested" is recorded, so that I can both file new references and correctly update one when I finish incorporating it.
- As Alexandre, I want the record of an already-ingested reference kept (not deleted) once it's done, so that the queue also serves as a lightweight history of what got pulled in and when, without needing to check a different file for that.

## Requirements

**Must-Have (P0)**
- Queue folder convention: a `queue/` folder at the workspace root holding one `.md` stub file per saved reference (not a single monolithic queue file, and not a convention bolted onto TASKS.md).
  - Acceptance: the convention is documented in generated CONTEXT.md/CLAUDE.md/AGENTS.md text — where `queue/` lives, what a stub file looks like, and the status-field convention below.
- Stub generation: given a small set of inputs (title, type, source, optional note), generate one `.md` file following a fixed stub format.
  - Acceptance: the generated stub contains, at minimum, a title heading and a metadata block with **Type**, **Source**, **Added** (date), and **Status** (`Pending`); this is generatable identically on all three surfaces (a copy/download-able block of text on the standalone HTML, a written file on CLI/Web App).
  - Stub format:
    ```
    # Queue item — <Title>

    - **Type:** <Voice note | Document | Link | Board | Other>
    - **Source:** <URL or description>
    - **Added:** <YYYY-MM-DD>
    - **Status:** Pending

    ## Notes
    <optional free text — what this covers, why it was saved, what to extract when ingesting>
    ```
- In-place "mark as done" convention: ingesting a reference is recorded by editing that same file's own **Status** field (e.g. `Status: Ingested (2026-07-26)`), optionally adding an **Ingested into:** line naming which file(s)/section(s) absorbed it — not a checkbox list, not a move to a different folder, not a new entry in another file.
  - Acceptance: a queue item can go from `Status: Pending` to `Status: Ingested (<date>)` by editing only that one file; the file's full history (when added, when ingested, where it went) is readable from that single file with no other file consulted.
- Lookup convention documented, no new index file: a one-line grep pattern (e.g. `grep -l "Status: Pending" queue/*.md`) documented in AGENTS.md/CLAUDE.md as "how to list open queue items," so the folder-of-files approach doesn't need a hand-maintained aggregator to stay useful.
  - Acceptance: the documented command correctly lists only the pending items in a folder containing a mix of pending and ingested stubs.
- Dogfood in this repository: create `queue/` here and populate it with the real backlog this spec is grounded in — the two Notion voice-note pages under the "Workspace//Kit" project card — with their status set to reflect what's actually already known (per TASKS.md's 2026-07-26 "Done" entry, both have already been checked; record that outcome in the stub rather than leaving it to memory).
  - Acceptance: `queue/` in this repo contains a stub per voice note, each with the correct Status and (where applicable) Ingested into field, so the next session never has to re-run that investigation by hand.

**Nice-to-Have (P1)**
- A CLI/Web-App convenience command (e.g. `workspace-kit queue list`) that reads `queue/` and prints pending vs. ingested items — a nicer wrapper around the same grep convention, not a new source of truth.
- A form UI (standalone HTML and Web App) for adding a queue item — Type/Source/Added/Notes fields — instead of hand-writing the stub, mirroring the existing form → preview → download pattern used elsewhere in the product.
- Configurable/extendable Type enum, if the fixed list (Voice note/Document/Link/Board/Other) turns out too narrow for how references actually show up in practice.

**Future Considerations (P2)**
- Actually fetching/rendering referenced content (would need per-source auth — a Notion API key, a Miro API key, etc.) — explicitly deferred; a different-shaped problem than this spec, and in tension with the no-network/no-API-key constraint on at least the standalone HTML surface.
- Ingestion-detection assistance (an agent proposing "this queue item looks incorporated already, confirm?") built on top of whatever the Workspace inspection layer (docs/specs/workspace-inspection-layer.md) eventually exposes as an addressable index of a workspace's files — not before that foundational piece exists.
- Folding queue items into a future aggregated view if grep-based lookup ever proves insufficient in practice.

## Success Metrics
**Leading:** this repo's own `queue/` folder exists, populated with the real historical backlog (the two Notion voice-note pages), each correctly reflecting its actual ingested/pending status — the concrete test that the convention answers "was this ingested?" without a fresh investigation.
**Lagging:** whether Alexandre actually files new references into `queue/` as he saves them, rather than letting them sit in Notion until a memory-jog conversation forces another manual audit — the real recurring failure mode this feature targets, and the only signal that actually matters at this stage.

## Open Questions
- **(Product — Alexandre)** Stub filename/slug convention — kebab-case of the title, date-prefixed, or something else? Cosmetic; pick a sensible default now and revisit if it's ever annoying.
- **(Product — Alexandre)** Should **Type** be a fixed small enum (Voice note/Document/Link/Board/Other) or freeform text? Fixed is more consistent for the grep convention; freeform is more flexible for reference kinds not anticipated here.
- **(Resolved)** Mark-as-done mechanism: in-place edit of the item's own **Status** field, not a checkbox list, not a move-to-done-folder, not a session-log append — chosen because it keeps a reference's entire lifecycle in one file, needs no filesystem move, and is therefore trivially available on all three surfaces including the standalone HTML (see Requirements).
- **(Resolved)** Boundary against TASKS.md: `queue/` holds only external references awaiting ingestion, never general project tasks; TASKS.md may optionally link to `queue/` in a single line but never enumerates its items — a list of pending references is adjacent to a task list but is not one (it tracks "have I looked at this" rather than "what work is left to do").
- **(Resolved 2026-07-27, see docs/specs/cross-tool-session-log.md and DECISIONS.md)** Whether an ingestion event should also produce an entry in the cross-tool session log: the queue item remains the sole authoritative record for *that specific reference's* lifecycle (its own Status/Ingested-into fields); `SESSIONS.md`'s per-session entries may mention "ingested queue item X" in passing as a mechanical handoff fact, but are never required to, and never restate the why. Consistent with the CHANGELOG.md/SESSIONS.md boundary resolved the same day — three overlapping "history of what happened" files was the risk, and each of TASKS.md/queue/SESSIONS.md now has one clear, non-overlapping job.
- **(Engineering)** Does this feature need any involvement from docs/specs/workspace-inspection-layer.md's addressable index (e.g., to eventually power the P1 `queue list` command), or is a folder of files plus grep sufficient indefinitely at this feature's scope? Lean toward "sufficient for now" — flagged only because that inspection layer explicitly lists this feature as a consumer to keep in view.

## Timeline Considerations
Content-generation only, so — unlike template management or git integration — it doesn't need the CLI or Web App to reach MVP first; even the standalone HTML can generate a single stub's text for copy/paste or download today. This makes it one of the cheapest features in the current batch to actually build and dogfood, and the repo-local dogfooding step (populating this repo's own `queue/`) can happen immediately, independent of any surface's build status.
