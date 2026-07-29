# Kit — Browser extension (`extension`) — PROPOSED

## Summary
For Chrome/Firefox/Edge browser extensions. The defining risk is different from any existing type: store reviewers reject almost entirely on permission scope, not code quality or design polish.

## When to choose this type
The project is a Manifest V3 (or V2 legacy) browser extension distributed through a web store.

## Proposed standard folders
- `src` (`src`) — extension source code.
- `assets` (`assets`) — icons, promotional images.
- `store` (`store`) — store listing copy. Unchecked by default.

Proposed defaults: `[true, true, false]`.

## Proposed anchor file
`docs/PERMISSIONS.md`:
```
# Permissions — {name}

## Requested permissions

## Why each one is needed

## Data collected

## Store listing notes
```

## Proposed stack / limits placeholders
- Stack example: "Manifest V3 · Chrome Web Store + Firefox Add-ons · TypeScript"
- Limits example: "don't request broader permissions than needed · document every permission's purpose"

## Notes for the generator
- The anchor file here is unusual in that it's primarily a compliance/trust document, not a design or product spec — worth keeping that framing if the generator ever adds guidance text explaining anchor files to users.
- If `mobile` is not adopted, `extension` can still stand alone — it doesn't depend on it.
