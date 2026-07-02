# Context — workspace//kit

Context the AI should know to work well on this project: conventions, constraints, vocabulary, people involved.

## Conventions
- The artifact is a single HTML file (no build step); any new external dependency must come from a CDN (cdnjs/Google Fonts) and be justified.
- Interface and generated file texts are available in Portuguese or English via the artifact's language selector (see DECISIONS.md, 2026-07-01 entry); file names that are fixed tool conventions (CLAUDE.md, AGENTS.md, etc.) always stay in English, since those are literal names read by external tools.
- The palette and typography defined in v2 (see DECISIONS.md) are the current visual identity — brand changes must be logged as a decision, not made silently.

## Constraints
- No backend, no external API calls requiring a key — the generator needs to keep working as a standalone artifact inside Claude.ai.
- The AI (Claude/Cowork) is treated, in the templates the product itself generates, as a tool that extends human judgment — never as a creative entity with its own agency. This rule applies both to the product and to how it talks about itself.

## Vocabulary / specific terms
- "Human layer" = PROJECT.md/DECISIONS.md/CONTEXT.md/TASKS.md.
- "Agent layer" = CLAUDE.md/AGENTS.md/Cursor/Copilot/Gemini CLI/Windsurf rules/Skills.
- "Anchor file" = the central document for a project type (PRD, GDD, Rulebook, handoff spec, API reference).
