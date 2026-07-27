# workspace//kit

AI workspace generator: from a project description, produces the human context layer and the AI instruction layer per tool, packaged into a .zip.

## Stack & commands
**Standalone artifact (`src/workspace-kit.html`):** plain HTML + CSS + JS, single file. No build step. External dependency: JSZip 3.10.1 via cdnjs. Fonts via Google Fonts (JetBrains Mono + Inter). To test: open the .html directly in a browser, or use it as a Claude artifact.

**Shared generation module (`core/generator.js`):** plain Node-compatible JS (CommonJS `module.exports` for Node, `window.WorkspaceKitCore` for `<script>`), zero dependencies at runtime, no build step. Seeded from the artifact's generation logic for the future CLI/Web App to consume — not wired into the standalone artifact, which keeps its own separate inline copy (see DECISIONS.md, 2026-07-22, for why). To test: `npm run test:fixtures` (fast smoke test against recorded fixture output, guards the module's own behavior) and `npm run test:parity` (jsdom, dev-only dependency — loads the real `src/workspace-kit.html` and diffs its actual output against `core/generator.js` for the same inputs; the real check that the two copies still agree).

## Limits — don't do this without asking
- Don't introduce a backend, API keys, or network calls beyond CDN/fonts — the generator needs to stay 100% client-side.
- Don't add a build framework (React/Vite/etc.) without an explicit decision — today it's plain HTML on purpose.
- Don't change the palette/typography defined in v2 without logging the reason in DECISIONS.md.
- Don't present the AI, in the texts the product itself generates, as anything beyond a tool — this is a product rule, not just a style rule.

## Every session
- Before ending your session, append one entry to `SESSIONS.md` — tool/surface, what was done, state left behind (see docs/specs/cross-tool-session-log.md). This fires every session, not just at onboarding.
- If you saved a reference you haven't incorporated yet (a voice note, doc, link), file a stub under `queue/` (see docs/specs/document-ingestion-queue.md). `grep -l "Status: Pending" queue/*.md` lists what's still open.

## See also
- PROJECT.md — overview for humans
- DECISIONS.md — decision history (update on every relevant decision)
- TASKS.md — active tasks
- SESSIONS.md — per-session tool-handoff log (append every session, see above)
- queue/ — saved-but-not-yet-ingested references
- research/agent-ecosystem.md — research that grounds the file-format choices
