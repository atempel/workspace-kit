# Decisions — workspace//kit

Chronological record of decisions made in this project. Each entry contains what, why, and discarded alternatives.

## v1 — base structure
- **Decision:** base files always generated: PROJECT.md, DECISIONS.md, CONTEXT.md, TASKS.md, README.md.
- **Reason:** replicates the context hierarchy already used in other projects ("context is the product").
- **Alternatives considered:** a single context file — discarded for mixing decision history with active tasks.

## v2 — agent layer (CLAUDE.md + AGENTS.md)
- **Decision:** generate CLAUDE.md and AGENTS.md by default, with CLAUDE.md only importing AGENTS.md (`@AGENTS.md`) and adding a section exclusive to Claude.
- **Reason:** Claude Code/Cowork does not read AGENTS.md natively (confirmed in April/May 2026 documentation), but AGENTS.md is already read natively by Codex, Cursor, Windsurf, Gemini CLI, Devin, Amazon Q, and others. Duplicating content across both files would risk them drifting out of sync.
- **Alternatives considered:** generating only CLAUDE.md (loses portability); duplicating the full text in both files (discarded due to drift risk).

## v2 — two file layers (human vs. agent)
- **Decision:** separate "human" files (PROJECT/DECISIONS/CONTEXT/TASKS, more descriptive) from "agent" files (CLAUDE.md/AGENTS.md/etc., leaner: stack, commands, limits).
- **Reason:** long architecture/prose sections dilute how well the agent follows instructions; concrete commands and limits work better in instruction files.
- **Alternatives considered:** a single set of files serving both audiences — discarded for producing files too long for agents.

## v2 — 11 project types with anchor file
- **Decision:** each project type (product, research, writing, design, data/ML, automation, digital game, board game, website, library, generic) has standard folders and, when it makes sense, an anchor file (PRD, GDD, Rulebook, handoff spec, API reference).
- **Reason:** reflect the actual project types worked on, without forcing every project into the same software-product structure.

## v2 — 100% client-side generation
- **Decision:** all file and .zip generation happens in the browser via JSZip, no backend.
- **Reason:** the artifact needs to work inside Claude.ai without its own infrastructure.

## Final adjustment — workspace//kit
- **Decision:** the repository was registered on GitHub as `workspace-kit` (full word), not `wrkspc-kit` (abbreviated). All files and the artifact's wordmark were synced to `workspace//kit`.
- **Reason:** keep the name shown everywhere (docs, artifact, repository) identical to the repository's actual slug, avoiding a mismatch between what's written and what actually exists on GitHub.
- **Resolved pending item:** the slug availability check, left open in the previous decision, was completed — `workspace-kit` is registered.

## Renaming — workspace//kit
- **Decision:** the project is now called `workspace//kit` (repository slug: `workspace-kit`), replacing the previous working name `ctx//forge` (and the intermediate idea "Context Forge").
- **Reason:** "context-forge" already exists as a real GitHub project with an almost identical pitch (`webdevtodayjason/context-forge`, a context-scaffolding CLI for Claude Code). Researching alternatives within the same root made it clear that both `ctx` and `forge` are extremely saturated roots in the AI context-tooling niche in 2026 (ctxloom, lean-ctx, ctx-init, RigForge, WorkForge, among others) — keeping any combination of the two was likely to collide again. `workspace//kit` moves away from both saturated roots, showed no relevant collision in the check, and keeps the same visual language (abbreviation + `//` + word).
- **Alternatives considered:** `Context Forge` / `context-forge` (discarded for a direct collision); `ctx//forge` (discarded for saturated roots); `ctx//prime` (discarded — the name coincides with a forex broker investigated for fraud, bad search associations); `workspace//boilerplate` (evaluated, no relevant collision, but "boilerplate" was considered a slightly dated term for the intended positioning); `brief//kit` and `wrk//spawn` (viable alternatives, not chosen).
- **Pending item:** the `workspace-kit` repository slug still needed to be checked and registered on GitHub (the owner/user had to verify exact availability at repo creation time).

