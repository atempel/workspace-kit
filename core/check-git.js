/**
 * Zero-dependency test for core/git.js.
 *
 * Covers the P0 acceptance criteria of docs/specs/git-integration-layer.md
 * (→ #79) that are not gated on an open product question. Worktree management
 * joined them on 2026-07-29, once placement/naming was answered. The PR flow is
 * still deliberately absent: this layer is local-only — see the module header.
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

/**
 * core/git.js requires nothing but child_process and path (P0-5 pins that), so
 * the filesystem is handed in by the caller. This is what bin/workspace-kit.js
 * passes; the tests use the same thing.
 */
const io = {
  readFile: function (p) { return fs.readFileSync(p, 'utf8'); },
  writeFile: function (p, c) { fs.writeFileSync(p, c); },
  exists: function (p) { return fs.existsSync(p); },
};

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

// --- Worktrees (unblocked 2026-07-29: convention + override) ----------------

test('P0-7a the convention places a worktree and names its branch, with no arguments beyond a name', function () {
  const root = makeMixedRepo();
  const result = gitLayer.createWorktree(root, 'agent-2', { io: io });
  assert.ok(result.ok, result.error);
  assert.strictEqual(result.path, path.join(root, '.worktrees', 'agent-2'));
  assert.strictEqual(result.branch, 'agent-2');
  assert.ok(result.byConvention);
  assert.ok(fs.existsSync(path.join(root, '.worktrees', 'agent-2', 'PROJECT.md')),
    'the worktree is a real checkout, not an empty folder');
});

test('P0-7b the user can override both the location and the branch name', function () {
  const root = makeMixedRepo();
  const custom = path.join(root, 'somewhere-else');
  const result = gitLayer.createWorktree(root, 'agent-3', { path: custom, branch: 'feature/login', io: io });
  assert.ok(result.ok, result.error);
  assert.strictEqual(result.path, custom);
  assert.strictEqual(result.branch, 'feature/login');
  assert.strictEqual(result.byConvention, false);
  assert.ok(fs.existsSync(path.join(custom, 'PROJECT.md')));
});

test('P0-7c creating the first worktree stops the parent repo reporting it as a stray file', function () {
  const root = makeMixedRepo();
  const result = gitLayer.createWorktree(root, 'agent-2', { io: io });
  assert.ok(result.gitignoreUpdated, '.gitignore gained the rule');
  const states = gitLayer.fileStates(root);
  assert.ok(!Object.keys(states).some(function (f) { return f.indexOf('.worktrees') === 0; }),
    'no .worktrees path shows up as untracked');
  // Idempotent: a second worktree must not append the rule again.
  gitLayer.createWorktree(root, 'agent-3', { io: io });
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.strictEqual(ignore.split('\n').filter(function (l) { return l.trim() === '.worktrees/'; }).length, 1);
});

test('P0-7d a custom location inside the workspace is ignored too; one outside is left alone', function () {
  const root = makeMixedRepo();
  // The user's own --path still lands inside the repo, so the parent would
  // otherwise report it as a stray directory — the same noise the convention
  // avoids.
  const inside = gitLayer.createWorktree(root, 'ui', { path: path.join(root, 'custom-spot'), io: io });
  assert.ok(inside.ok, inside.error);
  assert.ok(inside.gitignoreUpdated);
  assert.ok(!Object.keys(gitLayer.fileStates(root)).some(function (f) { return f.indexOf('custom-spot') === 0; }),
    'the custom location is not reported as untracked');

  // Outside the workspace there is nothing for the parent repo to see, so its
  // .gitignore must not be touched at all.
  const outsideDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-out-')), 'far-away');
  const before = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  const outside = gitLayer.createWorktree(root, 'far', { path: outsideDir, io: io });
  assert.ok(outside.ok, outside.error);
  assert.strictEqual(outside.gitignoreUpdated, false);
  assert.strictEqual(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), before);
});

