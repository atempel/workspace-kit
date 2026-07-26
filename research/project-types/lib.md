# Project type — Open source library / SDK (`lib`)

## Summary
For packages published to a registry (npm, PyPI, crates.io, etc.) and consumed by other developers — the type most concerned with API stability and versioning discipline.

## When to choose this type
The deliverable is a reusable package with a public API contract, not an end-user-facing app.

## Standard folders
- `examples` / `exemplos` — usage examples.
- `docs` — documentation beyond the anchor file.
- `tests` / `testes` — test suite.

All three default to checked — the highest-discipline type in the set, reflected in the folder defaults.

## Anchor file
`docs/API.md` — Installation, Basic usage, Public API, Versioning. The only type whose anchor file is meant to be kept continuously up to date as a living reference, rather than written once and left mostly static (contrast with GDD/RULEBOOK, which are set early and rarely revisited).

## Stack / limits placeholders (current)
- Stack example: "TypeScript · published on npm · strict semver"
- Limits example: "every public API change needs a changelog entry"

## Notes for the generator
- The semver/changelog discipline here is the strictest of any type — a good candidate first stop if the tool ever adds a "strictness level" concept (e.g. requiring DECISIONS.md entries to follow a stricter template for this type).
- Distinct from `extension` (proposed): both publish to a registry/store, but a library's consumers are developers reading an API, while an extension's consumers are end users going through a store review process — different anchor file, different risk (breaking API vs. requesting excessive permissions).
