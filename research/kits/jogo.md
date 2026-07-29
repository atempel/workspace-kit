# Kit — Digital game (game dev) (`jogo`)

## Summary
For video game development projects, scoped explicitly toward small/solo projects ("single mechanic, scope of a few days") rather than large studio productions.

## When to choose this type
The project is an interactive digital game with a codebase and needs a design anchor separate from the technical one.

## Standard folders
- `assets` — sprites, sound, models.
- `builds` — exported builds, unchecked by default (nothing built yet on day one).
- `src` — code.

Defaults: assets and src checked, builds unchecked.

## Anchor file
`design/GDD.md` — One-sentence concept, Core mechanic (core loop), Scope (what fits the timeline), Out of scope. Deliberately minimal compared to a professional GDD template — matches the tool's "small scope" framing in the limits placeholder.

## Stack / limits placeholders (current)
- Stack example: "Construct 3 / Unreal Engine 5 · Blueprints only"
- Limits example: "single mechanic, scope of a few days · no multi-layer systems"

## Notes for the generator
- Directly relevant to the user's own GamerDash project context (see `gamerdash-planning` skill), though GamerDash itself is a Steam library manager (a `produto`/app), not a game — worth not conflating the two when this type comes up.
- The "Blueprints only" stack example is UE5-specific and somewhat opinionated; if the tool ever supports per-example stack presets instead of one placeholder, this is a good candidate to branch (Unity/C# vs. UE5/Blueprints vs. Construct 3 have very different limits).
