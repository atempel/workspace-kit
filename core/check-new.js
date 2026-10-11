/**
 * Zero-dependency test for `workspace-kit new` (core/scaffold.js + bin).
 *
 * One case per P0 acceptance criterion of docs/specs/cli-generator.md
 * (→ #20; P0 issues #112-#116). Every case drives the real CLI as a child
 * process against a temp dir.
 *
 * Run with `npm run test:new`.
 */
'use strict';

const assert = require('assert');
const { spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const generator = require('./generator.js');
const scaffold = require('./scaffold.js');

const BIN = path.join(__dirname, '..', 'bin', 'workspace-kit.js');
// So the optional first commit works on a machine with no git identity.
const ENV = Object.assign({}, process.env, {
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com',
});

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-new-')); }

function run(args, input) {
  const r = spawnSync('node', [BIN].concat(args), { encoding: 'utf8', input: input || '', env: ENV });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function walk(root, rel) {
  rel = rel || '';
  let out = [];
  fs.readdirSync(path.join(root, rel), { withFileTypes: true }).forEach(function (e) {
    if (e.name === '.git') return;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(walk(root, r));
    else out.push(r);
  });
  return out.sort();
}

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('PASS  ' + name); } catch (e) {
    failures++;
    console.log('FAIL  ' + name + '\n      ' + String(e.message).split('\n').join('\n      '));
  }
}

const FLAGS = ['--name', 'Infinite List', '--desc', 'A test app.', '--obj', 'validate first', '--stack', 'Node',
  '--limits', 'no deploys', '--lang', 'en', '--agents', 'claude,agentsmd,cursor,skill'];

// P0 #1 — all inputs, prompted when absent, skipped when passed (#112).
test('no flags: prompts for every field the HTML form collects', function () {
  const dir = path.join(tmp(), 'ws');
  // Answers in prompt order: lang, kit, name, desc, obj, stack, limits, agents,
  // then one y/n per folder of the kit, then git, then visual, then docker.
  const r = run(['new', dir], ['pt', '2', 'Meu Estudo', 'descr', 'meta', 'Python', 'sem rede',
    'claude,gemini', 'y', 'n', 'n', 'n', 'n', 'n'].join('\n') + '\n');
  assert.strictEqual(r.code, 0, r.err);
  ['Language', 'Project type', 'Project name', 'Short description', 'Main goal', 'Stack',
    'Limits', 'Agents', 'Create dados/', 'Use git', 'visual person', 'Docker environment'].forEach(function (p) {
    assert.ok(r.err.indexOf(p) !== -1, 'never prompted for: ' + p);
  });
  const project = fs.readFileSync(path.join(dir, 'PROJECT.md'), 'utf8');
  assert.ok(project.indexOf('# Meu Estudo') !== -1 && project.indexOf('Python') !== -1);
  assert.ok(project.indexOf(generator.KIT_CONFIG.pesquisa.label.pt) !== -1, 'kit answer "2" not honoured');
  assert.ok(fs.existsSync(path.join(dir, 'GEMINI.md')) && !fs.existsSync(path.join(dir, 'AGENTS.md')));
  assert.ok(fs.existsSync(path.join(dir, 'dados', '.keep')) && !fs.existsSync(path.join(dir, 'notas')));
});

test('flags: a field passed on the command line is not prompted for', function () {
  const dir = path.join(tmp(), 'ws');
  const r = run(['new', dir, '--name', 'Only Name', '--kit', 'produto', '--lang', 'en'], '\n\n\n\n\n\n\n\n\n');
  assert.strictEqual(r.code, 0, r.err);
  ['Project name', 'Project type', 'Language'].forEach(function (p) {
    assert.ok(r.err.indexOf(p) === -1, 'prompted for a field that was passed: ' + p);
  });
  assert.ok(r.err.indexOf('Short description') !== -1, 'did not prompt for a field left out');
});

