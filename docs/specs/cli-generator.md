# Spec — CLI generator (MVP)

Status: draft, pending review. Part of the 2026-07-21 multi-surface direction (see PROJECT.md, DECISIONS.md).

## Problem Statement
Today workspace//kit only exists as a browser artifact (`src/workspace-kit.html`): you have to open it, fill a form, download a .zip, and manually extract it into a project folder before opening an AI agent. That's an extra manual hop for anyone already working from a terminal, and it structurally can't do things that need a real process — write files straight to disk, run `git init`, or chain into other local tooling. A CLI removes the browser round-trip and is the natural on-ramp for the "project context manager" direction: something you can run again, later, from the same place you already work.

## Goals
- Reach full functional parity with the HTML generator's core output (human layer + agent layer + `.gitignore`, all 17 project types) from a single command, no browser involved.
- Cut the time from "I want to start a project" to "agent-ready folder" to one command instead of open-browser → fill form → download → extract.
- Write directly into the target folder (optionally `git init` it), removing the download-and-extract step entirely.
- Establish the CLI as a credible base for later features that need a real process (Templates management, Docker environment spin-up — see their specs) without over-building ahead of need.

## Non-Goals
- **Workspace management** (editing/re-running against an existing workspace, tracking many projects) — that's the Local Web App's job (see its spec); the CLI's MVP only creates new workspaces.
- **Templates feature** — out of scope for MVP; the CLI should be built so it doesn't block that later, but isn't implementing it now.
- **Docker environment generation** — same: not in MVP, shouldn't be architecturally precluded.
- **Publishing to npm/Homebrew/etc. as a polished public package** — MVP can be a local Node script invoked via `npx` or a repo-local bin; packaging/distribution is a fast-follow, not P0.
- **Interactive TUI with rich widgets** — a straightforward prompt-based flow (à la `npm init`) is enough; a fancier TUI is a P2 at best.

## User Stories
- As a developer starting a new project from the terminal, I want to run one command and answer a few prompts so that I get an agent-ready workspace without leaving the terminal or touching a browser.
- As a developer who already has a project folder, I want to run the CLI inside it so that it writes the generated files directly into the folder instead of a .zip I have to extract myself.
- As a developer who wants a git repo, I want the CLI to optionally run `git init` and commit the initial scaffold so that I don't do that by hand right after generating.
- As a non-English speaker, I want to choose the same PT/EN options the HTML generator offers so that the output stays consistent no matter which surface I used.
- As Alexandre, I want the CLI's generation logic to share a single source of truth with the HTML/Web App generators so that the three surfaces don't drift out of sync over time (see Open Questions — this is the biggest unresolved risk).

## Requirements

**Must-Have (P0)**
- Command-line flow (interactive prompts, flags for non-interactive/CI use) covering the same inputs as the HTML form: project name, type (17 types), description, stack, target agents (CLAUDE.md/AGENTS.md/Cursor/Copilot/Gemini CLI/Windsurf/Skill), language (PT/EN).
  - Acceptance: running the CLI with no flags prompts for every field the HTML form currently collects; running with flags skips prompts for whichever fields were passed.
- Writes the full human layer + agent layer + `.gitignore` + anchor file (when applicable) directly into the target directory (default: cwd).
  - Acceptance: output file set and content match what the HTML generator would produce for the same inputs, given today's generation logic.
- `--git` flag (or an interactive yes/no) to run `git init` in the target folder after generation.
  - Acceptance: with the flag, the folder has a `.git`; without it, no git action is taken.
- Clear error handling: refuses to overwrite an existing non-empty directory without an explicit `--force`/confirmation.
  - Acceptance: running against a populated folder without `--force` exits with a non-zero code and no files written; with `--force`, proceeds and reports which files were overwritten.
- Starter prompt printed to stdout (and optionally written to a file) at the end of the run, same content the HTML generator produces today.

**Nice-to-Have (P1)**
- Non-interactive mode fully driven by a config file or flags (for scripting/CI use).
- `--dry-run` flag that prints the file tree it would generate without writing anything.
- Shell completion for flags/project types.

**Future Considerations (P2)**
- Re-running against an existing workspace to add an agent format or project-type folder that wasn't picked initially (this edges into Web App "management" territory — don't build the storage/state model for it now, but don't write generation code that assumes "always a brand-new empty folder" either).
- Packaging for `npx workspace-kit` / global install.

## Success Metrics
**Leading:** time from `npx ...` (or equivalent) to a written, agent-ready folder (target: under 60 seconds including prompts); whether output parity with the HTML generator holds across all 17 project types (target: 100%, verified by a checklist/test pass, not just spot-checks).
**Lagging:** whether the CLI becomes Alexandre's own default way of starting new projects going forward (self-usage is the realistic signal at this stage — there's no external user base yet to measure adoption against).

## Open Questions
- **(Engineering — blocking)** Shared generation logic: the HTML artifact's generation code lives inline in `src/workspace-kit.html`'s `<script>` block. Does the CLI extract/reuse that logic as a shared module (single source of truth, but requires refactoring the HTML artifact to consume it too), or does it duplicate the templates independently (faster to ship, but reintroduces the exact multi-file-drift risk the project's own docs warn about)? This should be resolved before writing CLI code, not after.
- **(Engineering)** Runtime choice: Node (consistent with the project's only existing tooling assumption — `npm install -g @anthropic-ai/claude-code` in the Dockerfile — and easiest to share code with a future Node-based Web App) vs. something else. Node is the reasonable default absent a stated reason otherwise.
- **(Product — Alexandre)** Should the CLI ship inside this same repo (`workspace-kit`) or as a separate package/repo? Affects the `docs/specs` and issue structure downstream.

## Timeline Considerations
No hard deadline. Natural sequencing: this spec and the Web App spec are foundational — Templates and Docker environment generation both assume at least one of the two exists in some form, so this is reasonable to prioritize first or in parallel with the Web App, ahead of those two.
