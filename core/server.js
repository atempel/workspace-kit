/**
 * workspace//kit — local HTTP surface over core/.
 *
 * The bridge the Local Web App (docs/specs/local-web-app.md → #29) and its
 * dashboard (docs/specs/web-app-dashboard.md → #169) talk to. Confirmed with
 * the owner 2026-07-29: the Web App reaches the filesystem through a local Node
 * server, not the browser's File System Access API — `core/` uses `fs` and a
 * browser could not run any of it (see DECISIONS.md).
 *
 * This module owns **no domain logic**. Every endpoint is a thin envelope over
 * core/inspect.js, core/doctor.js and core/git.js, so whatever the dashboard
 * shows, the CLI can produce identically — that shared-engine property is the
 * whole reason the local-server option was chosen over the browser API.
 *
 * Deliberately zero-dependency: Node's own `http` is enough for a localhost
 * JSON surface, and pulling in a framework here would put a dependency
 * underneath every `core/` consumer. The React/Tailwind/shadcn build step
 * decided on 2026-07-28 is scoped to the *front end* that consumes this, not to
 * this server.
 *
 * Security posture: binds to 127.0.0.1 only, refuses any workspace path outside
 * the root it was started with, and exposes nothing that writes. Read-only by
 * construction — the commit/PR/worktree actions are still blocked on open
 * product questions (see docs/specs/git-integration-layer.md), and this server
 * must not grow write endpoints ahead of those answers.
 */

'use strict';

const http = require('http');
const path = require('path');

const inspector = require('./inspect.js');
const doctor = require('./doctor.js');
const gitLayer = require('./git.js');

const HOST = '127.0.0.1';

/**
 * Resolve a requested workspace path against the server's root.
 *
 * Returns null for anything that escapes it. The dashboard is a localhost tool,
 * but a browser page on another origin can still issue requests to localhost,
 * so "read any path on disk" would be a genuine hole rather than a theoretical
 * one.
 */
function resolveWorkspace(root, requested) {
  if (!requested) return root;
  const resolved = path.resolve(root, requested);
  const rel = path.relative(root, resolved);
  if (rel.split(path.sep)[0] === '..' || path.isAbsolute(rel)) return null;
  return resolved;
}

function send(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/**
 * Build the payload for one route. Exported separately from the server so the
 * routes can be tested without binding a port.
 */
function handle(root, pathname, query) {
  const target = resolveWorkspace(root, query.get('path'));
  if (target === null) {
    return { status: 400, body: { error: 'path escapes the workspace root this server was started with' } };
  }

  if (pathname === '/api/health') {
    return { status: 200, body: { ok: true, root: root } };
  }

  if (pathname === '/api/index') {
    return { status: 200, body: inspector.inspect(target) };
  }

  if (pathname === '/api/doctor') {
    const index = inspector.inspect(target);
    const fs = require('fs');
    return {
      status: 200,
      body: doctor.diagnose(index, {
        readFile: function (rel) { return fs.readFileSync(path.join(target, rel), 'utf8'); },
      }),
    };
  }

  if (pathname === '/api/status') {
    const index = inspector.inspect(target);
    const summary = gitLayer.changeSummary(target, index);
    return {
      status: 200,
      body: Object.assign({}, summary, { files: gitLayer.annotate(index, gitLayer.fileStates(target)) }, {
        changes: summary.files,
      }),
    };
  }

  /**
   * Everything the dashboard needs in one round trip. The prototype renders
   * five sections from one scan; making it issue four requests would let the
   * sections disagree with each other mid-refresh.
   */
  if (pathname === '/api/dashboard') {
    const fs = require('fs');
    const index = inspector.inspect(target);
    const report = doctor.diagnose(index, {
      readFile: function (rel) { return fs.readFileSync(path.join(target, rel), 'utf8'); },
    });
    const summary = gitLayer.changeSummary(target, index);
    return {
      status: 200,
      body: {
        root: index.root,
        isWorkspace: index.isWorkspace,
        detection: index.detection,
        overview: {
          files: gitLayer.annotate(index, gitLayer.fileStates(target)),
          totals: index.totals,
          graph: index.graph,
        },
        health: report,
        sessions: index.sessions,
        queue: index.queue,
        git: summary,
        // The actions the prototype draws are not wired: they are blocked on
        // the hosting-provider and worktree-placement questions in #79. Saying
        // so in the payload keeps the UI honest rather than drawing live-looking
        // buttons over nothing.
        capabilities: { commit: false, pullRequest: false, worktrees: false },
      },
    };
  }

  return { status: 404, body: { error: 'unknown endpoint: ' + pathname } };
}

function createServer(root) {
  const resolvedRoot = path.resolve(root);
  return http.createServer(function (req, res) {
    if (req.method !== 'GET') {
      return send(res, 405, { error: 'this server is read-only; only GET is supported' });
    }
    let parsed;
    try {
      parsed = new URL(req.url, 'http://' + HOST);
    } catch (err) {
      return send(res, 400, { error: 'malformed request URL' });
    }
    let result;
    try {
      result = handle(resolvedRoot, parsed.pathname, parsed.searchParams);
    } catch (err) {
      return send(res, 500, { error: String((err && err.message) || err) });
    }
    send(res, result.status, result.body);
  });
}

function listen(root, port, callback) {
  const server = createServer(root);
  server.listen(port, HOST, function () { callback(null, server); });
  server.on('error', function (err) { callback(err); });
  return server;
}

module.exports = {
  createServer: createServer,
  listen: listen,
  handle: handle,
  resolveWorkspace: resolveWorkspace,
  HOST: HOST,
};
