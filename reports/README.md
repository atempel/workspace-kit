# reports/

Generated reports, written as **self-contained HTML** so the owner can open them in a browser instead of reading them
back as terminal text. Requested 2026-07-29.

## Convention
- **One file per report**, named `YYYY-MM-DD-short-slug.html` — same date-prefixed naming as `queue/`.
- **Self-contained**: no build step, no local assets, no JS required to read the content. Fonts come from Google Fonts
  (the same CDN-fonts exception `AGENTS.md` already allows); everything else is inline CSS. A report must still be
  readable if the fonts fail to load.
- **Project identity**: amber/teal accents over a neutral base, Inter for text, JetBrains Mono for paths and metrics
  (see `DESIGN.md` and `decisions/008-v2-visual-identity.md`). Dark and light are both first-class, via
  `prefers-color-scheme` — a report gets opened in whatever the owner's browser is set to.
- **Status is never color alone**: every verdict, badge or state carries a text label too. Same accessibility rule the
  doctor's output follows.
- **Say what was actually verified.** If a number came from running something, say so; if it came from reading code or a
  spec, say that instead. Reports are decision input — an unmarked guess is worse than no line at all.

## Not what this folder is for
This is **not** project history. `SESSIONS.md` is the mechanical per-session handoff log, `DECISIONS.md` holds the *why*
behind decisions, and `TASKS.md` is the live index of open work. A report is a **point-in-time snapshot for the owner**,
generated on request; it can go stale without anyone updating it, and nothing else in the repo should read from it.
Never move a decision's rationale in here — it belongs in `DECISIONS.md`.

## Index
- [2026-07-29 — Estado do projeto e próximos passos](2026-07-29-estado-do-projeto.html) — what exists after the
  2026-07-29 implementation batch, verified by running the test suite and all four CLI commands; the four owner
  decisions currently blocking work.
- [2026-07-30 — Comparativo das duas implementações do dashboard](2026-07-30-comparativo-dashboards.html) — how to run
  `web/` and `app/` side by side against one data server, what running them actually exposed (a white-screen crash in
  `web/`, since fixed, and a port collision between the two), and a recommendation on which to keep.
