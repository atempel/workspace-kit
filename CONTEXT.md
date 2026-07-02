# Contexto — workspace//kit

Contexto que a IA deve conhecer para trabalhar bem neste projeto: convenções, restrições, vocabulário, pessoas envolvidas.

## Convenções
- Artefato é um único arquivo HTML (sem build step); qualquer nova dependência externa deve vir de CDN (cdnjs/Google Fonts) e ser justificada.
- Textos da interface e dos arquivos gerados em português (PT-BR); nomes de arquivo de convenção internacional (CLAUDE.md, AGENTS.md etc.) permanecem em inglês por serem nomes fixos lidos pelas ferramentas.
- Paleta e tipografia definidas na v2 (ver DECISIONS.md) são a identidade visual atual — mudanças de marca devem ser registradas como decisão, não feitas silenciosamente.

## Restrições
- Sem backend, sem chamadas de API externas que exijam chave — o gerador precisa continuar funcionando como artefato standalone dentro do Claude.ai.
- IA (Claude/Cowork) é tratada, nos próprios templates gerados pelo produto, como ferramenta que amplia julgamento humano — nunca como entidade criativa com agência própria. Essa regra vale tanto para o produto quanto para como ele se comunica sobre si mesmo.

## Vocabulário / termos específicos
- "Camada humana" = PROJECT.md/DECISIONS.md/CONTEXT.md/TASKS.md.
- "Camada de agente" = CLAUDE.md/AGENTS.md/regras do Cursor/Copilot/Gemini CLI/Windsurf/Skills.
- "Arquivo-âncora" = documento central de um tipo de projeto (PRD, GDD, Rulebook, Spec de handoff, referência de API).
