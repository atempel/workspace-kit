/**
 * Zero-dependency test for core/doctor.js.
 *
 * Each case is named for the Must-Have (P0) acceptance criterion it covers in
 * docs/specs/workspace-health-check.md (→ #78), so a failure names the
 * requirement it breaks.
 *
 * Run with `npm run test:doctor`.
 */
'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const generator = require('./generator.js');
const inspector = require('./inspect.js');
const doctor = require('./doctor.js');

const CLI = path.join(__dirname, '..', 'bin', 'workspace-kit.js');

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-doctor-'));
  const map = generator.buildFileMap({
    name: 'Infinite List', kit: 'produto', lang: 'en',
    desc: 'A test app.', obj: 'validate', stack: 'Node', limits: 'none',
    folders: [{ name: 'src', localOnly: false }],
    agents: { claude: true, agentsmd: true },
  });
  Object.keys(map.files).forEach(function (rel) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, map.files[rel]);
  });
  return root;
}

/** An AGENTS.md of exactly `lines` lines, with real heading sections. */
function writeAgentsOfLines(root, lines) {
  const body = ['# Agent instructions', ''];
  let section = 0;
  while (body.length < lines) {
    if (body.length % 20 === 0) { body.push('## Section ' + (++section)); } else { body.push('- a rule'); }
  }
  fs.writeFileSync(path.join(root, 'AGENTS.md'), body.slice(0, lines).join('\n') + '\n');
}

function run(root, extra) {
  const index = inspector.inspect(root);
  return doctor.diagnose(index, Object.assign({
    readFile: function (rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); },
  }, extra || {}));
}

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// ---------------------------------------------------------------------------

test('P0-1  the result is structured, per file and in aggregate', function () {
  const report = run(makeWorkspace());
  ['verdict', 'budget', 'files', 'growth', 'crossReferences', 'suggestions', 'method']
    .forEach(function (key) { assert.ok(key in report, 'missing ' + key); });
  ['files', 'lines', 'tokensEstimate', 'lineCap', 'status', 'pctOfCap']
    .forEach(function (key) { assert.ok(key in report.budget, 'budget missing ' + key); });
  report.files.forEach(function (f) {
    ['path', 'bytes', 'lines', 'chars', 'tokensEstimate', 'status', 'alwaysLoaded']
      .forEach(function (key) { assert.ok(key in f, f.path + ' missing ' + key); });
  });
  assert.ok(report.growth.length >= 1, 'DECISIONS.md growth is measured');
  assert.strictEqual(typeof report.growth[0].entries, 'number');
});

test('P0-2  the token heuristic is declared as an approximation, not a count', function () {
  const report = run(makeWorkspace());
  assert.match(report.method.tokenEstimate, /÷ 4/);
  assert.match(report.method.tokenEstimate, /approximate/i);
  assert.match(doctor.formatReport(report), /approximate/i);
});

test('P0-3  250 / 300 / 400 lines give healthy / warning / over-budget', function () {
  const seen = {};
  [[250, 'healthy'], [300, 'warning'], [400, 'over-budget']].forEach(function (pair) {
    const root = makeWorkspace();
    writeAgentsOfLines(root, pair[0]);
    const report = run(root);
    const agents = report.files.filter(function (f) { return f.path === 'AGENTS.md'; })[0];
    assert.strictEqual(agents.lines, pair[0], 'fixture should be exactly ' + pair[0] + ' lines');
    assert.strictEqual(agents.status, pair[1], pair[0] + ' lines should be ' + pair[1]);
    seen[pair[1]] = true;
  });
  assert.strictEqual(Object.keys(seen).length, 3, 'three distinct statuses from the same thresholds');
});

test('P0-4  the verdict changes when one file is pushed over threshold', function () {
  const root = makeWorkspace();
  writeAgentsOfLines(root, 100);
  const before = run(root).verdict;
  assert.strictEqual(before, 'healthy');
  writeAgentsOfLines(root, 400);
  const after = run(root).verdict;
  assert.strictEqual(after, 'unhealthy');
  assert.notStrictEqual(after, before, 'visible without reading the per-file detail');
});

test('P0-5a suggestions name a specific file and a concrete action', function () {
  const root = makeWorkspace();
  writeAgentsOfLines(root, 400);
  const report = run(root);
  const split = report.suggestions.filter(function (s) { return s.kind === 'split-file'; })[0];
  assert.ok(split, 'an oversized file produces a split suggestion');
  assert.strictEqual(split.file, 'AGENTS.md');
  assert.match(split.message, /AGENTS\.md is 400 lines/);
  assert.match(split.message, /100 lines over/);
  assert.match(split.message, /largest section is "Section \d+"/, 'names where to cut, not "consider shortening"');
  assert.doesNotMatch(split.message, /consider shortening/i);
});

test('P0-5b a broken cross-reference is its own suggestion, naming the target', function () {
  const root = makeWorkspace();
  fs.appendFileSync(path.join(root, 'PROJECT.md'), '\nSee [the roadmap](docs/ROADMAP.md).\n');
  const report = run(root);
  const broken = report.suggestions.filter(function (s) { return s.kind === 'broken-reference'; });
  assert.strictEqual(broken.length, 1);
  assert.match(broken[0].message, /docs\/ROADMAP\.md/);
  assert.strictEqual(report.crossReferences.broken.length, 1);
});

