# Technical design — Templates feature

Status: draft, pending review. Plans the technical structure of the Templates feature specced in `docs/specs/templates-feature.md` (→ #32). Closes the planning item #22. It is a design, not an implementation: nothing here is built, and every choice that is the owner's to make is listed under Open Questions rather than assumed.

Related issues: parent spec #32; planning #22; permissions #23 / #150; merge tags #24 / #147; home selector #25 / #149; naming and reuse #26; authoring #146; generation-flow parity #148.

## Problem Statement
`docs/specs/templates-feature.md` says *what* Templates must do (authoring, merge tags, flow parity, a home selector, a permission scope) and leaves *how* open on five points: the on-disk format (partly resolved 2026-07-21: shareable files, not app-only state), the merge-tag marker, the permission boundary, how a template run relates to the existing generator, and which surface ships first. This document fixes those so implementation can start without re-litigating the architecture.

## Goals
- Define one portable template format (a folder, optionally zipped) that works identically on every surface, per `decisions/014-shared-generation-engine.md`.
- Reuse `core/generator.js` for everything it already does (agent-layer files, `.gitignore`, starter prompt, directory tree) instead of forking it.
- Keep merge tags a flat find-and-replace, as the spec's Non-Goals require.
- Sequence the surfaces by what each can do today under the 2026-07-21 multi-surface policy, not by what we would like.
- Keep `core/` zero-dependency, the artifact 100% client-side, and every generated string model-agnostic.

## Non-Goals
- **A templating language.** No conditionals, loops, computed fields, includes or filters (spec Non-Goal). A template is data plus `%tag%` substitution.
- **Executable templates.** No scripts, hooks or post-generate commands, ever. A template can only describe files to write.
- **Marketplace / remote fetch.** No network access to load a template; sharing is "send the folder or zip" (spec Non-Goal, P2).
- **Re-expressing the built-in project types as templates.** `decisions/014-shared-generation-engine.md` flags it as a future possibility; this design only avoids closing the door (see "Reuse of the generator").
- **Live link between a template and workspaces generated from it** (spec Non-Goal). Generation is one-shot.

## Template file format

### On-disk structure
A template is a folder. Only `template.json` is required.

```
presentation-workspace/            <- the template (folder name = template id)
├── template.json                  <- manifest (required)
├── files/                         <- verbatim output tree (required, may be nearly empty)
│   ├── README.md
│   ├── PROJECT.md
│   ├── brief/
│   │   └── audience.md
│   ├── slides/
│   │   └── .gitkeep
│   └── notes/
│       └── %talk_slug%.md         <- tags are allowed in file AND folder names
└── README.md                      <- optional, describes the template to its author; never copied to the output
```

Rules:
- **Everything under `files/` is output.** The relative path under `files/` is the relative path in the generated workspace. This keeps authoring (#146) trivial: add a file or folder to `files/`, it is in the template. No "file list" has to be kept in sync with the tree.
- **The manifest describes fields and options, not structure.** Structure is the tree itself.
- **Text files by default.** A file is treated as UTF-8 text and tag-substituted. Binary files are copied byte-for-byte only if the manifest lists them under `verbatim` (a glob list); otherwise a non-UTF-8 file is rejected at load with a clear message (see Open Question 11).
- **Empty folders** are represented by a `.gitkeep`, matching what the generator already writes for its own folders.
- **Portable archive.** A template folder zipped as `<id>.wkt.zip` is the single-file sharing form; its root contains `template.json` directly. JSZip is already an artifact dependency, so the archive form needs nothing new on any surface. A zip and a folder are two encodings of the same thing; the loader normalizes both to the in-memory shape below.

### Manifest schema (`template.json`)
```json
{
  "schema": 1,
  "id": "presentation-workspace",
  "name": { "en": "Presentation workspace", "pt": "Workspace de apresentação" },
  "description": { "en": "Talks and decks: brief, slides, speaker notes.", "pt": "Palestras e decks: briefing, slides, notas." },
  "version": "1.0.0",
  "fields": [
    { "tag": "project_name", "label": { "en": "Talk title", "pt": "Título da palestra" },
      "type": "text", "required": true },
    { "tag": "audience", "label": { "en": "Audience", "pt": "Público" },
      "type": "textarea", "required": false, "default": "" },
    { "tag": "talk_slug", "label": { "en": "File slug", "pt": "Slug do arquivo" },
      "type": "text", "required": true, "default": "{{slug:project_name}}" }
  ],
  "generator": {
    "agentLayer": true,
    "gitignore": true,
    "starterPrompt": true
  },
  "verbatim": ["assets/**"]
}
```

| Key | Required | Meaning |
|---|---|---|
| `schema` | yes | Manifest format version, integer. The loader refuses a higher number than it knows, so an old surface fails loudly on a newer template instead of mis-rendering it. |
| `id` | yes | Stable machine name, `[a-z0-9][a-z0-9-]*`. Must equal the folder name. Used for lookup and storage (#26). |
| `name`, `description` | yes / no | Display strings. A plain string is shorthand for the same text in every language; an object keyed by `en` / `pt` matches the generator's `lang` model (`STRINGS`, `KIT_CONFIG[..].label`). |
| `version` | no | Free-form author version. Informational only: no update or diff mechanism (spec Non-Goal). |
| `fields` | yes (may be `[]`) | The merge-tag definitions, below. Order is form order. |
| `generator` | no | Which parts of the existing generator's output to add around the template's own files. Defaults shown above; see "Reuse of the generator". |
| `verbatim` | no | Globs under `files/` copied without substitution. |

Field object:
- `tag`: identifier, `[a-z][a-z0-9_]*`. This is what appears between the markers in files.
- `label`: string or `{en, pt}`, shown on the generated form.
- `type`: `text` (single line) or `textarea` in v1. Nothing else: no select, date or number until a real template needs it (Open Question 8). Unknown types are a load error, not a silent fallback.
- `required`: boolean, default `false`. Required fields block generation when empty.
- `default`: string, optional. May use the one derived-value form `{{slug:other_tag}}` (see "The one derived form").

Validation lives in `core/templates.js` (below) and is shared by every surface: schema version known, `id` matches folder, tags unique and well-formed, no `..` or absolute path in `files/`, and unknown top-level keys reported as warnings rather than dropped silently, so a typo like `feilds` is caught.

## Merge-tag system (#147 / #24)

### Syntax
Recommendation: **`%tag%`**, with `%%` as the escape for a literal `%`. Final marker choice is the owner's (Open Question 1); the engine takes the marker pair as a single constant so changing it later is a one-line change plus a fixture update.

Why `%tag%` over `[tag]`: `[ ]` and `[x]` task checkboxes and `[text](url)` links are everywhere in the very `.md` files this feature targets (the generator itself writes `- [ ]` into TASKS.md), so `[tag]` would collide constantly and make escaping a daily chore. `%` rarely appears in Markdown prose, and the collision that does exist (percentages: `50% of 20% growth`) is removed by a strict grammar.

Grammar, applied in file contents **and** in path segments of `files/`:
- A tag reference is `%` + identifier + `%`, identifier = `[a-z][a-z0-9_]*`, **no whitespace**. `50% of the 20% share` therefore never matches (spaces inside the span), and `100%` alone never matches.
- `%%` renders as a single literal `%`. Needed only for the rare string that would otherwise parse as a tag, for example the literal text `%project_name%` in a template's own documentation.
- A well-formed reference to a tag the manifest does not define is **left untouched and reported as a warning** (never silently blanked, never an error), so prose like `%done%` is visible rather than lost. This is the "used but never defined" check already listed as P1 in the spec; at load it is just a warning list, so the P1 authoring validation falls out nearly free.
- A defined tag that no file uses is also reported as a warning ("defined but never used").
- Substitution is **single pass and non-recursive**: a submitted value that itself contains `%x%` is inserted as plain text, never re-expanded. This removes any chance of a value injecting another tag, and keeps the engine a flat find-and-replace.
- Values are inserted verbatim. No Markdown, YAML or shell escaping is applied (templates produce text files; they are not interpreted by this tool).

### Mapping to the generator's existing form fields
The standard generator's form has fixed fields (`name`, `desc`, `obj`, `stack`, `limits`, plus `lang`, `kit`, `folders`, `agents`; see `resolveData()` in `core/generator.js`). A template reuses those as **reserved tags**, so an author gets the same names the built-in PROJECT.md uses without redefining them:

| Reserved tag | Source | Notes |
|---|---|---|
| `%project_name%` | generator `name` | Falls back to the localized "New project" exactly as `resolveData()` does. |
| `%project_slug%` | `slugify(name)` | The same slug that names the zip and the `.cursor/rules/<slug>.mdc` file. |
| `%description%` | generator `desc` | |
| `%goal%` | generator `obj` | |
| `%stack%` | generator `stack` | |
| `%limits%` | generator `limits` | |
| `%date%` | `todayStr(lang)` | Same locale-formatted date the generator stamps today. |
| `%lang%` | `lang` | `en` / `pt`. |

Rules:
- A manifest field may **opt in** to a reserved tag simply by declaring it (to give it a template-specific label, a different default, or to make it required). A reserved tag the manifest does not declare is **not** shown on the form: it resolves to its generator fallback (for example the localized "(fill in)"), so the form contains exactly the N fields the author defined, which is what the spec's acceptance criterion asks for ("N defined fields produces a form with N inputs"). `date`, `lang` and `project_slug` are derived and never user-entered.
- A manifest may not declare a **custom** field with a reserved name unless it is the opt-in above (same name, compatible type); declaring a user-entered `date` is a load error. Reserved names are the one place a naming collision could silently change meaning, so it fails loudly.
- Custom tags (`audience`, `talk_slug` in the example) are user-defined and have no generator counterpart.

### The one derived form
`default: "{{slug:project_name}}"` is the only expression the format has. It exists because "file named after the project" (`notes/%talk_slug%.md`) is the most common structural use of a tag and the generator already owns `slugify()`. It is evaluated once, to pre-fill a form input the user can overwrite; it is not available inside template files. If the owner prefers zero expressions, drop it and let `%project_slug%` cover the case (Open Question 6).

## Reuse of the generator (no fork)
Principle: the template engine **calls** `core/generator.js`; it does not copy from it, and `generator.js` gains no template-specific logic.

New module `core/templates.js`, same conventions as the rest of `core/` (zero dependency, UMD-style so it loads under Node `require` and a `<script>` tag, no `fs`):

| Function | Purpose |
|---|---|
| `parseManifest(json)` / `validateTemplate(tpl)` | Schema checks above. Returns `{ok, errors[], warnings[]}`. |
| `fieldsOf(tpl)` | The ordered form definition the surface renders: manifest fields plus opted-in reserved tags. Single source for "what does the form look like", used by CLI prompts, Web App form and artifact form alike. |
| `renderTemplate(tpl, values, opts)` | Pure: `(template, field values, {lang, agents})` to `{files, slug, name}`, the **same return shape as `buildFileMap()`**. |

`tpl` is an in-memory object, `{ manifest, files: { 'relative/path': 'text', ... } }`. **Disk reading is not in `core/templates.js`.** Consistent with the existing split (`core/inspect.js` is the only module that touches disk; `core/generator.js` is pure), reading a template folder or zip into `tpl` lives in a Node-only `core/template-store.js` (CLI / server) and, for the artifact, in a few lines of JSZip glue. The pure engine therefore runs unchanged on every surface.

`renderTemplate` steps:
1. Resolve reserved tags from `values` using the generator's own `resolveData()` / `slugify()` / `todayStr()` (exported for this purpose; see below).
2. Substitute tags in every path and file body of `tpl.files` (single pass, grammar above).
3. If `manifest.generator.agentLayer` is true, ask the generator for the agent-layer files by **calling its existing builders** (`buildAgentBody`, `buildSkillFile`, and the per-tool path logic currently inlined in `buildFileMap`) for the tools the user ticked. A template file at the same path (for example the template's own `AGENTS.md`) **wins** over the generated one: the author's file overrides the default, never the reverse.
4. If `generator.gitignore`, add `buildGitignore()` output unless the template ships its own `.gitignore`.
5. Return `{files, slug, name}`.

`buildStarterPrompt()` is reused as is, but it currently reads the kit label from `KIT_CONFIG[input.kit]`. The template path needs a label that is not one of the built-ins. The smallest change is an **additive, optional** input, `input.kitLabel` (`{en, pt}`), consulted before `KIT_CONFIG`. It does not alter output for any existing input, so `npm run test:fixtures` and `npm run test:parity` stay green by construction. Splitting the agent-layer block of `buildFileMap` into an exported `buildAgentFiles(d, agents, lang, slug)` is the same kind of refactor (move, don't change). Both are work items below; neither may change a byte of existing fixture output, and that is their acceptance test.

`buildTreeStructure()` (used for the directory preview) already takes a list of paths, so the preview is identical for built-in and template runs. That is the core of generation-flow parity (#148): after `renderTemplate` the flow holds the same object shape as the standard generator's, so preview, download and starter-prompt code needs no template branch.

### Future: built-ins as system templates
Because `renderTemplate` returns the `buildFileMap` shape and takes comparable inputs, nothing prevents expressing a built-in kit as a template later. The one thing that would block it is built-ins needing logic a flat template cannot express (the kit-specific `extraFile.build()` callbacks in `KIT_CONFIG`). That is why the format has no logic and the callbacks stay in `generator.js` until someone decides to migrate them. Not decided here (Open Question 12).

## Permissions scope (#150 / #23)
The spec's minimum: a template author can create files, create folders, and edit file content within their template. Framed technically, a permission here is **what a template is able to cause on the user's disk when run**. In v1 the author is the owner, but a shared template (P2) is someone else's input, so the model is the smallest one that stays safe if a stranger's template is ever loaded.

**A template can:**
- Create files and folders anywhere **inside the output root**.
- Define the content of those files, including tag substitution.
- Override the default content of a generator-produced file (for example `AGENTS.md`) by shipping a file at that path.

**A template cannot, enforced in code at load and again at write:**
- Write outside the output root. Every output path is normalized and rejected if absolute, containing `..`, a drive prefix, a backslash, or a NUL. Rejected at validation, re-checked at the write boundary (defence in depth, the same posture as `core/server.js`'s root-escape refusal).
- Overwrite an existing file in the destination. A template never decides this; generation into a non-empty target follows the generator's policy (Open Question 9), consistent with the safe-edit rule in `docs/specs/git-integration-layer.md` (→ #79).
- Contain symlinks, special files or executable bits. A zip entry that is a symlink is rejected; the loader only produces regular files.
- Run anything: no scripts, hooks, commands or network fetch (see Non-Goals).
- Read the user's environment, other files or other templates: tag values come only from the form and the reserved tags above.
- Exceed size limits (proposed defaults, adjustable: 500 files, 2 MB per file, 20 MB total), so a hostile or corrupted zip cannot exhaust memory. Declared sizes are checked before inflating.

**Deletion/removal** (spec Open Question: may a template remove files that would otherwise be part of a base structure?). In this design a template has **no base to remove from**: it is its own file set, plus the optional generator extras. The question reduces to "can a template opt out of the generator extras", answered by the `manifest.generator` flags (all default on, each settable to false). That gives the author the control the spec asks about without a delete operation. If the owner wants templates that *extend a built-in kit* (start from kit X, then add or remove), that is a different, larger model (Open Question 2).

## Storage, naming and reuse (#26)
Per `templates-feature.md` the owner wants **shareable files**, not an opaque app database. So a saved template is the folder from "On-disk structure", and "saving" means writing that folder to a known place.

Lookup order (first match on `id` wins; the user sees which scope it came from):
1. **Project scope**, `<workspace>/.workspace-kit/templates/<id>/`: travels with a repository, so a team that commits it shares it through git with no extra mechanism. Also what makes "a template folder I was sent" usable: drop it here.
2. **User scope**, `~/.workspace-kit/templates/<id>/`: personal templates reused across all of one person's projects, which is what #26 describes ("name and reuse across future projects").
3. **Explicit path**, `--template ./some/folder` or `./name.wkt.zip` (CLI), or an uploaded zip (artifact): not stored, used once.

Naming (#26):
- `id` is the stable key, the folder name, and what scripts and the CLI use; it never changes after sharing. `name` is the human display name and can change freely. A collision between ids in different scopes resolves by the order above; within one scope it is an error at save time, never a silent overwrite.
- **Duplication** (P1 "start from an existing one") is "copy the folder to a new `id`", needing no special feature on top of the format.
- "Reuse" is just generation again: nothing is consumed or recorded on the template when it is used.

Why not a single user-level file or database: it would not be shareable, not diffable in git, and not inspectable by `core/inspect.js`. Why a dot-folder rather than `docs/` or `templates/` in the workspace: `inspect.js` and the health check walk the workspace, and template sources contain files named `PROJECT.md`, `AGENTS.md` and `%tag%` paths that must not be mistaken for the workspace's own instructions (they would inflate token counts and produce false broken-link and duplicate-instruction findings). The inspect/doctor walk should skip `.workspace-kit/templates/` (work item below; Open Questions 3 and 5).

## Surfaces: what ships where and in what order
Constraints that decide this, all already on record:
- The CLI exists as `bin/workspace-kit.js` with `doctor`, `status`, `serve`, `inspect`, `report`, `worktree`; its **generate** command (`docs/specs/cli-generator.md` → #20) is not built yet.
- `core/server.js` is **read-only by construction** (GET only; `docs/specs/local-web-app.md` says it must not grow write endpoints ahead of #79's blocked questions). The dashboard (`web/`) has no generation flow today; `docs/specs/web-app-dashboard.md` lists the generation form as a Non-Goal and assigns it to the artifact and the CLI.
- The artifact is single-file, no build, 100% client-side, and keeps its own inline copy of the generator guarded by `npm run test:parity`. It has no meaningful persistent storage and cannot touch the filesystem.

So, in order:

| Step | Surface | What it gets | Why this order |
|---|---|---|---|
| 1 | **`core/templates.js`** + fixtures | Format, validation, `renderTemplate`, merge tags. | Everything else is a client of this. It is pure and testable with no UI, so it can land first and be proven by the round-trip metric from the spec. |
| 2 | **CLI** | `workspace-kit template list \| validate \| new <id> \| show <id>` and `workspace-kit generate --template <id\|path> [--set tag=value ...] [--out dir]`; interactive prompts from `fieldsOf()` when `--set` is not given. | The only surface that can both store (user and project scope) and write files, and it needs no server change. Depends on the generate command (#20); if that is not ready, `template` subcommands can ship first and `--template` is added when `generate` lands (Open Question 10). |
| 3 | **Web App, read side** | Read-only `GET /api/templates` (list, scope, validation warnings) and `GET /api/templates/<id>` (manifest, tree, field list), plus a dashboard section to browse templates, see the form and preview a render. Rendering is a pure computation, so a preview can be a GET with the values in the query string, keeping the GET-only rule intact. | Fits the server as it is: a thin envelope over a core module, no domain logic in the server. |
| 4 | **Web App, write side** (authoring UI, "generate into a folder") | Needs server write endpoints. | **Blocked** on the same decision that blocks #79's commit/PR flow (when and how the read-only server gains writes). Do not start before the owner lifts it (Open Question 4). |
| 5 | **HTML artifact** | Single-template flow only: "use a template" loads one `.wkt.zip` (file picker / drag and drop; JSZip is already loaded), shows the form from `fieldsOf()`, renders, and reuses the existing preview/download/starter-prompt UI untouched. No storage, no list, no authoring. | Per the spec Non-Goal: multi-template management is not artifact territory. It needs an inline copy of the template engine (the artifact stays self-contained), so it inherits the parity-test obligation and goes last, once the engine has stopped moving. |

The "Templates" pill already in the artifact's nav (`navTemplates`) stays inert until step 5, then opens the single-template flow. This is also the answer to the spec's Timeline question about a reduced single-template HTML flow as a stepping stone: possible, but not first, because the artifact's copy cannot be written until `core/templates.js` is stable.

## Home-screen selector (#149 / #25)
Behavior contract (the spec's acceptance criterion): with zero saved templates, **no template UI is rendered at all** and the flow is identical to today's. The selector is derived, not configured:

- Input: the list of templates visible to the surface (`[]` when there are none or when the surface cannot list, as with the artifact).
- Output when `[]`: render nothing extra; `mode = 'standard'`.
- Output when `>= 1`: a "Start from" control with `Standard workspace` first and always selected by default, followed by the templates, each showing `name`, `description` and its scope (project / user). Choosing a template swaps the form for `fieldsOf(template)`; choosing Standard restores today's form. Because standard stays first and pre-selected, adding a template never changes the default path for someone who ignores it.
- Per surface: **CLI** `generate` with no `--template` is standard; if templates exist and the session is interactive, it asks once ("Standard or a saved template?") with Standard as the default answer, and `--standard` skips the question for scripts. **Web App** shows the control above the form. **Artifact** shows it only after a template zip has been loaded (it has no list to offer), so a user who never loads one sees the existing UI unchanged.
- The selector holds no template logic: it only picks which `fieldsOf()` result and which render function (`buildFileMap` or `renderTemplate`) the shared flow calls. Both return `{files, slug, name}`, so everything downstream is one code path.

## Test strategy
Follows the repo's existing pattern: zero-dependency `core/check-*.js` scripts mapped 1:1 to acceptance criteria, plus the parity check for the artifact.

1. **`npm run test:templates`** (`core/check-templates.js`), each case mapped to a P0 criterion of `templates-feature.md`:
   - *Authoring* (#146): a fixture template containing a file and a folder that exist in none of the built-in kits is loaded and rendered; both are present in the output.
   - *Merge tags* (#147): a template with N fields yields `fieldsOf().length === N`; after submit, **no** `%tag%` of a defined field remains in any path or file body, and every occurrence is replaced (including repeated and path-position tags).
   - *Grammar*: `50% of the 20% share` and `100%` unchanged; `%%` yields `%`; unknown `%nope%` left untouched with a warning; a value containing `%x%` is not re-expanded; CRLF and Unicode content round-trip.
   - *Reserved tags*: undeclared reserved tags use the generator's fallbacks; declared ones appear on the form; a colliding custom field name is a load error.
   - *Permissions* (#150): table-driven rejection of `../x`, `/etc/x`, `a/../../x`, `C:\x`, backslash and NUL paths, symlink zip entries, over-limit counts and sizes, a schema newer than supported.
   - *Reuse*: with all `generator` flags on, the agent-layer files equal what `buildFileMap` produces for the same inputs; a template file at the same path overrides it.
   - *Round trip* (the spec's leading metric): hand-built template, define, fill, render, assert every tag replaced and every file and folder present, with zero manual fixes.
2. **No outbound calls, no `eval`/`Function`, no shell**: the same style as `core/check-git.js`'s assertion that the module makes no outbound call; here also that `core/templates.js` imports no `fs` or `child_process`.
3. **Generator unchanged**: `npm run test:fixtures` must pass **unmodified** after the additive `kitLabel` / `buildAgentFiles` refactor. If a fixture has to change, the refactor altered behavior and is rejected.
4. **Parity (step 5 only)**: extend `core/parity-check.js` (jsdom, loads the real `src/workspace-kit.html`) to run the same template and values through both engines and diff the output, exactly how the standard generator is checked today.
5. **Store and CLI**: `core/template-store.js` against temp folders (scope precedence, id collision, zip vs folder equivalence); CLI end to end with `--set` and a temp `--out`.
6. **Server (step 3)**: route tests in the style of `core/check-server.js`: list, show, non-GET rejection, `?path=` escape refusal.
7. `npm test` gains the new suites; `node bin/workspace-kit.js doctor .` should still report 0 broken links.

## Work breakdown
1. Export the needed helpers and split `buildAgentFiles` out of `buildFileMap`; add optional `kitLabel`. No output change (fixtures green).
2. `core/templates.js` (+ `check-templates.js`, a fixture template under `core/fixtures/templates/`).
3. `core/template-store.js`; teach `inspect.js` to skip `.workspace-kit/templates/`.
4. CLI `template` subcommands, then `generate --template` once #20 exists.
5. Server `GET /api/templates*` and the dashboard Templates section.
6. Artifact inline copy and single-template flow, with the parity extension.
7. P1: duplicate, example templates ("presentation workspace", "mood board"; ship them as real templates so they double as fixtures), tag validation surfaced in authoring.

## Open Questions
1. **(Product — Alexandre)** Merge-tag marker: this design recommends `%tag%` with `%%` as the escape and a strict no-whitespace identifier grammar, because `[tag]` collides with Markdown checkboxes and links. Confirm, or pick another pair (`{{tag}}` would be the safest collision-wise, but looks the most like a templating language and invites the logic the spec rules out).
2. **(Product — Alexandre)** Should a template be able to **extend a built-in kit** (start from kit X's files, then add, override or remove)? This design says no: a template is self-contained and the only opt-out is the `generator` flags. Extending needs a deletion/override model and ties templates to the built-ins' evolving content. It answers the spec's open permission question about deletion one way; the other way is a bigger design.
3. **(Product — Alexandre)** Storage locations: is `~/.workspace-kit/templates/` (user) plus `<workspace>/.workspace-kit/templates/` (project) acceptable, including the dot-folder name? Should the user-level path honor `XDG_CONFIG_HOME` / `%APPDATA%` rather than a dotfolder in the home directory?
4. **(Engineering/Product)** When does the local server gain write endpoints? Web App authoring and "generate into this folder" are blocked on it, the same block as #79's commit/PR flow. Until then the Web App only lists, shows and previews templates.
5. **(Engineering)** Is it acceptable that `inspect.js` / `doctor.js` skip `.workspace-kit/templates/`, so template sources are invisible to the health check? The alternative (checking templates with the same rules) would flag every template as a workspace with broken `%tag%` paths.
6. **(Product)** Keep the single derived default form `{{slug:other_tag}}`, or ship v1 with zero expressions and let `%project_slug%` cover the common case? Keeping it adds a second, different-looking syntax to a deliberately flat format.
7. **(Product)** Languages: should a template be single-language (its files are what they are) or carry per-language file sets (`files/en/`, `files/pt/`)? This design localizes only manifest labels and lets the generator's own extras follow `lang`.
8. **(Product)** Field types beyond `text` / `textarea` (select, boolean, date)? Held out of v1 to avoid logic creep, but a "which agent tools do you use" checkbox set is the obvious first request. Today the existing agents control covers it.
9. **(Product)** What does generation do when the target folder is not empty: refuse, merge without overwriting, or ask file by file? This design only fixes "a template never overwrites on its own"; the policy should match the CLI generator (#20) and the safe-edit rule (#79).
10. **(Engineering)** Sequencing: the CLI `generate` command (#20) is unbuilt. Should `template` subcommands ship ahead of it, or wait so that `--template` lands together with `generate`?
11. **(Product)** Binary assets (images in a "mood board" template): the design allows verbatim copy of listed files, which also makes the artifact's single-template flow handle binary zip entries. Confirm this is wanted in v1, or restrict v1 to text only.
12. **(Product)** Should the built-in kits eventually become system templates (`decisions/014-shared-generation-engine.md` leaves it open)? No action now; the answer decides whether the `extraFile.build()` callbacks in `KIT_CONFIG` need a declarative form someday.

## See also
- `docs/specs/templates-feature.md` — the product spec this designs against (#32).
- `docs/specs/cli-generator.md` (#20), `docs/specs/local-web-app.md` (#29), `docs/specs/web-app-dashboard.md` (#169).
- `docs/specs/git-integration-layer.md` (#79) — safe-edit rule and the server-write block.
- `decisions/013-multi-surface-strategy.md`, `decisions/014-shared-generation-engine.md`, `decisions/020-local-web-app-stack.md`.
