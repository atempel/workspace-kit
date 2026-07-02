# PRD — workspace//kit

## Problema
Começar um novo projeto com IA exige montar, na mão e toda vez, tanto os arquivos de contexto de processo (visão, decisões, tarefas) quanto os arquivos de instrução específicos de cada ferramenta de IA (CLAUDE.md, AGENTS.md, .cursorrules, etc.) — e é fácil deixar isso desatualizado ou incompleto entre ferramentas.

## Solução proposta
Um gerador de workspace: a partir de nome, tipo, descrição, stack e limites de um projeto, produz as duas camadas de arquivo já formatadas corretamente por ferramenta, mais um prompt inicial, empacotados em um .zip pronto pra soltar em qualquer agente com acesso a workspace.

## Escopo
- Geração client-side (HTML/JS + JSZip), sem backend.
- Suporte a múltiplos tipos de projeto com pastas e arquivo-âncora próprios.
- Suporte a múltiplos "alvos" de agente (Claude/Cowork, AGENTS.md universal, Cursor, Copilot, Gemini CLI, Windsurf, Skills).

## Fora de escopo (por ora)
- Persistência entre sessões (o usuário preenche o formulário e baixa; nada fica salvo).
- Edição de templates pelo próprio usuário via UI (hoje os templates são fixos no código).
- Integração direta com Notion/GitHub para já criar o workspace remotamente.

## Métricas de sucesso
- (a definir no Cowork)
