<p align="center">
  <img src="assets/logo.svg" width="96" height="96" alt="workspace//kit" />
</p>

<h1 align="center">workspace//kit</h1>
<p align="center"><i>gerador de workspaces multi-agente</i></p>

Descreva um projeto e gere, de uma vez, a camada de contexto para humanos (`PROJECT.md`, `DECISIONS.md`, `CONTEXT.md`, `TASKS.md`) e a camada de instruções para IA (`CLAUDE.md`, `AGENTS.md`, Cursor, Copilot, Gemini CLI, Windsurf, Skills) — tudo empacotado em um `.zip`, com um prompt inicial pronto para colar.

## Por quê

Começar um projeto novo com IA exige montar esse contexto na mão, toda vez, e é fácil deixar arquivos desatualizados ou incompletos entre ferramentas diferentes. O workspace//kit elimina esse trabalho manual.

## Como usar

1. Abra `src/workspace-kit.html` no navegador (ou use como Claude artifact).
2. Preencha nome, tipo, descrição e stack do projeto.
3. Escolha para quais agentes de IA gerar arquivo de instrução.
4. Baixe o `.zip`, extraia na pasta do projeto e cole o prompt inicial gerado na primeira mensagem do agente.

Não há build step nem backend — é um único arquivo HTML/CSS/JS, 100% client-side.

## O que é gerado

**Camada humana** — `PROJECT.md`, `DECISIONS.md`, `CONTEXT.md`, `TASKS.md`, `README.md`, mais um arquivo-âncora quando o tipo de projeto pede (PRD, GDD, Rulebook, Spec de handoff, referência de API).

**Camada de agente** — `CLAUDE.md` (importando `AGENTS.md`), `AGENTS.md` (padrão universal, lido por Codex, Cursor, Windsurf, Gemini CLI, Devin, Amazon Q e outros), além de arquivos dedicados para Cursor, Copilot, Gemini CLI, Windsurf e um esqueleto de Skill portátil.

11 tipos de projeto com pastas e arquivo-âncora próprios: produto digital, pesquisa & análise, escrita & conteúdo, design, dados/ML, automação, jogo digital, jogo de tabuleiro, site, biblioteca/SDK e genérico.

## Stack

HTML + CSS + JS puro, single-file. [JSZip](https://stuk.github.io/jszip/) via cdnjs para gerar o `.zip` no navegador. Fontes via Google Fonts (JetBrains Mono + Inter).

## Estrutura do repositório

```
workspace-kit/
├── src/workspace-kit.html      # o artefato (funcional, standalone)
├── docs/PRD.md                 # problema, escopo, métricas
├── pesquisa/                   # levantamento sobre CLAUDE.md/AGENTS.md/Cursor/etc.
├── PROJECT.md · DECISIONS.md · CONTEXT.md · TASKS.md
└── CLAUDE.md · AGENTS.md       # instruções para agentes de IA neste próprio repo
```

## Roadmap

Próximas features em discussão estão em [`TASKS.md`](TASKS.md).

## Licença

[MIT](LICENSE)
