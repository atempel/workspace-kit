/**
 * Zero-dependency test for core/git.js.
 *
 * Covers the P0 acceptance criteria of docs/specs/git-integration-layer.md
 * (→ #79) that are not gated on an open product question. The PR flow and
 * worktree management are deliberately absent — see the module header.
 *
 * Run with `npm run test:git`.
 */
'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const inspector = require('./inspect.js');
const gitLayer = require('./git.js');

function git(root, args) {
  execFileSync('git', args, { cwd: root, stdio: 'ignore' });
}

/**
 * A repo containing every state the spec names at once: a committed-clean
 * file, one modified but unstaged, one staged, and one untracked.
 */
function makeMixedRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-git-'));
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);

  fs.writeFileSync(path.join(root, 'PROJECT.md'), '# Project\n');
  fs.writeFileSync(path.join(root, 'TASKS.md'), '# Tasks\n');
  fs.writeFileSync(path.join(root, 'CONTEXT.md'), '# Context\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-q', '-m', 'initial']);

  fs.appendFileSync(path.join(root, 'TASKS.md'), '- a new task\n');           // modified-unstaged
  fs.appendFileSync(path.join(root, 'CONTEXT.md'), '- a new note\n');
  git(root, ['add', 'CONTEXT.md']);                                           // staged
  fs.writeFileSync(path.join(root, 'DECISIONS.md'), '# Decisions\n');         // untracked
  return root;
}

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// ---------------------------------------------------------------------------

test('P0-1a every file is classified into its actual git status', function () {
  const root = makeMixedRepo();
  const states = gitLayer.fileStates(root);
  assert.strictEqual(states['TASKS.md'], 'modified-unstaged');
  assert.strictEqual(states['CONTEXT.md'], 'staged');
  assert.strictEqual(states['DECISIONS.md'], 'untracked');
  assert.ok(!('PROJECT.md' in states), 'a clean file is not reported by git status');

  const annotated = gitLayer.annotate(inspector.inspect(root), states);
  const byPath = {};
  annotated.forEach(function (f) { byPath[f.path] = f.gitState; });
  assert.strictEqual(byPath['PROJECT.md'], 'committed-clean', 'and is filled in as clean');
  assert.strictEqual(byPath['TASKS.md'], 'modified-unstaged');
  assert.strictEqual(byPath['CONTEXT.md'], 'staged');
  assert.strictEqual(byPath['DECISIONS.md'], 'untracked');
});

test('P0-1b staged plus further unstaged edits reports the unstaged state', function () {
  const root = makeMixedRepo();
  fs.appendFileSync(path.join(root, 'CONTEXT.md'), '- edited again after staging\n');
  const states = gitLayer.fileStates(root);
  assert.strictEqual(states['CONTEXT.md'], 'modified-unstaged',
    'the unrecorded change is the one a caller about to overwrite needs to know about');
});

test('P0-1c annotate does not mutate the inspection index', function () {
  const root = makeMixedRepo();
  const index = inspector.inspect(root);
  const before = JSON.stringify(index.files);
  gitLayer.annotate(index, gitLayer.fileStates(root));
  assert.strictEqual(JSON.stringify(index.files), before);
});

test('P0-2a safe-edit refuses a file with uncommitted changes', function () {
  const root = makeMixedRepo();
  const states = gitLayer.fileStates(root);
  const check = gitLayer.safeEditCheck(states, 'TASKS.md');
  assert.strictEqual(check.safe, false);
  assert.match(check.warning, /uncommitted changes/);
  assert.match(check.warning, /TASKS\.md/);
});

test('P0-2b clean and staged files are safe; untracked is safe but flagged', function () {
  const root = makeMixedRepo();
  const states = gitLayer.fileStates(root);
  assert.strictEqual(gitLayer.safeEditCheck(states, 'PROJECT.md').safe, true);
  assert.strictEqual(gitLayer.safeEditCheck(states, 'PROJECT.md').warning, null);
  assert.strictEqual(gitLayer.safeEditCheck(states, 'CONTEXT.md').safe, true,
    'staged work is already recorded in the index and recoverable');
  const untracked = gitLayer.safeEditCheck(states, 'DECISIONS.md');
  assert.strictEqual(untracked.safe, true);
  assert.match(untracked.warning, /no committed version/);
});

