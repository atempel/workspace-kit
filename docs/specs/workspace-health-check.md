# Spec — Workspace health check ("system doctor")

Status: **P0 implemented 2026-07-29** as `core/doctor.js` + `workspace-kit doctor` (tests: `npm run test:doctor`, 16 cases mapped onto the P0 acceptance criteria). Issue: [#78](https://github.com/atempel/workspace-kit/issues/78). Originally: draft, pending review. Source: Notion page "Notas de Áudio 26/07" (2026-07-26), ingested into TASKS.md the same day. No GitHub issue yet — will be created after this spec is reviewed.

## Problem Statement
Workspace//kit today only writes workspaces — the HTML artifact, and (once built) the CLI and Web App, all solve *generation*. Nothing solves what happens as a generated workspace ages: CLAUDE.md/AGENTS.md accumulate instructions over time, DECISIONS.md and CONTEXT.md grow, and eventually the human/agent layer files get big enough that reading them in full every session silently eats the context window of whatever agent is working in that project. The workspace gets *less* useful the longer it's used, and nothing today tells the user that's happening — there's no equivalent of a linter or a health check for a workspace's own instructions and history. This is also, per earlier planning, considered the single highest-value idea in the current batch: it's the thing a user would run repeatedly against a project they already have, not just once at creation — closer to the "context manager" pitch than any generation feature. This spec formalizes it as `workspace-kit doctor`: a command that measures a workspace's context footprint and gives concrete, actionable suggestions, the way a linter or a doctor's checkup does — diagnosis, not automatic treatment.

## Goals
- Measure the context footprint of an existing workspace: how many instruction files it has, how big each one is, and how much of an agent's context window they collectively consume before any real work starts.
- Give a per-file status and an overall verdict, using concrete numeric thresholds — not vague "this feels long" judgments — so the report is reproducible and consistent across runs.
- Turn measurement into specific, actionable suggestions (split a file, move prose on-demand, rotate a decision log, prune stale instructions, fix a broken cross-reference) rather than just reporting numbers with no next step.
- Reuse the ~300-line "always-loaded file" figure already recorded in docs/specs/context-manager-conventions.md → #34 as the starting threshold, so the product doesn't ship two conflicting numbers for the same underlying concern.
- Ship as the CLI's natural second command, usable stand-alone with no UI — `workspace-kit doctor` should be useful the moment it exists, independent of the Web App.

## Non-Goals
- **Automatically fixing anything.** The doctor diagnoses and suggests; it never edits, splits, or deletes a file itself in v1. That capability (if it happens at all) is the Markdown Orchestrator's territory (see TASKS.md's "Markdown Orchestrator integration" section) or a future automation pass, not this spec.
- **Reading workspaces that don't exist on disk yet.** The doctor is read-only against an *existing* workspace; it has nothing to do with the generation flow itself. It structurally depends on docs/specs/workspace-inspection-layer.md's read-side index existing first (see Open Questions) rather than parsing files itself.
- **Running from the standalone HTML artifact.** Per the 2026-07-21 multi-surface policy, reading an arbitrary folder from disk needs a local process; the HTML artifact can only ever inspect content a user pastes/uploads into it, which isn't the same feature. CLI/Web-App-only, same as the inspection layer it builds on.
- **A tokenizer dependency or model-specific token accounting.** v1's "estimated tokens" figure is a heuristic (see Requirements), not a byte-for-byte match to any specific model's tokenizer — precise accounting is future scope if it's ever worth the dependency cost.
- **Replacing or automating docs/specs/context-manager-conventions.md → #34's manual rotation policy.** The doctor measures and suggests that a rotation is due; it doesn't perform the rotation. Whether the doctor eventually absorbs more of #34's product-facing half is called out explicitly in Open Questions rather than decided here.
- **Workspace management** (editing, adding files, multi-project dashboards) — that's the Local Web App's and Markdown Orchestrator's job; the doctor only reports.

