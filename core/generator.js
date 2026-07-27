/**
 * workspace//kit — shared generation engine.
 *
 * Seeded 2026-07-22 from src/workspace-kit.html's inline <script> (the pure
 * data + generation functions, with DOM reads replaced by explicit params).
 * The standalone HTML artifact keeps its own separate inline copy of this
 * same logic — it is NOT wired to this module, so it keeps working as a
 * self-contained artifact pasted into Claude.ai. See DECISIONS.md, entry
 * "2026-07-22 — Shared generation module seeded standalone, HTML artifact
 * deferred", for why. When porting a change from one copy to the other,
 * check core/fixtures.json + core/check-fixtures.js still pass.
 *
 * Works both via Node (`require`/`module.exports`) and via a plain
 * <script> tag (exposes `window.WorkspaceKitCore`), with no build step.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WorkspaceKitCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STRINGS = {
    en: {
      newProject: 'New project',
      fillIn: '(fill in)',
      agentListFallback: 'the context files in the root folder',
    },
    pt: {
      newProject: 'Novo projeto',
      fillIn: '(preencher)',
      agentListFallback: 'os arquivos de contexto na raiz',
    },
  };

  var TYPE_CONFIG = {
    produto: {
      label:{en:'Digital product / App', pt:'Produto digital / App'},
      checks:[
        {label:{en:'Research / discovery', pt:'Pesquisa / discovery'}, folder:{en:'research', pt:'pesquisa'}},
        {label:{en:'Design / assets', pt:'Design / assets'}, folder:{en:'design', pt:'design'}},
        {label:{en:'Code (/src)', pt:'Código (/src)'}, folder:{en:'src', pt:'src'}}
      ],
      defaults:[true,true,true],
      stackPh:{en:'e.g. Tauri v2 + React + SQLite · pnpm · tests with vitest', pt:'Ex: Tauri v2 + React + SQLite · pnpm · testes com vitest'},
      limitsPh:{en:"e.g. don't commit directly to main · don't use paid libraries without asking", pt:'Ex: não commitar direto na main · não usar libs pagas sem avisar'},
      extraFile:{path:{en:'docs/PRD.md', pt:'docs/PRD.md'}, build:(n,lang)=> lang==='en'
        ? `# PRD — ${n}\n\n## Problem\n\n## Proposed solution\n\n## Scope\n\n## Out of scope\n\n## Success metrics\n`
        : `# PRD — ${n}\n\n## Problema\n\n## Solução proposta\n\n## Escopo\n\n## Fora de escopo\n\n## Métricas de sucesso\n`}
    },
    pesquisa: {
      label:{en:'Research & analysis', pt:'Pesquisa & análise'},
      checks:[
        {label:{en:'Raw data', pt:'Dados brutos'}, folder:{en:'data', pt:'dados'}, localOnly:true},
        {label:{en:'Source notes', pt:'Notas de fontes'}, folder:{en:'notes', pt:'notas'}},
        {label:{en:'Results / outputs', pt:'Resultados / outputs'}, folder:{en:'outputs', pt:'outputs'}, localOnly:true}
      ],
      defaults:[true,true,true],
      stackPh:{en:'e.g. Python + pandas + Jupyter · dataset in /data', pt:'Ex: Python + pandas + Jupyter · dataset em /dados'},
      limitsPh:{en:'e.g. never modify raw data, only copy before processing', pt:'Ex: nunca alterar os dados brutos, só copiar antes de processar'},
    },
    escrita: {
      label:{en:'Writing & content', pt:'Escrita & conteúdo'},
      checks:[
        {label:{en:'Drafts', pt:'Rascunhos'}, folder:{en:'drafts', pt:'rascunhos'}},
        {label:{en:'References', pt:'Referências'}, folder:{en:'references', pt:'referencias'}},
        {label:{en:'Published', pt:'Publicado'}, folder:{en:'published', pt:'publicado'}}
      ],
      defaults:[true,true,false],
      stackPh:{en:'e.g. Markdown · published on Medium (PT/EN)', pt:'Ex: Markdown · publicação no Medium (PT/EN)'},
      limitsPh:{en:"e.g. keep a first-person tone · never present the AI as the text's author", pt:'Ex: manter tom em primeira pessoa · nunca apresentar a IA como autora do texto'},
    },
    design: {
      label:{en:'Design (UI/product)', pt:'Design (UI/produto)'},
      checks:[
        {label:{en:'References', pt:'Referências'}, folder:{en:'references', pt:'referencias'}},
        {label:{en:'Assets', pt:'Assets'}, folder:{en:'assets', pt:'assets'}},
        {label:{en:'Wireframes', pt:'Wireframes'}, folder:{en:'wireframes', pt:'wireframes'}}
      ],
      defaults:[true,true,true],
      stackPh:{en:'e.g. Figma as source of truth · tokens exported to /assets', pt:'Ex: Figma como fonte da verdade · tokens exportados em /assets'},
      limitsPh:{en:"e.g. don't generate final assets with AI without clearly marking them as drafts", pt:'Ex: não gerar peças finais com IA sem marcar claramente como rascunho'},
      extraFile:{path:{en:'handoff/SPEC.md', pt:'handoff/SPEC.md'}, build:(n,lang)=> lang==='en'
        ? `# Handoff spec — ${n}\n\n## Tokens\n\n## Components\n\n## States\n\n## Breakpoints\n`
        : `# Spec de handoff — ${n}\n\n## Tokens\n\n## Componentes\n\n## Estados\n\n## Breakpoints\n`}
    },
    dataml: {
      label:{en:'Data / ML pipeline', pt:'Dados / ML pipeline'},
      checks:[
        {label:{en:'Data', pt:'Dados'}, folder:{en:'data', pt:'dados'}, localOnly:true},
        {label:{en:'Notebooks', pt:'Notebooks'}, folder:{en:'notebooks', pt:'notebooks'}},
        {label:{en:'Models / outputs', pt:'Modelos / outputs'}, folder:{en:'models', pt:'modelos'}, localOnly:true}
      ],
      defaults:[true,true,true],
      stackPh:{en:'e.g. Python + PyTorch · data versioned outside git', pt:'Ex: Python + PyTorch · dados versionados fora do git'},
      limitsPh:{en:'e.g. never push the full dataset to the repository', pt:'Ex: nunca subir dataset completo pro repositório'},
    },
    automacao: {
      label:{en:'Automation / internal script', pt:'Automação / script interno'},
      checks:[
        {label:{en:'Scripts', pt:'Scripts'}, folder:{en:'scripts', pt:'scripts'}},
        {label:{en:'Configuration', pt:'Configuração'}, folder:{en:'config', pt:'config'}, localOnly:true},
        {label:{en:'Logs', pt:'Logs'}, folder:{en:'logs', pt:'logs'}, localOnly:true}
      ],
      defaults:[true,true,false],
      stackPh:{en:'e.g. Node.js + node-cron · runs via PowerShell 7', pt:'Ex: Node.js + node-cron · roda via PowerShell 7'},
      limitsPh:{en:'e.g. never commit credentials or tokens in /config', pt:'Ex: nunca commitar credenciais ou tokens em /config'},
    },
    jogo: {
      label:{en:'Digital game (game dev)', pt:'Jogo digital (game dev)'},
      checks:[
        {label:{en:'Assets', pt:'Assets'}, folder:{en:'assets', pt:'assets'}},
        {label:{en:'Builds', pt:'Builds'}, folder:{en:'builds', pt:'builds'}, localOnly:true},
        {label:{en:'Code (/src)', pt:'Código (/src)'}, folder:{en:'src', pt:'src'}}
      ],
      defaults:[true,false,true],
      stackPh:{en:'e.g. Construct 3 / Unreal Engine 5 · Blueprints only', pt:'Ex: Construct 3 / Unreal Engine 5 · só Blueprints'},
      limitsPh:{en:'e.g. single mechanic, scope of a few days · no multi-layer systems', pt:'Ex: mecânica única, escopo de poucos dias · nada de sistemas multi-camada'},
      extraFile:{path:{en:'design/GDD.md', pt:'design/GDD.md'}, build:(n,lang)=> lang==='en'
        ? `# GDD — ${n}\n\n## One-sentence concept\n\n## Core mechanic (core loop)\n\n## Scope (what fits the timeline)\n\n## Out of scope\n`
        : `# GDD — ${n}\n\n## Conceito em uma frase\n\n## Mecânica principal (core loop)\n\n## Escopo (o que cabe no prazo)\n\n## Fora de escopo\n`}
    },
    boardgame: {
      label:{en:'Board / card game', pt:'Jogo de tabuleiro / cartas'},
      checks:[
        {label:{en:'Prototypes', pt:'Protótipos'}, folder:{en:'prototypes', pt:'prototipos'}},
        {label:{en:'Playtests', pt:'Playtests'}, folder:{en:'playtests', pt:'playtests'}},
        {label:{en:'Art / components', pt:'Arte / componentes'}, folder:{en:'art', pt:'arte'}}
      ],
      defaults:[true,true,true],
      stackPh:{en:'e.g. cooperative, WWII aviation theme · print-and-play for testing', pt:'Ex: cooperativo, tema WWII aviação · print-and-play pra testar'},
      limitsPh:{en:'e.g. every balance change must be logged with a reason', pt:'Ex: todo ajuste de balanceamento precisa ser registrado com o motivo'},
      extraFile:{path:{en:'rules/RULEBOOK.md', pt:'regras/RULEBOOK.md'}, build:(n,lang)=> lang==='en'
        ? `# Rulebook — ${n}\n\n## Theme\n\n## Game objective\n\n## Components\n\n## Setup\n\n## Turn / flow\n\n## Win and loss conditions\n`
        : `# Rulebook — ${n}\n\n## Tema\n\n## Objetivo do jogo\n\n## Componentes\n\n## Setup\n\n## Turno / fluxo\n\n## Condições de vitória e derrota\n`}
    },
    site: {
      label:{en:'Website / landing page', pt:'Site / landing page'},
      checks:[
        {label:{en:'Content', pt:'Conteúdo'}, folder:{en:'content', pt:'conteudo'}},
        {label:{en:'Assets', pt:'Assets'}, folder:{en:'assets', pt:'assets'}},
        {label:{en:'Code (/src)', pt:'Código (/src)'}, folder:{en:'src', pt:'src'}}
      ],
      defaults:[true,true,true],
      stackPh:{en:'e.g. Astro/Next.js · deployed on Vercel', pt:'Ex: Astro/Next.js · deploy na Vercel'},
      limitsPh:{en:'e.g. keep Lighthouse performance score above 90', pt:'Ex: manter Lighthouse acima de 90 em performance'},
    },
    lib: {
      label:{en:'Open source library / SDK', pt:'Biblioteca / SDK open source'},
      checks:[
        {label:{en:'Examples', pt:'Exemplos'}, folder:{en:'examples', pt:'exemplos'}},
        {label:{en:'Documentation', pt:'Documentação'}, folder:{en:'docs', pt:'docs'}},
        {label:{en:'Tests', pt:'Testes'}, folder:{en:'tests', pt:'testes'}}
      ],
      defaults:[true,true,true],
      stackPh:{en:'e.g. TypeScript · published on npm · strict semver', pt:'Ex: TypeScript · publicado no npm · semver estrito'},
      limitsPh:{en:'e.g. every public API change needs a changelog entry', pt:'Ex: toda mudança pública de API precisa de entrada no changelog'},
      extraFile:{path:{en:'docs/API.md', pt:'docs/API.md'}, build:(n,lang)=> lang==='en'
        ? `# API reference — ${n}\n\n## Installation\n\n## Basic usage\n\n## Public API\n\n## Versioning\n`
        : `# Referência de API — ${n}\n\n## Instalação\n\n## Uso básico\n\n## API pública\n\n## Versionamento\n`}
    },
    mobile: {
      label:{en:'Mobile app (iOS/Android)', pt:'App mobile (iOS/Android)'},
      checks:[
        {label:{en:'Assets (icons/screenshots)', pt:'Assets (ícones/screenshots)'}, folder:{en:'assets', pt:'assets'}},
        {label:{en:'Code (/src)', pt:'Código (/src)'}, folder:{en:'src', pt:'src'}},
        {label:{en:'Store listing', pt:'Ficha na loja'}, folder:{en:'store', pt:'store'}}
      ],
      defaults:[true,true,false],
      stackPh:{en:'e.g. React Native + Expo · TestFlight for iOS beta · target Android 8+', pt:'Ex: React Native + Expo · TestFlight pra beta iOS · Android 8+ como alvo'},
      limitsPh:{en:"e.g. don't submit to app stores without review · keep requested permissions minimal", pt:'Ex: não submeter às lojas sem revisão · manter permissões pedidas no mínimo'},
      extraFile:{path:{en:'store/LISTING.md', pt:'store/LISTING.md'}, build:(n,lang)=> lang==='en'
        ? `# Store listing — ${n}\n\n## App name\n\n## Short description\n\n## Full description\n\n## Screenshots\n\n## Keywords\n\n## Privacy policy URL\n\n## Support contact\n`
        : `# Ficha na loja — ${n}\n\n## Nome do app\n\n## Descrição curta\n\n## Descrição completa\n\n## Screenshots\n\n## Palavras-chave\n\n## URL da política de privacidade\n\n## Contato de suporte\n`}
    },
    extension: {
      label:{en:'Browser extension', pt:'Extensão de navegador'},
      checks:[
        {label:{en:'Code (/src)', pt:'Código (/src)'}, folder:{en:'src', pt:'src'}},
        {label:{en:'Icons & assets', pt:'Ícones & assets'}, folder:{en:'assets', pt:'assets'}},
        {label:{en:'Store listing', pt:'Ficha na loja'}, folder:{en:'store', pt:'store'}}
      ],
      defaults:[true,true,false],
      stackPh:{en:'e.g. Manifest V3 · Chrome Web Store + Firefox Add-ons · TypeScript', pt:'Ex: Manifest V3 · Chrome Web Store + Firefox Add-ons · TypeScript'},
      limitsPh:{en:"e.g. don't request broader permissions than needed · document every permission's purpose", pt:'Ex: não pedir permissões além do necessário · documentar o motivo de cada permissão'},
      extraFile:{path:{en:'docs/PERMISSIONS.md', pt:'docs/PERMISSIONS.md'}, build:(n,lang)=> lang==='en'
        ? `# Permissions — ${n}\n\n## Requested permissions\n\n## Why each one is needed\n\n## Data collected\n\n## Store listing notes\n`
        : `# Permissões — ${n}\n\n## Permissões solicitadas\n\n## Por que cada uma é necessária\n\n## Dados coletados\n\n## Notas para a ficha da loja\n`}
    },
    hardware: {
      label:{en:'Hardware / IoT', pt:'Hardware / IoT'},
      checks:[
        {label:{en:'Firmware', pt:'Firmware'}, folder:{en:'firmware', pt:'firmware'}},
        {label:{en:'Hardware design (schematics/CAD)', pt:'Design de hardware (esquemas/CAD)'}, folder:{en:'hardware', pt:'hardware'}},
        {label:{en:'Docs / BOM', pt:'Docs / BOM'}, folder:{en:'docs', pt:'docs'}}
      ],
      defaults:[true,true,true],
      stackPh:{en:'e.g. ESP32 + Arduino framework · KiCad for schematics · 3D-printed enclosure', pt:'Ex: ESP32 + framework Arduino · KiCad pra esquemas · case impresso em 3D'},
      limitsPh:{en:"e.g. don't change pinout without updating the schematic · flag any part with lead time over 2 weeks", pt:'Ex: não mudar pinagem sem atualizar o esquema · avisar sobre peças com prazo de entrega acima de 2 semanas'},
      extraFile:{path:{en:'hardware/BOM.md', pt:'hardware/BOM.md'}, build:(n,lang)=> lang==='en'
        ? `# Bill of materials — ${n}\n\n## Components\n\n## Sourcing / suppliers\n\n## Estimated cost\n\n## Lead-time risks\n`
        : `# Lista de materiais — ${n}\n\n## Componentes\n\n## Fornecedores\n\n## Custo estimado\n\n## Riscos de prazo de entrega\n`}
    },
    course: {
      label:{en:'Course / educational content', pt:'Curso / conteúdo educacional'},
      checks:[
        {label:{en:'Modules / curriculum', pt:'Módulos / currículo'}, folder:{en:'modules', pt:'modules'}},
        {label:{en:'Materials (slides, worksheets)', pt:'Materiais (slides, exercícios)'}, folder:{en:'materials', pt:'materials'}},
        {label:{en:'Assessments', pt:'Avaliações'}, folder:{en:'assessments', pt:'assessments'}}
      ],
      defaults:[true,true,false],
      stackPh:{en:'e.g. delivered via Notion + recorded video · cohort-based, 6 weeks', pt:'Ex: entregue via Notion + vídeo gravado · em turma, 6 semanas'},
      limitsPh:{en:"e.g. don't change learning objectives without updating the syllabus · keep exercises aligned to stated objectives", pt:'Ex: não mudar objetivos de aprendizagem sem atualizar a ementa · manter exercícios alinhados aos objetivos'},
      extraFile:{path:{en:'docs/SYLLABUS.md', pt:'docs/SYLLABUS.md'}, build:(n,lang)=> lang==='en'
        ? `# Syllabus — ${n}\n\n## Audience\n\n## Learning objectives\n\n## Module breakdown\n\n## Assessment criteria\n\n## Prerequisites\n`
        : `# Ementa — ${n}\n\n## Público-alvo\n\n## Objetivos de aprendizagem\n\n## Divisão em módulos\n\n## Critérios de avaliação\n\n## Pré-requisitos\n`}
    },
    marketing: {
      label:{en:'Marketing campaign', pt:'Campanha de marketing'},
      checks:[
        {label:{en:'Creative assets', pt:'Assets criativos'}, folder:{en:'assets', pt:'assets'}},
        {label:{en:'Copy / content', pt:'Copy / conteúdo'}, folder:{en:'copy', pt:'copy'}},
        {label:{en:'Channel plan / calendar', pt:'Plano de canais / calendário'}, folder:{en:'calendar', pt:'calendar'}}
      ],
      defaults:[true,true,true],
      stackPh:{en:'e.g. Meta Ads + Google Ads · scheduled via Buffer · landing page on Webflow', pt:'Ex: Meta Ads + Google Ads · agendado via Buffer · landing page na Webflow'},
      limitsPh:{en:"e.g. don't publish paid ads without approval · keep messaging consistent with brand guidelines", pt:'Ex: não publicar anúncios pagos sem aprovação · manter mensagem consistente com as diretrizes de marca'},
      extraFile:{path:{en:'docs/BRIEF.md', pt:'docs/BRIEF.md'}, build:(n,lang)=> lang==='en'
        ? `# Campaign brief — ${n}\n\n## Objective\n\n## Target audience\n\n## Key message\n\n## Channels\n\n## Budget\n\n## Success metrics\n\n## Timeline\n`
        : `# Brief de campanha — ${n}\n\n## Objetivo\n\n## Público-alvo\n\n## Mensagem principal\n\n## Canais\n\n## Orçamento\n\n## Métricas de sucesso\n\n## Cronograma\n`}
    },
    podcast: {
      label:{en:'Podcast / video production', pt:'Podcast / produção de vídeo'},
      checks:[
        {label:{en:'Episodes / scripts', pt:'Episódios / roteiros'}, folder:{en:'episodes', pt:'episodes'}},
        {label:{en:'Raw footage / audio', pt:'Material bruto (áudio/vídeo)'}, folder:{en:'raw', pt:'raw'}, localOnly:true},
        {label:{en:'Published / distribution', pt:'Publicado / distribuição'}, folder:{en:'published', pt:'published'}}
      ],
      defaults:[true,true,false],
      stackPh:{en:'e.g. recorded in Riverside.fm · edited in Descript · published via Spotify for Podcasters', pt:'Ex: gravado no Riverside.fm · editado no Descript · publicado via Spotify for Podcasters'},
      limitsPh:{en:"e.g. don't publish an episode without a reviewed transcript · credit guests accurately", pt:'Ex: não publicar episódio sem transcrição revisada · creditar convidados corretamente'},
      extraFile:{path:{en:'docs/SHOW-BIBLE.md', pt:'docs/SHOW-BIBLE.md'}, build:(n,lang)=> lang==='en'
        ? `# Show bible — ${n}\n\n## Premise\n\n## Format\n\n## Target audience\n\n## Episode structure\n\n## Tone & voice guidelines\n`
        : `# Show bible — ${n}\n\n## Premissa\n\n## Formato\n\n## Público-alvo\n\n## Estrutura dos episódios\n\n## Diretrizes de tom e voz\n`}
    },
    generico: {
      label:{en:'Generic', pt:'Genérico'},
      checks:[
        {label:{en:'Documents', pt:'Documentos'}, folder:{en:'docs', pt:'docs'}},
        {label:{en:'Assets', pt:'Assets'}, folder:{en:'assets', pt:'assets'}},
        {label:{en:'Results / outputs', pt:'Resultados / outputs'}, folder:{en:'outputs', pt:'outputs'}, localOnly:true}
      ],
      defaults:[false,false,false],
      stackPh:{en:'e.g. tools and conventions used in this project', pt:'Ex: ferramentas e convenções usadas neste projeto'},
      limitsPh:{en:'e.g. what the AI should not decide on its own here', pt:'Ex: o que a IA não deve decidir sozinha aqui'},
    },
  };

  var GITIGNORE_BASE = {
    en: `# OS\n.DS_Store\nThumbs.db\n\n# Editors\n.vscode/\n.idea/\n*.swp\n*.swo\n\n# Secrets & local overrides\n.env\n.env.local\n.env.*.local\n*.local.*\nCLAUDE.local.md\n\n# Logs\n*.log\n`,
    pt: `# Sistema operacional\n.DS_Store\nThumbs.db\n\n# Editores\n.vscode/\n.idea/\n*.swp\n*.swo\n\n# Segredos e overrides locais\n.env\n.env.local\n.env.*.local\n*.local.*\nCLAUDE.local.md\n\n# Logs\n*.log\n`,
  };

  function slugify(s){
    return (s || 'new-project')
      .normalize('NFD').replace(/[̀-ͯ]/g,'')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/(^-|-$)/g,'') || 'new-project';
  }

  function todayStr(lang){ return new Date().toLocaleDateString(lang==='en' ? 'en-US' : 'pt-BR'); }

  function buildGitignore(lang, localOnlyFolderNames){
    localOnlyFolderNames = localOnlyFolderNames || [];
    let content = GITIGNORE_BASE[lang];
    if(localOnlyFolderNames.length){
      content += lang==='en'
        ? '\n# Local-only folders (heavy or sensitive) — kept out of version control\n'
        : '\n# Pastas locais (pesadas ou sensíveis) — fora do controle de versão\n';
      localOnlyFolderNames.forEach(f=>{ content += `${f}/*\n!${f}/.gitkeep\n`; });
    }
    return content;
  }

  function buildAgentBody(d, lang){
    return lang==='en'
      ? `# ${d.name}\n\n${d.desc}\n\n## Stack & commands\n${d.stack || '(fill in: how to build, test, and run this project)'}\n\n## Limits — don't do this without asking\n${d.limits || '- (fill in)'}\n\n## See also\n- PROJECT.md — overview for humans\n- DECISIONS.md — decision history (update on every relevant decision)\n- TASKS.md — active tasks\n`
      : `# ${d.name}\n\n${d.desc}\n\n## Stack & comandos\n${d.stack || '(preencher: como buildar, testar e rodar este projeto)'}\n\n## Limites — o que não fazer sem perguntar\n${d.limits || '- (preencher)'}\n\n## Ver também\n- PROJECT.md — visão geral para humanos\n- DECISIONS.md — histórico de decisões (atualizar a cada decisão relevante)\n- TASKS.md — tarefas ativas\n`;
  }

  function buildSkillFile(d, slug, lang){
    return lang==='en'
      ? `---\nname: ${slug}\ndescription: Support skill for the ${d.name} project. Use when you need context or routines specific to this project.\n---\n\n# ${d.name} — support skill\n\nReusable instructions and procedures for recurring tasks in this project.\n\n## When to use\n- (fill in: in which situations this skill should be loaded)\n\n## Procedure\n1. \n2. \n3. \n`
      : `---\nname: ${slug}\ndescription: Skill de apoio para o projeto ${d.name}. Use quando precisar de contexto ou rotinas específicas deste projeto.\n---\n\n# ${d.name} — skill de apoio\n\nInstruções e procedimentos reutilizáveis para tarefas recorrentes deste projeto.\n\n## Quando usar\n- (preencher: em que situações esta skill deve ser carregada)\n\n## Procedimento\n1. \n2. \n3. \n`;
  }

  function buildAgentFileList(agents, lang){
    agents = agents || {};
    const agentFiles = [];
    if(agents.claude) agentFiles.push('CLAUDE.md');
    if(agents.agentsmd) agentFiles.push('AGENTS.md');
    if(agents.cursor) agentFiles.push('.cursor/rules/');
    if(agents.copilot) agentFiles.push('.github/copilot-instructions.md');
    if(agents.gemini) agentFiles.push('GEMINI.md');
    if(agents.windsurf) agentFiles.push('.windsurf/rules/');
    return agentFiles.length ? agentFiles.join(', ') : STRINGS[lang].agentListFallback;
  }

  function resolveData(input){
    const t = STRINGS[input.lang];
    return {
      name: (input.name || '').trim() || t.newProject,
      type: input.type,
      desc: (input.desc || '').trim() || t.fillIn,
      obj: (input.obj || '').trim() || t.fillIn,
      stack: (input.stack || '').trim(),
      limits: (input.limits || '').trim(),
    };
  }

  function buildFileMap(input){
    const lang = input.lang;
    const d = resolveData(input);
    const cfg = TYPE_CONFIG[d.type];
    const date = todayStr(lang);
    const slug = slugify(d.name);
    const files = {};

    const folderEntries = input.folders || [];
    const folders = folderEntries.map(f=>f.name);
    const localOnlyFolderNames = folderEntries.filter(f=>f.localOnly).map(f=>f.name);
    const localOnlySet = new Set(localOnlyFolderNames);
    const folderList = folders.map(f=> localOnlySet.has(f)
      ? `- \`${f}/\` — ${lang==='en' ? 'local only, see .gitignore' : 'só local, ver .gitignore'}`
      : `- \`${f}/\``).join('\n');

    if(lang==='en'){
      files['README.md'] = `# ${d.name}\n\nIndex of this workspace:\n- \`PROJECT.md\` — overview and goal\n- \`DECISIONS.md\` — decision history\n- \`CONTEXT.md\` — accumulated context for the AI\n- \`TASKS.md\` — active tasks\n${folderList ? '\nFolders:\n'+folderList : ''}\n\n> The AI is a tool that extends human judgment, not a substitute for it. Relevant decisions go into DECISIONS.md.\n`;
      files['PROJECT.md'] = `# ${d.name}\n\n## Overview\n${d.desc}\n\n## Main goal\n${d.obj}\n\n## Project type\n${cfg.label[lang]}\n\n## Stack\n${d.stack || '(fill in)'}\n\n## Status\n🟡 In definition\n\n---\nCreated on ${date} via workspace//kit.\n`;
      files['DECISIONS.md'] = `# Decisions — ${d.name}\n\nChronological record of decisions made in this project. Each entry should contain what, why, and discarded alternatives.\n\n## ${date}\n- **Decision:** —\n- **Reason:** —\n- **Alternatives considered:** —\n`;
      files['CONTEXT.md'] = `# Context — ${d.name}\n\nContext the AI should know to work well on this project: conventions, constraints, vocabulary, people involved.\n\n## Conventions\n- \n\n## Constraints\n- \n\n## Vocabulary / specific terms\n- \n`;
      files['TASKS.md'] = `# Tasks — ${d.name}\n\n## In progress\n- [ ] \n\n## Next\n- [ ] \n\n## Done\n- [x] Workspace created (${date})\n`;
    } else {
      files['README.md'] = `# ${d.name}\n\nÍndice deste workspace:\n- \`PROJECT.md\` — visão geral e objetivo\n- \`DECISIONS.md\` — histórico de decisões\n- \`CONTEXT.md\` — contexto acumulado para a IA\n- \`TASKS.md\` — tarefas ativas\n${folderList ? '\nPastas:\n'+folderList : ''}\n\n> A IA é uma ferramenta que amplia julgamento humano, não um substituto para ele. Decisões relevantes vão para DECISIONS.md.\n`;
      files['PROJECT.md'] = `# ${d.name}\n\n## Visão geral\n${d.desc}\n\n## Objetivo principal\n${d.obj}\n\n## Tipo de projeto\n${cfg.label[lang]}\n\n## Stack\n${d.stack || '(preencher)'}\n\n## Status\n🟡 Em definição\n\n---\nCriado em ${date} via workspace//kit.\n`;
      files['DECISIONS.md'] = `# Decisões — ${d.name}\n\nRegistro cronológico de decisões tomadas neste projeto. Cada entrada deve conter o quê, por quê, e alternativas descartadas.\n\n## ${date}\n- **Decisão:** —\n- **Motivo:** —\n- **Alternativas consideradas:** —\n`;
      files['CONTEXT.md'] = `# Contexto — ${d.name}\n\nContexto que a IA deve conhecer para trabalhar bem neste projeto: convenções, restrições, vocabulário, pessoas envolvidas.\n\n## Convenções\n- \n\n## Restrições\n- \n\n## Vocabulário / termos específicos\n- \n`;
      files['TASKS.md'] = `# Tarefas — ${d.name}\n\n## Em andamento\n- [ ] \n\n## Próximas\n- [ ] \n\n## Concluídas\n- [x] Workspace criado (${date})\n`;
    }

    folders.forEach(f => { files[`${f}/.gitkeep`] = ''; });
    if(cfg.extraFile){ files[cfg.extraFile.path[lang]] = cfg.extraFile.build(d.name, lang); }
    files['.gitignore'] = buildGitignore(lang, localOnlyFolderNames);

    const agentBody = buildAgentBody(d, lang);
    const agents = input.agents || {};
    const wantsAgentsmd = !!agents.agentsmd;
    if(agents.claude){
      files['CLAUDE.md'] = wantsAgentsmd
        ? (lang==='en'
            ? `@AGENTS.md\n\n## Specific to Claude Code / Cowork\n- (add rules exclusive to this agent here, e.g. use plan mode before structural changes)\n`
            : `@AGENTS.md\n\n## Específico para Claude Code / Cowork\n- (adicione aqui regras exclusivas deste agente, ex: usar plan mode antes de mudanças estruturais)\n`)
        : agentBody;
    }
    if(wantsAgentsmd){ files['AGENTS.md'] = agentBody; }
    if(agents.cursor){
      files[`.cursor/rules/${slug}.mdc`] = lang==='en'
        ? `---\ndescription: Rules for the ${d.name} project\nglobs:\nalwaysApply: true\n---\n\n${agentBody}`
        : `---\ndescription: Regras do projeto ${d.name}\nglobs:\nalwaysApply: true\n---\n\n${agentBody}`;
    }
    if(agents.copilot){ files['.github/copilot-instructions.md'] = agentBody; }
    if(agents.gemini){ files['GEMINI.md'] = agentBody; }
    if(agents.windsurf){ files[`.windsurf/rules/${slug}.md`] = agentBody; }
    if(agents.skill){ files[`.claude/skills/${slug}/SKILL.md`] = buildSkillFile(d, slug, lang); }

    return {files, slug, name: d.name};
  }

  function buildStarterPrompt(input){
    const lang = input.lang;
    const t = STRINGS[lang];
    const name = (input.name || '').trim() || t.newProject;
    const desc = (input.desc || '').trim() || t.fillIn;
    const obj = (input.obj || '').trim() || t.fillIn;
    const cfg = TYPE_CONFIG[input.type];
    const agentList = buildAgentFileList(input.agents, lang);

    return lang === 'en'
      ? `You'll act as a working partner on this project: "${name}".

CONTEXT
${desc}
Main goal: ${obj}
Project type: ${cfg.label[lang]}

HOW TO WORK
- Before taking any action, read ${agentList}, then PROJECT.md, CONTEXT.md, and DECISIONS.md in this folder.
- Every relevant decision we make should be logged in DECISIONS.md (what, why, discarded alternatives).
- Update TASKS.md as work progresses.
- You are a tool that extends my judgment — at points of strategic ambiguity, don't decide on your own: bring options and trade-offs for me to decide.
- Be explicit about what is fact, inference, or assumption.

Start by reviewing the workspace files and tell me what's missing before we begin.`
      : `Você vai atuar como parceiro de trabalho neste projeto: "${name}".

CONTEXTO
${desc}
Objetivo principal: ${obj}
Tipo de projeto: ${cfg.label[lang]}

COMO TRABALHAR
- Antes de qualquer ação, leia ${agentList}, depois PROJECT.md, CONTEXT.md e DECISIONS.md nesta pasta.
- Toda decisão relevante que tomarmos deve ser registrada em DECISIONS.md (o quê, por quê, alternativas descartadas).
- Atualize TASKS.md conforme o trabalho avança.
- Você é uma ferramenta que amplia meu julgamento — em pontos de ambiguidade estratégica, não decida sozinho: traga opções e trade-offs para eu decidir.
- Seja explícito sobre o que é fato, inferência ou suposição.
- Este chat é em português, mas a documentação gerada (PROJECT.md, DECISIONS.md, etc.) deve continuar em inglês por padrão — só escreva a documentação em português se eu pedir isso explicitamente.

Comece revisando os arquivos do workspace e me diga o que falta preencher antes de começarmos.`;
  }

  function buildTreeStructure(paths){
    const root = {};
    paths.forEach(p=>{
      const parts = p.split('/');
      let node = root;
      parts.forEach((part,i)=>{
        const isLeaf = i === parts.length-1;
        if(!(part in node)) node[part] = isLeaf ? null : {};
        if(node[part] !== null) node = node[part];
      });
    });
    return root;
  }

  return {
    TYPE_CONFIG: TYPE_CONFIG,
    STRINGS: STRINGS,
    GITIGNORE_BASE: GITIGNORE_BASE,
    slugify: slugify,
    todayStr: todayStr,
    buildGitignore: buildGitignore,
    buildAgentBody: buildAgentBody,
    buildSkillFile: buildSkillFile,
    buildAgentFileList: buildAgentFileList,
    buildFileMap: buildFileMap,
    buildStarterPrompt: buildStarterPrompt,
    buildTreeStructure: buildTreeStructure,
  };
});