test('P0-5c a decision log past ~15 entries is told to rotate', function () {
  const root = makeWorkspace();
  let log = '# Decisions\n\n';
  for (let i = 1; i <= 18; i++) log += '## 2026-01-' + String(i).padStart(2, '0') + ' — Entry ' + i + '\n- x\n\n';
  fs.writeFileSync(path.join(root, 'DECISIONS.md'), log);
  const report = run(root);
  const rotate = report.suggestions.filter(function (s) { return s.kind === 'rotate-log'; })[0];
  assert.ok(rotate, 'rotation is suggested');
  assert.match(rotate.message, /18 entries/);
  assert.match(rotate.message, /decisions\//);
  const growth = report.growth.filter(function (g) { return g.path === 'DECISIONS.md'; })[0];
  assert.strictEqual(growth.entries, 18);
  assert.strictEqual(growth.status, 'over-budget');
});

test('P0-5d a stale instruction pointing at a removed file is flagged', function () {
  const root = makeWorkspace();
  fs.appendFileSync(path.join(root, 'AGENTS.md'),
    '\n## Deployment\n- Follow the steps in [the runbook](docs/RUNBOOK.md).\n');
  const report = run(root);
  const stale = report.suggestions.filter(function (s) { return s.kind === 'stale-instruction'; })[0];
  assert.ok(stale, 'the instruction section is identified, not just the file');
  assert.match(stale.message, /"Deployment"/);
  assert.match(stale.message, /docs\/RUNBOOK\.md/);
});

test('P0-5e a warning always carries a suggestion, never a bare warning', function () {
  // Found by running the doctor against workspace//kit's own repo, which sat
  // at 14/15 decision entries: the verdict said needs-attention while the
  // report said "within every threshold" and offered nothing to do.
  const root = makeWorkspace();
  let log = '# Decisions\n\n';
  for (let i = 1; i <= 14; i++) log += '## 2026-01-' + String(i).padStart(2, '0') + ' — Entry ' + i + '\n- x\n\n';
  fs.writeFileSync(path.join(root, 'DECISIONS.md'), log);
  const report = run(root);
  assert.strictEqual(report.verdict, 'needs-attention');
  const rotate = report.suggestions.filter(function (s) { return s.kind === 'rotate-log'; })[0];
  assert.ok(rotate, 'a warning must come with something to do about it');
  assert.match(rotate.message, /1 short of/);
  assert.strictEqual(rotate.severity, 'low');
  assert.doesNotMatch(doctor.formatReport(report), /within every threshold/,
    'the report must not contradict its own verdict');
});

test('P0-6a the CLI runs with no arguments and covers every P0 metric', function () {
  const root = makeWorkspace();
  const out = execFileSync(process.execPath, [CLI, 'doctor'], { cwd: root, encoding: 'utf8' });
  assert.match(out, /Verdict:/);
  assert.match(out, /Always-loaded context budget/);
  assert.match(out, /Always-loaded files/);
  assert.match(out, /History growth/);
  assert.match(out, /Cross-references:/);
  assert.match(out, /approximate/i, 'the estimate is labelled in the report itself');
});

test('P0-6b --help documents the heuristic as an approximation', function () {
  const out = execFileSync(process.execPath, [CLI, '--help'], { encoding: 'utf8' });
  assert.match(out, /doctor/);
  assert.match(out, /÷ 4/);
  assert.match(out, /approximation|approximate/i);
});

test('P0-7  exit code is zero when healthy and non-zero when unhealthy', function () {
  const healthy = makeWorkspace();
  writeAgentsOfLines(healthy, 100);
  execFileSync(process.execPath, [CLI, 'doctor'], { cwd: healthy, encoding: 'utf8' });

  const sick = makeWorkspace();
  writeAgentsOfLines(sick, 400);
  let code = 0;
  try {
    execFileSync(process.execPath, [CLI, 'doctor'], { cwd: sick, encoding: 'utf8', stdio: 'pipe' });
  } catch (err) {
    code = err.status;
  }
  assert.notStrictEqual(code, 0, 'an over-budget workspace must exit non-zero for CI use');
});

test('P0-8  a folder that is not a workspace is reported, not crashed on', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-nows-'));
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'hello\n');
  const report = run(dir);
  assert.strictEqual(report.isWorkspace, false);
  assert.match(doctor.formatReport(report), /Not a workspace/);
});

test('P1  --json emits the structured report for other consumers', function () {
  const root = makeWorkspace();
  writeAgentsOfLines(root, 400);
  let out;
  try {
    out = execFileSync(process.execPath, [CLI, 'doctor', '--json'], { cwd: root, encoding: 'utf8' });
  } catch (err) {
    out = err.stdout; // non-zero exit is expected for an unhealthy workspace
  }
  const parsed = JSON.parse(out);
  assert.strictEqual(parsed.verdict, 'unhealthy');
  assert.ok(parsed.suggestions.length > 0);
});

test('P1  thresholds are configurable', function () {
  const root = makeWorkspace();
  writeAgentsOfLines(root, 400);
  assert.strictEqual(run(root).verdict, 'unhealthy');
  const relaxed = run(root, { thresholds: { alwaysLoadedLines: 1000 } });
  assert.strictEqual(relaxed.verdict, 'healthy', 'a project may intentionally want a larger budget');
});

test('boundary  the doctor never walks the filesystem itself', function () {
  const source = fs.readFileSync(path.join(__dirname, 'doctor.js'), 'utf8');
  assert.ok(source.indexOf("require('fs')") === -1, 'reading belongs to core/inspect.js');
  assert.ok(source.indexOf('readdirSync') === -1);
  const skill = doctor.isAlwaysLoaded({ layer: 'agent', path: '.claude/skills/x/SKILL.md' });
  assert.strictEqual(skill, false, 'a skill is loaded on invocation, not at session start');
  assert.strictEqual(doctor.isAlwaysLoaded({ layer: 'agent', path: 'AGENTS.md' }), true);
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
  console.log('\n' + failures + ' of ' + tests.length + ' doctor test(s) failed.');
  process.exit(1);
} else {
  console.log('\nAll ' + tests.length + ' doctor test(s) passed.');
}
