# Spec — Context-manager conventions (CHANGELOG + decision-log rotation)

Status: draft, pending review. Grounded in findings from a separate session ("Context.md file size") surfaced during the 2026-07-21 planning review; validated pattern applied to two targets — this repo's own docs, and a future product convention.

## Problem Statement
Log-style files (CONTEXT.md's narrative history, DECISIONS.md's chronological entries) are genuinely useful — they give an agent a project's history — but they only grow, never shrink, and eventually become long and heavy enough that reading them in full every session wastes context and attention. This is the exact problem the 2026-07-14 voice note flagged for workspace-kit's own conventions ("status.md e decisions.md podem ficar longos e pesados"), and a pattern for solving it was already validated in a different project: split the ever-growing narrative out into an on-demand file, and rotate old decision entries into individual files with an index. This spec applies that validated pattern in two places: this repository's own documentation, and — as workspace-kit repositions from generator to context manager — as a convention the tool itself could offer to every workspace it produces.

## Goals
- Keep this repo's own CONTEXT.md and DECISIONS.md from growing into files that are expensive to read every session, without losing the history they currently hold.
- Establish a concrete, numeric policy (not just "keep it short") so future sessions apply it consistently instead of re-deciding each time.
- Validate the pattern on this repo first, so that offering it as a generated convention (future product feature) is proven, not speculative.

## Non-Goals
- **Automating the rotation with tooling/scripts in v1** — v1 is a documented convention an agent follows manually when it notices a file has grown past the threshold, not a script that runs itself. Automation is a later step once the manual version proves useful.
- **Applying this to TASKS.md** — TASKS.md is a live, frequently-edited file by design (see CONTEXT.md's "RAG by Markdown" framing); it isn't a pure append-only log the way DECISIONS.md is, so the same rotation logic doesn't obviously apply. Not addressed here.
- **Making this a generator-form option before the CLI/Web App exist** — offering "enable log rotation" as a checkbox in the standalone HTML generator's output is plausible eventually, but the convention needs to actually be lived with in this repo first (see Goals).

## User Stories
- As an agent working in this repo, I want CONTEXT.md to stay focused on current, always-relevant context so that I'm not reading a long narrative history just to understand today's conventions.
- As an agent working in this repo, I want a place to look up *why* an old decision was made without that history bloating the file I read every session.
- As Alexandre, I want a numeric trigger (not a vague "when it feels long") for when to split CONTEXT.md's history into CHANGELOG.md or rotate old DECISIONS.md entries, so this doesn't rely on remembering to do it.
- As a future user of workspace-kit-the-context-manager, I want my own generated workspace to come with the same anti-bloat convention so I don't hit the same problem later on my own project.

## Requirements

**Must-Have (P0)**
- `CHANGELOG.md` introduced in this repo, holding narrative/historical entries currently mixed into CONTEXT.md (if any accumulate there going forward — CONTEXT.md is intentionally kept to current conventions/constraints/vocabulary per its existing structure).
  - Acceptance: CHANGELOG.md exists, documented as **on-demand/grep-only reading** (not part of the always-read file set) in CLAUDE.md/AGENTS.md's "See also" list.
- Explicit pruning policy for CHANGELOG.md: entries older than ~3 months get summarized to one line or removed.
  - Acceptance: the policy is written down (in CHANGELOG.md's own header or CONTEXT.md) in concrete terms — "~3 months," not "periodically."
- ADR-style rotation policy for DECISIONS.md: once it passes ~15 entries, older entries move to individual files under a `decisions/` folder, leaving an index (one line + link) in DECISIONS.md itself.
  - Acceptance: the policy is written down with the numeric trigger; DECISIONS.md is at or below that count today, so this is a documented future action, not an immediate rewrite (see Non-Goals — no automation yet).
- Both policies applied consistently to (a) this repository's own docs, and (b) recorded in DECISIONS.md as the intended future product convention — already partially done in the 2026-07-21 DECISIONS.md entry; this spec is where the detail lives.

**Nice-to-Have (P1)**
- A short "how to rotate" checklist (in CLAUDE.md/AGENTS.md or CONTEXT.md) so any agent — not just the one that set this up — can execute the rotation correctly when the trigger is hit.
- Cross-link fix noted separately in TASKS.md: CONTEXT.md is currently missing from the "See also" list in AGENTS.md/CLAUDE.md (only listed in README/starter prompt) — worth fixing alongside this, since it's the same "keep the reference network accurate" concern.

**Future Considerations (P2)**
- Offering this as a generation-time option ("enable changelog/decision-log rotation for this workspace") once the CLI/Web App exist and the pattern has been lived with here for a while.
- Automated tooling (a script or agent routine that performs the rotation itself when triggered) instead of a manually-followed policy.

## Success Metrics
**Leading:** CONTEXT.md and DECISIONS.md stay under a reasonable size going forward (rough target, consistent with the "RAG by Markdown" research already in CONTEXT.md: always-loaded files under ~300 lines — DECISIONS.md is arguably not "always loaded" the same way CLAUDE.md/AGENTS.md are, but the same instinct applies).
**Lagging:** whether this actually gets applied when the DECISIONS.md ~15-entry trigger is hit, rather than being a policy that's written down and then ignored — the real test of whether it was worth formalizing.

## Open Questions
- **(Product — Alexandre)** Is ~15 entries / ~3 months the right threshold, or was that specific to the other project this pattern came from? Treated here as a reasonable starting default, not a firm number.
- **(Product — Alexandre)** Should CHANGELOG.md be created now (proactively, ahead of CONTEXT.md actually growing a narrative history) or only once there's real content to move into it? Current CONTEXT.md is short (19 lines) — creating an empty CHANGELOG.md today may be premature; worth revisiting once there's actual history to split out.

## Timeline Considerations
No hard deadline; independent of the CLI/Web App/Templates/Docker specs — this is a documentation-process change, not a product feature with its own build. Reasonable to apply to this repo whenever DECISIONS.md/CONTEXT.md actually approach the stated thresholds, rather than immediately.