test('-y: never prompts and still writes a valid workspace', function () {
  const dir = path.join(tmp(), 'ws');
  const r = run(['new', dir, '-y', '--name', 'CI']);
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(!/Project name|Short description/.test(r.err), 'prompted under -y');
  assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')));
});

test('rejects an unknown kit, agent, or language without writing', function () {
  [[ '--kit', 'nope' ], [ '--agents', 'nope' ], [ '--lang', 'fr' ]].forEach(function (extra) {
    const dir = path.join(tmp(), 'ws');
    const r = run(['new', dir, '-y'].concat(extra));
    assert.strictEqual(r.code, 1);
    assert.ok(!fs.existsSync(dir), 'wrote files despite invalid ' + extra[0]);
  });
});

// P0 #2 — output matches the generator for the same inputs (#113).
test('output matches core/generator.js for all 17 kits in both languages', function () {
  const kits = scaffold.kitKeys();
  assert.strictEqual(kits.length, 17);
  ['en', 'pt'].forEach(function (lang) {
    kits.forEach(function (kit) {
      const dir = path.join(tmp(), 'ws');
      const r = run(['new', dir].concat(FLAGS.map(function (f) { return f === 'en' ? lang : f; }), ['--kit', kit]));
      assert.strictEqual(r.code, 0, kit + ': ' + r.err);
      const expected = generator.buildFileMap(scaffold.buildInput({
        name: 'Infinite List', kit: kit, lang: lang, desc: 'A test app.', obj: 'validate first', stack: 'Node',
        limits: 'no deploys', agents: ['claude', 'agentsmd', 'cursor', 'skill'],
      })).files;
      assert.deepStrictEqual(walk(dir), Object.keys(expected).sort(), kit + '/' + lang + ': file set differs');
      Object.keys(expected).forEach(function (p) {
        assert.strictEqual(fs.readFileSync(path.join(dir, p), 'utf8'), expected[p], kit + '/' + lang + ': ' + p + ' differs');
      });
    });
  });
});

test('writes human layer, agent layer, .gitignore and the kit anchor file', function () {
  const dir = path.join(tmp(), 'ws');
  assert.strictEqual(run(['new', dir].concat(FLAGS, ['--kit', 'produto', '--git'])).code, 0);
  ['README.md', 'PROJECT.md', 'DECISIONS.md', 'CONTEXT.md', 'TASKS.md', 'CLAUDE.md', 'AGENTS.md',
    '.gitignore', 'docs/PRD.md', 'research/.gitkeep'].forEach(function (p) {
    assert.ok(fs.existsSync(path.join(dir, p)), 'missing ' + p);
  });
  assert.ok(walk(dir).some(function (p) { return /^\.cursor\/rules\/.+\.mdc$/.test(p); }));
  assert.ok(walk(dir).some(function (p) { return /^\.claude\/skills\/.+\/SKILL\.md$/.test(p); }));
});

test('--git sets the generator git option: .gitignore, .gitkeep, byte-identical to git:true', function () {
  const dir = path.join(tmp(), 'ws');
  assert.strictEqual(run(['new', dir].concat(FLAGS, ['--kit', 'produto', '--git'])).code, 0);
  const expected = generator.buildFileMap(scaffold.buildInput({
    name: 'Infinite List', kit: 'produto', lang: 'en', desc: 'A test app.', obj: 'validate first', stack: 'Node',
    limits: 'no deploys', agents: ['claude', 'agentsmd', 'cursor', 'skill'], extra: { git: true, visual: false },
  })).files;
  assert.ok('.gitignore' in expected && fs.existsSync(path.join(dir, '.gitignore')));
  assert.deepStrictEqual(walk(dir), Object.keys(expected).sort());
  Object.keys(expected).forEach(function (p) {
    assert.strictEqual(fs.readFileSync(path.join(dir, p), 'utf8'), expected[p], p);
  });
});