test('P0-3  the change summary is plain language, with no git vocabulary', function () {
  const root = makeMixedRepo();
  const summary = gitLayer.changeSummary(root, inspector.inspect(root));
  assert.strictEqual(summary.isRepo, true);
  assert.strictEqual(summary.branch, 'main');
  assert.strictEqual(summary.files.length, 3);

  const byPath = {};
  summary.files.forEach(function (f) { byPath[f.path] = f; });
  assert.strictEqual(byPath['DECISIONS.md'].what, 'new file');
  assert.strictEqual(byPath['TASKS.md'].what, 'added 1 line');
  assert.strictEqual(summary.counts['committed-clean'], 1, 'PROJECT.md is clean');

  summary.files.forEach(function (f) {
    assert.doesNotMatch(f.what, /\b(HEAD|index|stage[d]?|blob|ref)\b/i,
      'the summary is for someone who does not use git');
  });
});

test('P0-4  the commit message is templated from the diff, never from a model', function () {
  const root = makeMixedRepo();
  const summary = gitLayer.changeSummary(root, inspector.inspect(root));
  const message = gitLayer.buildCommitMessage(summary);
  assert.match(message, /^Update 2 files and add 1 new file/);
  assert.match(message, /- TASKS\.md \(added 1 line\)/);
  assert.match(message, /- DECISIONS\.md \(new file\)/);

  // Determinism is the actual requirement: same input, byte-identical output.
  assert.strictEqual(message, gitLayer.buildCommitMessage(
    gitLayer.changeSummary(root, inspector.inspect(root))));
});

test('P0-5  model-agnostic guardrail: no outbound AI call exists in this feature', function () {
  const source = fs.readFileSync(path.join(__dirname, 'git.js'), 'utf8');
  [/anthropic/i, /openai/i, /api[_-]?key/i, /\bfetch\s*\(/, /https?:\/\//]
    .forEach(function (pattern) {
      assert.ok(!pattern.test(source.replace(/^\s*\*.*$/gm, '')),
        'core/git.js must make no outbound call: ' + pattern);
    });
  const requires = (source.match(/require\((['"])(.*?)\1\)/g) || [])
    .map(function (r) { return r.replace(/require\((['"])(.*?)\1\)/, '$2'); });
  assert.deepStrictEqual(requires.sort(), ['child_process', 'path']);
});

test('P0-6  the standalone HTML artifact is untouched by this feature', function () {
  const artifact = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-kit.html'), 'utf8');
  ['git.js', 'gitState', 'safeEditCheck'].forEach(function (token) {
    assert.ok(artifact.indexOf(token) === -1, 'the artifact must not reference ' + token);
  });
});

test('a folder that is not a git repository is a result, not a crash', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-nogit-'));
  fs.writeFileSync(path.join(dir, 'PROJECT.md'), '# P\n');
  assert.strictEqual(gitLayer.isGitRepo(dir), false);
  assert.deepStrictEqual(gitLayer.fileStates(dir), {});
  const summary = gitLayer.changeSummary(dir, inspector.inspect(dir));
  assert.strictEqual(summary.isRepo, false);
  assert.strictEqual(gitLayer.buildCommitMessage(summary), null);
});

test('a path containing a space or quote cannot become a command', function () {
  const root = makeMixedRepo();
  const nasty = 'a file; echo pwned > owned.txt.md';
  fs.writeFileSync(path.join(root, nasty), '# odd name\n');
  const states = gitLayer.fileStates(root);
  assert.strictEqual(states[nasty], 'untracked', 'reported literally, not interpreted');
  assert.ok(!fs.existsSync(path.join(root, 'owned.txt')), 'nothing was executed');
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
  console.log('\n' + failures + ' of ' + tests.length + ' git test(s) failed.');
  process.exit(1);
} else {
  console.log('\nAll ' + tests.length + ' git test(s) passed.');
}
