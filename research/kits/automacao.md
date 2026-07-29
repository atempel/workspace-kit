# Kit — Automation / internal script (`automacao`)

## Summary
For small, self-contained scripts and internal tools that automate a task: scheduled jobs, one-off scripts, glue code between systems — deliberately scoped smaller than `produto`.

## When to choose this type
The project is a script or small set of scripts run on a schedule or on demand, not a user-facing product, and the main risk is leaking credentials.

## Standard folders
- `scripts` — the actual automation code.
- `config` / `configuração` — configuration files.
- `logs` — run logs, checked unchecked by default (logs are usually generated, not authored).

Defaults: scripts and config checked, logs unchecked.

## Anchor file
None — intentionally. This type is meant to stay lightweight; forcing an anchor file on a five-line cron script would work against the type's purpose.

## Stack / limits placeholders (current)
- Stack example: "Node.js + node-cron · runs via PowerShell 7"
- Limits example: "never commit credentials or tokens in /config"

## Notes for the generator
- The credentials warning here is the single highest-value default limit in the whole tool — this is the type most likely to have a `config` folder that could accidentally hold secrets.
- Strongly overlaps with the open TASKS.md discussion about generating a `.gitignore`: this type in particular should probably default to gitignoring `config/*.local.*` or similar, once that feature exists.
