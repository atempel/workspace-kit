# Kit — Marketing campaign (`marketing`) — PROPOSED

## Summary
For a bounded marketing campaign: a product launch push, a seasonal promotion, a content series with a specific goal and timeline — distinct from ongoing brand/content work.

## When to choose this type
The project has a campaign brief with an objective, target audience, channels, and an end date, rather than being an ongoing content practice.

## Proposed standard folders
- `assets` (`assets`) — creative assets (images, video, ad creative).
- `copy` (`copy`) — campaign copy, ad text, email drafts.
- `calendar` (`calendar`) — channel plan and publishing schedule.

Proposed defaults: `[true, true, true]` — all three are usually needed from the first planning session.

## Proposed anchor file
`docs/BRIEF.md`:
```
# Campaign brief — {name}

## Objective

## Target audience

## Key message

## Channels

## Budget

## Success metrics

## Timeline
```

## Proposed stack / limits placeholders
- Stack example: "Meta Ads + Google Ads · scheduled via Buffer · landing page on Webflow"
- Limits example: "don't publish paid ads without approval · keep messaging consistent with brand guidelines"

## Notes for the generator
- Overlaps with `site`: a campaign frequently points at a landing page. Recommendation: keep them separate — `marketing` is the strategy/brief layer, `site` is the page/code layer, and a campaign may reference an existing `site` project rather than creating a new one.
- Also adjacent to `escrita` (copy) but campaign copy is short-form, channel-bound, and tied to a deadline and metrics in a way that general writing isn't.
