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
- **Pending:** the language-selector implementation in `src/workspace-kit.html` is a structural change to a single-file artifact — per CLAUDE.md, it needs a reviewed plan before being applied. Plan to be presented separately.
