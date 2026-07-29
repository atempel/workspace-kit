# Spec — Cross-tool session log

Status: draft, pending review. Source: Notion voice note "Notas de Áudio 26/07" (2026-07-26), ingested into TASKS.md same day. No GitHub issue yet — will be opened after this draft is reviewed.

## Problem Statement
The same workspace is often worked on from several tools in sequence — Claude Design for a mockup, Cowork for planning, Claude Code for implementation — but nothing records what happened where. Anyone picking the workspace back up (human or agent) has to reconstruct the handoff from memory or by re-reading everything, and the thread between design → planning → development gets lost. This is the cheapest of the 2026-07-26 batch: mostly a new generated file plus a standing instruction telling whichever tool is running to append to it, so it works on all three surfaces without needing a local process.

## Goals
- Give every workspace a single place recording, per session, which tool touched it, what was done, and what state it was left in.
- Make the log self-maintaining: the instruction to append fires every session, not just at project onboarding.
- Ship it as plain generated text/instructions so it works identically on the standalone HTML artifact, the CLI, and the Web App.

## Non-Goals
- **Same artifact as CHANGELOG.md (docs/specs/context-manager-conventions.md → #34)** — distinct axis: CHANGELOG.md is narrative *project* history (decisions, features shipped) rotated out of CONTEXT.md; this log is a *tool-handoff* record (who touched the workspace, in what tool, leaving it in what state), written far more mechanically and far more often. See Open Questions — the boundary is asserted here but not yet stress-tested.
- **A dashboard, timeline UI, or query interface over the log** — v1 is a flat file an agent reads/appends as text; visualizing it is Web-App territory for later, once docs/specs/workspace-inspection-layer.md exists to parse it.
- **Automatic session-boundary detection** — there's no hook that fires "session ended"; this relies entirely on the standing instruction telling the agent to append before it finishes, not on tooling that detects the moment for it.
- **Merge-conflict resolution for simultaneous edits** — if two tools touch the workspace at once, reconciling their log entries is a normal git-merge concern for the user, not something this feature solves.

## User Stories
- As someone who mocked up a workspace's structure in Claude Design, I want the next tool to see what I did and why, so the plan → build handoff doesn't lose the thread.
- As Claude Code picking up a workspace last touched in Cowork, I want to read one file and know what state it was left in, so I don't have to reconstruct context from scratch.
- As the workspace owner, I want each tool to append its own entry without me remembering to write it myself, so the log stays current with zero extra effort on my part.

## Requirements

**Must-Have (P0)**
- A new root file, `SESSIONS.md`, holding append-only, structured entries: date, tool/surface, what was done, resulting state left behind.
  - Acceptance: the file ships with one worked example entry demonstrating the exact field format, so an agent can pattern-match rather than invent its own shape.
- A standing instruction in CLAUDE.md/AGENTS.md (and per-tool variants) telling the agent to append an entry to `SESSIONS.md` before ending its session — placed in the "every session" convention section, not a "first-run only" block.
  - Acceptance: the instruction wording explicitly says "every session" and lives outside whatever mechanism the onboarding instruction (see TASKS.md's `## Next`) uses to fire once; a reviewer can point at the instruction and confirm it isn't gated by any one-time flag.
- Available on all three surfaces as pure generated text, no local process required — ships in the standalone HTML artifact's output identically to the CLI/Web App.
  - Acceptance: a workspace generated from `src/workspace-kit.html` contains `SESSIONS.md` plus the standing instruction, matching the CLI/Web-App output in shape.
- Clear separation from CHANGELOG.md (#34): different file, different section of the instructions, no shared template.
  - Acceptance: a workspace with both conventions present has two files, each with a one-line note pointing at the other and explaining which question it answers.

**Nice-to-Have (P1)**
- A convention for how an agent identifies *which* tool it's running as (Claude Design/Cowork/Claude Code/CLI/Web App), since there's no reliable environment signal — likely just an instruction to state it plainly based on what the agent already knows about its own context.

**Future Considerations (P2)**
- A rotation/pruning policy for `SESSIONS.md` once it grows long, mirroring #34's CHANGELOG.md approach — not designed now, revisit once the file has actually accumulated entries in this repo.
- Surfacing the log as a visual timeline in the Web App, consuming docs/specs/workspace-inspection-layer.md once that exists.

## Success Metrics
**Leading:** dogfooded in this repository — across at least two different tools working on workspace//kit itself, entries get appended without a manual reminder.
**Lagging:** whether someone switching tools mid-project can reconstruct the design → planning → development handoff from `SESSIONS.md` alone, without re-reading unrelated files.

## Open Questions
- **(Resolved 2026-07-27, see DECISIONS.md)** The CHANGELOG.md boundary is stable: the two files sit on orthogonal axes. CHANGELOG.md (once created, #34) is narrative *product* history — what shipped, what was decided; coarse-grained and judgment-driven. `SESSIONS.md` is a mechanical *tool-handoff* record — who touched the workspace, in what tool, leaving it in what state — written automatically, every session, with no editorial judgment. A `SESSIONS.md` entry may reference a CHANGELOG.md/DECISIONS.md entry but never restates the *why*; that discipline is what keeps the two from converging. Dogfooded immediately: this repo's own `SESSIONS.md` now carries this exact boundary note in its header.
- **(Product — Alexandre)** File naming: `SESSIONS.md` vs. something else — should match the existing root-file convention (PROJECT.md, DECISIONS.md, CONTEXT.md, TASKS.md) but the name needs to read as "tool handoff log," not be confusable with CHANGELOG.md.
- **(Engineering)** How does an agent reliably self-identify which tool/surface it's running as, given there's no environment variable guaranteeing it — is a plain "state what you know about your own context" instruction good enough, or does this need per-surface generated instruction variants that hardcode the tool name?
- **(Engineering)** One-line boundary check against docs/specs/document-ingestion-queue.md: that feature's "ingested on date X" marker is also a form of history, but scoped narrowly to queue items — does it need its own note pointing back here, symmetric to the note this spec owes CHANGELOG.md?

## Timeline Considerations
No dependency on the CLI or Web App reaching MVP — this is generated text plus an instruction, so it can ship to the standalone HTML artifact directly. Per the same sequencing logic as #34 and the Templates feature, dogfood in this repository first (add `SESSIONS.md` here and start appending to it) before offering it as a generated convention to workspaces this tool produces.

## Implementation status
**Read side done 2026-07-29:** `core/inspect.js` parses `SESSIONS.md` into `index.sessions` (date, tool, Did, Left at), newest-first, closing this spec's deferral of parsing to the inspection layer. **Still open:** the generation half — emitting `SESSIONS.md` plus the "every session" standing instruction into generated workspaces from all three surfaces. This repo dogfoods both already, but the generator does not yet produce them.
