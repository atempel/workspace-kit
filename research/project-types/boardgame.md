# Project type — Board / card game (`boardgame`)

## Summary
For physical (or print-and-play) tabletop game design: board games, card games — a non-digital sibling of `jogo`.

## When to choose this type
The project is a physical game whose main iteration loop is playtesting and rule balancing, not code.

## Standard folders
- `prototypes` / `prototipos` — physical or print-and-play prototypes.
- `playtests` — session notes, feedback.
- `art` / `arte` — components, illustrations.

All three default to checked.

## Anchor file
`rules/RULEBOOK.md` — Theme, Game objective, Components, Setup, Turn/flow, Win and loss conditions. This is the type whose anchor file is closest to a finished, player-facing artifact rather than an internal spec — worth keeping in mind if the tool ever adds export formatting (PDF-ready rulebooks, etc.).

## Stack / limits placeholders (current)
- Stack example: "cooperative, WWII aviation theme · print-and-play for testing"
- Limits example: "every balance change must be logged with a reason"

## Notes for the generator
- The "log every balance change" limit is unusually specific and valuable — it maps balance tweaks directly onto DECISIONS.md, reinforcing the human-layer/agent-layer split that's central to this whole product.
- No code folder by design — if a future board-game project needs a companion app (score tracker, digital rules reference), that's a sign to add a `src` folder as a fourth check, or to note in CONTEXT.md that it's a hybrid project.