## v2 — visual identity
- **Decision:** "terminal" palette (near-black background, amber + teal), JetBrains Mono/Inter typography, a logo of stacked context cards with a blinking cursor.
- **Reason:** avoid the three visual "defaults" of AI-generated content (cream+terracotta, black+acid green, broadsheet) and anchor the identity in the user's own terminal environment aesthetic.

## 2026-07-01 — Repository translated to English + bilingual generator planned
- **Decision:** the repository's own documentation (README, PROJECT, DECISIONS, CONTEXT, TASKS, AGENTS, CLAUDE, docs/PRD, research/) is now maintained in English only, replacing the Portuguese versions — no parallel bilingual docs. The generated artifact (`src/workspace-kit.html`) will get a PT/EN language selector covering both UI text and the physical folder names it generates (e.g. "pesquisa" → "research"), not just prose inside files.
- **Reason:** the project is moving toward a broader, GitHub-facing audience, and a single source of truth in English avoids double maintenance of the repo's own docs. For the generator's own output, translating only prose while keeping folder names fixed in Portuguese would leave a generated workspace inconsistent (English file content inside Portuguese-named folders), defeating the point of a language selector.
- **Alternatives considered:** keeping parallel bilingual repo docs (e.g. `README.md` + `README.pt-BR.md`) — discarded for ongoing double maintenance; translating only the generator's UI chrome while keeping folder names fixed in Portuguese — discarded for producing inconsistent generated output.
- **Supersedes:** the CONTEXT.md convention "interface and generated file texts in Portuguese (PT-BR)" recorded under v2 identity — see the updated CONTEXT.md convention.
- **Implemented:** the PT/EN selector was added to `src/workspace-kit.html` (2026-07-01), defaulting to English per the owner's call. It covers UI chrome, generated file templates, and generated folder names (e.g. "pesquisa" → "research"), driven by a `LANG` state and per-language `UI`/`TYPE_CONFIG` dictionaries — no `localStorage`, since the artifact also needs to run inside Claude.ai where that API is unavailable.