test('without --git there is no .gitignore and no repo', function () {
  const dir = path.join(tmp(), 'ws');
  assert.strictEqual(run(['new', dir, '-y', '--name', 'N']).code, 0);
  assert.ok(!fs.existsSync(path.join(dir, '.gitignore')));
  assert.ok(!fs.existsSync(path.join(dir, '.git')));
});

test('--visual adds the Visual communication section to the agent files', function () {
  const on = path.join(tmp(), 'a');
  const off = path.join(tmp(), 'b');
  assert.strictEqual(run(['new', on, '-y', '--name', 'V', '--visual']).code, 0);
  assert.strictEqual(run(['new', off, '-y', '--name', 'V']).code, 0);
  const a = fs.readFileSync(path.join(on, 'AGENTS.md'), 'utf8');
  const b = fs.readFileSync(path.join(off, 'AGENTS.md'), 'utf8');
  assert.ok(/Visual communication/i.test(a), 'section missing');
  assert.ok(!/Visual communication/i.test(b));
  const expected = generator.buildFileMap(scaffold.buildInput({ name: 'V', extra: { git: false, visual: true } })).files;
  assert.strictEqual(a, expected['AGENTS.md']);
});

test('--docker writes the Docker files adapted to the kit; without it there are none', function () {
  const on = path.join(tmp(), 'a');
  const off = path.join(tmp(), 'b');
  assert.strictEqual(run(['new', on, '-y', '--name', 'D', '--kit', 'dataml', '--docker']).code, 0);
  assert.strictEqual(run(['new', off, '-y', '--name', 'D', '--kit', 'dataml']).code, 0);
  ['Dockerfile', 'docker-compose.yml', '.dockerignore'].forEach(function (p) {
    assert.ok(fs.existsSync(path.join(on, p)), 'missing ' + p);
    assert.ok(!fs.existsSync(path.join(off, p)), p + ' without --docker');
  });
  const expected = generator.buildFileMap(scaffold.buildInput({ name: 'D', kit: 'dataml', extra: { docker: true } })).files;
  assert.strictEqual(fs.readFileSync(path.join(on, 'Dockerfile'), 'utf8'), expected['Dockerfile']);
  assert.ok(/jupyterlab/.test(expected['Dockerfile']), 'dataml should get the Python stack');
});

test('defaults to the current directory when no [dir] is given', function () {
  const dir = tmp();
  const r = spawnSync('node', [BIN, 'new', '-y', '--name', 'Here'], { cwd: dir, encoding: 'utf8', env: ENV });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'PROJECT.md')));
});

test('--set reaches the generator input, including nested keys', function () {
  const dir = path.join(tmp(), 'ws');
  assert.strictEqual(run(['new', dir, '-y', '--name', 'S', '--agents', 'claude', '--set', 'agents.gemini=true']).code, 0);
  assert.ok(fs.existsSync(path.join(dir, 'GEMINI.md')));
});

test('options the generator declares become flags without CLI changes', function () {
  const declared = scaffold.genericOptions();
  assert.ok(Array.isArray(declared));
  declared.forEach(function (o) {
    const dir = path.join(tmp(), 'ws');
    const r = run(['new', dir, '-y', '--name', 'G', o.type === 'boolean' ? '--' + o.flag : '--' + o.flag + '=x']);
    assert.strictEqual(r.code, 0, '--' + o.flag + ': ' + r.err);
  });
});

// P0 #3 — --git (#114).
test('--git: the folder has a .git and the first commit; without it, no git action', function () {
  const withGit = path.join(tmp(), 'ws');
  const r = run(['new', withGit, '-y', '--name', 'G', '--git']);
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(withGit, '.git')));
  const log = execFileSync('git', ['log', '--format=%s'], { cwd: withGit, encoding: 'utf8' });
  assert.ok(log.trim().length > 0, 'no first commit');
  assert.strictEqual(execFileSync('git', ['status', '--porcelain'], { cwd: withGit, encoding: 'utf8' }).trim(), '');

  const without = path.join(tmp(), 'ws');
  assert.strictEqual(run(['new', without, '-y', '--name', 'G']).code, 0);
  assert.ok(!fs.existsSync(path.join(without, '.git')));
});

