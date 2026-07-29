# Kit — Course / educational content (`course`) — PROPOSED

## Summary
For structured educational content: cohort-based courses, workshops, internal training — anything organized into modules with learning objectives and assessments, as opposed to unstructured writing (`escrita`).

## When to choose this type
The deliverable is organized around learning objectives and modules/lessons, with some form of assessment, rather than a single piece of prose.

## Proposed standard folders
- `modules` (`modules`) — curriculum, lesson breakdown.
- `materials` (`materials`) — slides, worksheets, supporting media.
- `assessments` (`assessments`) — quizzes, assignments, grading criteria. Unchecked by default — often designed after the modules exist.

Proposed defaults: `[true, true, false]`.

## Proposed anchor file
`docs/SYLLABUS.md`:
```
# Syllabus — {name}

## Audience

## Learning objectives

## Module breakdown

## Assessment criteria

## Prerequisites
```

## Proposed stack / limits placeholders
- Stack example: "delivered via Notion + recorded video · cohort-based, 6 weeks"
- Limits example: "don't change learning objectives without updating the syllabus · keep exercises aligned to stated objectives"

## Notes for the generator
- Distinct from `escrita`: writing is single-author prose with a publishing endpoint; a course is modular, has assessments, and usually involves iteration based on learner feedback (closer in spirit to `design`'s handoff/iteration loop than to `escrita`).
- No overlap with other proposed types; safe to add independently.
