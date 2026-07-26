# Project type — Mobile app (iOS/Android) (`mobile`) — PROPOSED

## Summary
For native or cross-platform mobile apps. Distinct from `produto` mainly because of the store-submission lifecycle: metadata, screenshots, permissions, and platform review — none of which a desktop/web product deals with.

## When to choose this type
The project ships through the App Store and/or Google Play, and part of the work is preparing a store listing and surviving platform review, not just writing code.

## Proposed standard folders
- `assets` (`assets`) — icons, screenshots, app store images.
- `src` (`src`) — code.
- `store` (`store`) — store listing copy and metadata. Unchecked by default — not needed until closer to release.

Proposed defaults: `[true, true, false]`.

## Proposed anchor file
`store/LISTING.md`:
```
# Store listing — {name}

## App name

## Short description

## Full description

## Screenshots

## Keywords

## Privacy policy URL

## Support contact
```

## Proposed stack / limits placeholders
- Stack example: "React Native + Expo · TestFlight for iOS beta · target Android 8+"
- Limits example: "don't submit to app stores without review · keep requested permissions minimal"

## Notes for the generator
- Biggest overlap risk is with `produto` — the dividing line is the store folder/anchor file. If a mobile project doesn't care about store presence (e.g. internal-only distribution via TestFlight/APK sideloading), `produto` may still be the better fit.
- Also overlaps conceptually with `extension` (also proposed) in that both have a "store" folder and review-driven risk — but app store review is about content/functionality, while extension store review is overwhelmingly about permissions justification. Kept as separate types for that reason.