test('P0-8  two worktrees are edited in parallel with no collision, each tracked independently', function () {
  const root = makeMixedRepo();
  const a = gitLayer.createWorktree(root, 'agent-a', { io: io });
  const b = gitLayer.createWorktree(root, 'agent-b', { io: io });
  assert.ok(a.ok && b.ok, 'both worktrees were created');

  // Each session edits the *same* file in its own copy — the exact case that
  // collides when two agents share one working directory.
  fs.appendFileSync(path.join(a.path, 'PROJECT.md'), '- written by agent A\n');
  fs.appendFileSync(path.join(b.path, 'PROJECT.md'), '- written by agent B\n');

  assert.strictEqual(gitLayer.fileStates(a.path)['PROJECT.md'], 'modified-unstaged');
  assert.strictEqual(gitLayer.fileStates(b.path)['PROJECT.md'], 'modified-unstaged');
  assert.ok(fs.readFileSync(path.join(a.path, 'PROJECT.md'), 'utf8').indexOf('agent A') !== -1);
  assert.ok(fs.readFileSync(path.join(b.path, 'PROJECT.md'), 'utf8').indexOf('agent B') !== -1);
  assert.ok(fs.readFileSync(path.join(a.path, 'PROJECT.md'), 'utf8').indexOf('agent B') === -1,
    'neither worktree can see the other\'s uncommitted edit');

  // And the parent workspace's own PROJECT.md is untouched by either.
  assert.ok(!('PROJECT.md' in gitLayer.fileStates(root)));

  const summaryA = gitLayer.changeSummary(a.path, null);
  assert.strictEqual(summaryA.branch, 'agent-a');
  assert.ok(summaryA.files.some(function (f) { return f.path === 'PROJECT.md'; }));
});

test('P0-9  listing reports every worktree, marking the main one and any custom location', function () {
  const root = makeMixedRepo();
  gitLayer.createWorktree(root, 'agent-2', { io: io });
  gitLayer.createWorktree(root, 'agent-3', { path: path.join(root, 'elsewhere'), io: io });

  const listed = gitLayer.listWorktrees(root);
  assert.ok(listed.isRepo);
  assert.strictEqual(listed.worktrees.length, 3, 'the main working copy is included');
  assert.strictEqual(listed.worktrees.filter(function (w) { return w.isMain; }).length, 1);

  const byName = {};
  listed.worktrees.forEach(function (w) { byName[w.name] = w; });
  assert.strictEqual(byName['agent-2'].byConvention, true);
  assert.strictEqual(byName['elsewhere'].byConvention, false, 'a custom location is distinguishable');
  assert.strictEqual(byName['agent-2'].branch, 'agent-2');
});

test('P1  the same file uncommitted in two worktrees is reported as an overlap', function () {
  const root = makeMixedRepo();
  const a = gitLayer.createWorktree(root, 'agent-a', { io: io });
  const b = gitLayer.createWorktree(root, 'agent-b', { io: io });

  // Nothing overlaps until two copies actually touch the same path.
  assert.deepStrictEqual(gitLayer.worktreeConflicts(root).conflicts, [],
    'parallel worktrees are not a conflict by themselves');

  fs.appendFileSync(path.join(a.path, 'PROJECT.md'), '- written by agent A\n');
  fs.appendFileSync(path.join(b.path, 'PROJECT.md'), '- written by agent B\n');
  // A file only one worktree touches must not be reported.
  fs.writeFileSync(path.join(a.path, 'NOTES.md'), '- only agent A\n');

  const result = gitLayer.worktreeConflicts(root);
  assert.strictEqual(result.isRepo, true);
  assert.strictEqual(result.conflicts.length, 1, 'exactly the shared file is flagged');
  assert.strictEqual(result.conflicts[0].path, 'PROJECT.md');

  const names = result.conflicts[0].worktrees.map(function (w) { return w.name; }).sort();
  assert.deepStrictEqual(names, ['agent-a', 'agent-b'], 'both holders are named');
  result.conflicts[0].worktrees.forEach(function (w) {
    assert.strictEqual(w.state, 'modified-unstaged', 'each holder carries its own state');
    assert.ok(w.branch, 'and its branch, so the reader can tell the copies apart');
  });
});

test('P1  the main working copy counts as a holder like any other worktree', function () {
  // makeMixedRepo leaves TASKS.md modified in the main copy. An agent editing
  // the same file in a worktree is the everyday version of this collision, and
  // the main copy being "the real one" does not exempt it.
  const root = makeMixedRepo();
  const a = gitLayer.createWorktree(root, 'agent-a', { io: io });
  fs.appendFileSync(path.join(a.path, 'TASKS.md'), '- also touched by agent A\n');

  const conflicts = gitLayer.worktreeConflicts(root).conflicts;
  const tasks = conflicts.filter(function (c) { return c.path === 'TASKS.md'; })[0];
  assert.ok(tasks, 'the shared file is flagged');
  assert.deepStrictEqual(
    tasks.worktrees.map(function (w) { return w.name; }).sort(),
    [path.basename(root), 'agent-a'].sort(),
    'the main copy is named among the holders'
  );
});

