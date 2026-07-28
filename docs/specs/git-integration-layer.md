# Spec — Git integration layer

Status: draft, pending review. Source: Notion voice note "Notas de Áudio 26/07" (2026-07-26), ingested into TASKS.md under "Git as the integration layer," building on the model-agnostic clarification in DECISIONS.md's 2026-07-26 entry.

## Problem Statement
As workspace//kit repositions itself from a one-shot generator into an ongoing project context manager, workspaces start accumulating edits over time instead of only being written once at creation: the Markdown Orchestrator toggling instructions on/off, the workspace health check suggesting file splits, multiple agents working the same project in parallel. None of that is safe today because nothing tracks what has actually changed on disk versus what's committed — an edit could silently clobber uncommitted work, and there's no way to parallelize agent work without agents colliding on the same files. Git already solves exactly this class of problem, but expecting every user to operate it by hand (staging, branching, worktrees, PRs) reintroduces the friction workspace//kit exists to remove elsewhere.

This spec is about workspace//kit **itself operating git** — as a local tool shelling out to the `git` binary — to track file state and drive user-friendly commit/PR/worktree flows. It is explicitly not about workspace//kit calling or hosting an AI model of its own: per the resolved 2026-07-26 decision in DECISIONS.md, workspace//kit stays fully model-agnostic. "The model can make commits and PRs" refers only to whatever agent (Claude Code, Cursor, etc.) is already working inside a generated workspace — that agent does the committing using its own tools, and the user reviews/merges externally through their normal git hosting. Workspace//kit's job is narrower and purely mechanical: track file state against git, and prepare git-aware flows/instructions that make it easy for a human or an agent to act on. This spec is also distinct from the `## Next` git-instructions bullet in TASKS.md, which is about *generated instructional text* teaching an agent already inside a workspace how to use git/worktrees — that's prose the generator writes into CLAUDE.md/AGENTS.md; this spec is about workspace//kit's own tooling actually running git commands.

## Goals
- Track file state against git (which workspace files are untouched, modified-unstaged, staged, or committed) as the safety substrate for any tool-initiated edit — building on the Workspace inspection layer (`docs/specs/workspace-inspection-layer.md`, no issue number yet).
- Offer git worktrees as a first-class, workspace//kit-managed capability, so multiple agents (or multi-agent methodologies) can work on the same project in parallel without colliding on the same files.
- Provide a user-friendly commit/PR surface that someone with no git command-line experience can drive end to end, while deliberately leaving review and merge to the user's normal external tools (GitHub/GitLab/their IDE) rather than reimplementing them.
- Stay strictly model-agnostic: every operation in this feature is either a plain local git command or a deterministic template built from file-state/diff data — never a call to an AI model or an API key of workspace//kit's own. Reinforces CONTEXT.md's "no backend, no external API calls requiring a key" constraint (which is scoped to the HTML surface) by making sure this CLI/Web-App-only feature doesn't introduce a model dependency either.
- Serve as the substrate the Markdown Orchestrator (TASKS.md, "Markdown Orchestrator integration") needs to route its instruction-toggle edits through git safely, without building its own one-off git logic.
- Ship as CLI/Web-App-only, consistent with the 2026-07-21 multi-surface policy — this needs a local process to shell out to `git`, which the standalone HTML artifact structurally cannot do.

## Non-Goals
- **Workspace//kit calling or hosting an AI model** — resolved, not open: per DECISIONS.md's 2026-07-26 entry, workspace//kit never calls or hosts a model itself. All commit-message and PR-description drafting in this feature is templated from plain file-state/diff data, not model-generated text.
- **Reimplementing code review or merge tooling** — reviewing diffs, approving changes, and merging branches stay in the user's existing external tools (GitHub, GitLab, their IDE); this feature prepares commits/PRs, it doesn't replace a hosting provider's review UI.
- **The trivial `git init` / first-commit slice** already scoped in `docs/specs/cli-generator.md` → #20 and `docs/specs/local-web-app.md` → #29 — this spec starts past that point (file-state tracking, worktrees, commit/PR flows) and shouldn't duplicate it.
- **Generated instructions teaching an agent to use git** — that's the separate `## Next` TASKS.md bullet (prose written into CLAUDE.md/AGENTS.md); this spec is about workspace//kit's own tooling, not generated text.
- **Standalone HTML artifact support** — CLI/Web-App-only by construction; the HTML artifact has no local-process access to shell out to `git` and won't get any part of this feature.
- **Enterprise multi-user "guardian" approval role** — explicitly deferred to a future enterprise phase, not scoped for v1 (see Future Considerations). It's the first genuinely multi-user idea in the project and directly collides with `docs/specs/local-web-app.md` → #29's "local, single-user, no auth" Non-Goal; not to be built toward prematurely.
- **A full custom git client/UI** (branch graphs, interactive rebase, etc.) — the surface here is deliberately narrow (state tracking, worktrees, commit, PR prep), not a general-purpose git GUI competing with existing tools.

