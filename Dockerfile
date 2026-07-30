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
    wget \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ── GitHub CLI ─────────────────────────────────────────────────────────────
# `git push` routes credentials through `gh auth git-credential` (see the
# committed dev gitconfig), so gh has to be in the image, not hand-installed
# into a container — a container recreate would silently take pushing with it.
# Its official apt repo, per https://github.com/cli/cli/blob/trunk/docs/install_linux.md.
RUN mkdir -p /etc/apt/keyrings \
    && wget -nv -O- https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# ── Global Node tools ────────────────────────────────────────────────────
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /workspace

CMD ["/bin/bash"]
