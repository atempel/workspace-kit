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
});

test('blocked actions are declared unavailable, not drawn as if they worked', function () {
  const root = makeWorkspace();
  const body = server.handle(root, '/api/dashboard', new URLSearchParams()).body;
  assert.deepStrictEqual(body.capabilities,
    { commit: false, pullRequest: false, worktrees: false },
    'the commit/PR/worktree flows are blocked on open product questions in #79');
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
