# Spec — Templates feature

Status: draft, pending review. Source: Notion voice note "Notas de áudio Workspace Kit 14/07" (2026-07-14), refined in TASKS.md and the 2026-07-21 multi-surface decision.

## Problem Statement
Workspace//kit today generates one fixed structure per project type, defined entirely by the maintainer. That's a good universal default, but it isn't the ideal workspace for everyone — professionals who work a certain way repeatedly end up wanting their own file structure and naming, not the maintainer's. The home nav already has a "Templates" option with no functionality behind it, so this gap is already visible to anyone using the artifact today.

## Goals
- Let a user define their own reusable workspace structure (files, folders, content with fill-in-the-blank fields) instead of only the 17 built-in project types.
- Reuse the existing generation UX (form → preview → download/write, starter prompt) for template-based generation, so it feels like the same tool, not a separate one.
- Let users name and reuse templates across future projects without rebuilding them each time.
- Keep the built-in generator as the zero-friction default — templates are additive, not a replacement, and shouldn't complicate the experience for someone who just wants a standard workspace.

## Non-Goals
- **Template marketplace / sharing between users** — v1 is single-user, local templates only; publishing/discovering others' templates is a separate initiative if ever pursued.
- **Arbitrary logic in templates** (conditionals, loops, computed fields) — the merge-tag system (see Requirements) is a flat find-and-replace, not a templating language; anything more is future scope.
- **Full workspace management from a template** (versioning templates, diffing template updates against already-generated workspaces) — out of scope; a template is a one-time generation source, not a live link to workspaces created from it.
- **Building this inside the standalone HTML artifact as a first-class multi-template manager** — per the 2026-07-21 multi-surface decision, persistent template storage/management is realistically CLI/Web-App territory (needs to save/list many templates across sessions); the HTML artifact can still support a single-template flow (paste/upload one template, fill its form, download) since that's just more generated text, but isn't where "manage many templates" lives.

## User Stories
- As a professional who works a certain way repeatedly, I want to define my own folder/file structure once so that I don't rebuild it by hand every time I start a similar project.
- As a template creator, I want to mark fields in my template's `.md` files with a merge tag (e.g. `%project_name%`) so that filling out a form later automatically populates them, the same way the built-in generator's form populates PROJECT.md today.
- As a template creator, I want to add/remove files and folders in my template (not just edit the content of files the tool already generates) so that I have real freedom over structure, not just wording.
- As a returning user, I want to name my template and pick it again later from the home screen so that reusing it doesn't mean recreating it.
- As a new user with no templates saved, I want the home screen to default straight to the standard generator so that templates never get in the way of someone who just wants the normal flow.

## Requirements

**Must-Have (P0)**
- Template authoring: create/edit a template's file and folder structure, including adding new files/folders beyond what any built-in project type defines.
  - Acceptance: a user can produce a template containing at least one file/folder not present in any of the 17 built-in types.
- Merge-tag system: define named fields (like the built-in generator's "project name") and reference them in template `.md` files with a marker (`%tag%` or `[tag]`, format TBD — see Open Questions).
  - Acceptance: generating from a template with N defined fields produces a form with N inputs; submitting the form replaces every occurrence of each tag in every template file with the submitted value.
- Generation flow parity: running a template produces the same kind of experience as the standard generator — directory preview, download/write options, starter-prompt configuration.
  - Acceptance: a template-based generation run and a standard-type generation run both end at a downloadable/writable workspace with a starter prompt, from the user's point of view.
- Home-screen selector: choose between the standard generator and a saved template; auto-select the standard generator when no template exists.
  - Acceptance: a fresh install/session with zero saved templates shows no template-selection UI at all — behavior is identical to today's single-generator flow.
- Template permissions scope (see also Open Questions): at minimum, a template author can create files, create folders, and edit file content within their template.

**Nice-to-Have (P1)**
- Template duplication ("start a new template from an existing one").
- Example/starter templates ("presentation workspace," "mood board workspace" — both explicitly mentioned in the source voice note) shipped as built-in examples to make the feature legible on first use.
- Validation/preview of merge tags while authoring (e.g. warn if a tag is defined but never used in any file, or used but never defined).

**Future Considerations (P2)**
- Full workspace management from templates ("generate new projects from templates" as a broader capability) — the voice note's own long-term framing, explicitly deferred there too.
- Template sharing/export as a portable file other users could import.
- Spec Kit-format anchor files (spec.md/plan.md) as an alternate template output format for Phase-2 handoff — a parked idea from a separate planning session, unrelated to this feature's core scope but worth remembering if template *output formats* become configurable later.

## Success Metrics
**Leading:** whether a hand-built test template (structure + merge tags) round-trips correctly end to end (define → fill form → generate → verify every tag replaced, every file/folder present) with zero manual fixes needed.
**Lagging:** whether Alexandre's own recurring project types (e.g. whatever he repeats across his own work) end up as saved templates he actually reuses, rather than being rebuilt by hand each time — the realistic signal at this stage, same caveat as the CLI/Web App specs.

## Open Questions
- **(Product — Alexandre)** Merge-tag marker syntax: `%tag%`, `[tag]`, or something else? Needs to be a character sequence unlikely to collide with normal Markdown/prose content.
- **(Product — Alexandre)** Exact permission boundary: can a template *remove* files/folders that would otherwise be part of a base structure, or only add/edit? The source material says "create files, create folders, alter content" but doesn't address deletion explicitly.
- **(Engineering — blocking on CLI/Web App specs)** This feature assumes at least one of the CLI or Web App exists for anything beyond the single-template HTML flow — sequencing depends on which of those two ships first.
- **(Engineering)** Storage format for saved templates (a folder on disk? a serialized JSON/zip the app manages?) — depends on the Web App's file-system access model (see that spec's open questions).

## Timeline Considerations
Depends on the CLI and/or Web App reaching at least MVP first for the "saved, reusable, multi-template" experience; a reduced single-template HTML flow could theoretically ship earlier and independently if useful as a stepping stone — worth a call once those two specs are further along rather than deciding now.
