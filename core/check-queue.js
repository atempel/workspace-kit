/**
 * Zero-dependency test for `workspace-kit queue` (core/queue.js, #104) and
 * `workspace-kit commit` (core/git.js commitChanges, #98).
 *
 * Run with `npm run test:queue`.
 */
'use strict';

const assert = require('assert');
const { spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const inspector = require('./inspect.js');
const queueWriter = require('./queue.js');

const BIN = path.join(__dirname, '..', 'bin', 'workspace-kit.js');
const ENV = Object.assign({}, process.env, {
  GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.com',
});

function run(args, input) {
  return spawnSync('node', [BIN].concat(args), { encoding: 'utf8', input: input || '', env: ENV });
}
function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: ENV });
}
function tmp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function workspace() {
  const dir = tmp('wskit-queue-');
  fs.writeFileSync(path.join(dir, 'PROJECT.md'), '# P\n');
  fs.writeFileSync(path.join(dir, 'TASKS.md'), '# T\n');
  return dir;
}
function repo() {
  const dir = workspace();
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'initial']);
  return dir;
}

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// ---- #104 queue add -------------------------------------------------------

test('#104  queue add writes a stub with title, Type, Source, Added and Status: Pending', function () {
  const dir = workspace();
  const r = run(['queue', 'add', dir, '--title', 'Board export', '--type', 'board', '--source', 'Miro', '--note', 'Extract the flows.']);
  assert.strictEqual(r.status, 0, r.stderr);
  const names = fs.readdirSync(path.join(dir, 'queue'));
  assert.strictEqual(names.length, 1);
  assert.match(names[0], /^\d{4}-\d{2}-\d{2}-board-export\.md$/);
  const text = fs.readFileSync(path.join(dir, 'queue', names[0]), 'utf8');
  assert.match(text, /^# Queue item — Board export$/m);
  assert.match(text, /^- \*\*Type:\*\* Board$/m);
  assert.match(text, /^- \*\*Source:\*\* Miro$/m);
  assert.match(text, /^- \*\*Added:\*\* \d{4}-\d{2}-\d{2}$/m);
  assert.match(text, /^- \*\*Status:\*\* Pending$/m);
  assert.match(text, /## Notes\nExtract the flows\./);
});

test('#104  the written stub round-trips through core/inspect.js and the documented grep', function () {
  const dir = workspace();
  queueWriter.add(dir, { title: 'Voice note 14/07', type: 'Voice note', source: 'https://example.com/n', note: 'Covers the CLI.', date: '2026-07-14' });
  const items = inspector.inspect(dir).queue;
  assert.strictEqual(items.length, 1);
  const i = items[0];
  assert.strictEqual(i.title, 'Voice note 14/07');
  assert.strictEqual(i.type, 'Voice note');
  assert.strictEqual(i.source, 'https://example.com/n');
  assert.strictEqual(i.added, '2026-07-14');
  assert.strictEqual(i.status, 'pending');
  assert.strictEqual(i.notes, 'Covers the CLI.');
  assert.strictEqual(i.path, 'queue/2026-07-14-voice-note-14-07.md');
});

test('#104  queue add prompts for missing fields (piped answers) and slugs accents', function () {
  const dir = workspace();
  const r = run(['queue', 'add', dir], 'Notas de áudio\nVoice note\nhttps://x.example\n\n');
  assert.strictEqual(r.status, 0, r.stderr);
  const items = inspector.inspect(dir).queue;
  assert.strictEqual(items[0].title, 'Notas de áudio');
  assert.match(items[0].path, /-notas-de-audio\.md$/);
  assert.strictEqual(items[0].type, 'Voice note');
});

test('#104  queue add refuses to overwrite and rejects missing fields or unknown types', function () {
  const dir = workspace();
  const args = ['queue', 'add', dir, '--title', 'Same', '--type', 'Link', '--source', 's'];
  assert.strictEqual(run(args).status, 0);
  const file = path.join(dir, 'queue', fs.readdirSync(path.join(dir, 'queue'))[0]);
  fs.appendFileSync(file, 'hand edit\n');
  const again = run(args);
  assert.strictEqual(again.status, 1);
  assert.match(again.stderr, /already exists/);
  assert.match(fs.readFileSync(file, 'utf8'), /hand edit/);
  assert.strictEqual(run(['queue', 'add', dir, '-y', '--title', 'X', '--source', 's', '--type', 'Podcast']).status, 1);
  assert.strictEqual(run(['queue', 'add', dir, '-y', '--source', 's']).status, 1);
});

// ---- #104 queue list / done ----------------------------------------------

test('#104  queue list shows pending items before ingested ones', function () {
  const dir = workspace();
  queueWriter.add(dir, { title: 'Old', type: 'Link', source: 's', date: '2026-01-01' });
  queueWriter.add(dir, { title: 'New', type: 'Link', source: 's', date: '2026-02-01' });
  assert.ok(queueWriter.markDone(dir, 'queue/2026-02-01-new.md', 'TASKS.md').ok);
  const out = run(['queue', 'list', dir]).stdout;
  assert.match(out, /1 pending, 1 ingested/);
  assert.ok(out.indexOf('Old') < out.indexOf('New'), 'pending item listed first');
});

test('#104  queue done edits only that file: Status flips in place and the destination is recorded', function () {
  const dir = workspace();
  queueWriter.add(dir, { title: 'Spec idea', type: 'Document', source: 's', note: 'keep me', date: '2026-03-01' });
  const other = queueWriter.add(dir, { title: 'Other', type: 'Link', source: 's', date: '2026-03-02' });
  const otherBefore = fs.readFileSync(other.absolute, 'utf8');
  const r = run(['queue', 'done', '2026-03-01-spec-idea.md', dir, '--into', 'docs/specs/x.md (#1)']);
  assert.strictEqual(r.status, 0, r.stderr);
  const item = inspector.inspect(dir).queue.filter(function (q) { return q.title === 'Spec idea'; })[0];
  assert.strictEqual(item.status, 'ingested');
  assert.match(item.ingestedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(item.ingestedInto, 'docs/specs/x.md (#1)');
  assert.strictEqual(item.notes, 'keep me');
  assert.strictEqual(item.added, '2026-03-01');
  assert.strictEqual(fs.readFileSync(other.absolute, 'utf8'), otherBefore);
});

test('#104  queue done refuses paths outside queue/, an already-ingested item, and a missing --into', function () {
  const dir = workspace();
  queueWriter.add(dir, { title: 'A', type: 'Link', source: 's', date: '2026-03-01' });
  assert.strictEqual(run(['queue', 'done', '../PROJECT.md', dir, '--into', 'x']).status, 1);
  assert.strictEqual(run(['queue', 'done', 'PROJECT.md', dir, '--into', 'x']).status, 1);
  assert.strictEqual(run(['queue', 'done', '2026-03-01-a.md', dir]).status, 1);
  assert.strictEqual(run(['queue', 'done', '2026-03-01-a.md', dir, '--into', 'x']).status, 0);
  assert.strictEqual(run(['queue', 'done', '2026-03-01-a.md', dir, '--into', 'y']).status, 1);
});

// ---- #98 commit -----------------------------------------------------------

test('#98  commit shows the summary and message, and -y stages and commits every changed file', function () {
  const dir = repo();
  fs.appendFileSync(path.join(dir, 'TASKS.md'), '- more\n');
  fs.writeFileSync(path.join(dir, 'NEW.md'), '# new\n');
  const r = run(['commit', dir, '-y']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stderr, /2 files have changed/);
  assert.match(r.stderr, /Update 1 file and add 1 new file/);
  assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '');
  assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '2');
  assert.match(git(dir, ['log', '-1', '--format=%B']), /NEW\.md/);
});

test('#98  without -y it asks first: a "no" (or no answer) commits nothing', function () {
  const dir = repo();
  fs.appendFileSync(path.join(dir, 'TASKS.md'), '- more\n');
  const no = run(['commit', dir], 'n\n');
  assert.strictEqual(no.status, 1);
  assert.match(no.stderr, /Cancelled/);
  assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
  const eof = run(['commit', dir], '');
  assert.strictEqual(eof.status, 1);
  const yes = run(['commit', dir], 'y\n');
  assert.strictEqual(yes.status, 0, yes.stderr);
  assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '2');
});

