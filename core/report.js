/**
 * workspace//kit report layer.
 *
 * Turns the workspace's own Markdown (PRD, specs, design docs, DECISIONS.md,
 * TASKS.md, SESSIONS.md) into a readable, presentable static HTML report under
 * `reports/`. It is a *rendering* layer only: it never judges, never edits a
 * source file, and holds no domain logic -- every number it shows is either
 * counted off the raw text or read from the file system, in the same
 * chars-over-4 token convention the rest of the CLI uses.
 *
 * Chrome (nav, labels, counters) is in Portuguese: the reports exist to be read
 * by the owner, while the repo's documents stay English-only per
 * `decisions/009-repo-translated-to-english.md`. Document content is rendered
 * verbatim in whatever language it was written in.
 *
 * Zero dependencies, no build step, Node-only (it reads and writes the disk),
 * same conventions as `core/inspect.js`.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

function estimateTokens(text) {
  // Same rough chars/4 approximation the CLI reports elsewhere. An estimate,
  // never a tokenizer count.
  return Math.round(text.length / 4);
}

function formatNumber(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function posix(p) {
  return p.split(path.sep).join('/');
}

/* ------------------------------------------------------------------ *
 * Markdown -> HTML (deliberate subset)
 *
 * Supports what this repo's documents actually use: ATX headings, bullet and
 * ordered lists with nesting, task-list items, fenced and inline code,
 * blockquotes, tables, horizontal rules, links, bold/italic/strikethrough.
 * Anything outside that subset degrades to escaped plain text rather than
 * producing broken markup.
 * ------------------------------------------------------------------ */

const SENTINEL = '\u0000';
const SENTINEL_RE = /\u0000(\d+)\u0000/g;

function renderInline(text, resolveLink) {
  const codes = [];
  let s = escapeHtml(text);

  // Pull code spans out first so no emphasis rule can fire inside them.
  s = s.replace(/`([^`]+)`/g, (m, code) => {
    codes.push(code);
    return SENTINEL + (codes.length - 1) + SENTINEL;
  });

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, alt, src) =>
    `<img src="${resolveLink(src)}" alt="${alt}" loading="lazy">`);

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, label, href) => {
    const url = resolveLink(href);
    const external = /^https?:/i.test(href);
    return `<a href="${url}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });

  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  s = s.replace(SENTINEL_RE, (m, i) => `<code>${codes[Number(i)]}</code>`);
  return s;
}

function renderListItemBody(raw, resolveLink) {
  const task = raw.match(/^\[([ xX])\]\s+(.*)$/);
  if (!task) return { html: renderInline(raw, resolveLink), task: null };
  const done = task[1].toLowerCase() === 'x';
  const body = renderInline(task[2], resolveLink);
  return {
    html: `<span class="check" aria-hidden="true">${done ? '&#10003;' : ''}</span><span>${body}</span>`,
    task: done ? 'done' : 'open',
  };
}

function renderMarkdown(md, options) {
  const opts = options || {};
  const resolveLink = opts.resolveLink || ((h) => escapeHtml(h));
  const headingOffset = opts.headingOffset || 0;
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const headings = [];
  const usedIds = Object.create(null);

  let i = 0;

  function uniqueId(text) {
    let id = slugify(text);
    if (usedIds[id]) {
      usedIds[id] += 1;
      id = id + '-' + usedIds[id];
    } else {
      usedIds[id] = 1;
    }
    return id;
  }

  function flushParagraph(buffer) {
    if (!buffer.length) return;
    out.push('<p>' + renderInline(buffer.join(' '), resolveLink) + '</p>');
  }

  function parseList(startIndent) {
    // Returns HTML for one list level; consumes lines from the shared cursor.
    const first = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    const ordered = /\d/.test(first[2]);
    const items = [];
    let hasTasks = false;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        // A blank line only ends the list if the next content is not a deeper
        // or equal-indent list item / continuation.
        const next = lines[i + 1];
        if (next === undefined) break;
        const m = next.match(/^(\s*)([-*+]|\d+[.)])\s+/);
        if (!m || m[1].length < startIndent) break;
        i++;
        continue;
      }
      const m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (!m) {
        // Continuation line of the current item (lazy wrapping).
        if (items.length && line.match(/^\s+\S/)) {
          items[items.length - 1].parts.push(renderInline(line.trim(), resolveLink));
          i++;
          continue;
        }
        break;
      }
      const indent = m[1].length;
      if (indent < startIndent) break;
      if (indent > startIndent) {
        const nested = parseList(indent);
        if (items.length) items[items.length - 1].parts.push(nested);
        continue;
      }
      const body = renderListItemBody(m[3], resolveLink);
      if (body.task) hasTasks = true;
      items.push({ parts: [body.html], task: body.task });
      i++;
    }

    const tag = ordered ? 'ol' : 'ul';
    const cls = hasTasks ? ' class="tasklist"' : '';
    const html = items
      .map((it) => {
        const c = it.task ? ` class="task ${it.task}"` : '';
        return `<li${c}>${it.parts.join(' ')}</li>`;
      })
      .join('');
    return `<${tag}${cls}>${html}</${tag}>`;
  }

  let paragraph = [];

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      flushParagraph(paragraph);
      paragraph = [];
      i++;
      const body = [];
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        `<pre class="code"${fence[1] ? ` data-lang="${escapeHtml(fence[1])}"` : ''}><code>${escapeHtml(
          body.join('\n')
        )}</code></pre>`
      );
      continue;
    }

    if (!line.trim()) {
      flushParagraph(paragraph);
      paragraph = [];
      i++;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph(paragraph);
      paragraph = [];
      const level = Math.min(6, heading[1].length + headingOffset);
      const text = heading[2].replace(/\s+#+\s*$/, '');
      const id = uniqueId(text);
      headings.push({ level: heading[1].length, text, id });
      out.push(
        `<h${level} id="${id}">${renderInline(text, resolveLink)}` +
          `<a class="anchor" href="#${id}" aria-label="Link para esta seção">#</a></h${level}>`
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushParagraph(paragraph);
      paragraph = [];
      out.push('<hr>');
      i++;
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      flushParagraph(paragraph);
      paragraph = [];
      const body = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + renderMarkdown(body.join('\n'), opts).html + '</blockquote>');
      continue;
    }

    // Table
    if (line.includes('|') && lines[i + 1] && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      flushParagraph(paragraph);
      paragraph = [];
      const splitRow = (row) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const head = splitRow(line);
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        body.push(splitRow(lines[i]));
        i++;
      }
      out.push(
        '<div class="table-wrap"><table><thead><tr>' +
          head.map((c) => `<th>${renderInline(c, resolveLink)}</th>`).join('') +
          '</tr></thead><tbody>' +
          body
            .map(
              (row) =>
                '<tr>' + row.map((c) => `<td>${renderInline(c, resolveLink)}</td>`).join('') + '</tr>'
            )
            .join('') +
          '</tbody></table></div>'
      );
      continue;
    }

    // List
    if (/^(\s*)([-*+]|\d+[.)])\s+/.test(line)) {
      flushParagraph(paragraph);
      paragraph = [];
      const indent = line.match(/^(\s*)/)[1].length;
      out.push(parseList(indent));
      continue;
    }

    paragraph.push(line.trim());
    i++;
  }

  flushParagraph(paragraph);
  return { html: out.join('\n'), headings };
}

