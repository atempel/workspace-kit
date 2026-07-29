# Kit — Hardware / IoT (`hardware`) — PROPOSED

## Summary
For physical computing and IoT projects: firmware plus a physical device, e.g. ESP32/Arduino/Raspberry Pi builds, sensors, enclosures. No existing type covers firmware or bills of materials.

## When to choose this type
The project involves both code (firmware) and a physical bill of materials, and lead times / part sourcing are a real project risk.

## Proposed standard folders
- `firmware` (`firmware`) — embedded code.
- `hardware` (`hardware`) — schematics, CAD files, wiring diagrams.
- `docs` (`docs`) — general documentation.

Proposed defaults: `[true, true, true]` — all three matter from day one, unlike mobile/extension where store presence can wait.

## Proposed anchor file
`hardware/BOM.md`:
```
# Bill of materials — {name}

## Components

## Sourcing / suppliers

## Estimated cost

## Lead-time risks
```

## Proposed stack / limits placeholders
- Stack example: "ESP32 + Arduino framework · KiCad for schematics · 3D-printed enclosure"
- Limits example: "don't change pinout without updating the schematic · flag any part with lead time over 2 weeks"

## Notes for the generator
- This is the only proposed type where the anchor file tracks physical supply-chain risk rather than a design or product decision — genuinely new territory for the tool's "human layer" concept.
- No overlap with existing types; safe to add independently of the others.
