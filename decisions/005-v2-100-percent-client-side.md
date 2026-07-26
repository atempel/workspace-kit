# v2 — 100% client-side generation

**Decision:** all file and .zip generation happens in the browser via JSZip, no backend.
**Reason:** the artifact needs to work inside Claude.ai without its own infrastructure.

Note: partially superseded by the 2026-07-21 multi-surface decision — see DECISIONS.md.
