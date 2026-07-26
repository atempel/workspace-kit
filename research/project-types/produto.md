# Project type — Digital product / App (`produto`)

## Summary
The default, broadest type. Covers any software product built for end users or internal use: desktop apps, internal tools, standalone artifacts. This is the type used by the generator's own project (workspace//kit itself) and by the user's other product, GamerDash.

## When to choose this type
The project ships working software with a codebase, and the main risk is scope creep or losing track of technical decisions — not research methodology, narrative voice, or game balance.

## Standard folders
- `research` / `pesquisa` — discovery notes, competitive research, user interviews (optional; often the project already has validated the idea).
- `design` — UI references, wireframes, exported assets.
- `src` — the actual code.

All three default to checked — this is the type most likely to need all three from day one.

## Anchor file
`docs/PRD.md` — Problem, Proposed solution, Scope, Out of scope, Success metrics. This is the closest thing to a classic PRD and is the template most other generators copy from.

## Stack / limits placeholders (current)
- Stack example: "Tauri v2 + React + SQLite · pnpm · tests with vitest"
- Limits example: "don't commit directly to main · don't use paid libraries without asking"

## Notes for the generator
- This type is the fallback mental model for "software project" — if a future type feels like a variant of this one (e.g. mobile, extension, API service), consider whether it should be a distinct type or just a stack note within `produto`. The line we've drawn so far: a new type earns its place when it has a genuinely different anchor file or folder set (e.g. mobile apps need a store-listing folder; this type doesn't).
- Because this is the default/first option in the select, its ordering matters more than other types for first-time users.
