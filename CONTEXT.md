# Context — workspace//kit

Context the AI should know to work well on this project: conventions, constraints, vocabulary, people involved.

## Conventions
- The artifact is a single HTML file (no build step); any new external dependency must come from a CDN (cdnjs/Google Fonts) and be justified.
- Interface and generated file texts are available in Portuguese or English via the artifact's language selector (see DECISIONS.md, 2026-07-01 entry); file names that are fixed tool conventions (CLAUDE.md, AGENTS.md, etc.) always stay in English, since those are literal names read by external tools.
- The palette and typography defined in v2 (see DECISIONS.md) are the current visual identity — brand changes must be logged as a decision, not made silently.

## Constraints
- No backend, no external API calls requiring a key — **scoped to the standalone HTML surface** (see DECISIONS.md, 2026-07-21): it needs to keep working as a self-contained artifact inside Claude.ai/the browser. The planned CLI and local Web App surfaces are expected to have their own runtime and are not bound by this.
- The AI (Claude/Cowork) is treated, in the templates the product itself generates, as a tool that extends human judgment — never as a creative entity with its own agency. This rule applies both to the product and to how it talks about itself.
- workspace//kit is a workspace **management and versioning** tool for instructions/prose/documentation — explicitly not a code-versioning tool (git already does that). It is **model- and tool-agnostic** as a product principle, not just an implementation detail of the standalone HTML artifact: the planned Git integration layer is a user-friendly layer workspace//kit itself drives, never a wrapper that calls or hosts an AI model (see DECISIONS.md, 2026-07-26).

## Vocabulary / specific terms
- "Human layer" = PROJECT.md/DECISIONS.md/CONTEXT.md/TASKS.md.
- "Agent layer" = CLAUDE.md/AGENTS.md/Cursor/Copilot/Gemini CLI/Windsurf rules/Skills.
- "Kit" (formerly "project type") = one of the 17 built-in folder/anchor-file presets; built-ins are "system kits". Renamed 2026-07-26 (see DECISIONS.md) to avoid colliding with the separate, user-authored Templates feature. Executing the rename across code/UI is still tracked in TASKS.md — until that lands, `TYPE_CONFIG` and other in-code identifiers still say "project type".
- "Anchor file" = the central document for a kit (PRD, GDD, Rulebook, handoff spec, API reference).
- "RAG by Markdown" = the product's core mental model: the files in a generated workspace form a reference network, each file linking only to the other files relevant to it (not all of them); the agent builds and walks a semantic path, reading just what's relevant to the task at hand instead of the whole directory. This is why cross-references between files (e.g. CLAUDE.md → AGENTS.md, PROJECT.md → DECISIONS.md/TASKS.md) matter more than any single file's completeness.
- Workspace vs. SDD (Spec Driven Development): related but distinct. SDD is a development methodology; the Workspace is treated as the broader foundation underneath it — not limited to software development, applicable to any kind of project.
- "Three surfaces" = the product's planned coexisting delivery forms (see DECISIONS.md, 2026-07-21): CLI, local Web App (generates + manages workspaces), and the standalone HTML artifact. Not sequential versions — meant to coexist, each getting new features except where a feature structurally requires git/a local process (CLI/Web-App-only).
