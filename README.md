<p align="right"><sub>🇺🇸 English (this page) · <a href="README.pt-BR.md">🇧🇷 Português</a></sub></p>

<p align="center">
  <img src="assets/logo.svg" width="320" alt="workspace//kit" />
</p>

<p align="center"><i>multi-agent workspace generator</i></p>

Describe a project and generate, in one shot, the human context layer (`PROJECT.md`, `DECISIONS.md`, `CONTEXT.md`, `TASKS.md`) and the AI instruction layer (`CLAUDE.md`, `AGENTS.md`, Cursor, Copilot, Gemini CLI, Windsurf, Skills) — all packaged into a `.zip`, with a ready-to-paste starter prompt.

## Why

Starting a new project with AI means assembling this context by hand, every time, and it's easy to leave files outdated or incomplete across different tools. workspace//kit removes that manual work. Having an organized workspace file structure has great benefits for context and continuity across sessions and tools.

## How to use

1. Open `src/workspace-kit.html` in your browser (or use it as a Claude artifact).
2. Fill in the project's name, type, description, and stack.
3. Choose which AI agents to generate an instruction file for.
4. Download the `.zip`, extract it into the project folder, and paste the generated starter prompt as your first message to the agent.

No build step, no backend — it's a single HTML/CSS/JS file, 100% client-side.

## What gets generated

**Human layer** — `PROJECT.md`, `DECISIONS.md`, `CONTEXT.md`, `TASKS.md`, `README.md`, plus an anchor file when the project type calls for one (PRD, GDD, Rulebook, handoff spec, API reference).

**Agent layer** — `CLAUDE.md` (importing `AGENTS.md`), `AGENTS.md` (universal standard, read natively by Codex, Cursor, Windsurf, Gemini CLI, Devin, Amazon Q and others), plus dedicated files for Cursor, Copilot, Gemini CLI, Windsurf, and a portable Skill skeleton.

17 project types with their own folders and anchor file: digital product, research & analysis, writing & content, design, data/ML, automation, digital game, board game, website, library/SDK, mobile app, browser extension, hardware/IoT, course, marketing campaign, podcast/video, and generic.

**`.gitignore`** is generated automatically for every workspace, combining universal patterns (OS/editor cruft, `.env*`, logs) with per-type "local only" folders (e.g. raw data, models, build outputs) that stay on your machine instead of getting committed.

**Language** — both the generator itself and its generated output support English and Portuguese so far, covering UI text, generated file content, and generated folder names (defaults to English).

## Interface

v3 reworked the generator's UI around a Figma reference: a dark glass-card layout with a centered pill navigation bar, a sticky live workspace-preview sidebar, an outlined-wordmark logo, and real flag icons for the language switcher. It keeps 100% of the generator's original functionality — nothing about how projects are generated changed, only how the tool looks and feels to use. The previous interface is preserved at `src/workspace-kit-v2-archive.html` for reference.

## Stack

Plain HTML + CSS + JS, single-file. [JSZip](https://stuk.github.io/jszip/) via cdnjs to generate the `.zip` in the browser. Fonts via Google Fonts (JetBrains Mono + Inter).

## Repository structure

```
workspace-kit/
├── src/workspace-kit.html            # the artifact (functional, standalone)
├── src/workspace-kit-v2-archive.html # previous interface, kept for reference
├── docs/PRD.md                       # problem, scope, metrics
├── research/                         # research on CLAUDE.md/AGENTS.md/Cursor/etc.
├── PROJECT.md · DECISIONS.md · CONTEXT.md · TASKS.md
└── CLAUDE.md · AGENTS.md             # AI agent instructions for this repo itself
```

## Roadmap

Upcoming features under discussion live in [`TASKS.md`](TASKS.md).

## Generated with workspace//kit

This repository's own context layer (`PROJECT.md`, `DECISIONS.md`, `CONTEXT.md`, `TASKS.md`) and agent layer (`CLAUDE.md`, `AGENTS.md`) were scaffolded using workspace//kit itself.

## License

[MIT](LICENSE)

---

<p align="center"><sub>Made with ❤️ in Brazil 🇧🇷</sub></p>
