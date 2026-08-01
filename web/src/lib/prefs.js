/**
 * View preferences, in the browser's localStorage.
 *
 * This file answers the Open Question docs/specs/web-app-dashboard.md left
 * standing: where suggestion dismissals, the workspace list and theme persist.
 * The answer is the browser, for one structural reason — `core/server.js` is
 * read-only by construction and refuses every non-GET method, so persisting
 * any of this server-side would mean opening a write endpoint. Punching that
 * hole for a checkbox would trade the server's central guarantee for a
 * convenience, and none of these three is a fact about the workspace: they are
 * facts about how one person is looking at it. Workspace facts stay in the
 * workspace's files, where the CLI can read them too.
 *
 * The cost is honest and worth naming: these preferences do not follow the user
 * to another browser, and clearing site data resets them. Nothing is lost when
 * that happens — a dismissed suggestion comes back, which is the safe direction
 * for the mistake to fall.
 *
 * Everything workspace-specific is keyed by the workspace's root path, so two
 * workspaces served from the same port do not inherit each other's state.
 */

const NS = 'wskit';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + ':' + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    // Corrupt or unreadable storage must never take the dashboard down with
    // it — a lost preference is a far smaller problem than a blank screen.
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(NS + ':' + key, JSON.stringify(value));
  } catch {
    /* private mode, or a full quota: the UI still works without persistence */
  }
}

// --- theme ------------------------------------------------------------------

export function readTheme() {
  const stored = read('theme', null);
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

export function writeTheme(theme) {
  write('theme', theme);
}

// --- suggestion dismissals --------------------------------------------------

/**
 * A suggestion's identity, derived rather than stored.
 *
 * `core/doctor.js` emits findings without ids, and it should stay that way:
 * an id would be a UI concern leaking into the analysis layer, and the CLI has
 * no use for one. Kind + file + message is stable across runs for as long as
 * the finding itself is unchanged — and when the message changes, the finding
 * has genuinely changed and deserves to reappear rather than stay dismissed
 * under an old decision.
 */
export function suggestionKey(suggestion) {
  return [suggestion.kind || '', suggestion.file || '', suggestion.message || ''].join(' :: ');
}

export function readDismissed(root) {
  const list = read('dismissed:' + (root || ''), []);
  return Array.isArray(list) ? list : [];
}

export function writeDismissed(root, keys) {
  write('dismissed:' + (root || ''), keys);
}

// --- recently opened workspaces ---------------------------------------------

const MAX_RECENT = 8;

export function readWorkspaces() {
  const list = read('workspaces', []);
  return Array.isArray(list) ? list.filter((w) => w && typeof w.root === 'string') : [];
}

/**
 * Record the workspace currently being served, newest first.
 *
 * The server is bound to one root for its whole life, so this list is the only
 * memory the shell has of the others. It is a record of where the user has
 * been, not a set of live connections — which is exactly why the switcher can
 * offer them without being able to open them.
 */
export function rememberWorkspace(root, name) {
  if (!root) return readWorkspaces();
  const next = [
    { root, name: name || root, lastSeen: new Date().toISOString() },
    ...readWorkspaces().filter((w) => w.root !== root),
  ].slice(0, MAX_RECENT);
  write('workspaces', next);
  return next;
}

export function forgetWorkspace(root) {
  const next = readWorkspaces().filter((w) => w.root !== root);
  write('workspaces', next);
  return next;
}
