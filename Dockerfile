# Base: Node 20 LTS (Debian Bookworm) — includes npm/npx
FROM node:20-bookworm

# ── System packages ──────────────────────────────────────────────────────
# git/curl/build-essential: general base
# python3/pip/venv: kept available for tooling (e.g. a future CLI init
# script — see TASKS.md) even though the current artifact is 100% static
# HTML/CSS/JS with no backend (see CONTEXT.md "Constraints").
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    unzip \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ── Global Node tools ────────────────────────────────────────────────────
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /workspace

CMD ["/bin/bash"]
