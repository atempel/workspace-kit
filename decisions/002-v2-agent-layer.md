# v2 — agent layer (CLAUDE.md + AGENTS.md)

**Decision:** generate CLAUDE.md and AGENTS.md by default, with CLAUDE.md only importing AGENTS.md (`@AGENTS.md`) and adding a section exclusive to Claude.
**Reason:** Claude Code/Cowork does not read AGENTS.md natively (confirmed in April/May 2026 documentation), but AGENTS.md is already read natively by Codex, Cursor, Windsurf, Gemini CLI, Devin, Amazon Q, and others. Duplicating content across both files would risk them drifting out of sync.
**Alternatives considered:** generating only CLAUDE.md (loses portability); duplicating the full text in both files (discarded due to drift risk).
