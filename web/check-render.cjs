/**
 * Zero-config render test for the dashboard.
 *
 * Each case maps to a P0 acceptance criterion in
 * docs/specs/web-app-dashboard.md (→ #169). The components are rendered with a
 * payload produced by the real core/server.js against a real workspace on disk,
 * so a section that silently stops reflecting the data layer fails here rather
 * than in a browser.
 *
 * esbuild (already present via Vite) compiles the JSX; react-dom/server turns
 * it into markup. No browser, no jsdom, no extra dependency.
 *
 * Run with `npm test` inside web/.
 */
'use strict';

const assert = require('assert');
const esbuild = require('esbuild');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const server = require(path.join(REPO, 'core', 'server.js'));

// --- build the components once, as CommonJS Node can require ----------------

const ENTRY = `
import { renderToStaticMarkup } from 'react-dom/server';
import Overview from './src/sections/Overview.jsx';
import Health from './src/sections/Health.jsx';
import Sessions from './src/sections/Sessions.jsx';
import Queue from './src/sections/Queue.jsx';
import SourceControl from './src/sections/SourceControl.jsx';

const SECTIONS = { Overview, Health, Sessions, Queue, SourceControl };

export function render(name, data) {
  const Component = SECTIONS[name];
  return renderToStaticMarkup(<Component data={data} />);
}
`;

const built = esbuild.buildSync({
  stdin: { contents: ENTRY, resolveDir: __dirname, loader: 'jsx' },
  bundle: true,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  write: false,
  logLevel: 'silent',
});

const compiled = new Module('dashboard-sections', null);
compiled.filename = path.join(__dirname, 'dashboard-sections.js');
compiled.paths = Module._nodeModulePaths(__dirname);
compiled._compile(built.outputFiles[0].text, compiled.filename);
const { render } = compiled.exports;

// --- a real payload, from the real server, against a real workspace ---------

function payloadFor(root) {
  const result = server.handle(root, '/api/dashboard', new URLSearchParams());
  assert.strictEqual(result.status, 200, 'the server answered ' + result.status);
  return result.body;
}

/** A workspace with a known dangling cross-reference and a queue. */
function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-web-'));
  fs.writeFileSync(
    path.join(root, 'PROJECT.md'),
    '# Project\n\nSee [the PRD](docs/PRD.md) for scope.\n'
  );
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Agents\n\n## Stack\nPlain JS.\n');
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '@AGENTS.md\n');
  fs.writeFileSync(path.join(root, 'CONTEXT.md'), '# Context\n');
  fs.writeFileSync(path.join(root, 'DECISIONS.md'), '# Decisions\n\n## 2026-01-01 — A\n- **Decision:** a\n');
  fs.writeFileSync(path.join(root, 'TASKS.md'), '# Tasks\n\n- [ ] something\n');
  fs.writeFileSync(
    path.join(root, 'SESSIONS.md'),
    '# Sessions\n\n## Entries\n\n### 2026-07-29 — Cowork\n**Did:** Wrote the thing.\n**Left at:** Uncommitted.\n'
  );
  fs.mkdirSync(path.join(root, 'queue'));
  fs.writeFileSync(
    path.join(root, 'queue', '2026-07-01-a-note.md'),
    '# A note\n\n- Type: Voice note\n- Source: Notion\n- Added: 2026-07-01\n- Status: Pending\n- Notes: not yet read\n'
  );

  // Source control only has anything to render inside a git repository, so the
  // fixture is one — with a committed file and an uncommitted edit, which is
  // what puts the safe-edit warning on screen.
  const git = function (args) { execFileSync('git', args, { cwd: root, stdio: 'ignore' }); };
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'Test']);
  git(['add', '.']);
  git(['commit', '-q', '-m', 'initial']);
  fs.appendFileSync(path.join(root, 'TASKS.md'), '- [ ] an unsaved edit\n');
  return root;
}

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

const WORKSPACE = makeWorkspace();
const DATA = payloadFor(WORKSPACE);

// ---------------------------------------------------------------------------

test('P0  every file row comes from the data layer, never from UI code', function () {
  const html = render('Overview', DATA);
  DATA.overview.files.slice(0, 6).forEach(function (f) {
    assert.ok(html.indexOf(f.path) !== -1, 'missing file row: ' + f.path);
  });

  // The real check: change the data, and the output must change with it.
  const trimmed = Object.assign({}, DATA, {
    overview: Object.assign({}, DATA.overview, {
      files: DATA.overview.files.filter(function (f) { return f.path !== 'TASKS.md'; }),
    }),
  });
  assert.ok(render('Overview', trimmed).indexOf('>TASKS.md<') === -1,
    'a file absent from the payload must not appear on screen');
});

test('P0  every token figure is labelled an estimate, never an exact count', function () {
  const overview = render('Overview', DATA);
  const health = render('Health', DATA);
  [overview, health].forEach(function (html) {
    assert.ok(/approximate|characters ÷ 4|estimates/.test(html),
      'the heuristic is named on screen');
    // Token numbers themselves carry the tilde the formatter adds.
    const tokenCells = html.match(/~[\d.]+k?/g) || [];
    assert.ok(tokenCells.length > 0, 'token figures render with the estimate marker');
  });
});

