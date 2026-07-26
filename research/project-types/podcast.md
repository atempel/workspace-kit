# Project type — Podcast / video production (`podcast`) — PROPOSED

## Summary
For episodic audio/video content: podcasts, YouTube series — recurring production with a consistent format, as opposed to one-off writing.

## When to choose this type
The project produces episodes on a recurring cadence, involves raw recordings that get edited down, and needs guest/credit accuracy — none of which `escrita` folders (drafts/references/published) map onto well.

## Proposed standard folders
- `episodes` (`episodes`) — episode outlines, scripts, show notes.
- `raw` (`raw`) — raw recordings (audio/video), unchecked by default (often stored outside git due to size).
- `published` (`published`) — final published episode metadata.

Proposed defaults: `[true, true, false]`.

## Proposed anchor file
`docs/SHOW-BIBLE.md`:
```
# Show bible — {name}

## Premise

## Format

## Target audience

## Episode structure

## Tone & voice guidelines
```

## Proposed stack / limits placeholders
- Stack example: "recorded in Riverside.fm · edited in Descript · published via Spotify for Podcasters"
- Limits example: "don't publish an episode without a reviewed transcript · credit guests accurately"

## Notes for the generator
- Raw audio/video files are usually large — this type is a strong candidate for the open TASKS.md `.gitignore` item (ignore `raw/` by default, or warn that it shouldn't be zipped/committed).
- Distinct from `escrita`: episodic cadence, recording/editing workflow, and guest-credit accuracy are format-specific risks that a text-writing type doesn't carry.