test('--git --no-commit initialises without committing; an existing repo is left alone', function () {
  const dir = path.join(tmp(), 'ws');
  assert.strictEqual(run(['new', dir, '-y', '--name', 'G', '--git', '--no-commit']).code, 0);
  assert.ok(fs.existsSync(path.join(dir, '.git')));
  assert.notStrictEqual(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).status, 0, 'committed anyway');

  const repo = tmp();
  execFileSync('git', ['init', '-q'], { cwd: repo });
  const r = run(['new', repo, '-y', '--name', 'G', '--git']);
  assert.strictEqual(r.code, 0, r.err);
  assert.notStrictEqual(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo }).status, 0, 'touched an existing repo\'s history');
});

// P0 #4 — refuse non-empty directories (#115).
test('non-empty folder without --force: non-zero exit, nothing written', function () {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'mine');
  fs.writeFileSync(path.join(dir, 'README.md'), 'mine');
  const before = walk(dir);
  const r = run(['new', dir, '-y', '--name', 'X']);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/not empty/.test(r.err) && /--force/.test(r.err), r.err);
  assert.deepStrictEqual(walk(dir), before);
  assert.strictEqual(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), 'mine');
  assert.strictEqual(r.out, '', 'printed a prompt for a workspace that was not written');
});

test('--force: proceeds, reports overwritten files, leaves unrelated files alone', function () {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'mine');
  fs.writeFileSync(path.join(dir, 'README.md'), 'old');
  const r = run(['new', dir, '-y', '--name', 'X', '--force']);
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(/Overwrote 1 existing file/.test(r.err) && /README\.md/.test(r.err), r.err);
  assert.notStrictEqual(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), 'old');
  assert.strictEqual(fs.readFileSync(path.join(dir, 'notes.txt'), 'utf8'), 'mine');
});

test('an existing empty folder and a missing nested path are both fine; a file path is refused', function () {
  assert.strictEqual(run(['new', tmp(), '-y', '--name', 'E']).code, 0);
  assert.strictEqual(run(['new', path.join(tmp(), 'a', 'b'), '-y', '--name', 'E']).code, 0);
  const f = path.join(tmp(), 'file');
  fs.writeFileSync(f, 'x');
  assert.notStrictEqual(run(['new', f, '-y']).code, 0);
});

test('--dry-run lists the files and writes nothing', function () {
  const dir = path.join(tmp(), 'ws');
  const r = run(['new', dir, '-y', '--name', 'D', '--dry-run']);
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(r.err.indexOf('PROJECT.md') !== -1);
  assert.ok(!fs.existsSync(dir));
});

// P0 #5 — starter prompt (#116).
test('starter prompt goes to stdout, identical to the generator\'s, and optionally to a file', function () {
  const dir = path.join(tmp(), 'ws');
  const file = path.join(tmp(), 'prompt.txt');
  const r = run(['new', dir].concat(FLAGS, ['--kit', 'produto', '--prompt-out', file]));
  assert.strictEqual(r.code, 0, r.err);
  const expected = generator.buildStarterPrompt(scaffold.buildInput({
    name: 'Infinite List', kit: 'produto', lang: 'en', desc: 'A test app.', obj: 'validate first', stack: 'Node',
    limits: 'no deploys', agents: ['claude', 'agentsmd', 'cursor', 'skill'],
  }));
  assert.strictEqual(r.out, expected + '\n');
  assert.strictEqual(fs.readFileSync(file, 'utf8'), expected + '\n');
});

test('scaffold refuses paths that escape the target folder', function () {
  const dir = path.join(tmp(), 'ws');
  assert.throws(function () { scaffold.plan(dir, { '../evil.txt': 'x' }, true); }, /outside/);
});

if (failures) {
  console.log('\n' + failures + ' case(s) failed.');
  process.exit(1);
}
console.log('\nAll cases passed.');
