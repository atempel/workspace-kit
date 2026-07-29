# workspace//kit

AI workspace generator: from a project description, produces the human context layer and the AI instruction layer per tool, packaged into a .zip.

## Stack & commands
**Standalone artifact (`src/workspace-kit.html`):** plain HTML + CSS + JS, single file. No build step. External dependency: JSZip 3.10.1 via cdnjs. Fonts via Google Fonts (JetBrains Mono + Inter). To test: open the .html directly in a browser, or use it as a Claude artifact.

**Shared generation module (`core/generator.js`):** plain Node-compatible JS (CommonJS `module.exports` for Node, `window.WorkspaceKitCore` for `<script>`), zero dependencies at runtime, no build step. Seeded from the artifact's generation logic for the future CLI/Web App to consume — not wired into the standalone artifact, which keeps its own separate inline copy (see DECISIONS.md, 2026-07-22, for why). To test: `npm run test:fixtures` (fast smoke test against recorded fixture output, guards the module's own behavior) and `npm run test:parity` (jsdom, dev-only dependency — loads the real `src/workspace-kit.html` and diffs its actual output against `core/generator.js` for the same inputs; the real check that the two copies still agree).

**Workspace inspection layer (`core/inspect.js`):** the read-side counterpart to `core/generator.js` — same conventions (Node-compatible, zero runtime dependencies, no build step), but Node-only (`module.exports`, no `window.*`) since reading a folder needs `fs`. Turns an existing workspace into an addressable index: per-file metrics, agent-layer instructions parsed into stable-ID units, and the cross-reference graph. It reports; it never judges — thresholds, verdicts and suggestions belong to the health check (docs/specs/workspace-health-check.md → #78), git state to #79, rendering to #169. To test: `npm run test:inspect` (each case maps 1:1 to a P0 acceptance criterion in docs/specs/workspace-inspection-layer.md → #77). To eyeball an index: `node core/inspect.js <folder>`. It also parses the two workspace conventions that delegate their reading here rather than each growing a parser: `queue/*.md` stubs (#80) into `index.queue`, and `SESSIONS.md` (#81) into `index.sessions`, newest-first.

**Workspace health check (`core/doctor.js` + `bin/workspace-kit.js`):** the judgement layer over the inspection index — thresholds, verdict, and concrete suggestions (docs/specs/workspace-health-check.md → #78). `diagnose()` takes an index, never a folder path, so `core/inspect.js` stays the only module in this codebase that touches the disk. Run it with `node bin/workspace-kit.js doctor [dir]` (`--json` for machine output); it exits non-zero when the verdict is unhealthy, so it works in CI. To test: `npm run test:doctor`.

**Git integration layer (`core/git.js`):** file-state tracking, the safe-edit check, a plain-language change summary and a templated commit message (docs/specs/git-integration-layer.md → #79). Builds on the inspection index rather than re-walking the folder. Model-agnostic is a product rule here, not a preference: every string it emits is a deterministic template over file names and diff counts, and a test asserts the module makes no outbound call. Git is driven with explicit argument arrays, never a shell string. Run `node bin/workspace-kit.js status [dir]`. To test: `npm run test:git`. **Not implemented, on purpose:** the PR flow and worktree management, both gated on open product questions in the spec (hosting-provider scope; worktree placement/naming).

`npm test` runs all five suites.

## Limits — don't do this without asking
- Don't introduce a backend, API keys, or network calls beyond CDN/fonts — the generator needs to stay 100% client-side.
- Don't add a build framework (React/Vite/etc.) to `src/workspace-kit.html` or `core/` — the artifact is plain single-file HTML on purpose, and `core/` stays zero-dependency so both the CLI and Web App can consume it. The Local Web App surface is the documented exception: React + Tailwind + shadcn/ui with a build step, decided 2026-07-28 (see DECISIONS.md).
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
