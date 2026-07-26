# Project type — Website / landing page (`site`)

## Summary
For marketing sites, landing pages, and simple content sites — narrower than `produto` in that there's no expectation of complex application state, just content + performance.

## When to choose this type
The deliverable is a public-facing site whose success is measured by load performance and content clarity, not feature depth.

## Standard folders
- `content` / `conteudo` — page copy, structured content.
- `assets` — images, media.
- `src` — code/templates.

All three default to checked.

## Anchor file
None currently. Given this type already tracks performance ("Lighthouse above 90"), a lightweight anchor covering target pages, primary CTA, and SEO/meta requirements could be a good future addition — currently that information has nowhere dedicated to live except CONTEXT.md.

## Stack / limits placeholders (current)
- Stack example: "Astro/Next.js · deployed on Vercel"
- Limits example: "keep Lighthouse performance score above 90"

## Notes for the generator
- Meaningful overlap with `marketing` (proposed): a landing page is often the deliverable of a marketing campaign. The distinction we're drawing: `site` is for the page/code itself, `marketing` is for the campaign strategy that may point at one or more `site` projects, or at a page within an already-existing site.
- Currently the only type whose limits placeholder encodes a numeric target rather than a behavioral rule — worth keeping that pattern in mind if the tool ever validates/parses limits text instead of treating it as free text.
