/**
 * Zero-dependency test for core/server.js — the local HTTP surface the Local
 * Web App (#29) and its dashboard (#169) consume.
 *
 * Run with `npm run test:server`.
 */
'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const generator = require('./generator.js');
const server = require('./server.js');

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-server-'));
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
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['add', '.'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: root, stdio: 'ignore' });
  return root;
}

function get(port, urlPath) {
  return new Promise(function (resolve, reject) {
    http.get({ host: server.HOST, port: port, path: urlPath }, function (res) {
      let data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null, headers: res.headers });
      });
    }).on('error', reject);
  });
}

function request(port, method, urlPath) {
  return new Promise(function (resolve, reject) {
    const req = http.request({ host: server.HOST, port: port, path: urlPath, method: method },
      function (res) {
        let data = '';
        res.on('data', function (chunk) { data += chunk; });
        res.on('end', function () { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); });
      });
    req.on('error', reject);
    req.end();
  });
}

const tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// ---------------------------------------------------------------------------

test('zero dependencies: Node built-ins and core/ only', function () {
  const source = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const requires = (source.match(/require\((['"])(.*?)\1\)/g) || [])
    .map(function (r) { return r.replace(/require\((['"])(.*?)\1\)/, '$2'); });
  const allowed = ['http', 'path', 'fs', './inspect.js', './doctor.js', './git.js'];
  requires.forEach(function (dep) {
    assert.ok(allowed.indexOf(dep) !== -1, 'unexpected dependency: ' + dep);
  });
});

test('/api/dashboard returns every section the prototype renders, in one round trip', function () {
  const root = makeWorkspace();
  const result = server.handle(root, '/api/dashboard', new URLSearchParams());
  assert.strictEqual(result.status, 200);
  const body = result.body;
  ['overview', 'health', 'sessions', 'queue', 'git', 'capabilities']
    .forEach(function (key) { assert.ok(key in body, 'missing section: ' + key); });
  assert.strictEqual(body.isWorkspace, true);
  assert.ok(body.overview.files.length > 0);
  assert.ok('gitState' in body.overview.files[0], 'the Overview table carries its git column');
  assert.ok('verdict' in body.health);
  assert.ok(Array.isArray(body.overview.graph.edges));
  assert.ok(Array.isArray(body.git.worktrees),
    'the Source control section lists worktrees, which the spec makes P0');
});

test('the worktree list is served, since listing is a read', function () {
  const root = makeWorkspace();
  const body = server.handle(root, '/api/dashboard', new URLSearchParams()).body;
  // The workspace fixture is a git repo with only its main working copy.
  assert.strictEqual(body.git.worktrees.length, 1);
  assert.strictEqual(body.git.worktrees[0].isMain, true);
  assert.ok('branch' in body.git.worktrees[0]);
});

test('worktree overlaps are served alongside the list, so the UI need not compute them', function () {
  const root = makeWorkspace();
  const body = server.handle(root, '/api/dashboard', new URLSearchParams()).body;
  assert.ok(Array.isArray(body.git.worktreeConflicts),
    'the Source control section can flag overlaps without a second round trip');
  // A single-worktree workspace has nothing to overlap with, and that must read
  // as an empty answer rather than a missing field.
  assert.deepStrictEqual(body.git.worktreeConflicts, []);
});

test('blocked actions are declared unavailable, not drawn as if they worked', function () {
  const root = makeWorkspace();
  const body = server.handle(root, '/api/dashboard', new URLSearchParams()).body;
  assert.deepStrictEqual(body.capabilities,
    { commit: false, pullRequest: false, worktrees: false },
    'this server is read-only, so the UI renders state and hands execution to the CLI');
});

test('one scan backs every section, so they cannot disagree', function () {
  const root = makeWorkspace();
  const body = server.handle(root, '/api/dashboard', new URLSearchParams()).body;
  const overviewPaths = body.overview.files.map(function (f) { return f.path; }).sort();
  const healthPaths = body.health.files.map(function (f) { return f.path; }).sort();
  assert.deepStrictEqual(healthPaths, overviewPaths,
    'the health report and the overview table describe the same file set');
});

test('a path escaping the server root is refused', function () {
  const root = makeWorkspace();
  ['../', '../../etc', '/etc'].forEach(function (attempt) {
    const query = new URLSearchParams();
    query.set('path', attempt);
    const result = server.handle(root, '/api/index', query);
    assert.strictEqual(result.status, 400, attempt + ' must be refused');
    assert.match(result.body.error, /escapes the workspace root/);
  });
  assert.strictEqual(server.resolveWorkspace(root, 'src'), path.join(root, 'src'),
    'a path inside the root is still allowed');
});

test('an unknown endpoint is a 404, not a crash', function () {
  const root = makeWorkspace();
  const result = server.handle(root, '/api/nope', new URLSearchParams());
  assert.strictEqual(result.status, 404);
});

test('a folder that is not a workspace is reported, not an error', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-srv-none-'));
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'hi\n');
  const body = server.handle(dir, '/api/dashboard', new URLSearchParams()).body;
  assert.strictEqual(body.isWorkspace, false);
  assert.match(body.detection.reason, /Not a workspace-kit workspace/);
});

test('over the wire: it binds to localhost and serves JSON', async function () {
  const root = makeWorkspace();
  const instance = server.createServer(root);
  await new Promise(function (resolve) { instance.listen(0, server.HOST, resolve); });
  const port = instance.address().port;
  try {
    assert.strictEqual(instance.address().address, '127.0.0.1', 'never bound to a public interface');

    const health = await get(port, '/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.ok, true);
    assert.match(health.headers['content-type'], /application\/json/);

    const dash = await get(port, '/api/dashboard');
    assert.strictEqual(dash.status, 200);
    assert.strictEqual(dash.body.isWorkspace, true);

    const doctorRes = await get(port, '/api/doctor');
    assert.ok('verdict' in doctorRes.body);
  } finally {
    instance.close();
  }
});

test('over the wire: the server is read-only — writes are refused', async function () {
  const root = makeWorkspace();
  const instance = server.createServer(root);
  await new Promise(function (resolve) { instance.listen(0, server.HOST, resolve); });
  const port = instance.address().port;
  try {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const res = await request(port, method, '/api/index');
      assert.strictEqual(res.status, 405, method + ' must be refused');
      assert.match(res.body.error, /read-only/);
    }
  } finally {
    instance.close();
  }
});

// --- serving the built dashboard -------------------------------------------
// `serve` hands out the compiled front end as well as the JSON, so the whole
// dashboard is one command and one port. Static GETs do not touch the read-only
// guarantee — but the directory still has to be a wall, not a suggestion.

/** A stand-in for web/dist, plus a secret next to it that must stay unreachable. */
function makeUiDir() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-ui-'));
  const dist = path.join(base, 'dist');
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>dashboard</title>');
  fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)');
  fs.writeFileSync(path.join(base, 'secret.txt'), 'TOP-SECRET');
  return { dist: dist, base: base };
}

function getRaw(port, urlPath) {
  return new Promise(function (resolve, reject) {
    http.get({ host: server.HOST, port: port, path: urlPath }, function (res) {
      let data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        resolve({ status: res.statusCode, body: data, headers: res.headers });
      });
    }).on('error', reject);
  });
}

async function withServer(root, options, fn) {
  const instance = server.createServer(root, options);
  await new Promise(function (resolve) { instance.listen(0, server.HOST, resolve); });
  try {
    return await fn(instance.address().port);
  } finally {
    instance.close();
  }
}

test('the built dashboard is served at /, so no second server is needed', async function () {
  const ui = makeUiDir();
  await withServer(makeWorkspace(), { uiDir: ui.dist }, async function (port) {
    const res = await getRaw(port, '/');
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.body, /<title>dashboard<\/title>/);

    const asset = await getRaw(port, '/assets/app.js');
    assert.strictEqual(asset.status, 200);
    assert.match(asset.headers['content-type'], /javascript/);
  });
});

test('the JSON API still wins over the static files', async function () {
  const ui = makeUiDir();
  await withServer(makeWorkspace(), { uiDir: ui.dist }, async function (port) {
    const res = await getRaw(port, '/api/health');
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.strictEqual(JSON.parse(res.body).ok, true);
  });
});

test('an unknown path falls back to the app, not to a 404', async function () {
  const ui = makeUiDir();
  await withServer(makeWorkspace(), { uiDir: ui.dist }, async function (port) {
    // The dashboard is one page whose section state lives in the client, so a
    // reload on any path has to reach the app.
    const res = await getRaw(port, '/health');
    assert.strictEqual(res.status, 200);
    assert.match(res.body, /<title>dashboard<\/title>/);
  });
});

test('a path escaping the UI directory cannot read the disk', async function () {
  const ui = makeUiDir();
  await withServer(makeWorkspace(), { uiDir: ui.dist }, async function (port) {
    const attempts = [
      '/../secret.txt',
      '/../../etc/passwd',
      '/%2e%2e%2fsecret.txt',
      '/assets/../../secret.txt',
    ];
    for (const attempt of attempts) {
      const res = await getRaw(port, attempt);
      assert.ok(res.body.indexOf('TOP-SECRET') === -1, attempt + ' must not escape the UI directory');
      assert.ok(res.body.indexOf('root:') === -1, attempt + ' must not reach /etc/passwd');
    }
  });
});

test('when the dashboard is not built, / explains rather than failing blankly', async function () {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'wskit-nodist-'));
  await withServer(makeWorkspace(), { uiDir: empty }, async function (port) {
    const res = await getRaw(port, '/');
    assert.strictEqual(res.status, 503);
    assert.match(res.body, /has not been built yet/);
    assert.match(res.body, /npm --prefix web run build/,
      'the message has to name the command, not just the problem');

    const api = await getRaw(port, '/api/health');
    assert.strictEqual(api.status, 200, 'the API works whether or not the front end was built');
  });
});

test('ui:false keeps it a pure JSON surface, for the Vite dev proxy and the tests', async function () {
  await withServer(makeWorkspace(), { ui: false }, async function (port) {
    const res = await getRaw(port, '/');
    assert.strictEqual(res.status, 404);
    assert.match(JSON.parse(res.body).error, /unknown endpoint/);
  });
});

test('serving files did not open a write path: non-GET is still refused', async function () {
  const ui = makeUiDir();
  await withServer(makeWorkspace(), { uiDir: ui.dist }, async function (port) {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const res = await request(port, method, '/');
      assert.strictEqual(res.status, 405, method + ' must be refused at the static root too');
    }
  });
});

// ---------------------------------------------------------------------------

(async function () {
  let failures = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('PASS  ' + t.name);
    } catch (err) {
      failures++;
      console.log('FAIL  ' + t.name);
      console.log('      ' + (err && err.message ? String(err.message).split('\n')[0] : err));
    }
  }
  if (failures) {
    console.log('\n' + failures + ' of ' + tests.length + ' server test(s) failed.');
    process.exit(1);
  }
  console.log('\nAll ' + tests.length + ' server test(s) passed.');
})();
