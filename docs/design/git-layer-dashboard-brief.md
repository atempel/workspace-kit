# Design brief — Git integration layer (for Claude Design)

Existing prototype: https://claude.ai/design/p/d620bebb-45b3-423b-9daa-8d53cd155426?file=Workspace+Kit+Dashboard.dc.html&via=share ("Workspace Kit Dashboard")

Purpose: extend that prototype with a Git section, so docs/specs/git-integration-layer.md (→ #79) has a visual reference before Claude Code implements it. This is an addition to the existing dashboard, not a new prototype — reuse its established visual system (sidebar nav, badge/status conventions, table components, accent/shell/density props) rather than introducing new patterns.

## Where it goes
Add a new nav item — "Git" (or "Source control") — alongside the existing Overview / Health check / Session log / Queue, after Queue.

## What to show (grounded in docs/specs/git-integration-layer.md's Must-Have requirements)

1. **File-state summary** — per-file git status joined onto the existing Overview file table (new column: untracked / modified-unstaged / staged / committed-clean), plus a compact rollup at the top of the new Git section (e.g. "3 modified · 1 staged · 37 clean").
2. **Commit flow** — a card with a plain-language change summary (files changed, lines added/removed) and a single "Commit changes" action. No raw git commands anywhere in the UI.
3. **Pull request flow** — from a branch with committed changes: a drafted title/description visually flagged as templated from the diff (not written by a model — keep the model-agnostic guardrail visible), one "Open Pull Request" action, and nothing past that. No approve/merge controls in this screen — the spec stops at "PR opened" on purpose.
4. **Worktrees** — a list of active worktrees (name, path, branch/agent, created date), with create/remove actions. Nice-to-have: flag when two worktrees touch the same file (P1 in the spec).
5. **Safe-edit warning** — one example state: a workspace//kit-driven edit attempted against a file with uncommitted changes shows a warning + confirmation before proceeding, instead of silently overwriting.

## While you're in there — three small gaps in the existing sections
- **Health check:** add a distinct "history growth" row per rotation-eligible file (e.g. "DECISIONS.md — 12/15 entries before rotation"), separate from the per-file size/line status.
- **Overview table:** surface "broken cross-reference" as a badge on the affected file's own row, not only as an annotation on the graph.
- **Token counts:** label them as estimates everywhere they appear (e.g. "~1.2k tokens (chars ÷ 4, approx.)"), so they never read as an exact count.

## Constraints
- Mock data only — no real git operations, no backend; keep using the same `{{ placeholder }}` fixture-data convention as the rest of the dashboard.
- Visual reference only — the actual implementation is a separate, later step for Claude Code; don't wire up real functionality.
