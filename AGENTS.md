# workspace//kit

Gerador de workspaces para agentes de IA: a partir de uma descrição de projeto, produz a camada de contexto humana e a camada de instrução por ferramenta de IA, empacotadas em .zip.

## Stack & comandos
HTML + CSS + JS puro, um único arquivo (`src/workspace-kit.html`). Sem build step. Dependência externa: JSZip 3.10.1 via cdnjs. Fontes via Google Fonts (JetBrains Mono + Inter). Pra testar: abrir o .html direto no navegador, ou usá-lo como Claude artifact.

## Limites — o que não fazer sem perguntar
- Não introduzir backend, API keys ou chamadas de rede além de CDN/fontes — o gerador precisa continuar 100% client-side.
- Não adicionar framework de build (React/Vite/etc.) sem decisão explícita — hoje é HTML puro de propósito.
- Não mudar a paleta/tipografia definidas na v2 sem registrar o motivo em DECISIONS.md.
- Não apresentar a IA, nos textos gerados pelo próprio produto, como algo além de ferramenta — isso é regra de produto, não só de estilo.

## Ver também
- PROJECT.md — visão geral para humanos
- DECISIONS.md — histórico de decisões (atualizar a cada decisão relevante)
- TASKS.md — tarefas ativas
- pesquisa/ecossistema-agentes.md — levantamento que fundamenta as escolhas de formato de arquivo