test('#98  --message overrides the generated message', function () {
  const dir = repo();
  fs.appendFileSync(path.join(dir, 'TASKS.md'), '- more\n');
  assert.strictEqual(run(['commit', dir, '-y', '--message', 'Tidy the task list']).status, 0);
  assert.strictEqual(git(dir, ['log', '-1', '--format=%s']).trim(), 'Tidy the task list');
});

test('#98  nothing to commit: clear message, exit 0, no new commit', function () {
  const dir = repo();
  const r = run(['commit', dir, '-y']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /nothing has changed/);
  assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
  const notRepo = run(['commit', workspace(), '-y']);
  assert.strictEqual(notRepo.status, 0);
  assert.match(notRepo.stdout, /Not a git repository/);
});

test('#98  a workspace in a repo subfolder commits with correct repo-relative paths', function () {
  const top = repo();
  const sub = path.join(top, 'ws');
  fs.mkdirSync(sub);
  fs.writeFileSync(path.join(sub, 'PROJECT.md'), '# P\n');
  fs.writeFileSync(path.join(top, 'outside.txt'), 'x\n');
  const r = run(['commit', sub, '-y']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(git(top, ['show', '--name-only', '--format=', 'HEAD']), /ws\/PROJECT\.md/);
});

test('#98  local only: the commit path contains no remote operation', function () {
  const src = fs.readFileSync(path.join(__dirname, 'git.js'), 'utf8');
  const body = src.slice(src.indexOf('function commitChanges'), src.indexOf('// Worktrees'));
  ['push', 'fetch', 'pull', 'clone', 'remote'].forEach(function (w) {
    assert.ok(body.indexOf("'" + w + "'") === -1, 'no ' + w);
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
    console.log('      ' + (err && err.message ? err.message.split('\n')[0] : err));
  }
});

if (failures) {
  console.log('\n' + failures + ' of ' + tests.length + ' queue/commit test(s) failed.');
  process.exit(1);
} else {
  console.log('\nAll ' + tests.length + ' queue/commit test(s) passed.');
}