/* ------------------------------------------------------------------ *
 * Link resolution
 *
 * Every relative link in a source document is rewritten so it still works from
 * inside `reports/`: links to a document that also got rendered point at its
 * HTML page; everything else points back at the real file in the repo.
 * ------------------------------------------------------------------ */

function makeLinkResolver(sourceRel, outputRel, pageIndex) {
  const sourceDir = path.posix.dirname(sourceRel);
  const outputDir = path.posix.dirname(outputRel);

  return function resolveLink(href) {
    if (/^(https?:|mailto:|tel:|data:|#)/i.test(href)) return escapeHtml(href);

    const hashAt = href.indexOf('#');
    const hash = hashAt >= 0 ? href.slice(hashAt) : '';
    const target = hashAt >= 0 ? href.slice(0, hashAt) : href;
    if (!target) return escapeHtml(href);

    const repoRel = path.posix.normalize(path.posix.join(sourceDir, target)).replace(/^\.\//, '');
    const page = pageIndex[repoRel];
    if (page) {
      const rel = path.posix.relative(outputDir, page) || path.posix.basename(page);
      return escapeHtml(rel + hash);
    }
    // Not rendered: point back at the real file, relative to the report page.
    const depth = outputDir === '.' ? 0 : outputDir.split('/').length;
    const prefix = '../'.repeat(depth + 1);
    return escapeHtml(prefix + repoRel + hash);
  };
}

/* ------------------------------------------------------------------ *
 * Document discovery + metadata
 * ------------------------------------------------------------------ */

const DOC_GROUPS = [
  {
    id: 'produto',
    label: 'Produto & visão',
    hint: 'O porquê do projeto: problema, escopo, pilares e restrições.',
    files: ['docs/PRD.md', 'PROJECT.md', 'CONTEXT.md'],
  },
  {
    id: 'specs',
    label: 'Specs de features',
    hint: 'Uma spec por feature — requisitos P0/P1, Non-Goals e questões em aberto.',
    dir: 'docs/specs',
  },
  {
    id: 'design',
    label: 'Design',
    hint: 'Direção visual e os briefs que alimentaram o protótipo.',
    files: ['DESIGN.md'],
    dir: 'docs/design',
  },
  {
    id: 'agentes',
    label: 'Instruções de agente',
    hint: 'A camada que Claude Code, Cowork e afins leem antes de tocar no repo.',
    files: ['AGENTS.md', 'CLAUDE.md'],
  },
];

function readIfExists(root, rel) {
  const abs = path.join(root, rel.split('/').join(path.sep));
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return fs.readFileSync(abs, 'utf8');
}

function docMeta(rel, raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const titleLine = lines.find((l) => /^#\s+/.test(l));
  const title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : path.posix.basename(rel);

  let status = null;
  for (const line of lines.slice(0, 12)) {
    const m = line.match(/^\*{0,2}Status:?\*{0,2}\s*(.+)$/i);
    if (m) {
      status = m[1].split('.')[0].trim().replace(/\*\*/g, '');
      break;
    }
  }

  const issues = [];
  const issueRe = /#(\d{1,4})\b/g;
  let m;
  while ((m = issueRe.exec(raw))) {
    if (issues.indexOf(m[1]) === -1) issues.push(m[1]);
    if (issues.length >= 4) break;
  }

  // Intro = first non-heading, non-status paragraph.
  let summary = '';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l || /^#/.test(l) || /^status:/i.test(l) || /^\*\*/.test(l)) continue;
    summary = l;
    break;
  }
  if (summary.length > 240) summary = summary.slice(0, 237).replace(/\s+\S*$/, '') + '…';

  const p0 = (raw.match(/^\s*-\s+(?![-*])/gm) || []).length;
  const sections = lines.filter((l) => /^##\s+/.test(l)).length;

  return {
    rel,
    title,
    status,
    issues,
    summary: summary.replace(/\*\*/g, '').replace(/`/g, ''),
    lines: lines.length,
    tokens: estimateTokens(raw),
    bullets: p0,
    sections,
  };
}

function statusTone(status) {
  if (!status) return 'neutral';
  const s = status.toLowerCase();
  if (/implement|done|adopted|resolved|current/.test(s)) return 'ok';
  if (/draft|pending|planning|proposed|first pass/.test(s)) return 'warn';
  if (/superseded|deprecated|blocked|obsolete/.test(s)) return 'muted';
  return 'neutral';
}

function collectDocs(root) {
  const groups = [];
  for (const group of DOC_GROUPS) {
    const docs = [];
    const seen = Object.create(null);

    for (const rel of group.files || []) {
      const raw = readIfExists(root, rel);
      if (raw && !seen[rel]) {
        seen[rel] = true;
        docs.push(docMeta(rel, raw));
      }
    }
    if (group.dir) {
      const absDir = path.join(root, group.dir.split('/').join(path.sep));
      if (fs.existsSync(absDir)) {
        for (const name of fs.readdirSync(absDir).sort()) {
          if (!/\.md$/i.test(name)) continue;
          const rel = group.dir + '/' + name;
          if (seen[rel]) continue;
          seen[rel] = true;
          docs.push(docMeta(rel, readIfExists(root, rel)));
        }
      }
    }
    if (docs.length) groups.push({ id: group.id, label: group.label, hint: group.hint, docs });
  }
  return groups;
}

/* ------------------------------------------------------------------ *
 * TASKS.md / DECISIONS.md / SESSIONS.md parsing
 * ------------------------------------------------------------------ */

function parseTasks(raw) {
  const lines = String(raw || '').replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let current = { title: 'Sem seção', meta: null, items: [] };
  let started = false;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    if (h2 || h3) {
      if (started && current.items.length) sections.push(current);
      const rawTitle = (h2 ? h2[1] : h3[1]).trim();
      const withMeta = rawTitle.match(/^(.*?)\s*\((.+)\)\s*$/);
      current = {
        title: withMeta ? withMeta[1].trim() : rawTitle,
        meta: withMeta ? withMeta[2].trim() : null,
        level: h2 ? 2 : 3,
        items: [],
      };
      started = true;
      continue;
    }
    const item = line.match(/^-\s+\[([ xX])\]\s+(.*)$/);
    if (item && started) {
      const done = item[1].toLowerCase() === 'x';
      let text = item[2];
      text = text.replace(/~~(.+?)~~/g, '$1');
      current.items.push({ done, text });
    }
  }
  if (started && current.items.length) sections.push(current);
  return sections;
}

function parseDecisions(root) {
  const raw = readIfExists(root, 'DECISIONS.md') || '';
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const entries = [];
  let current = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      if (current) entries.push(current);
      const title = h2[1].trim();
      const dateMatch = title.match(/^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.*)$/);
      current = {
        date: dateMatch ? dateMatch[1] : null,
        title: dateMatch ? dateMatch[2] : title,
        body: [],
        archived: false,
        source: 'DECISIONS.md',
      };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) entries.push(current);

  // Archived ADRs under decisions/
  const absDir = path.join(root, 'decisions');
  if (fs.existsSync(absDir)) {
    for (const name of fs.readdirSync(absDir).sort()) {
      if (!/\.md$/i.test(name)) continue;
      const rel = 'decisions/' + name;
      const text = readIfExists(root, rel) || '';
      const body = text.replace(/\r\n/g, '\n').split('\n');
      const titleLine = body.find((l) => /^#\s+/.test(l)) || name;
      const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
      entries.push({
        date: dateMatch ? dateMatch[1] : null,
        title: titleLine.replace(/^#\s+/, '').trim(),
        body: body.filter((l) => !/^#\s+/.test(l)),
        archived: true,
        source: rel,
      });
    }
  }

  const dated = entries.filter((e) => e.date);
  const undated = entries.filter((e) => !e.date);
  dated.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { dated, undated };
}

function parseSessions(raw) {
  const lines = String(raw || '').replace(/\r\n/g, '\n').split('\n');
  const entries = [];
  let current = null;
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      if (current) entries.push(current);
      const title = h3[1].trim();
      const m = title.match(/^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.*)$/);
      current = { date: m ? m[1] : null, tool: m ? m[2] : title, body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) entries.push(current);
  entries.reverse();
  return entries;
}

/* ------------------------------------------------------------------ *
 * Page shell
 * ------------------------------------------------------------------ */

const NAV = [
  { href: 'index.html', label: 'Início' },
  { href: 'plans/index.html', label: 'Planos & specs' },
  { href: 'decisions.html', label: 'Decisões' },
  { href: 'tasks.html', label: 'Tarefas' },
  { href: 'sessions.html', label: 'Sessões' },
];

function shell(opts) {
  const depth = opts.depth || 0;
  const up = '../'.repeat(depth);
  const nav = NAV.map((item) => {
    const active = item.href === opts.active ? ' class="active"' : '';
    return `<a href="${up}${item.href}"${active}>${item.label}</a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)} — workspace//kit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="${up}assets/report.css">
</head>
<body>
<header class="topbar">
  <a class="brand" href="${up}index.html"><span>workspace</span><span class="slashes">//</span><span>kit</span></a>
  <nav>${nav}</nav>
  <button class="theme-toggle" type="button" data-theme-toggle aria-label="Alternar tema">
    <span class="only-light">◐</span><span class="only-dark">◑</span>
  </button>
</header>
<main class="page">
${opts.body}
</main>
<footer class="footer">
  <p>Gerado por <code>workspace-kit report</code> a partir dos arquivos Markdown do repositório — não edite estes HTMLs à mão, edite o <code>.md</code> de origem e rode o comando de novo.</p>
  <p class="muted">${escapeHtml(opts.generatedAt)} · contagens de tokens são estimativas (caracteres ÷ 4), não contagem de tokenizer.</p>
</footer>
<script src="${up}assets/report.js"></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ *
 * Static assets
 * ------------------------------------------------------------------ */

const CSS = `/* workspace//kit reports — generated by core/report.js, do not edit by hand.
   Visual direction per DESIGN.md: neutral base, amber/teal accents, Inter for
   UI and JetBrains Mono for paths/metrics, dark and light equally first-class. */

:root {
  --bg: #fbfbfa;
  --bg-elev: #ffffff;
  --bg-sunken: #f4f4f2;
  --fg: #1c1c1a;
  --fg-muted: #6b6b66;
  --fg-subtle: #8f8f88;
  --border: #e4e4e0;
  --border-strong: #d2d2cc;
  --accent: #0f766e;
  --accent-soft: rgba(15, 118, 110, .1);
  --amber: #b45309;
  --amber-soft: rgba(180, 83, 9, .1);
  --ok: #15803d;
  --ok-soft: rgba(21, 128, 61, .1);
  --warn: #b45309;
  --warn-soft: rgba(180, 83, 9, .12);
  --danger: #b91c1c;
  --radius: 10px;
  --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #131313;
    --bg-elev: #1a1a19;
    --bg-sunken: #0f0f0f;
    --fg: #ececea;
    --fg-muted: #a1a19b;
    --fg-subtle: #77776f;
    --border: #2a2a28;
    --border-strong: #3a3a37;
    --accent: #2dd4bf;
    --accent-soft: rgba(45, 212, 191, .12);
    --amber: #f59e0b;
    --amber-soft: rgba(245, 158, 11, .12);
    --ok: #4ade80;
    --ok-soft: rgba(74, 222, 128, .12);
    --warn: #fbbf24;
    --warn-soft: rgba(251, 191, 36, .12);
    --danger: #f87171;
    color-scheme: dark;
  }
}

:root[data-theme="dark"] {
  --bg: #131313;
  --bg-elev: #1a1a19;
  --bg-sunken: #0f0f0f;
  --fg: #ececea;
  --fg-muted: #a1a19b;
  --fg-subtle: #77776f;
  --border: #2a2a28;
  --border-strong: #3a3a37;
  --accent: #2dd4bf;
  --accent-soft: rgba(45, 212, 191, .12);
  --amber: #f59e0b;
  --amber-soft: rgba(245, 158, 11, .12);
  --ok: #4ade80;
  --ok-soft: rgba(74, 222, 128, .12);
  --warn: #fbbf24;
  --warn-soft: rgba(251, 191, 36, .12);
  --danger: #f87171;
  color-scheme: dark;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}

/* ---- top bar ---- */
.topbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 24px;
  padding: 0 24px; height: 56px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}
.brand {
  font-family: var(--mono); font-weight: 500; font-size: 14px;
  color: var(--fg); text-decoration: none; letter-spacing: -.02em; white-space: nowrap;
}
.brand .slashes { color: var(--amber); }
.topbar nav { display: flex; gap: 4px; flex: 1; overflow-x: auto; }
.topbar nav a {
  padding: 5px 10px; border-radius: 7px; font-size: 13.5px; font-weight: 500;
  color: var(--fg-muted); text-decoration: none; white-space: nowrap;
}
.topbar nav a:hover { background: var(--bg-sunken); color: var(--fg); }
.topbar nav a.active { background: var(--accent-soft); color: var(--accent); }
.theme-toggle {
  border: 1px solid var(--border); background: var(--bg-elev); color: var(--fg-muted);
  width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 15px; line-height: 1;
}
.theme-toggle:hover { border-color: var(--border-strong); color: var(--fg); }
:root[data-theme="dark"] .only-light, :root[data-theme="light"] .only-dark { display: none; }
:root[data-theme="auto"] .only-dark { display: none; }

/* ---- layout ---- */
.page { max-width: 900px; margin: 0 auto; padding: 40px 24px 24px; }
.page.wide { max-width: 1120px; }
.footer {
  max-width: 900px; margin: 0 auto; padding: 32px 24px 56px;
  border-top: 1px solid var(--border); color: var(--fg-subtle); font-size: 12.5px;
}
.footer p { margin: 6px 0; }
.footer code { font-size: 11.5px; }

.page-head { margin-bottom: 28px; }
.page-head h1 { font-size: 30px; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 8px; }
.page-head .lead { color: var(--fg-muted); margin: 0; font-size: 15.5px; max-width: 66ch; }
.eyebrow {
  font-family: var(--mono); font-size: 11.5px; text-transform: uppercase;
  letter-spacing: .08em; color: var(--fg-subtle); margin: 0 0 10px;
}
.breadcrumb { font-size: 13px; color: var(--fg-muted); margin: 0 0 14px; }
.breadcrumb a { color: var(--fg-muted); }

/* ---- kpi row ---- */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 0 0 32px; }
.kpi { border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-elev); padding: 14px 16px; }
.kpi .n { font-family: var(--mono); font-size: 22px; font-weight: 500; letter-spacing: -.02em; display: block; }
.kpi .l { font-size: 12px; color: var(--fg-muted); }

/* ---- cards ---- */
.group { margin-bottom: 36px; }
.group > h2 { font-size: 17px; margin: 0 0 4px; letter-spacing: -.01em; }
.group > .hint { color: var(--fg-muted); font-size: 13.5px; margin: 0 0 14px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.card {
  display: block; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-elev); padding: 16px; text-decoration: none; color: inherit;
  transition: border-color .12s ease, transform .12s ease;
}
a.card:hover { border-color: var(--accent); transform: translateY(-1px); }
.card h3 { margin: 0 0 6px; font-size: 15px; letter-spacing: -.01em; }
.card p { margin: 0 0 12px; font-size: 13px; color: var(--fg-muted); }
.card .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.path { font-family: var(--mono); font-size: 11.5px; color: var(--fg-subtle); }

/* ---- chips ---- */
.chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11.5px; font-weight: 500; padding: 2px 8px; border-radius: 999px;
  border: 1px solid var(--border-strong); color: var(--fg-muted); background: var(--bg-sunken);
  white-space: nowrap;
}
.chip.ok { color: var(--ok); background: var(--ok-soft); border-color: transparent; }
.chip.warn { color: var(--warn); background: var(--warn-soft); border-color: transparent; }
.chip.accent { color: var(--accent); background: var(--accent-soft); border-color: transparent; }
.chip.muted { color: var(--fg-subtle); }
.chip .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.chip.mono { font-family: var(--mono); }

/* ---- filter ---- */
.filter { display: flex; gap: 8px; align-items: center; margin-bottom: 22px; flex-wrap: wrap; }
.filter input {
  flex: 1; min-width: 220px; padding: 8px 12px; font: inherit; font-size: 14px;
  border: 1px solid var(--border); border-radius: 8px; background: var(--bg-elev); color: var(--fg);
}
.filter input:focus { outline: 2px solid var(--accent-soft); border-color: var(--accent); }
.filter .count { font-size: 12.5px; color: var(--fg-subtle); font-family: var(--mono); }
[hidden] { display: none !important; }

/* ---- document body ---- */
.doc { max-width: 74ch; }
.doc h1 { font-size: 26px; margin: 36px 0 12px; letter-spacing: -.02em; }
.doc h2 { font-size: 19px; margin: 34px 0 10px; letter-spacing: -.01em; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.doc h3 { font-size: 16px; margin: 26px 0 8px; }
.doc h4, .doc h5, .doc h6 { font-size: 14px; margin: 20px 0 6px; color: var(--fg-muted); }
.doc p { margin: 0 0 14px; }
.doc ul, .doc ol { margin: 0 0 14px; padding-left: 22px; }
.doc li { margin-bottom: 6px; }
.doc li > ul, .doc li > ol { margin-top: 6px; }
.doc a { color: var(--accent); text-decoration: none; border-bottom: 1px solid var(--accent-soft); }
.doc a:hover { border-bottom-color: var(--accent); }
.doc code { font-family: var(--mono); font-size: .87em; background: var(--bg-sunken); border: 1px solid var(--border); border-radius: 5px; padding: 1px 5px; }
.doc pre.code { background: var(--bg-sunken); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; overflow-x: auto; font-size: 13px; }
.doc pre.code code { background: none; border: 0; padding: 0; font-size: inherit; }
.doc blockquote { margin: 0 0 14px; padding: 2px 0 2px 16px; border-left: 3px solid var(--border-strong); color: var(--fg-muted); }
.doc hr { border: 0; border-top: 1px solid var(--border); margin: 28px 0; }
.doc strong { font-weight: 600; }
.doc del { color: var(--fg-subtle); }
.doc .anchor { opacity: 0; margin-left: 8px; color: var(--fg-subtle); border: 0; font-weight: 400; }
.doc h1:hover .anchor, .doc h2:hover .anchor, .doc h3:hover .anchor { opacity: 1; }
.table-wrap { overflow-x: auto; margin: 0 0 16px; }
.doc table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
.doc th, .doc td { border: 1px solid var(--border); padding: 7px 10px; text-align: left; vertical-align: top; }
.doc th { background: var(--bg-sunken); font-weight: 600; }
.doc ul.tasklist { list-style: none; padding-left: 0; }
.doc li.task { display: flex; gap: 9px; align-items: flex-start; }
.doc li.task .check {
  flex: none; width: 16px; height: 16px; margin-top: 4px; border-radius: 4px;
  border: 1px solid var(--border-strong); font-size: 11px; line-height: 14px; text-align: center;
}
.doc li.task.done .check { background: var(--ok-soft); border-color: transparent; color: var(--ok); }
.doc li.task.done > span:last-child { color: var(--fg-muted); }

/* ---- table of contents ---- */
.toc { border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-elev); padding: 14px 18px; margin: 0 0 28px; }
.toc h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--fg-subtle); margin: 0 0 8px; font-family: var(--mono); font-weight: 500; }
.toc ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 24px; }
.toc li { margin: 0 0 4px; break-inside: avoid; font-size: 13.5px; }
.toc li.lvl3 { padding-left: 14px; font-size: 12.5px; }
.toc a { color: var(--fg-muted); text-decoration: none; }
.toc a:hover { color: var(--accent); }
@media (max-width: 640px) { .toc ul { columns: 1; } }

/* ---- timeline ---- */
.timeline { border-left: 2px solid var(--border); margin-left: 8px; padding-left: 0; }
.tl-item { position: relative; padding: 0 0 8px 26px; }
.tl-item::before {
  content: ''; position: absolute; left: -7px; top: 20px;
  width: 12px; height: 12px; border-radius: 50%; background: var(--bg); border: 2px solid var(--accent);
}
.tl-item.archived::before { border-color: var(--border-strong); }
.tl-item > details { border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-elev); margin: 10px 0; }
.tl-item > details > summary { cursor: pointer; padding: 13px 16px; list-style: none; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.tl-item > details > summary::-webkit-details-marker { display: none; }
.tl-item > details[open] > summary { border-bottom: 1px solid var(--border); }
.tl-item .date { font-family: var(--mono); font-size: 12px; color: var(--fg-subtle); }
.tl-item .t { font-weight: 600; font-size: 14.5px; flex: 1; min-width: 200px; }
.tl-body { padding: 4px 18px 8px; }

/* ---- board ---- */
.board { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
.column { border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-elev); padding: 16px; }
.column > h2 { font-size: 14px; margin: 0 0 3px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.column > .sub { font-size: 12px; color: var(--fg-subtle); margin: 0 0 12px; }
.bar { height: 4px; border-radius: 999px; background: var(--bg-sunken); overflow: hidden; margin: 0 0 14px; }
.bar > span { display: block; height: 100%; background: var(--ok); }
.item { border-top: 1px solid var(--border); padding: 11px 0; font-size: 13.5px; display: flex; gap: 9px; align-items: flex-start; }
.item:first-of-type { border-top: 0; }
.item .check { flex: none; width: 15px; height: 15px; margin-top: 3px; border-radius: 4px; border: 1px solid var(--border-strong); font-size: 10px; line-height: 13px; text-align: center; }
.item.done .check { background: var(--ok-soft); border-color: transparent; color: var(--ok); }
.item.done .txt { color: var(--fg-muted); }
.item code { font-family: var(--mono); font-size: 11.5px; background: var(--bg-sunken); border-radius: 4px; padding: 1px 4px; }
.item a { color: var(--accent); text-decoration: none; }

/* ---- session entries ---- */
.session { border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-elev); padding: 16px 18px; margin: 0 0 12px; }
.session > header { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; margin-bottom: 8px; }
.session .tool { font-weight: 600; font-size: 14.5px; }

@media print {
  .topbar, .theme-toggle, .filter { display: none; }
  .page { max-width: none; }
  .card, .column, .session, details { break-inside: avoid; }
  details { border: 0; }
  details > div { display: block !important; }
}
`;

const JS = `/* workspace//kit reports — generated by core/report.js. */
(function () {
  var root = document.documentElement;
  var KEY = 'wk-report-theme';
  try {
    var saved = localStorage.getItem(KEY);
    if (saved) root.setAttribute('data-theme', saved);
  } catch (e) {}

  var btn = document.querySelector('[data-theme-toggle]');
  if (btn) {
    btn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      if (current === 'auto') {
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        current = prefersDark ? 'dark' : 'light';
      }
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
    });
  }

  var input = document.querySelector('[data-filter]');
  if (input) {
    var targets = [].slice.call(document.querySelectorAll('[data-searchable]'));
    var counter = document.querySelector('[data-filter-count]');
    var groups = [].slice.call(document.querySelectorAll('[data-filter-group]'));
    var render = function () {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      targets.forEach(function (el) {
        var hit = !q || el.getAttribute('data-searchable').indexOf(q) !== -1;
        el.hidden = !hit;
        if (hit) shown++;
      });
      groups.forEach(function (g) {
        var any = [].slice.call(g.querySelectorAll('[data-searchable]')).some(function (el) { return !el.hidden; });
        g.hidden = !any;
      });
      if (counter) counter.textContent = shown + ' de ' + targets.length;
    };
    input.addEventListener('input', render);
    render();
  }

  var expand = document.querySelector('[data-expand-all]');
  if (expand) {
    expand.addEventListener('click', function () {
      var items = [].slice.call(document.querySelectorAll('main details'));
      var anyClosed = items.some(function (d) { return !d.open; });
      items.forEach(function (d) { d.open = anyClosed; });
      expand.textContent = anyClosed ? 'Recolher tudo' : 'Expandir tudo';
    });
  }
})();
`;

/* ------------------------------------------------------------------ *
 * Page builders
 * ------------------------------------------------------------------ */

function chip(text, tone, mono) {
  return `<span class="chip${tone ? ' ' + tone : ''}${mono ? ' mono' : ''}">${escapeHtml(text)}</span>`;
}

function outputPathFor(rel) {
  const base = rel.replace(/\.md$/i, '');
  const flat = base.split('/').slice(-1)[0];
  const prefix = rel.startsWith('docs/specs/') ? 'spec-' : '';
  return 'plans/' + prefix + slugify(flat) + '.html';
}

function buildDocPage(doc, rendered, generatedAt) {
  const toc = rendered.headings
    .filter((h) => h.level === 2 || h.level === 3)
    .map((h) => `<li class="lvl${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
    .join('');

  const meta = [
    doc.status ? chip(doc.status, statusTone(doc.status)) : '',
    chip(doc.rel, 'mono muted', true),
    chip(formatNumber(doc.lines) + ' linhas', 'muted'),
    chip('~' + formatNumber(doc.tokens) + ' tokens', 'muted'),
    ...doc.issues.map((n) => `<a class="chip accent" href="https://github.com/atempel/workspace-kit/issues/${n}" target="_blank" rel="noopener">#${n}</a>`),
  ]
    .filter(Boolean)
    .join(' ');

  const body = `
<p class="breadcrumb"><a href="index.html">← Planos &amp; specs</a></p>
<div class="page-head">
  <h1>${escapeHtml(doc.title)}</h1>
  <div class="meta card-meta">${meta}</div>
</div>
${toc ? `<nav class="toc"><h2>Nesta página</h2><ul>${toc}</ul></nav>` : ''}
<article class="doc">
${rendered.html}
</article>`;

  return shell({
    title: doc.title,
    body,
    depth: 1,
    active: 'plans/index.html',
    generatedAt,
  });
}

function buildPlansIndex(groups, pageIndex, generatedAt) {
  const total = groups.reduce((n, g) => n + g.docs.length, 0);
  const sections = groups
    .map((group) => {
      const cards = group.docs
        .map((doc) => {
          const href = path.posix.relative('plans', pageIndex[doc.rel]);
          const searchable = escapeHtml(
            (doc.title + ' ' + doc.rel + ' ' + (doc.status || '') + ' ' + doc.summary).toLowerCase()
          );
          const chips = [
            doc.status ? chip(doc.status, statusTone(doc.status)) : '',
            chip(doc.rel, 'mono muted', true),
            ...doc.issues.slice(0, 2).map((n) => chip('#' + n, 'accent')),
          ]
            .filter(Boolean)
            .join(' ');
          return `<a class="card" href="${href}" data-searchable="${searchable}">
  <h3>${escapeHtml(doc.title)}</h3>
  <p>${escapeHtml(doc.summary || 'Sem resumo — abra o documento.')}</p>
  <div class="meta">${chips}</div>
</a>`;
        })
        .join('\n');
      return `<section class="group" data-filter-group>
  <h2>${escapeHtml(group.label)}</h2>
  <p class="hint">${escapeHtml(group.hint)}</p>
  <div class="cards">${cards}</div>
</section>`;
    })
    .join('\n');

  const body = `
<div class="page-head">
  <p class="eyebrow">Relatório</p>
  <h1>Planos &amp; specs</h1>
  <p class="lead">Todo documento de planejamento do repositório, renderizado a partir do Markdown de origem. Os links internos entre documentos continuam funcionando aqui.</p>
</div>
<div class="filter">
  <input type="search" placeholder="Filtrar por título, caminho ou status…" data-filter aria-label="Filtrar documentos">
  <span class="count" data-filter-count>${total} de ${total}</span>
</div>
${sections}`;

  return shell({ title: 'Planos & specs', body, depth: 1, active: 'plans/index.html', generatedAt });
}

function buildHome(data, generatedAt) {
  const { groups, pageIndex, tasks, decisions, sessions } = data;
  const totalDocs = groups.reduce((n, g) => n + g.docs.length, 0);
  const allItems = tasks.reduce((acc, s) => acc.concat(s.items), []);
  const openItems = allItems.filter((i) => !i.done).length;
  const decisionCount = decisions.dated.length + decisions.undated.length;

  const kpis = [
    ['Documentos', totalDocs],
    ['Specs de feature', (groups.find((g) => g.id === 'specs') || { docs: [] }).docs.length],
    ['Decisões registradas', decisionCount],
    ['Tarefas abertas', openItems],
    ['Tarefas concluídas', allItems.length - openItems],
    ['Sessões registradas', sessions.length],
  ]
    .map(([label, n]) => `<div class="kpi"><span class="n">${formatNumber(n)}</span><span class="l">${label}</span></div>`)
    .join('');

  const specGroup = groups.find((g) => g.id === 'specs') || { docs: [] };
  const specRows = specGroup.docs
    .map((doc) => {
      const href = pageIndex[doc.rel];
      const chips = [
        doc.status ? chip(doc.status, statusTone(doc.status)) : chip('sem status', 'muted'),
        ...doc.issues.slice(0, 1).map((n) => chip('#' + n, 'accent')),
      ].join(' ');
      return `<a class="card" href="${href}">
  <h3>${escapeHtml(doc.title.replace(/^Spec\s*[—–-]\s*/, ''))}</h3>
  <p>${escapeHtml(doc.summary)}</p>
  <div class="meta">${chips}</div>
</a>`;
    })
    .join('\n');

  const recentDecisions = decisions.dated
    .slice(0, 5)
    .map(
      (d) =>
        `<div class="item"><span class="txt"><span class="path">${escapeHtml(d.date)}</span> — ${escapeHtml(
          d.title
        )}</span></div>`
    )
    .join('');

  const recentSessions = sessions
    .slice(0, 4)
    .map(
      (s) =>
        `<div class="item"><span class="txt"><span class="path">${escapeHtml(
          s.date || '—'
        )}</span> — ${escapeHtml(s.tool)}</span></div>`
    )
    .join('');

  const body = `
<div class="page-head">
  <p class="eyebrow">workspace//kit · relatórios</p>
  <h1>Painel do projeto</h1>
  <p class="lead">Uma leitura navegável do estado do repositório — planos, specs, decisões, tarefas e sessões — gerada direto dos arquivos Markdown versionados. Nada aqui é fonte da verdade: os <code>.md</code> são.</p>
</div>
<div class="kpis">${kpis}</div>

<section class="group">
  <h2>Specs de features</h2>
  <p class="hint">Uma por feature. O status é o que a própria spec declara na sua linha <code>Status:</code>.</p>
  <div class="cards">${specRows}</div>
</section>

<section class="group">
  <h2>Atalhos</h2>
  <div class="cards">
    <a class="card" href="plans/index.html"><h3>Planos &amp; specs →</h3><p>Todos os documentos de planejamento, com filtro por título, caminho e status.</p></a>
    <a class="card" href="decisions.html"><h3>Linha do tempo de decisões →</h3><p>${decisionCount} decisões, das mais recentes às arquivadas em <code>decisions/</code>.</p></a>
    <a class="card" href="tasks.html"><h3>Board de tarefas →</h3><p>${openItems} abertas e ${allItems.length - openItems} concluídas, agrupadas por frente de trabalho.</p></a>
    <a class="card" href="sessions.html"><h3>Log de sessões →</h3><p>Quem tocou no workspace, em qual ferramenta e em que estado deixou.</p></a>
  </div>
</section>

<div class="board">
  <section class="column">
    <h2>Decisões recentes <span class="chip muted">últimas 5</span></h2>
    <p class="sub">De <code>DECISIONS.md</code></p>
    ${recentDecisions || '<p class="sub">Nada registrado.</p>'}
  </section>
  <section class="column">
    <h2>Sessões recentes <span class="chip muted">últimas 4</span></h2>
    <p class="sub">De <code>SESSIONS.md</code></p>
    ${recentSessions || '<p class="sub">Nada registrado.</p>'}
  </section>
</div>`;

  return shell({ title: 'Painel', body, depth: 0, active: 'index.html', generatedAt });
}

function buildTasksPage(tasks, resolveLink, generatedAt) {
  const columns = tasks
    .map((section) => {
      const done = section.items.filter((i) => i.done).length;
      const pct = section.items.length ? Math.round((done / section.items.length) * 100) : 0;
      const items = section.items
        .slice()
        .sort((a, b) => Number(a.done) - Number(b.done))
        .map(
          (item) =>
            `<div class="item${item.done ? ' done' : ''}"><span class="check">${
              item.done ? '&#10003;' : ''
            }</span><span class="txt">${renderInline(item.text, resolveLink)}</span></div>`
        )
        .join('');
      const searchable = escapeHtml(
        (section.title + ' ' + (section.meta || '') + ' ' + section.items.map((i) => i.text).join(' ')).toLowerCase()
      );
      return `<section class="column" data-searchable="${searchable}">
  <h2><span>${escapeHtml(section.title)}</span><span class="chip ${done === section.items.length ? 'ok' : 'muted'}">${done}/${section.items.length}</span></h2>
  <p class="sub">${escapeHtml(section.meta || '—')}</p>
  <div class="bar"><span style="width:${pct}%"></span></div>
  ${items}
</section>`;
    })
    .join('\n');

  const total = tasks.reduce((n, s) => n + s.items.length, 0);
  const done = tasks.reduce((n, s) => n + s.items.filter((i) => i.done).length, 0);

  const body = `
<div class="page-head">
  <p class="eyebrow">Relatório</p>
  <h1>Board de tarefas</h1>
  <p class="lead">Cada coluna é uma frente de trabalho de <code>TASKS.md</code>. O arquivo é um índice: os requisitos detalhados vivem nas specs, ligadas aqui pelos próprios links do texto.</p>
</div>
<div class="kpis">
  <div class="kpi"><span class="n">${total}</span><span class="l">Itens no total</span></div>
  <div class="kpi"><span class="n">${total - done}</span><span class="l">Em aberto</span></div>
  <div class="kpi"><span class="n">${done}</span><span class="l">Concluídos</span></div>
  <div class="kpi"><span class="n">${tasks.length}</span><span class="l">Frentes de trabalho</span></div>
</div>
<div class="filter">
  <input type="search" placeholder="Filtrar frentes de trabalho…" data-filter aria-label="Filtrar tarefas">
  <span class="count" data-filter-count></span>
</div>
<div class="board doc">${columns}</div>`;

  return shell({ title: 'Board de tarefas', body, depth: 0, active: 'tasks.html', generatedAt, wide: true });
}

function buildDecisionsPage(decisions, resolveLink, generatedAt) {
  const all = decisions.dated.concat(decisions.undated);
  const items = all
    .map((entry) => {
      const rendered = renderMarkdown(entry.body.join('\n'), { resolveLink, headingOffset: 1 });
      const searchable = escapeHtml((entry.title + ' ' + (entry.date || '') + ' ' + entry.body.join(' ')).toLowerCase());
      return `<div class="tl-item${entry.archived ? ' archived' : ''}" data-searchable="${searchable}">
  <details>
    <summary>
      <span class="date">${escapeHtml(entry.date || '—')}</span>
      <span class="t">${escapeHtml(entry.title)}</span>
      ${entry.archived ? chip('arquivada', 'muted') : chip('DECISIONS.md', 'accent')}
    </summary>
    <div class="tl-body doc">${rendered.html}</div>
  </details>
</div>`;
    })
    .join('\n');

  const body = `
<div class="page-head">
  <p class="eyebrow">Relatório</p>
  <h1>Linha do tempo de decisões</h1>
  <p class="lead">O que foi decidido, por quê e o que foi descartado — de <code>DECISIONS.md</code> e das entradas rotacionadas para <code>decisions/</code> pela política ADR. Mais recentes primeiro.</p>
</div>
<div class="kpis">
  <div class="kpi"><span class="n">${all.length}</span><span class="l">Decisões</span></div>
  <div class="kpi"><span class="n">${decisions.dated.filter((d) => !d.archived).length}</span><span class="l">Ativas em DECISIONS.md</span></div>
  <div class="kpi"><span class="n">${all.filter((d) => d.archived).length}</span><span class="l">Arquivadas em decisions/</span></div>
</div>
<div class="filter">
  <input type="search" placeholder="Filtrar por data, título ou conteúdo…" data-filter aria-label="Filtrar decisões">
  <span class="count" data-filter-count></span>
  <button class="chip" type="button" data-expand-all>Expandir tudo</button>
</div>
<div class="timeline">${items}</div>`;

  return shell({ title: 'Decisões', body, depth: 0, active: 'decisions.html', generatedAt });
}

function buildSessionsPage(sessions, resolveLink, generatedAt) {
  const cards = sessions
    .map((entry) => {
      const rendered = renderMarkdown(entry.body.join('\n'), { resolveLink, headingOffset: 2 });
      const searchable = escapeHtml(((entry.date || '') + ' ' + entry.tool + ' ' + entry.body.join(' ')).toLowerCase());
      return `<article class="session doc" data-searchable="${searchable}">
  <header>
    <span class="path">${escapeHtml(entry.date || '—')}</span>
    <span class="tool">${escapeHtml(entry.tool)}</span>
  </header>
  ${rendered.html}
</article>`;
    })
    .join('\n');

  const body = `
<div class="page-head">
  <p class="eyebrow">Relatório</p>
  <h1>Log de sessões</h1>
  <p class="lead">Registro de hand-off entre ferramentas, de <code>SESSIONS.md</code>: quem tocou no workspace, em qual superfície e em que estado deixou. Não é histórico narrativo — o <em>porquê</em> mora em Decisões.</p>
</div>
<div class="filter">
  <input type="search" placeholder="Filtrar por data, ferramenta ou conteúdo…" data-filter aria-label="Filtrar sessões">
  <span class="count" data-filter-count></span>
</div>
${cards || '<p>Nenhuma sessão registrada ainda.</p>'}`;

  return shell({ title: 'Sessões', body, depth: 0, active: 'sessions.html', generatedAt });
}

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function build(root, outDir, options) {
  const opts = options || {};
  const target = outDir || path.join(root, 'reports');
  const generatedAt =
    'Gerado em ' +
    new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });

  const groups = collectDocs(root);
  const pageIndex = Object.create(null);
  for (const group of groups) {
    for (const doc of group.docs) pageIndex[doc.rel] = outputPathFor(doc.rel);
  }

  const written = [];
  const write = (rel, content) => {
    const abs = path.join(target, rel.split('/').join(path.sep));
    ensureDir(path.dirname(abs));
    fs.writeFileSync(abs, content, 'utf8');
    written.push(rel);
  };

  write('assets/report.css', CSS);
  write('assets/report.js', JS);

  for (const group of groups) {
    for (const doc of group.docs) {
      const raw = readIfExists(root, doc.rel);
      const outRel = pageIndex[doc.rel];
      const resolveLink = makeLinkResolver(doc.rel, outRel, pageIndex);
      // Drop the leading H1 -- the page head already shows the title.
      const bodyMd = raw.replace(/^#\s+.*\n/, '');
      const rendered = renderMarkdown(bodyMd, { resolveLink, headingOffset: 0 });
      write(outRel, buildDocPage(doc, rendered, generatedAt));
    }
  }

  write('plans/index.html', buildPlansIndex(groups, pageIndex, generatedAt));

  const tasks = parseTasks(readIfExists(root, 'TASKS.md'));
  const decisions = parseDecisions(root);
  const sessions = parseSessions(readIfExists(root, 'SESSIONS.md'));

  const rootResolver = makeLinkResolver('TASKS.md', 'tasks.html', pageIndex);
  write('tasks.html', buildTasksPage(tasks, rootResolver, generatedAt));
  write('decisions.html', buildDecisionsPage(decisions, makeLinkResolver('DECISIONS.md', 'decisions.html', pageIndex), generatedAt));
  write('sessions.html', buildSessionsPage(sessions, makeLinkResolver('SESSIONS.md', 'sessions.html', pageIndex), generatedAt));
  write('index.html', buildHome({ groups, pageIndex, tasks, decisions, sessions }, generatedAt));

  if (!opts.quiet) {
    // caller decides what to print
  }

  return {
    outDir: target,
    files: written,
    counts: {
      documents: groups.reduce((n, g) => n + g.docs.length, 0),
      decisions: decisions.dated.length + decisions.undated.length,
      tasks: tasks.reduce((n, s) => n + s.items.length, 0),
      sessions: sessions.length,
    },
  };
}

module.exports = {
  build,
  renderMarkdown,
  renderInline,
  collectDocs,
  parseTasks,
  parseDecisions,
  parseSessions,
  makeLinkResolver,
  outputPathFor,
  escapeHtml,
  slugify,
};

if (require.main === module) {
  const dir = process.argv[2] || process.cwd();
  const result = build(path.resolve(dir));
  console.log(`${result.files.length} arquivos escritos em ${posix(result.outDir)}`);
}
