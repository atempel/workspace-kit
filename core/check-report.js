/**
 * Zero-dependency test for core/report.js.
 *
 * The report layer's contract is narrow and worth pinning: it renders, it never
 * edits a source document, and the HTML it emits has to be escaped correctly and
 * internally linked. Each case names the property it guards, so a failure says
 * what broke rather than which line moved.
 *
 * Run with `npm run test:report`.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const report = require('./report.js');

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

/** A miniature workspace shaped like the real repo's document layout. */
function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-report-'));
  const write = function (rel, body) {
    const abs = path.join(root, rel.split('/').join(path.sep));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf8');
  };

  write('docs/PRD.md', [
    '# PRD — test',
    '',
    'The problem, stated once.',
    '',
    '## Scope',
    '- One bullet with `code` and **bold**.',
    '- A link to [the spec](specs/thing.md).',
  ].join('\n'));

  write('docs/specs/thing.md', [
    '# Spec — Thing',
    '',
    'Status: draft, pending review. Source: a voice note.',
    '',
    'One-line summary of the thing.',
    '',
    '## Requirements',
    '',
    '**Must-Have (P0)**',
    '- It works.',
    '  - Acceptance: it demonstrably works.',
    '',
    '| Column | Other |',
    '| --- | --- |',
    '| a | b |',
    '',
    '```js',
    'const danger = "<script>alert(1)</script>";',
    '```',
    '',
    'Back to [the PRD](../PRD.md) and to [an issue](https://example.test/1).',
  ].join('\n'));

  write('TASKS.md', [
    '# Tasks',
    '',
    '## Next',
    '- [ ] An open task',
    '- [x] ~~A finished task~~ — done today.',
    '',
    '### Thing (planning — 2026-01-01)',
    '- [ ] Spec it, see `docs/specs/thing.md`',
  ].join('\n'));

  write('DECISIONS.md', [
    '# Decisions',
    '',
    '## 2026-01-02 — Second decision',
    '- **Decision:** the later one.',
    '',
    '## 2026-01-01 — First decision',
    '- **Decision:** the earlier one, mentioning <angle brackets> & an ampersand.',
  ].join('\n'));

  write('decisions/001-archived.md', [
    '# An archived decision',
    '',
    'Made 2025-12-01, rotated out per the ADR policy.',
  ].join('\n'));

  write('SESSIONS.md', [
    '# Sessions',
    '',
    '## Entries',
    '',
    '### 2026-01-01 — Cowork',
    '**Did:** the first thing.',
    '**Left at:** a known state.',
    '',
    '### 2026-01-02 — Claude Code',
    '**Did:** the second thing.',
    '**Left at:** another known state.',
  ].join('\n'));

  return root;
}

function buildInto(root) {
  const out = path.join(root, 'reports');
  const result = report.build(root, out);
  const read = function (rel) {
    return fs.readFileSync(path.join(out, rel.split('/').join(path.sep)), 'utf8');
  };
  return { out: out, result: result, read: read };
}

// ---------------------------------------------------------------------------

test('R1  every discovered document gets a page, plus the five index pages', function () {
  const { result, out } = buildInto(makeWorkspace());
  ['index.html', 'plans/index.html', 'decisions.html', 'tasks.html', 'sessions.html',
    'assets/report.css', 'assets/report.js', 'plans/prd.html', 'plans/spec-thing.html']
    .forEach(function (rel) {
      assert.ok(
        fs.existsSync(path.join(out, rel.split('/').join(path.sep))),
        'missing generated file: ' + rel
      );
    });
  assert.strictEqual(result.counts.documents, 2);
});

test('R2  rendering never touches a source document', function () {
  const root = makeWorkspace();
  const before = {};
  ['docs/PRD.md', 'docs/specs/thing.md', 'TASKS.md', 'DECISIONS.md', 'SESSIONS.md']
    .forEach(function (rel) {
      const abs = path.join(root, rel.split('/').join(path.sep));
      before[rel] = fs.readFileSync(abs, 'utf8');
    });
  buildInto(root);
  Object.keys(before).forEach(function (rel) {
    const abs = path.join(root, rel.split('/').join(path.sep));
    assert.strictEqual(fs.readFileSync(abs, 'utf8'), before[rel], rel + ' was modified');
  });
});

test('R3  HTML in source content is escaped, never executed', function () {
  const { read } = buildInto(makeWorkspace());
  const page = read('plans/spec-thing.html');
  assert.ok(page.indexOf('&lt;script&gt;alert(1)&lt;/script&gt;') !== -1, 'code fence not escaped');
  assert.ok(page.indexOf('<script>alert(1)</script>') === -1, 'raw script tag leaked into the page');
  const decisions = read('decisions.html');
  assert.ok(decisions.indexOf('&lt;angle brackets&gt;') !== -1, 'angle brackets not escaped');
  assert.ok(decisions.indexOf('brackets&gt; &amp; an ampersand') !== -1, 'ampersand not escaped');
});