test('P1  committing in one worktree clears the overlap — it is an uncommitted-work check', function () {
  const root = makeMixedRepo();
  const a = gitLayer.createWorktree(root, 'agent-a', { io: io });
  const b = gitLayer.createWorktree(root, 'agent-b', { io: io });
  fs.appendFileSync(path.join(a.path, 'PROJECT.md'), '- agent A\n');
  fs.appendFileSync(path.join(b.path, 'PROJECT.md'), '- agent B\n');
  assert.strictEqual(gitLayer.worktreeConflicts(root).conflicts.length, 1);

  execFileSync('git', ['add', 'PROJECT.md'], { cwd: b.path, stdio: 'ignore' });
  execFileSync('git', ['commit', '-q', '-m', 'agent B lands its work'], { cwd: b.path, stdio: 'ignore' });

  // Once committed it belongs to a branch, and whether two branches disagree is
  // a merge question rather than a worktree one.
  assert.deepStrictEqual(gitLayer.worktreeConflicts(root).conflicts, [],
    'only uncommitted work counts as an overlap');
});

test('P1  a folder that is not a repository reports no overlaps rather than failing', function () {
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-git-plain-'));
  const result = gitLayer.worktreeConflicts(plain);
  assert.strictEqual(result.isRepo, false);
  assert.deepStrictEqual(result.conflicts, []);
});

test('P0-10a removing a worktree that holds uncommitted work is refused, not silently done', function () {
  const root = makeMixedRepo();
  const wt = gitLayer.createWorktree(root, 'agent-2', { io: io });
  fs.appendFileSync(path.join(wt.path, 'PROJECT.md'), '- unsaved work\n');

  const result = gitLayer.removeWorktree(root, 'agent-2');
  assert.strictEqual(result.ok, false);
  assert.ok(/uncommitted/i.test(result.error), 'the refusal says why');
  assert.ok(/--force/.test(result.error), 'and says how to override it');
  assert.deepStrictEqual(result.uncommitted, ['PROJECT.md'], 'and names what would be lost');
  assert.ok(fs.existsSync(wt.path), 'the worktree is still there');
});

test('P0-10b a clean worktree is removed, and its branch is kept', function () {
  const root = makeMixedRepo();
  const wt = gitLayer.createWorktree(root, 'agent-2', { io: io });
  const result = gitLayer.removeWorktree(root, 'agent-2');
  assert.ok(result.ok, result.error);
  assert.ok(!fs.existsSync(wt.path), 'the directory is gone');
  assert.strictEqual(gitLayer.listWorktrees(root).worktrees.length, 1, 'only the main copy is left');
  assert.notStrictEqual(
    execFileSync('git', ['rev-parse', '--verify', 'refs/heads/agent-2'], { cwd: root, encoding: 'utf8' }).trim(),
    '', 'the branch survives — deleting it is a separate decision');
});

test('a name that would escape the workspace is refused, not sanitised', function () {
  const root = makeMixedRepo();
  ['../escape', 'a/b', '..', '.hidden', '', '   '].forEach(function (bad) {
    const result = gitLayer.createWorktree(root, bad, { io: io });
    assert.strictEqual(result.ok, false, JSON.stringify(bad) + ' must be refused');
  });
  assert.ok(!fs.existsSync(path.join(path.dirname(root), 'escape')), 'nothing was created outside the workspace');
});

test('a repository with no commits yet gets an explanation, not a raw git error', function () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-empty-'));
  git(root, ['init', '-q', '-b', 'main']);
  const result = gitLayer.createWorktree(root, 'agent-2', { io: io });
  assert.strictEqual(result.ok, false);
  assert.ok(/no commits yet/i.test(result.error), 'says what is wrong: ' + result.error);
  assert.ok(/first commit/i.test(result.error), 'and what to do about it');
});

test('local only: the worktree flow contacts no remote', function () {
  const source = fs.readFileSync(path.join(__dirname, 'git.js'), 'utf8');
  [/\bgit\(root, \['push'/, /'fetch'/, /'clone'/, /'pull'/, /\bgh\b.*\bpr\b/].forEach(function (pattern) {
    assert.ok(!pattern.test(source), 'no remote operation matching ' + pattern);
  });
  const result = gitLayer.createWorktree(fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-nr-')), 'x');
  assert.strictEqual(result.ok, false, 'a non-repo is refused rather than initialised from anywhere');
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
