# workspace//kit

AI workspace generator: from a project description, produces the human context layer and the AI instruction layer per tool, packaged into a .zip.

## Stack & commands
Plain HTML + CSS + JS, single file (`src/workspace-kit.html`). No build step. External dependency: JSZip 3.10.1 via cdnjs. Fonts via Google Fonts (JetBrains Mono + Inter). To test: open the .html directly in a browser, or use it as a Claude artifact.

## Limits — don't do this without asking
- Don't introduce a backend, API keys, or network calls beyond CDN/fonts — the generator needs to stay 100% client-side.
- Don't add a build framework (React/Vite/etc.) without an explicit decision — today it's plain HTML on purpose.
- Don't change the palette/typography defined in v2 without logging the reason in DECISIONS.md.
- Don't present the AI, in the texts the product itself generates, as anything beyond a tool — this is a product rule, not just a style rule.

## See also
- PROJECT.md — overview for humans
- DECISIONS.md — decision history (update on every relevant decision)
- TASKS.md — active tasks
- research/agent-ecosystem.md — research that grounds the file-format choices