## User Stories
- As a developer returning to a project after weeks away, I want to run one command and see whether my CLAUDE.md/AGENTS.md have quietly grown too large, so that I know before an agent's context gets wasted reading them.
- As a developer, I want a per-file status (healthy / warning / over-budget) and an overall verdict, so that I don't have to interpret raw line/character counts myself.
- As a developer, I want concrete suggestions attached to each flagged file — split it, move some of it to an on-demand file, rotate old entries out — so that the report tells me what to do next, not just that something is wrong.
- As Alexandre, I want the doctor's thresholds to match the ~300-line figure already used in the context-manager-conventions spec, so the product isn't telling me two different "safe file size" numbers in two different places.
- As a developer running an agent inside a workspace, I want the doctor to also flag a broken cross-reference (a file linking to another that doesn't exist), since the "RAG by Markdown" model depends on those links being accurate to work at all.

## Requirements

**Must-Have (P0)**
- Health metrics computed per workspace, built on docs/specs/workspace-inspection-layer.md's file index: number of instruction files present, per-file size (bytes), line count, character count, estimated tokens per file, total always-loaded context budget (sum across every file an agent reads by default at session start — CLAUDE.md/AGENTS.md and their equivalents, not on-demand files), and history/log growth (current line/entry count of CONTEXT.md/DECISIONS.md-style files vs. their own stated rotation thresholds).
  - Acceptance: running the doctor against a real generated workspace returns a structured result (not just printed prose) containing every metric above, per file and in aggregate.
- Token estimation via a fixed heuristic (characters ÷ 4, the common rough approximation), not a tokenizer dependency — consistent with `core/generator.js`'s "zero dependencies, no build step" convention.
  - Acceptance: the heuristic and its divisor are documented in the doctor's own output/help text as an approximation, not presented as an exact count.
- Threshold-based per-file status using the ~300-line "always-loaded file" figure from docs/specs/context-manager-conventions.md → #34 as the baseline for CLAUDE.md/AGENTS.md-equivalents: e.g. healthy under ~300 lines, warning approaching it, over-budget beyond it (exact banding is an Open Question, but the anchor number is fixed, not reinvented).
  - Acceptance: a fixture file authored at ~250, ~300, and ~400 lines produces three different statuses (healthy/warning/over-budget respectively) from the same thresholds.
- Overall workspace verdict: a single summary judgment (e.g. healthy / needs attention / unhealthy) derived from the per-file statuses, plus the total always-loaded budget figure.
  - Acceptance: the verdict changes when a previously-healthy fixture workspace has one file pushed over threshold, without needing to read the per-file detail to notice something changed.
- Improvement suggestions attached to specific findings, covering at minimum the five kinds named in TASKS.md: split an oversized file into smaller ones, move prose from an always-loaded file into an on-demand/on-request file, rotate decision-log entries per the #34 policy once its numeric trigger (~15 entries) is hit, flag stale/likely-dead instructions (heuristic: e.g. referencing a removed file or a superseded convention — exact detection approach is an Open Question), fix a broken cross-reference (a link/mention of a file that doesn't exist in the workspace).
  - Acceptance: each suggestion in the report names the specific file and a concrete action ("CLAUDE.md is 412 lines; move the 'Recurring task suggestions' section to an on-demand file"), not a generic "consider shortening this file."
- `workspace-kit doctor` CLI command, no flags required for a useful default run (defaults to cwd), with a human-readable terminal report as the default output.
  - Acceptance: running `workspace-kit doctor` inside a real workspace-kit-generated folder with no arguments produces a readable report covering every P0 metric and at least one suggestion where warranted.
- Non-zero exit code when the overall verdict is "unhealthy" (or equivalent), zero when healthy — so the command is scriptable/CI-usable even though v1 has no UI.
  - Acceptance: a fixture workspace engineered to be over-budget exits non-zero; a clean fixture exits zero.

**Nice-to-Have (P1)**
- `--json` output flag for machine-readable results, so the Web App (or any future consumer) can render the same report instead of re-implementing the analysis.
- Historical comparison: running the doctor twice and showing a size delta since the last run (requires persisting a prior result somewhere — mechanism TBD, likely deferred to whatever the cross-tool session log / Web App ends up storing).
- Configurable thresholds (e.g. a project that intentionally wants a larger always-loaded budget can override the ~300-line default) via a config file or flag.
- Cross-reference graph check surfaced as its own report section (not just folded into "suggestions"), reusing the inspection layer's graph output directly.

**Future Considerations (P2)**
- Web App UI rendering of the same report (dashboard view, visual budget bar per file) — belongs to docs/specs/local-web-app.md → #29 once it exists; this spec only guarantees the underlying data is available and structured.
- Auto-fix mode that performs the suggested split/rotation itself rather than only recommending it — explicitly out of v1 (see Non-Goals); revisit once the Markdown Orchestrator's edit/move capability exists.
- Trend tracking across many workspaces (e.g. "your last 5 generated projects all hit warning status by month 2") — needs the Web App's multi-project awareness first.
- Model-specific token accounting (real tokenizer per target model) instead of the chars÷4 heuristic, if the heuristic proves misleading enough in practice to justify the dependency.

## Success Metrics
**Leading:** whether running the doctor against this repo's own workspace (CLAUDE.md/AGENTS.md/CONTEXT.md/DECISIONS.md/TASKS.md) produces a report whose per-file verdicts match a manual eyeball assessment of the same files — i.e., the thresholds and suggestions feel right on the one workspace available for dogfooding, not just structurally correct.
**Lagging:** whether Alexandre actually runs `workspace-kit doctor` repeatedly on his own projects as they age, and whether its suggestions lead to real action (a file actually gets split, a rotation actually gets performed) rather than being a report that's generated once and ignored — the same self-usage caveat as the CLI/Web App specs, but the sharpest test of this particular feature's "killer feature" claim.

## Open Questions
- **(Resolved 2026-07-29 in implementation, see DECISIONS.md)** Banding is *warning at 90% of the limit, over-budget past it* — 250 healthy / 300 warning / 400 over-budget, matching this spec's own acceptance criterion. One knob (`warnRatio`) rather than three numbers, and overridable per call or via `--max-lines`. Retune freely; the ~300 anchor from #34 stays fixed.
- **(Product — Alexandre)** Does the doctor eventually absorb docs/specs/context-manager-conventions.md → #34's product-facing half (the numeric rotation policy itself), leaving #34 as a repo-own-docs process note only? As scoped today, the doctor *measures against* #34's thresholds and *tells the user a rotation is due*, but #34 remains the source of truth for the policy itself and manual execution stays out of scope for both specs in v1. Revisit once the doctor has been lived with for a while — if the doctor's suggestion output becomes the de facto policy reference, #34 may narrow to "how this repo's own docs got rotated historically" rather than "the general policy."
- **(Unblocked 2026-07-29)** The dependency on docs/specs/workspace-inspection-layer.md (→ #77) is satisfied: that module landed first, as this question hoped, and `diagnose()` consumes its index rather than parsing anything itself.
- **(Resolved 2026-07-29 in implementation)** Stale-instruction detection is scoped to the mechanically-detectable case, as this spec proposed for v1: an instruction section containing a reference to a file that does not exist is flagged by heading and line range. "Obsolete but still linked" stays a P1/P2 refinement pending real usage.
- **(Resolved 2026-07-29 in implementation)** Thresholds live in `core/doctor.js` as an exported `DEFAULT_THRESHOLDS`, overridable per call and via `--max-lines`. A shared config file is deferred until a second consumer actually needs to read the same numbers — today only the doctor does.
- **(Resolved 2026-07-26, see TASKS.md)** Command surface: this is the CLI's natural second command (`workspace-kit doctor`), building directly on the generator's sibling command rather than a new tool — no UI required to be useful, and it should be built right after the CLI's generate flow works.

## Timeline Considerations
Depends on docs/specs/workspace-inspection-layer.md landing first (or at least far enough along to expose a stable file index + cross-reference graph) and on the CLI (docs/specs/cli-generator.md → #20) having a working `generate` flow, since `doctor` is scoped as the CLI's second command sitting on the same binary. Independent of Templates (#32) and Docker environment generation (#33) — no coupling either direction. Reasonable to prioritize highly once its one blocking dependency (the inspection layer) exists, given it's assessed as the highest-value idea in the current batch.