## User Stories
- As a user with the Markdown Orchestrator toggling instructions in my workspace, I want workspace//kit to check git state before writing so that an automated edit never silently overwrites uncommitted work of mine.
- As a developer running multiple agents on the same project, I want workspace//kit to set up git worktrees for me so that each agent works in its own isolated copy without colliding on the same files.
- As a non-git-expert, I want a simple "commit my changes" action so that I don't need to memorize `git add`/`git commit` to save an agent's work.
- As a non-git-expert, I want a simple "open a PR" action so that I can hand my changes off for review without learning branch/remote/PR mechanics.
- As a user, I want to do the actual reviewing and merging in my normal external tools (GitHub, GitLab, my IDE) rather than inside workspace//kit, so I'm not learning a second, unfamiliar review workflow.
- As Alexandre, I want file-state tracking to share the same read-side layer used by the health check and document ingestion queue, so there's one shared way to read a workspace's git state instead of several divergent copies.

## Requirements

**Must-Have (P0)**
- File-state tracking against git: classify every workspace file as untracked, modified-unstaged, staged, or committed-clean, built on top of the Workspace inspection layer (`docs/specs/workspace-inspection-layer.md`).
  - Acceptance: given a workspace with a deliberate mix of untouched, modified-unstaged, staged, and committed files, the tool correctly classifies every file into its actual git status.
- Safe-edit substrate: any workspace//kit-initiated file write (starting with the Markdown Orchestrator's instruction-toggle moves) checks git state first and warns before proceeding if the target file has uncommitted changes that would be overwritten.
  - Acceptance: a workspace//kit-driven edit attempted against a file with uncommitted changes surfaces a warning and requires confirmation before writing, rather than overwriting silently.
- User-friendly commit flow: given the current set of changed files, generate a plain-language change summary and let the user commit in one action, without hand-typing git commands.
  - Acceptance: a user with zero git command-line knowledge can go from "my workspace has changes" to "changes committed" using only workspace//kit's prompts/UI.
- User-friendly PR flow: given a branch with committed changes, prepare and open a pull request (title/description drafted from the change summary) against the user's existing remote — stopping at "PR opened," never attempting the review or merge itself.
  - Acceptance: running the PR flow produces an actual open PR (or a pushed branch plus a working PR-creation link) on the user's existing remote; no step in the flow approves or merges it.
- Git worktrees as a first-class capability: create, list, and remove worktrees for a workspace so multiple agents can work in parallel without touching the same working directory.
  - Acceptance: creating two worktrees for the same workspace lets two independent agent sessions edit different worktrees concurrently with no file-lock collision, and each worktree's changes are independently visible through the file-state tracking above.
- Model-agnostic guardrail: no code path in this feature calls an external AI model or requires an API key of workspace//kit's own; commit-message and PR-description text is generated from deterministic templates over file-state/diff data (changed-file list, add/remove counts), never from a model response.
  - Acceptance: a code/dependency review of this feature turns up zero outbound calls to an LLM API.
- CLI/Web-App-only scope: none of this feature's capabilities are exposed in `src/workspace-kit.html`.
  - Acceptance: the standalone HTML artifact is unchanged by this feature — no new UI, no new logic added to it.