## 2026-07-01 — Project pillars: security & privacy, collaboration
- **Decision:** the project declares two explicit pillars, recorded in PROJECT.md: security & privacy, and collaboration.
- **Reason:** came out of a privacy audit of the repository (triggered by the owner's discomfort about making it public) and the resulting `.gitignore` discussion. Security & privacy: the repo and the generator's output must never expose secrets, personal data, or private discussion. Collaboration: the generated context layer exists so multiple people (and agents) can pick up a project without re-litigating past decisions, and local-only per-user state should be isolated rather than versioned.
- **How to apply:** future features (starting with the `.gitignore` generation task) should be evaluated against both pillars — e.g., what's heavy/sensitive stays local (privacy), and what helps a new collaborator or agent onboard faster stays documented and versioned (collaboration).

## 2026-07-02 — Generated `.gitignore` + 17 project types (11 → 17)
- **Decision:** `src/workspace-kit.html` now generates a `.gitignore` file in every workspace it produces, built from two tiers: a universal base (OS/editor cruft, `.env*`, `CLAUDE.local.md`, `*.log`) plus a per-type `localOnly` flag on specific folder checkboxes (e.g. `dados`/`data`, `outputs`, `models`, `logs`, `builds`, raw footage). Local-only folders get `folder/*` + `!folder/.gitkeep`, so the folder exists on a fresh clone but its contents never get committed. The checkbox label for any local-only folder is tagged in the UI (`· local only (.gitignore)` / `· só local (.gitignore)`) so the choice is visible before generating.
- **Reason:** direct implementation of the Collaboration and Security & privacy pillars — heavy or sensitive folder contents (raw datasets, trained models, logs, build artifacts) shouldn't ship to every collaborator via git, but the folder skeleton should still exist so the project structure is consistent for whoever clones it.
- **Also folded into this same push:** while implementing this, a separate parallel work session had already added 6 new project types directly to `src/workspace-kit.html` — `mobile`, `extension`, `hardware`, `course`, `marketing`, `podcast` — each with its own folders, defaults, stack/limits placeholders, and anchor file, following the same pattern as the original 11. These were merged in rather than redone. The project now ships **17 project types**, not 11 — the "v2 — 11 project types" decision above is superseded by this count; anywhere still saying "11 project types" (README, PROJECT.md status line) is stale and should be updated to match.
- **Alternatives considered:** gitignoring by folder name globally regardless of project type — discarded because the same folder name (e.g. "assets") is sensitive/heavy in one project type and fine to version in another; making every generated folder local-only by default — discarded, most generated folders (docs, src, notes) are exactly what should be versioned.

## 2026-07-10 — v3 visual redesign promoted to official version
- **Decision:** the v3 reskin (Figma-referenced dark glass-card UI, centered pill nav, sticky workspace-preview sidebar, new outlined-wordmark logo, SVG flag icons for the language selector) is now `src/workspace-kit.html` — the official artifact. It was built and iterated as a separate preview file (`src/workspace-kit-v3-preview.html`) precisely so the owner could review it without risking the live version, and is promoted only now that three rounds of visual/UX fixes are resolved: cropped logo, emoji flags not rendering on Windows, spacing/attachment issues between header elements, low-contrast text (`--text-mute` raised from ~3.8:1 to ~7.5:1 contrast), agent-configuration cards overflowing their bounds (CSS Grid `min-width:auto` bug) and not being uniformly sized, and an unnecessary internal scroll in the preview sidebar. The previous version is preserved unmodified at `src/workspace-kit-v2-archive.html`.
- **Reason:** explicit owner instruction — the new version becomes the basis for the next release, but the previous version must remain saved rather than deleted, in case of regressions or a desire to compare/revert.
- **Alternatives considered:** keeping v3 as a permanent parallel file and only linking to it — discarded, the owner was explicit that this is meant to *become* the new version, not live alongside it indefinitely.
- **Functional parity:** the entire original `<script>` block (17 project types, dynamic folders, 7 agent-format checkboxes, `.gitignore` generation, tree preview, starter prompt, .zip download, PT/EN toggle) was reused verbatim with unchanged element IDs — this was a visual reskin, not a functional rewrite.
- **Resolved follow-up:** `src/workspace-kit-v3-preview.html` was removed (owner confirmed) and the full change set (new `workspace-kit.html`, `workspace-kit-v2-archive.html`, updated PROJECT/DECISIONS/TASKS) was pushed to GitHub (`atempel/workspace-kit`, `main`).

## 2026-07-10 — Bilingual README (partial reversal of the English-only repo docs decision)
- **Decision:** the repository README is now maintained in two versions — `README.md` (English, canonical) and `README.pt-BR.md` (Portuguese) — cross-linked at the top of each with a language switcher. A short closing note in Portuguese with a 🇧🇷 flag marks the project's Brazilian origin.
- **Reason:** explicit owner request — the owner is Brazilian and wants the README to make it clear, right away, that the project (and its generated output) supports both English and Portuguese, plus a personal touch acknowledging where the project comes from.
- **Supersedes (partially):** the 2026-07-01 decision to keep repo docs English-only "no parallel bilingual docs" — that decision still holds for PROJECT/DECISIONS/CONTEXT/TASKS/AGENTS/CLAUDE (unchanged, English-only), but is now overridden specifically for README.md, which is the repo's public-facing entry point.
- **Alternatives considered:** a single README with inline PT translation below the English content — discarded, makes the file long and harder to scan; a `## Português` anchor section only — discarded in favor of a full separate file so each language reads as a complete, standalone document.
