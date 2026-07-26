# v2 — two file layers (human vs. agent)

**Decision:** separate "human" files (PROJECT/DECISIONS/CONTEXT/TASKS, more descriptive) from "agent" files (CLAUDE.md/AGENTS.md/etc., leaner: stack, commands, limits).
**Reason:** long architecture/prose sections dilute how well the agent follows instructions; concrete commands and limits work better in instruction files.
**Alternatives considered:** a single set of files serving both audiences — discarded for producing files too long for agents.
