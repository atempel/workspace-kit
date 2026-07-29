<p align="right"><sub><a href="README.md">🇺🇸 English</a> · 🇧🇷 Português (esta página)</sub></p>

<p align="center">
  <img src="assets/logo.svg" width="320" alt="workspace//kit" />
</p>

<p align="center"><i>gerador de workspaces multi-agente</i></p>

Descreva um projeto e gere, de uma vez só, a camada de contexto para humanos (`PROJECT.md`, `DECISIONS.md`, `CONTEXT.md`, `TASKS.md`) e a camada de instruções para IA (`CLAUDE.md`, `AGENTS.md`, Cursor, Copilot, Gemini CLI, Windsurf, Skills) — tudo empacotado em um `.zip`, com um prompt inicial pronto para colar.

## Por quê

Começar um projeto novo com IA significa montar esse contexto na mão, toda vez, e é fácil deixar arquivos desatualizados ou incompletos entre diferentes ferramentas. O workspace//kit elimina esse trabalho manual. Ter uma estrutura de arquivos organizada traz grandes benefícios de contexto e continuidade entre sessões e ferramentas.

## Como usar

1. Abra `src/workspace-kit.html` no navegador (ou use como artifact do Claude).
2. Preencha o nome, tipo, descrição e stack do projeto.
3. Escolha para quais IAs gerar arquivo de instrução.
4. Baixe o `.zip`, extraia na pasta do projeto e cole o prompt inicial gerado como primeira mensagem para o agente.

Sem build, sem backend — é um único arquivo HTML/CSS/JS, 100% client-side.

## O que é gerado

**Camada humana** — `PROJECT.md`, `DECISIONS.md`, `CONTEXT.md`, `TASKS.md`, `README.md`, além de um arquivo âncora quando o kit pede um (PRD, GDD, Rulebook, spec de handoff, referência de API).

**Camada de agentes** — `CLAUDE.md` (importando `AGENTS.md`), `AGENTS.md` (padrão universal, lido nativamente por Codex, Cursor, Windsurf, Gemini CLI, Devin, Amazon Q e outros), além de arquivos dedicados para Cursor, Copilot, Gemini CLI, Windsurf, e um esqueleto de Skill portátil.

17 kits nativos ("system kits"), cada um com suas próprias pastas e arquivo âncora: produto digital, pesquisa & análise, escrita & conteúdo, design, dados/ML, automação, jogo digital, jogo de tabuleiro, site, biblioteca/SDK, app mobile, extensão de navegador, hardware/IoT, curso, campanha de marketing, podcast/vídeo, e genérico.

**`.gitignore`** é gerado automaticamente para cada workspace, combinando padrões universais (lixo de SO/editor, `.env*`, logs) com pastas "só locais" por kit (ex: dados brutos, modelos, builds) que ficam apenas na sua máquina, sem serem commitadas.

**Idioma** — tanto o gerador quanto o conteúdo que ele gera oferecem, até o momento, suporte a inglês e português, cobrindo textos de interface, conteúdo dos arquivos gerados e nomes de pastas geradas (padrão em inglês).

## Interface

A v3 refez a interface do gerador com base em uma referência do Figma: um layout escuro com cards translúcidos, navegação em pílula centralizada, uma barra lateral de pré-visualização do workspace fixa na tela, uma logo com wordmark em contorno, e ícones de bandeiras de verdade no seletor de idioma. Ela mantém 100% da funcionalidade original do gerador — nada mudou em como os projetos são gerados, só a aparência e a experiência de uso da ferramenta. A interface anterior fica preservada em `src/workspace-kit-v2-archive.html` para referência.

## Stack

HTML + CSS + JS puro, em arquivo único. [JSZip](https://stuk.github.io/jszip/) via cdnjs para gerar o `.zip` no navegador. Fontes via Google Fonts (JetBrains Mono + Inter).

## Estrutura do repositório

```
workspace-kit/
├── src/workspace-kit.html            # o artifact (funcional, standalone)
├── src/workspace-kit-v2-archive.html # interface anterior, mantida para referência
├── docs/PRD.md                       # problema, escopo, métricas
├── research/                         # pesquisa sobre CLAUDE.md/AGENTS.md/Cursor/etc.
├── PROJECT.md · DECISIONS.md · CONTEXT.md · TASKS.md
└── CLAUDE.md · AGENTS.md             # instruções de IA para este próprio repositório
```

## Roadmap

As próximas funcionalidades em discussão estão em [`TASKS.md`](TASKS.md).

## Gerado com o workspace//kit

A própria camada de contexto deste repositório (`PROJECT.md`, `DECISIONS.md`, `CONTEXT.md`, `TASKS.md`) e a camada de agentes (`CLAUDE.md`, `AGENTS.md`) foram criadas usando o workspace//kit.

## Licença

[MIT](LICENSE)

---

<p align="center"><sub>Feito com ❤️ no Brasil 🇧🇷</sub></p>
