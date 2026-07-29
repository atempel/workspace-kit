# Kit — Research & analysis (`pesquisa`)

## Summary
For projects whose output is a finding, not a shipped artifact: market research, user research synthesis, competitive analysis, data investigations that end in a report rather than a product.

## When to choose this type
The deliverable is a conclusion or recommendation backed by evidence, and the biggest risk is contaminating or losing track of raw source data, not code regressions.

## Standard folders
- `data` / `dados` — raw data, kept untouched.
- `notes` / `notas` — source notes, interview transcripts, citations.
- `outputs` — the actual findings, reports, decks.

All three default to checked.

## Anchor file
None. Research projects don't have a single canonical anchor document the way a product has a PRD — the "anchor" is really the accumulation of notes plus the final output. This may be worth revisiting if we see recurring requests for a "research brief" template (goal, questions, methodology).

## Stack / limits placeholders (current)
- Stack example: "Python + pandas + Jupyter · dataset in /data"
- Limits example: "never modify raw data, only copy before processing"

## Notes for the generator
- The "never modify raw data" limit is the single most important convention this type encodes — it's the type-specific instinct most worth protecting when users skip filling in the limits field themselves.
- Overlaps partially with `dataml` (both have a `data` folder) but the intent differs: `pesquisa` ends in a written conclusion, `dataml` ends in a running model/pipeline. Worth keeping them separate for that reason.
