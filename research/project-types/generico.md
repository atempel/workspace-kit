# Project type — Generic (`generico`)

## Summary
The catch-all for anything that doesn't fit the other types — or that the user hasn't yet decided how to categorize.

## When to choose this type
Anything genuinely ambiguous, or a project that's still too early to classify.

## Standard folders
- `docs` — documents.
- `assets` — assets.
- `outputs` — results/outputs.

All three default to **unchecked** — the only type where nothing is pre-selected, since we have no signal about what this project actually needs.

## Anchor file
None, and it should stay that way — adding an anchor file here would defeat the purpose of a fallback type.

## Stack / limits placeholders (current)
- Stack example: "tools and conventions used in this project"
- Limits example: "what the AI should not decide on its own here"

## Notes for the generator
- This type's placeholders are the most "meta" of the set — they describe the fields themselves rather than giving a concrete domain example, since there's no domain to anchor to.
- Should remain last in the type list (or clearly marked as a fallback) so it doesn't get chosen by default ahead of a better-fitting type — currently it's simply last in `TYPE_CONFIG`, which coincides with iteration order in `populateTypeSelect()`.
