# PRP — High-fidelity prototype: workspace//kit lifecycle dashboard

Paste this whole file into Claude Design as the brief. It's self-contained — the example content below is real (pulled from this repo's own dogfooded files), not placeholder text, so you can design against it directly instead of lorem ipsum.

## What workspace//kit is
workspace//kit is a **workspace management and versioning tool** — not a code-versioning tool, that's git's job. From a project description it generates a "human layer" (PROJECT.md, DECISIONS.md, CONTEXT.md, TASKS.md) and an "agent layer" (CLAUDE.md, AGENTS.md, Cursor/Copilot/Gemini/Windsurf rules) so any AI coding tool has consistent context to work from. It ships on three surfaces: a standalone HTML artifact (exists today), a CLI, and a **Local Web App** (planned) — the Web App is the one being prototyped here, since it's the only surface that can read an existing project on disk on an ongoing basis, not just generate once.

## What to prototype
The Local Web App's **"open an existing workspace" view** — a read-only dashboard over a workspace that already exists on disk. Four sections/tabs of one screen (not four separate pages):

1. **Overview** — what files exist and their basic stats (the "workspace inspection" data)
2. **Health check** ("doctor") — is this workspace's context footprint getting too big, with concrete suggestions
3. **Session log** — a chronological record of which AI tool touched this workspace and did what
4. **Document queue** — references saved but not yet incorporated into the project

This is explicitly a **prototype, not the real app** — mock/static data is fine, no real file system access, no auth, no backend. The point (per the product owner's own sequencing decision, logged 2026-07-27) is to see and feel the UI before writing the real implementation.

Desktop-first (like Cursor/Notion) — no mobile layout needed.

---

## Section 1 — Overview (workspace inspection)
Shows what a workspace has, structurally. Example real data shape (from `docs/specs/workspace-inspection-layer.md`):

- A file list — human layer (PROJECT.md, DECISIONS.md, CONTEXT.md, TASKS.md), agent layer (CLAUDE.md, AGENTS.md, `.cursor/rules/`, etc.), and generated per-kit folders — each row showing: exists / missing, size (bytes), line count, estimated token count.
- A **cross-reference graph**: which files link to which (e.g. `CLAUDE.md → AGENTS.md`, `PROJECT.md → DECISIONS.md/CONTEXT.md/TASKS.md`). Worth trying as a simple node/edge diagram, not just a table — this "files link to only what's relevant" model (the product calls it "RAG by Markdown") is the product's core mental model, worth making visually legible.
- A clear empty/error state: opening a folder that isn't a workspace-kit workspace should say so plainly, not error.

## Section 2 — Health check ("doctor")
An overall verdict plus per-file detail. Concrete example (from `docs/specs/workspace-health-check.md`) — use numbers like these, not abstractions:

**Overall verdict:** one of `Healthy` / `Needs attention` / `Unhealthy`, shown prominently at the top, plus the total "always-loaded context budget" (sum of every file an agent reads by default at session start).

**Per-file status**, using ~300 lines as the "always-loaded file" threshold:
| File | Lines | Est. tokens | Status |
|---|---|---|---|
| CLAUDE.md | 210 | ~1,400 | Healthy |
| AGENTS.md | 287 | ~1,900 | Warning (approaching 300-line threshold) |
| DECISIONS.md | 412 | ~2,700 | Over-budget |

**Suggestions**, each naming a specific file and a concrete action (not generic advice):
- "DECISIONS.md is 412 lines and has 21 entries — past the ~15-entry rotation trigger. Move the oldest entries to `decisions/*.md` with an index (see the ADR-rotation pattern already in use)."
- "AGENTS.md is 287 lines, approaching the 300-line always-loaded budget. Consider moving a less-frequently-needed section to an on-demand file."
- A **broken cross-reference** example: "PROJECT.md links to `docs/PRD.md`, which doesn't exist in this workspace."

Status colors: green (healthy), amber (warning), red (over-budget/unhealthy) — consistent everywhere the same status appears, and never color-only (pair with an icon + text label) for accessibility.

## Section 3 — Session log
A chronological, append-only list — one entry per session, per tool. Real example entry (from this repo's own `SESSIONS.md`):

> **2026-07-27 — Cowork**
> **Did:** Resolved the CHANGELOG.md vs. SESSIONS.md boundary; created this file; populated `queue/` with two real voice-note references; refreshed docs/PRD.md and PROJECT.md; added standing instructions to AGENTS.md.
> **Left at:** No code touched — planning/docs only. Repo ready for Claude Code to start implementing the specs.

Design this as a simple reverse-chronological timeline/list — tool name should be visually tagged (badge/pill) since "which tool touched this" is the entire point of the feature.

## Section 4 — Document queue
A list of saved-but-not-yet-ingested references. Real examples (from this repo's own `queue/`):

| Type | Source | Added | Status |
|---|---|---|---|
| Voice note | Notion — "Notas de Áudio 26/07" | 2026-07-26 | Ingested (2026-07-26) |
| Voice note | Notion — "Notas de áudio Workspace Kit 14/07" | 2026-07-14 | Ingested (2026-07-21) |

Each item also has free-text **Notes**. Status is a small, fixed set (e.g. Pending / Ingested) — design it so "what's still pending" is scannable in one glance across a longer list (this maps to a real workflow: `grep -l "Status: Pending" queue/*.md`).

---

## Visual direction
See the attached/pasted `DESIGN.md` (written alongside this PRP) for full detail. Short version:
- **Both dark and light mode**, equally first-class — not a dark theme with light bolted on.
- **Clean, organized, high-usability** — Cursor and Notion are the explicit references: neutral grayscale base, restrained color (color = status/meaning, never decoration), 1px borders over shadows, no glass-morphism/gradients.
- **shadcn/ui** as the component base (already available in Claude Design) — gives native light/dark theming and a fast path to the requested feel.
- Typography: **Inter** for UI text, **JetBrains Mono** for file names/paths/metrics/code-shaped content.
- Shell: persistent left sidebar (Overview / Health / Session Log / Queue) + main content area, no top mega-nav.

## Explicitly not in scope for this prototype
- Real file-system access, git integration, or any backend — static/mock data throughout.
- The generation flow (project-name/description form, kit picker) — that's the existing HTML artifact's territory; this prototype is only the *read* side (open-an-existing-workspace).
- Mobile/responsive layout.
- Final color values — the palette in DESIGN.md is a starting point, expected to change as you iterate.

## Suggested additional context to paste/attach into Claude Design
If Claude Design supports attaching more than this one file, these help but aren't required (this PRP is self-contained on purpose):
- `DESIGN.md` (written alongside this PRP)
- `docs/specs/workspace-inspection-layer.md`, `workspace-health-check.md`, `cross-tool-session-log.md`, `document-ingestion-queue.md` — full requirements behind each section above, if you want more edge cases to design for (empty states, very large workspaces, etc.)
- A screenshot of the current `src/workspace-kit.html` artifact, **only** for contrast/context — its dark "terminal" glass-card look is a different, intentionally-separate visual identity (see DESIGN.md's scope note), not something to match here.
