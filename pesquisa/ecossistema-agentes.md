# Pesquisa — ecossistema de arquivos de contexto para agentes (jul/2026)

Levantamento que fundamentou a v2 do gerador. Resumo, não cópia de fontes.

## AGENTS.md
- Formato aberto e vendor-neutral. Surgiu de colaboração entre OpenAI, Google, Cursor e Factory em 2025; doado à Agentic AI Foundation (Linux Foundation) em dezembro de 2025.
- Lido nativamente por: OpenAI Codex CLI, Cursor, Aider, Devin, GitHub Copilot (parcial), Gemini CLI (via configuração), Windsurf, Amazon Q, Google Jules, Amp, Warp, Zed, Goose, Continue, Kilo, entre outros.
- Mais de 60 mil repositórios open-source já usam o formato (dados de dez/2025).
- Descoberta: ferramentas como Codex percorrem a árvore de diretórios de cima pra baixo, priorizando o AGENTS.md mais próximo do arquivo em edição.

## CLAUDE.md (Claude Code / Cowork)
- Formato próprio da Anthropic, anterior ao AGENTS.md.
- Até pelo menos meados de 2026, Claude Code **não lê AGENTS.md nativamente** — há um pedido popular em aberto no rastreador de issues do projeto.
- Workaround recomendado: `@AGENTS.md` no topo do CLAUDE.md (import), ou symlink em repositórios de agente único.
- Suporta hierarquia (CLAUDE.md do projeto + `~/.claude/CLAUDE.md` pessoal) e `CLAUDE.local.md` para overrides não versionados.

## Outras convenções específicas de ferramenta
- **Cursor:** `.cursor/rules/*.mdc` (formato atual, com frontmatter `description`/`globs`/`alwaysApply`); `.cursorrules` é o formato legado.
- **GitHub Copilot:** `.github/copilot-instructions.md` para regras gerais; `.github/instructions/*.instructions.md` com frontmatter `applyTo` para regras por tipo de arquivo.
- **Gemini CLI:** `GEMINI.md` por padrão; nome do arquivo configurável via `settings.json` (`context.fileName`).
- **Windsurf:** `.windsurf/rules/`, com limite de ~6.000 caracteres por arquivo e ~12.000 no total.

## Agent Skills (SKILL.md)
- Padrão separado de AGENTS.md: enquanto AGENTS.md descreve *o projeto*, uma Skill descreve *uma capacidade reutilizável* (procedimento, checklist, rotina) que viaja entre projetos.
- Formato: pasta com `SKILL.md` (frontmatter `name` + `description` obrigatórios) e assets opcionais.
- Originado na Anthropic, adotado como padrão aberto por Claude Code, Codex, Cursor, VS Code e outros.

## Implicação de design pro gerador
- Gerar AGENTS.md como fonte da verdade + CLAUDE.md que importa (`@AGENTS.md`) é a combinação que cobre o maior número de ferramentas sem duplicar conteúdo.
- Vale reavaliar esta pesquisa periodicamente — é uma área que muda rápido (o próprio Claude Code pode passar a ler AGENTS.md nativamente no futuro).
