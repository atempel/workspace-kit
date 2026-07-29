# Sessions — workspace//kit

Append-only log of who touched this workspace, in what tool, and what state it was left in. One entry per session, added by whichever agent/tool is ending its session — this is a mechanical handoff record, not project history.

**Boundary with CHANGELOG.md** (resolved 2026-07-27, see DECISIONS.md): CHANGELOG.md — once created, see docs/specs/context-manager-conventions.md → #34 — is narrative *product* history (what shipped, what was decided; coarse-grained, judgment-driven, infrequent). This file is a *tool-handoff* record (who touched the workspace, in what tool, leaving it in what state); written far more mechanically and far more often, every session, with no editorial judgment involved. An entry here may reference a decision or issue (e.g. "see DECISIONS.md, 2026-07-26") but never restates the *why* — that always lives in DECISIONS.md/CHANGELOG.md, not here.

## Entries

### 2026-07-27 — Cowork
**Did:** Resolved the CHANGELOG.md vs. SESSIONS.md boundary (orthogonal axes, see DECISIONS.md); created this file; populated `queue/` with the two real Workspace//Kit voice-note references; refreshed docs/PRD.md and PROJECT.md to reflect the 5 specs written 2026-07-26 (workspace inspection layer #77, health check #78, git integration layer #79, document ingestion queue #80, cross-tool session log #81) and the "kit" rename; added standing "every session" / queue instructions to AGENTS.md.
**Left at:** No code touched — planning/docs only. Repo is ready for Claude Code to start implementing the specs. Next: prototype the new structures (workspace inspection/health-check output, queue, session log) in Claude Design before implementation begins, per the owner's request.

### 2026-07-29 — Claude Code (background job, `tasks-progress` worktree)
**Did:** Executed the "project type" → **kit** rename across both copies of the generation logic, the parity harness/fixtures, `research/kits/`, and README/CONTEXT/specs wording (see DECISIONS.md, 2026-07-29, including the boundary that generated text keeps saying "Project type"). Re-mirrored `index.html` from `src/workspace-kit.html`, which had been a version behind since 2026-07-27.
**Left at:** Branch `worktree-tasks-progress` pushed with a draft PR; `npm run test:fixtures` and `npm run test:parity` both pass. The branch also still carries four earlier unpushed commits from the 2026-07-27 session (CONTEXT.md rename propagation, non-functional bar, PT starter prompt, `DESIGN.md` + prototype PRP) — the PR lands all of them. **Not touched:** the 2026-07-28/29 Local Web App batch (`docs/specs/web-app-dashboard.md`, `docs/design/workspace-kit-dashboard.dc.html`, the DECISIONS.md 2026-07-28 entry, the AGENTS.md build-framework rescope) was being actively written in the main checkout during this session and is still uncommitted there — it needs its own commit and will conflict at the tail of DECISIONS.md/TASKS.md with this PR.
