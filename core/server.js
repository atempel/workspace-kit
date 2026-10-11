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
 * Security posture: binds to 127.0.0.1 by default, refuses any workspace path
 * outside the root it was started with, and exposes nothing that writes.
 * Read-only by construction — the commit/PR/worktree actions are still blocked
 * on open product questions (see docs/specs/git-integration-layer.md), and this
 * server must not grow write endpoints ahead of those answers. `--host` can
 * widen the bind (a container has to, or nothing outside it can connect); the
 * CLI warns when it does, because a wider bind offers this workspace's contents
 * to anything that can reach the port.
 *
 * It also serves the compiled dashboard from `web/dist`, so the whole thing is
 * one command and one port with no Vite in the picture (docs/specs/web-app-
 * dashboard.md). That is why this module requires `fs` even though
 * core/inspect.js is meant to be the only module that touches the disk — the
 * boundary that rule protects is *reading the workspace*, which still happens
 * in exactly one place. Reading the app's own build output is a different
 * concern, and serving bytes it already produced is not domain logic (see
 * DECISIONS.md, 2026-07-30).
 */

'use strict';

const fs = require('fs');
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

/** The compiled dashboard, when it has been built. */
const DEFAULT_UI_DIR = path.resolve(__dirname, '..', 'web', 'dist');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Resolve a request path inside the UI directory, or null if it escapes.
 *
 * Same reasoning as resolveWorkspace: a page on another origin can still aim
 * requests at localhost, so "../../etc/passwd" has to be refused here too
 * rather than trusted because the directory is ours.
 */
function resolveAsset(uiDir, pathname) {
  const decoded = decodeURIComponent(pathname);
  const resolved = path.resolve(uiDir, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded));
  const rel = path.relative(uiDir, resolved);
  if (rel && (rel.split(path.sep)[0] === '..' || path.isAbsolute(rel))) return null;
  return resolved;
}

function readIfFile(file) {
  try {
    if (!fs.statSync(file).isFile()) return null;
    return fs.readFileSync(file);
  } catch (err) {
    return null;
  }
}

/**
 * Serve the built dashboard.
 *
 * Unknown paths fall back to index.html rather than 404ing — the dashboard is a
 * single page and its section state lives in the client, so a reload on any
 * path has to reach the app rather than a not-found. `/api/*` never gets here.
 *
 * If the build is missing this says so in plain language instead of 404ing: an
 * empty page with no explanation is the worst outcome, and "not built yet" is a
 * normal state, not an error.
 */
function serveStatic(res, uiDir, pathname) {
  const index = path.join(uiDir, 'index.html');
  if (!readIfFile(index)) {
    return sendText(
      res,
      503,
      'The dashboard has not been built yet.\n\n' +
        'Build it once with:\n' +
        '  npm --prefix web install\n' +
        '  npm --prefix web run build\n\n' +
        'then restart this server. The JSON API at /api/dashboard is already working.\n'
    );
  }

  const asset = pathname === '/' ? null : resolveAsset(uiDir, pathname);
  if (asset !== null) {
    const body = readIfFile(asset);
    if (body) {
      const type = CONTENT_TYPES[path.extname(asset).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': body.length,
        // The build fingerprints its assets, so index.html is the only thing
        // that must never be cached — a stale one would pin an old bundle.
        'Cache-Control': asset === index ? 'no-store' : 'public, max-age=3600',
      });
      return res.end(body);
    }
  }

  const html = readIfFile(index);
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES['.html'],
    'Content-Length': html.length,
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

function sendText(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
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
        // Worktrees are listed here because the Source control section names
        // them as P0 (docs/specs/web-app-dashboard.md). Listing is a read, so
        // it belongs on this server; creating and removing them are writes and
        // stay in the CLI, which is what `capabilities` below says.
        //
        // `worktreeConflicts` is the same kind of read one level up: which
        // files two worktrees are both sitting on right now. It costs one
        // `git status` per worktree, which is why it is computed here once for
        // the whole payload rather than per section.
        git: Object.assign({}, summary, {
          worktrees: gitLayer.listWorktrees(target).worktrees,
          worktreeConflicts: gitLayer.worktreeConflicts(target).conflicts,
        }),
        // What the UI may *do*, as opposed to what it may show. Every one of
        // these is false because this server is read-only by design and rejects
        // non-GET; the dashboard renders state and hands execution to the CLI.
        // Saying so in the payload keeps the UI honest rather than drawing
        // live-looking buttons over nothing.
        //
        // `pullRequest` is false for a second, independent reason: the git
        // layer is scoped to local git and contacts no remote at all
        // (see DECISIONS.md, 2026-07-29).
        capabilities: { commit: false, pullRequest: false, worktrees: false },
      },
    };
  }

  return { status: 404, body: { error: 'unknown endpoint: ' + pathname } };
}

function createServer(root, options) {
  const opts = options || {};
  const resolvedRoot = path.resolve(root);
  // `ui: false` keeps the server a pure JSON surface — what the test suite and
  // the Vite dev proxy both want, since Vite serves the front end itself there.
  const uiDir = opts.ui === false ? null : path.resolve(opts.uiDir || DEFAULT_UI_DIR);

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

    if (uiDir && parsed.pathname.indexOf('/api/') !== 0) {
      try {
        return serveStatic(res, uiDir, parsed.pathname);
      } catch (err) {
        return sendText(res, 500, String((err && err.message) || err));
      }
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

function listen(root, port, callback, options) {
  const opts = options || {};
  const host = opts.host || HOST;
  const server = createServer(root, opts);
  server.listen(port, host, function () { callback(null, server); });
  server.on('error', function (err) { callback(err); });
  return server;
}

module.exports = {
  createServer: createServer,
  listen: listen,
  handle: handle,
  resolveWorkspace: resolveWorkspace,
  resolveAsset: resolveAsset,
  DEFAULT_UI_DIR: DEFAULT_UI_DIR,
  HOST: HOST,
};
