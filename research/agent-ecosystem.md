# Research — AI agent context file ecosystem (Jul/2026)

Research that grounded the generator's v2. A summary, not a copy of sources.

## AGENTS.md
- Open, vendor-neutral format. Emerged from collaboration between OpenAI, Google, Cursor, and Factory in 2025; donated to the Agentic AI Foundation (Linux Foundation) in December 2025.
- Read natively by: OpenAI Codex CLI, Cursor, Aider, Devin, GitHub Copilot (partial), Gemini CLI (via configuration), Windsurf, Amazon Q, Google Jules, Amp, Warp, Zed, Goose, Continue, Kilo, among others.
- Over 60,000 open-source repositories already use the format (Dec/2025 data).
- Finding: tools like Codex walk the directory tree top-down, prioritizing the AGENTS.md closest to the file being edited.

## CLAUDE.md (Claude Code / Cowork)
- Anthropic's own format, predates AGENTS.md.
- As of at least mid-2026, Claude Code **does not read AGENTS.md natively** — there's a popular open request in the project's issue tracker.
- Recommended workaround: `@AGENTS.md` at the top of CLAUDE.md (import), or a symlink in single-agent repos.
- Supports hierarchy (project CLAUDE.md + personal `~/.claude/CLAUDE.md`) and `CLAUDE.local.md` for unversioned overrides.

## Other tool-specific conventions
- **Cursor:** `.cursor/rules/*.mdc` (current format, with `description`/`globs`/`alwaysApply` frontmatter); `.cursorrules` is the legacy format.
- **GitHub Copilot:** `.github/copilot-instructions.md` for general rules; `.github/instructions/*.instructions.md` with `applyTo` frontmatter for per-file-type rules.
- **Gemini CLI:** `GEMINI.md` by default; file name configurable via `settings.json` (`context.fileName`).
- **Windsurf:** `.windsurf/rules/`, with a ~6,000 character limit per file and ~12,000 total.

## Agent Skills (SKILL.md)
- A standard separate from AGENTS.md: while AGENTS.md describes *the project*, a Skill describes *a reusable capability* (procedure, checklist, routine) that travels between projects.
- Format: a folder with `SKILL.md` (`name` + `description` frontmatter required) and optional assets.
- Originated at Anthropic, adopted as an open standard by Claude Code, Codex, Cursor, VS Code, and others.

## Design implication for the generator
- Generating AGENTS.md as the source of truth + a CLAUDE.md that imports it (`@AGENTS.md`) is the combination that covers the most tools without duplicating content.
- Worth re-evaluating this research periodically — this space moves fast (Claude Code itself may start reading AGENTS.md natively in the future).