test('R4  markdown constructs render as real elements', function () {
  const { read } = buildInto(makeWorkspace());
  const page = read('plans/spec-thing.html');
  assert.match(page, /<table>/, 'table not rendered');
  assert.match(page, /<pre class="code"/, 'code fence not rendered');
  assert.match(page, /<h2 id="requirements"/, 'heading not rendered with an id');
  assert.match(page, /<strong>Must-Have \(P0\)<\/strong>/, 'bold not rendered');
  assert.match(read('plans/prd.html'), /<code>code<\/code>/, 'inline code not rendered');
});

test('R5  cross-document links point at the rendered page, external links stay put', function () {
  const { read } = buildInto(makeWorkspace());
  assert.match(read('plans/prd.html'), /href="spec-thing\.html"/, 'PRD → spec link not rewritten');
  assert.match(read('plans/spec-thing.html'), /href="prd\.html"/, 'spec → PRD link not rewritten');
  assert.match(
    read('plans/spec-thing.html'),
    /href="https:\/\/example\.test\/1" target="_blank"/,
    'external link altered'
  );
});

test('R6  no generated link is broken', function () {
  const { out } = buildInto(makeWorkspace());
  const pages = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach(function (name) {
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else if (/\.html$/.test(name)) pages.push(abs);
    });
  })(out);

  const broken = [];
  pages.forEach(function (page) {
    const html = fs.readFileSync(page, 'utf8');
    const re = /href="([^"]+)"|src="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const href = m[1] || m[2];
      if (/^(https?:|mailto:|data:|#)/.test(href)) continue;
      const target = href.split('#')[0];
      if (!target) continue;
      const abs = path.resolve(path.dirname(page), target.split('/').join(path.sep));
      if (!fs.existsSync(abs)) broken.push(path.basename(page) + ' → ' + href);
    }
  });
  assert.deepStrictEqual(broken, [], 'broken links: ' + broken.join(', '));
});

test('R7  TASKS.md parses into sections with correct done/open counts', function () {
  const root = makeWorkspace();
  const sections = report.parseTasks(fs.readFileSync(path.join(root, 'TASKS.md'), 'utf8'));
  assert.strictEqual(sections.length, 2, 'expected two sections with items');
  assert.strictEqual(sections[0].title, 'Next');
  assert.strictEqual(sections[0].items.length, 2);
  assert.strictEqual(sections[0].items.filter(function (i) { return i.done; }).length, 1);
  assert.strictEqual(sections[1].title, 'Thing');
  assert.strictEqual(sections[1].meta, 'planning — 2026-01-01');
});

test('R8  decisions come back newest-first, with archived ADRs included', function () {
  const root = makeWorkspace();
  const decisions = report.parseDecisions(root);
  const dates = decisions.dated.map(function (d) { return d.date; });
  const sorted = dates.slice().sort().reverse();
  assert.deepStrictEqual(dates, sorted, 'not sorted newest-first');
  assert.ok(
    decisions.dated.some(function (d) { return d.archived; }),
    'archived decisions/ entries not picked up'
  );
});

test('R9  sessions come back newest-first', function () {
  const root = makeWorkspace();
  const sessions = report.parseSessions(fs.readFileSync(path.join(root, 'SESSIONS.md'), 'utf8'));
  assert.strictEqual(sessions.length, 2);
  assert.strictEqual(sessions[0].date, '2026-01-02', 'newest session is not first');
  assert.strictEqual(sessions[0].tool, 'Claude Code');
});

test('R10  a rebuild is deterministic apart from the generation timestamp', function () {
  const root = makeWorkspace();
  const first = buildInto(root).read('plans/spec-thing.html');
  const second = buildInto(root).read('plans/spec-thing.html');
  const strip = function (html) { return html.replace(/Gerado em [^<]*/g, 'Gerado em X'); };
  assert.strictEqual(strip(first), strip(second), 'output changed between identical runs');
});

test('R11  token figures are labelled as estimates, never as counts', function () {
  const { read } = buildInto(makeWorkspace());
  assert.match(read('plans/prd.html'), /estimativas \(caracteres ÷ 4\)/);
  assert.match(read('plans/prd.html'), /~[\d.]+ tokens/);
});

// ---------------------------------------------------------------------------

let failures = 0;
tests.forEach(function (t) {
  try {
    t.fn();
    console.log('PASS  ' + t.name);
  } catch (err) {
    failures++;
    console.log('FAIL  ' + t.name);
    console.log('      ' + (err && err.message ? String(err.message).split('\n')[0] : err));
  }
});

if (failures) {
  console.log('\n' + failures + ' of ' + tests.length + ' report test(s) failed.');
  process.exit(1);
} else {
  console.log('\nAll ' + tests.length + ' report test(s) passed.');
}
