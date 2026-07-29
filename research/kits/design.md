# Kit — Design (UI/product) (`design`)

## Summary
For design-only work streams: a design system, a UI redesign, a set of screens handed off to engineering — where the deliverable is specs and assets, not running code.

## When to choose this type
The project's output is visual/interaction decisions destined for a handoff, and the main risk is shipping AI-generated visuals as if they were final, polished assets.

## Standard folders
- `references` / `referencias` — inspiration, competitor screenshots, mood boards.
- `assets` — exported design files, icons, images.
- `wireframes` — low-fidelity exploration.

All three default to checked.

## Anchor file
`handoff/SPEC.md` — Tokens, Components, States, Breakpoints. This mirrors what the `design:design-handoff` skill produces, so a project generated here should slot naturally into that workflow later.

## Stack / limits placeholders (current)
- Stack example: "Figma as source of truth · tokens exported to /assets"
- Limits example: "don't generate final assets with AI without clearly marking them as drafts"

## Notes for the generator
- The limits placeholder here is doing real work: it's the one type where "the AI making an unmarked deliverable-quality artifact" is a distinct, named risk versus just a generic "don't overstep" warning.
- Good candidate to cross-reference with the `design` plugin skills (design-critique, accessibility-review, design-system) in a future "recommended skills per kit" feature — see TASKS.md.