**Nice-to-Have (P1)**
- Conflict surfacing: when two worktrees have touched the same file, flag it proactively (still leaving actual resolution to the user's own tools, not resolved automatically).
- Multi-agent worktree presets: a convenience flow to split a set of tasks (e.g. a TASKS.md section) across N worktrees in one step, rather than creating each manually.
- Commit-message convention support (e.g. an opt-in Conventional Commits template) for the commit flow.
- Logging integration with the Cross-tool session log (`docs/specs/cross-tool-session-log.md`) — recording which tool/agent produced which commit, if that spec's file format ends up supporting structured entries.

**Future Considerations (P2)**
- Enterprise "guardian" role: a shared team workspace repo where a designated "guardian" approves changes to the project's core human/agent layer before they land — explicitly not scoped now. This is the first genuinely multi-user idea in the project and collides directly with `docs/specs/local-web-app.md` → #29's "local, single-user, no auth" Non-Goal; revisit only if a real multi-user need materializes, and only alongside a broader decision to support multi-user workspace//kit at all.
- Deeper hosting-provider integration beyond opening a PR (e.g. native GitHub Issues/Projects sync).
- Automatic (rather than merely flagged) conflict resolution across worktrees.
- Structured integration with the document ingestion queue (`docs/specs/document-ingestion-queue.md`) — e.g. committing automatically when a queued item is marked ingested — once that spec's own "mark as done" mechanism is settled.

## Success Metrics
**Leading:** whether git file-state classification is correct across a fixture set covering every state (untracked, modified-unstaged, staged, committed-clean); whether a hand-run "two-worktree parallel edit" test (create two worktrees → edit each independently → confirm independent, correct state tracking → no collision) round-trips with zero manual git fixes needed.
**Lagging:** whether Alexandre actually adopts workspace//kit's commit/PR flow for his own workspaces instead of falling back to raw `git` commands or his IDE's built-in git UI — same self-usage caveat noted in the CLI and Web App specs, given there's no external user base yet.

## Open Questions
- **(Engineering — blocking)** This spec depends on `docs/specs/workspace-inspection-layer.md` (no issue number yet) for the read-side file index that git file-state tracking is layered on top of; can't fully build ahead of that spec maturing.
- **(Product — Alexandre)** Worktree placement/naming: does workspace//kit auto-place worktrees (e.g. sibling folders like `../workspace-name-agent2/`) with a default naming convention, or prompt the user for location every time?
- **(Product — Alexandre)** Hosting-provider scope for the PR flow: GitHub only for v1, or also GitLab/Bitbucket? Determines whether this depends on GitHub's `gh` CLI specifically or needs a provider-agnostic approach.
- **(Engineering)** Implementation approach for git operations: shell out to the local `git` binary directly, or additionally lean on an existing provider CLI (e.g. `gh`) where available for faster PR creation — trades an extra external dependency against less flow to build/maintain in-house.
- **(Resolved 2026-07-26, see DECISIONS.md)** Does workspace//kit call an AI model itself anywhere in this feature? No. Commit-message/PR-description drafting is templated from file-state/diff data only; "the model can make commits and PRs" refers strictly to whatever agent is already working inside the generated workspace, using its own tools — workspace//kit only tracks state and prepares the flow for that agent (or for the user directly).
- **(Resolved)** Relationship to the `## Next` git-instructions bullet in TASKS.md: that bullet covers generated instructional prose teaching an agent how to use git/worktrees inside a workspace; this spec covers workspace//kit's own tooling actually operating git. Cross-referenced, not duplicated.
- **(Resolved)** Overlap with the `git init`/first-commit P0 slice already scoped in `docs/specs/cli-generator.md` → #20 and `docs/specs/local-web-app.md` → #29: that slice stays where it is; this spec is everything past it.

## Timeline Considerations
Blocked on `docs/specs/workspace-inspection-layer.md` reaching enough maturity to provide the read-side file index this feature's git state tracking builds on. Softly coupled to the Markdown Orchestrator work (TASKS.md, "Markdown Orchestrator integration" — no spec file yet), which is the first concrete consumer that needs safe, git-aware edits rather than just read access. No hard deadline otherwise; reasonable to sequence this after the CLI and/or Web App MVPs (`docs/specs/cli-generator.md` → #20, `docs/specs/local-web-app.md` → #29) reach their own baseline, since this feature builds on whichever of those two first supplies the local-process runtime it needs.

## Design Reference
A Claude Design prototype of the Local Web App dashboard ("Workspace Kit Dashboard") already covers Overview/Health check/Session log/Queue; it has no Git section yet. See `docs/design/git-layer-dashboard-brief.md` for the brief requesting that addition (file-state summary, commit flow, PR flow, worktrees, safe-edit warning) — a visual reference only, not an implementation.
