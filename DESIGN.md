# Design — workspace//kit

Status: draft, first pass (2026-07-27) — no prior version existed. Written to seed a Claude Design prototype of the Local Web App's new lifecycle screens (workspace inspection summary, health check, session log, document queue); expected to be refined once the prototype comes back, not treated as final.

Scope note: this describes the **Local Web App** surface's visual direction. The standalone HTML artifact (`src/workspace-kit.html`) keeps its own v2/v3 "terminal" identity (near-black, amber/teal, JetBrains Mono/Inter, glass-card) — see `decisions/008-v2-visual-identity.md`. Whether the two surfaces should look related, or are allowed to diverge as genuinely different products (one-shot artifact vs. ongoing management app), is an open call — see Open Questions. Nothing here silently overrides that existing decision; if the prototype's direction is adopted, it gets its own DECISIONS.md entry per CONTEXT.md's rule that brand changes are logged, not made silently.

## Reference points
Cursor and Notion, named explicitly by the owner: dense-but-uncluttered information display, generous whitespace, a persistent left sidebar + content area shell, subtle 1px borders instead of heavy shadows/skeuomorphism, restrained color (mostly neutral grayscale, color reserved for status/meaning, not decoration), fast-feeling and keyboard-friendly.

## Principles
- **Clean over decorative.** No glass-morphism, no gradients-as-decoration, no glow effects. If the v3 HTML artifact's "glass-card" language shows up here, it should be a deliberate choice, not a default carried over.
- **Status is legible at a glance.** This app's whole job is telling the user "is this workspace healthy?" — verdicts (healthy / warning / over-budget / unhealthy) need an unambiguous, consistent visual language (color + icon + label together, never color alone, for accessibility).
- **Real content, not chrome.** Favor information density appropriate to a power-user tool (closer to Notion's database views or Cursor's file tree) over marketing-site-style whitespace-for-its-own-sake.
- **Same product, two lights.** Dark and light are equally first-class — design tokens, not a dark theme with light as an afterthought (or vice versa).

## Design system
**shadcn/ui** as the component foundation (Radix primitives + Tailwind), per the owner's call — already available in Claude Design. Reasons: native, well-tested light/dark theming via CSS variables; it's the same foundation a lot of Cursor/Linear/Notion-adjacent tools are built on, so it's a fast path to the requested feel; and it still reads as "our own" once brand tokens (color/type/radius) are swapped in, not generic.

## Typography (proposed)
- **Inter** for UI text — carried over from the existing product typography (see `decisions/008-v2-visual-identity.md`), not a new brand element, so lower-risk to reuse.
- **JetBrains Mono** for anything file-path-, code-, or metric-shaped (file names, line/token counts, the `grep`-style commands the product already surfaces in TASKS.md/AGENTS.md) — same reasoning.

## Color (starting point — expect this to change inside Claude Design)
Neutral-first, shadcn-token-shaped (`background`/`foreground`/`card`/`muted`/`border`/`primary`/`ring`, etc.), one accent color, semantic status colors reserved for verdicts:

- **Neutral scale:** near-white → near-black grayscale (standard shadcn "zinc" or "neutral" base is a reasonable starting point) for both modes — light mode is *not* pure white, dark mode is *not* pure black, matching the Notion/Cursor "soft" neutral feel rather than max-contrast.
- **Accent:** one color for interactive elements/links/selection state. Open question whether it's a fresh pick or a continuity nod to the existing teal (see Open Questions) — do not default to indigo/violet (the generic AI-tool color), per the same instinct that drove the original "terminal" identity away from AI-generated-content defaults.
- **Status semantics** (used consistently across the doctor report, file statuses, queue status):
  - Healthy / OK → green
  - Warning / approaching threshold → amber/yellow
  - Over-budget / unhealthy / broken reference → red
  - Neutral/informational (e.g. "ingested", "not yet reviewed") → the neutral/muted tone, not a color, to avoid overloading the palette

## Layout shell (proposed)
Persistent left sidebar (workspace nav: Overview / Health / Session Log / Queue, plus a workspace switcher if multiple are ever opened) + main content area. No top mega-nav. Command-palette-style quick actions (⌘K) are a nice-to-have worth prototyping if time allows, since it fits the Cursor/Notion reference point directly.

## Open Questions
- **(Resolved 2026-07-28, see DECISIONS.md)** Scope: this direction stays **scoped to the Local Web App**. The standalone HTML artifact keeps its v3 terminal identity (`decisions/008-v2-visual-identity.md`) unchanged, and the two surfaces are explicitly allowed to read as related-but-distinct products — a one-shot artifact and an ongoing management app. Nothing here overrides that earlier decision.
- **(Resolved 2026-07-28, see DECISIONS.md)** Accent: amber/teal — a continuity nod to the existing identity rather than a fresh pick, over a neutral shadcn token base, with Inter for UI text and JetBrains Mono for paths/metrics.
- **(Resolved by the prototype)** Exact token values (hex/OKLCH), spacing scale, radius scale — settled inside Claude Design and now versioned as markup at `docs/design/workspace-kit-dashboard.dc.html`. This file stays the direction; that file is the reference for numbers.
