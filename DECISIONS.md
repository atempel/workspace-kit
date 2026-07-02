# Decisões — workspace//kit

Registro cronológico de decisões tomadas neste projeto. Cada entrada contém o quê, por quê, e alternativas descartadas.

## v1 — estrutura base
- **Decisão:** arquivos base sempre gerados: PROJECT.md, DECISIONS.md, CONTEXT.md, TASKS.md, README.md.
- **Motivo:** replica a hierarquia de contexto que já uso em outros projetos ("contexto é o produto").
- **Alternativas consideradas:** um único arquivo de contexto — descartado por misturar histórico de decisões com tarefas ativas.

## v2 — camada de agentes (CLAUDE.md + AGENTS.md)
- **Decisão:** gerar CLAUDE.md e AGENTS.md por padrão, sendo que CLAUDE.md apenas importa AGENTS.md (`@AGENTS.md`) e adiciona uma seção exclusiva pro Claude.
- **Motivo:** Claude Code/Cowork não lê AGENTS.md nativamente (confirmado em documentação de abril/maio 2026), mas AGENTS.md já é lido nativamente por Codex, Cursor, Windsurf, Gemini CLI, Devin, Amazon Q e outros. Duplicar o conteúdo nos dois arquivos criaria risco de desalinhamento.
- **Alternativas consideradas:** gerar só CLAUDE.md (perde portabilidade); duplicar texto integralmente nos dois arquivos (descartado pelo risco de desalinhamento).

## v2 — duas camadas de arquivo (humana vs. agente)
- **Decisão:** separar arquivos "humanos" (PROJECT/DECISIONS/CONTEXT/TASKS, mais descritivos) dos arquivos "de agente" (CLAUDE.md/AGENTS.md/etc., mais enxutos: stack, comandos, limites).
- **Motivo:** seções longas de arquitetura/prosa diluem a aderência do agente às instruções; comandos e limites concretos funcionam melhor em arquivos de instrução.
- **Alternativas consideradas:** um único conjunto de arquivos servindo os dois públicos — descartado por gerar arquivos longos demais para os agentes.

## v2 — 11 tipos de projeto com arquivo-âncora
- **Decisão:** cada tipo de projeto (produto, pesquisa, escrita, design, dados/ML, automação, jogo digital, jogo de tabuleiro, site, biblioteca, genérico) tem pastas padrão e, quando faz sentido, um arquivo-âncora (PRD, GDD, Rulebook, Spec de handoff, referência de API).
- **Motivo:** refletir os tipos de projeto reais trabalhados, sem forçar todo projeto a usar a mesma estrutura de produto de software.

## v2 — geração 100% client-side
- **Decisão:** toda a geração de arquivos e .zip acontece no navegador via JSZip, sem backend.
- **Motivo:** o artefato precisa funcionar dentro do Claude.ai sem infraestrutura própria.

## Ajuste final — workspace//kit
- **Decisão:** o repositório foi cadastrado no GitHub como `workspace-kit` (palavra cheia), não `wrkspc-kit` (abreviado). Todos os arquivos e o wordmark do artefato foram sincronizados para `workspace//kit`.
- **Motivo:** manter o nome exibido em todo lugar (docs, artefato, repositório) idêntico ao slug real do repositório, evitando divergência entre o que está escrito e o que existe de fato no GitHub.
- **Pendência resolvida:** a checagem de disponibilidade do slug, deixada em aberto na decisão anterior, foi concluída — `workspace-kit` está cadastrado.

## Renomeação — workspace//kit
- **Decisão:** o projeto passa a se chamar `workspace//kit` (slug de repositório: `workspace-kit`), substituindo o nome de trabalho anterior `ctx//forge` (e a ideia intermediária "Context Forge").
- **Motivo:** "context-forge" já existe como projeto real no GitHub com proposta quase idêntica (`webdevtodayjason/context-forge`, CLI de scaffolding de contexto pra Claude Code). Ao pesquisar alternativas dentro do mesmo radical, ficou claro que tanto `ctx` quanto `forge` são radicais extremamente usados no nicho de ferramentas de contexto para IA em 2026 (ctxloom, lean-ctx, ctx-init, RigForge, WorkForge, entre outros) — manter qualquer combinação dos dois tende a colidir de novo. `workspace//kit` sai desses dois radicais saturados, não apresentou colisão relevante na checagem, e mantém a mesma linguagem visual (abreviação + `//` + palavra).
- **Alternativas consideradas:** `Context Forge` / `context-forge` (descartado por colisão direta); `ctx//forge` (descartado por radicais saturados); `ctx//prime` (descartado — nome coincide com uma corretora forex investigada por fraude, más associações de busca); `workspace//boilerplate` (avaliado, sem colisão relevante, mas "boilerplate" foi considerado um termo com conotação um pouco datada pro posicionamento pretendido); `brief//kit` e `wrk//spawn` (alternativas viáveis, não escolhidas).
- **Pendência:** slug de repositório `workspace-kit` ainda precisa ser conferido e cadastrado no GitHub (o dono/usuário deve verificar disponibilidade exata no momento de criar o repo).

## v2 — identidade visual
- **Decisão:** paleta "terminal" (fundo quase-preto, âmbar + teal), tipografia JetBrains Mono/Inter, logo de cartões de contexto empilhados com cursor piscando.
- **Motivo:** evitar os três "defaults" visuais de conteúdo gerado por IA (cream+terracota, preto+verde ácido, broadsheet) e ancorar na estética do próprio ambiente de terminal do usuário.