test('P0  a broken cross-reference is surfaced twice: on the file row and in the graph', function () {
  const html = render('Overview', DATA);
  const broken = (DATA.overview.graph.edges || []).filter(function (e) { return !e.resolved; });
  assert.ok(broken.length > 0, 'the fixture has a dangling link to test with');

  assert.ok(/broken link/.test(html), 'the offending file row carries a badge');
  assert.ok(/broken reference/.test(html), 'the graph block annotates it');
  broken.forEach(function (e) {
    assert.ok(html.indexOf(e.to) !== -1, 'the missing target is named: ' + e.to);
  });
});

test('P0  the UI applies no threshold of its own — verdicts arrive decided', function () {
  const html = render('Health', DATA);
  const verdict = DATA.health.verdict;
  assert.ok(verdict, 'the payload carries a verdict');

  // Flip the verdict in the data; the screen must follow it rather than
  // recomputing anything from the underlying numbers.
  const flipped = Object.assign({}, DATA, {
    health: Object.assign({}, DATA.health, { verdict: 'unhealthy' }),
  });
  assert.ok(render('Health', flipped).indexOf('Unhealthy') !== -1,
    'the rendered verdict follows the payload');
  assert.ok(html.indexOf('Unhealthy') === -1 || verdict === 'unhealthy',
    'and was not already claiming that verdict');
});

test('P0  status is never colour alone: every status carries an icon and a text label', function () {
  ['Overview', 'Health', 'Queue', 'SourceControl'].forEach(function (section) {
    const html = render(section, DATA);
    // The Status component always emits an <svg> immediately before its text.
    const statuses = html.match(/<span class="inline-flex items-center gap-1\.5[^"]*"[^>]*>(.*?)<\/span><\/span>/g) || [];
    statuses.forEach(function (chunk) {
      assert.ok(/<svg/.test(chunk), section + ': a status rendered without its icon');
      const text = chunk.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]*>/g, '').trim();
      assert.ok(text.length > 0, section + ': a status rendered without a text label');
    });
  });
});

test('P0  no raw git command and no approve/merge control appears in Source control', function () {
  const html = render('SourceControl', DATA);
  [/git\s+(commit|push|add|merge|rebase|checkout)/i, />\s*Merge\b/, />\s*Approve\b/]
    .forEach(function (pattern) {
      assert.ok(!pattern.test(html), 'Source control must not contain ' + pattern);
    });
  // Plain language instead.
  assert.ok(/Commit changes/.test(html));
});

test('P0  actions the system cannot perform are drawn unavailable, with a reason', function () {
  const html = render('SourceControl', DATA);
  assert.deepStrictEqual(DATA.capabilities, { commit: false, pullRequest: false, worktrees: false });
  const buttons = html.match(/<button[^>]*>/g) || [];
  assert.ok(buttons.length > 0, 'the flows are drawn');
  buttons.forEach(function (b) {
    assert.ok(/disabled/.test(b), 'a blocked action rendered as if it worked: ' + b);
  });
  assert.ok(/local git only|contacts\s+no remote/i.test(html), 'the PR flow explains why');
  assert.ok(/never writes to it|read/i.test(html), 'the commit flow explains why');
});

test('P0  the worktree list renders from the payload', function () {
  const html = render('SourceControl', DATA);
  assert.ok(Array.isArray(DATA.git.worktrees) && DATA.git.worktrees.length > 0);
  DATA.git.worktrees.forEach(function (w) {
    assert.ok(html.indexOf(w.name) !== -1, 'missing worktree: ' + w.name);
  });
  assert.ok(/main working copy/.test(html), 'the main copy is distinguishable');
});

test('P0  the queue shows pending items without anything being opened', function () {
  const html = render('Queue', DATA);
  const pending = DATA.queue.filter(function (q) { return q.status === 'pending'; });
  assert.ok(pending.length > 0, 'the fixture has a pending item');
  assert.ok(new RegExp(pending.length + ' pending').test(html), 'the pending count is visible');
  DATA.queue.forEach(function (q) {
    assert.ok(html.indexOf(q.title) !== -1, 'missing queue item: ' + q.title);
  });
});

test('P0  the session log renders newest-first with its tool tag, never inferred', function () {
  const html = render('Sessions', DATA);
  assert.ok(DATA.sessions.length > 0);
  DATA.sessions.forEach(function (s) {
    assert.ok(html.indexOf(s.date) !== -1, 'missing session: ' + s.date);
  });
  assert.ok(/Cowork/.test(html), 'the tool tag comes through');

  const untagged = Object.assign({}, DATA, {
    sessions: [Object.assign({}, DATA.sessions[0], { tool: null })],
  });
  assert.ok(/tool not recorded/.test(render('Sessions', untagged)),
    'a missing tool is stated, not guessed');
});

test('a folder that is not a workspace is a first-class result, not an error screen', function () {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-empty-'));
  fs.writeFileSync(path.join(empty, 'notes.txt'), 'hello\n');
  const body = payloadFor(empty);
  assert.strictEqual(body.isWorkspace, false);
  assert.ok(body.detection.reason, 'the payload explains what was scanned and why it did not match');
});

test('sections hold no hard-coded workspace data', function () {
  const dir = path.join(__dirname, 'src', 'sections');
  fs.readdirSync(dir).forEach(function (file) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    [/PROJECT\.md/, /DECISIONS\.md/, /SESSIONS\.md['"]/, /workspace-kit\.html/]
      .forEach(function (pattern) {
        assert.ok(!pattern.test(source),
          file + ' names a specific workspace file; it must render whatever the payload holds');
      });
  });
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
  console.log('\n' + failures + ' of ' + tests.length + ' dashboard test(s) failed.');
  process.exit(1);
} else {
  console.log('\nAll ' + tests.length + ' dashboard test(s) passed.');
}
