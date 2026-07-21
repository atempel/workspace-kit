# Spec — Docker environment generation

Status: draft, pending review. Requested 2026-07-21, based on this repo's own `Dockerfile`/`docker-compose.yml` (created the same day).

## Problem Statement
Getting a project into a working dev container today means hand-writing a Dockerfile and docker-compose.yml, deciding on a base image, and wiring up whatever tooling the project type needs — the same kind of one-time setup friction workspace-kit already solves for context files. This repository's own `Dockerfile`/`docker-compose.yml` (Node 20 + Claude Code CLI + Python, no DB/JVM) is a concrete, working example of exactly the kind of output this feature should be able to generate automatically, adapted to whatever project type the workspace is for.

## Goals
- Generate a working Dockerfile + docker-compose.yml as part of a workspace, using this repo's own container setup as the base template.
- Adapt the generated Docker template to the chosen project type (same 17 types already driving folders/anchor files), so a data/ML workspace and a mobile workspace don't get the same generic container.
- Make "spin up a dev environment for this project" a small number of steps once the CLI or Web App exists, instead of a from-scratch Docker setup.

## Non-Goals
- **Cloud/production deployment configs** (Kubernetes manifests, cloud-provider-specific files) — this is a *local dev environment* feature, not a deployment tool.
- **Running/orchestrating the container from the standalone HTML artifact** — structurally impossible (no process execution from a browser artifact); see Requirements for what the HTML artifact *can* do.
- **A full matrix of every possible tool/language per project type at launch** — v1 covers a reasonable default per type (see Requirements); exhaustive tool coverage per type is a P1/P2 expansion, not a blocking v1 requirement.
- **Editing the generated Dockerfile/docker-compose through a GUI** — v1 generates static files the user can hand-edit afterward, same as every other generated file today; a config editor UI is out of scope.

## User Stories
- As a developer generating a new workspace, I want the option to also generate a Dockerfile/docker-compose.yml so that I don't hand-write a dev container setup from scratch.
- As a developer working on a data/ML project, I want the generated container to include the tooling that project type actually needs (e.g. Python) rather than a generic empty container.
- As a CLI/Web App user, I want to go from "generated workspace" to "running container" in a small number of commands/clicks, so the Docker setup isn't just files I still have to wire up myself.
- As Alexandre, I want the generated template to stay in sync with whatever this repo's own `Dockerfile`/`docker-compose.yml` evolves into, so the example and the generator don't quietly drift apart over time.

## Requirements

**Must-Have (P0)**
- Base Docker template reused from this repo's own `Dockerfile`/`docker-compose.yml`: Node 20 + Claude Code CLI, `git`/`curl`/`unzip`/`build-essential`, Python3/pip/venv available, single `dev` service, bind-mounted project folder, `.claude_global` volume for Claude Code config, `.gitignore` entry for it.
  - Acceptance: a workspace generated with no project-type-specific additions produces a Dockerfile/docker-compose.yml equivalent to this repo's own (same base packages, same volume/service structure).
- Project-type → Docker adaptation mapping: at least a first pass covering the 17 existing project types, adding/removing base packages or services per type where it clearly matters (e.g. data/ML keeps the Python stack front-and-center; a type with no clear extra runtime need just gets the base template unchanged).
  - Acceptance: at least 3 project types produce a visibly different Dockerfile/docker-compose.yml from the base (not just a cosmetic comment change), reflecting real tooling differences.
- Content generation available from all three surfaces (HTML included) — this is "just more generated text," same pattern as `.gitignore`/CLAUDE.md/AGENTS.md.
  - Acceptance: the standalone HTML artifact can produce the Dockerfile/docker-compose.yml files in its output zip, with no dependency on git or a local process.
- "Spin it up" step (build + up) available from the CLI and/or Web App once either exists — out of reach for the HTML artifact by construction.
  - Acceptance: from the CLI or Web App, going from a freshly generated workspace to a running container takes no manual editing of the generated files (defaults must actually work, not just look plausible).

**Nice-to-Have (P1)**
- User-configurable extras in the generation form: optional services (DB/Redis/etc.), base image or runtime version override.
- A `docker compose config` (or equivalent) validation step run automatically after generation, to catch broken output before the user hits it.

**Future Considerations (P2)**
- Broader per-type tooling matrix (e.g. JVM for types that need it, GPU-aware base images for heavier ML work) — deliberately deferred past the P0 "at least 3 types differ" bar.
- Keeping the generated template automatically in sync with future changes to this repo's own `Dockerfile`/`docker-compose.yml` (vs. the two quietly diverging over time) — worth a policy decision once both exist for a while, not before.

## Success Metrics
**Leading:** whether `docker compose build && docker compose up` succeeds without manual edits immediately after generation, across the project types covered in P0 (target: 100% of covered types build cleanly, verified the same way the CLI/Web App specs verify generation parity — an explicit pass, not spot-checks).
**Lagging:** whether Alexandre actually uses the generated Docker setup for his own new projects instead of hand-rolling one each time (self-usage signal, same caveat as the other specs).

## Open Questions
- **(Product — Alexandre)** Exact per-type mapping: which project types need which extra packages/services? The P0 bar (≥3 types visibly differ) is deliberately low to unblock a first pass — the full mapping is better defined once this is being built, informed by `research/project-types/`.
- **(Engineering)** Where does the type → Docker mapping live technically — hardcoded alongside the existing type → folders/anchor-file mapping, or a separate config? Reasonable default is alongside the existing mapping, for consistency, unless a reason emerges not to.
- **(Engineering, shared with CLI/Web App specs)** The "spin it up" P0 requirement depends on the CLI and/or Web App existing — sequencing follows theirs.

## Timeline Considerations
The content-generation half (P0's first three items) can ship as soon as the generation logic is touched at all (any surface), independent of CLI/Web-App timing. The "spin it up" half is gated on the CLI/Web App reaching at least a basic working state.
