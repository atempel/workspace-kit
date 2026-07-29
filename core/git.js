/**
 * workspace//kit — git integration layer (read side + safe-edit substrate).
 *
 * Implements the unblocked half of docs/specs/git-integration-layer.md (→ #79):
 * file-state tracking, the safe-edit check, a plain-language change summary,
 * and a templated commit message.
 *
 * Worktree create/list/remove was added 2026-07-29, once the owner answered the
 * placement/naming question: convention by default, with the user free to
 * override both the name and the location (see DECISIONS.md).
 *
 * Deliberately still NOT here: the **PR flow**, and anything that talks to a
 * remote. The owner scoped this layer to local git only (2026-07-29) — pushing
 * and opening PRs drag in authentication and a hosting-provider surface whose
 * security deserves its own pass, so they are a later, separate step rather
 * than a half-built one now.
 *
 * Model-agnostic by construction, which is a product rule (see DECISIONS.md,
 * 2026-07-26), not a style preference: every string this module produces is a
 * deterministic template over file names and add/remove counts. There is no
 * code path here that calls an AI model, and a test asserts it.
 *
 * Git is driven by shelling out to the local `git` binary with explicit
 * argument arrays -- never a shell string -- so a path containing a space or a
 * quote cannot turn into a command. Zero runtime dependencies, Node-only.
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const STATE = {
  UNTRACKED: 'untracked',
  MODIFIED: 'modified-unstaged',
  STAGED: 'staged',
  CLEAN: 'committed-clean',
};

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function tryGit(root, args) {
  try {
    return git(root, args);
  } catch (err) {
    return null;
  }
}

function isGitRepo(root) {
  return tryGit(root, ['rev-parse', '--is-inside-work-tree']) !== null;
}

function currentBranch(root) {
  const out = tryGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return out ? out.trim() : null;
}

/**
 * Classify every file git knows about into one of the four P0 states.
 *
 * `git status --porcelain=v1 -z` gives a two-character code per path: the first
 * column is the index (staged) state, the second the working-tree state. A file
 * can be both -- staged edits plus further unstaged edits -- and in that case
 * the unstaged change is what matters to a caller about to overwrite the file,
 * so `modified-unstaged` wins. That ordering is what makes the safe-edit check
 * below trustworthy.
 *
 * Files git does not report are committed-clean; they are filled in by
 * `annotate()` from the inspection index rather than listed here, so this
 * function stays a thin, honest read of git's own answer.
 */
function fileStates(root) {
  const states = {};
  const raw = tryGit(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  if (raw === null) return states;

  const records = raw.split('\0');
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    const index = record[0];
    const worktree = record[1];
    let file = record.slice(3);
    if (index === 'R' || index === 'C') {
      // A rename record is "XY <new>\0<old>"; the following entry is the old
      // path and must be consumed, not read as another file.
      i++;
    }
    if (!file) continue;
    if (index === '?' || worktree === '?') {
      states[file] = STATE.UNTRACKED;
    } else if (worktree !== ' ' && worktree !== '') {
      states[file] = STATE.MODIFIED;
    } else if (index !== ' ' && index !== '') {
      states[file] = STATE.STAGED;
    }
  }
  return states;
}

/**
 * Join git state onto an inspection index's file list (#77's index is the
 * substrate this feature builds on, rather than re-walking the folder).
 * Returns a new array; the index is not mutated.
 */
function annotate(index, states) {
  return index.files.map(function (file) {
    return Object.assign({}, file, {
      gitState: Object.prototype.hasOwnProperty.call(states, file.path)
        ? states[file.path]
        : STATE.CLEAN,
    });
  });
}

function countsOf(states, totalFiles) {
  const counts = { untracked: 0, 'modified-unstaged': 0, staged: 0, 'committed-clean': 0 };
  Object.keys(states).forEach(function (file) { counts[states[file]] += 1; });
  const tracked = totalFiles - Object.keys(states).length;
  counts['committed-clean'] = tracked > 0 ? tracked : 0;
  return counts;
}

/** Line counts per changed file, from git's own diff rather than re-reading. */
function numstat(root, staged) {
  const out = tryGit(root, staged
    ? ['diff', '--numstat', '--cached']
    : ['diff', '--numstat']);
  const result = {};
  if (!out) return result;
  out.split('\n').forEach(function (line) {
    if (!line.trim()) return;
    const parts = line.split('\t');
    if (parts.length < 3) return;
    result[parts[2]] = {
      added: parts[0] === '-' ? null : parseInt(parts[0], 10),
      removed: parts[1] === '-' ? null : parseInt(parts[1], 10),
    };
  });
  return result;
}

/** Plain language for one file's change — no git vocabulary, per the spec. */
function describeChange(entry) {
  if (entry.state === STATE.UNTRACKED) return 'new file';
  if (entry.added === null || entry.removed === null) return 'changed';
  if (entry.added && !entry.removed) return 'added ' + entry.added + (entry.added === 1 ? ' line' : ' lines');
  if (entry.removed && !entry.added) return 'removed ' + entry.removed + (entry.removed === 1 ? ' line' : ' lines');
  if (!entry.added && !entry.removed) return 'changed';
  return 'added ' + entry.added + ', removed ' + entry.removed;
}

/**
 * A plain-language summary of what has changed, suitable for showing someone
 * who does not use git — the input to both the commit flow and the dashboard's
 * Source control section.
 */
function changeSummary(root, index) {
  if (!isGitRepo(root)) {
    return { isRepo: false, branch: null, files: [], counts: null, totalAdded: 0, totalRemoved: 0 };
  }
  const states = fileStates(root);
  const unstaged = numstat(root, false);
  const staged = numstat(root, true);

  const files = Object.keys(states).sort().map(function (file) {
    const lines = unstaged[file] || staged[file] || { added: null, removed: null };
    const entry = {
      path: file,
      state: states[file],
      added: lines.added,
      removed: lines.removed,
    };
    entry.what = describeChange(entry);
    return entry;
  });

  return {
    isRepo: true,
    branch: currentBranch(root),
    files: files,
    counts: countsOf(states, index ? index.files.length : Object.keys(states).length),
    totalAdded: files.reduce(function (n, f) { return n + (f.added || 0); }, 0),
    totalRemoved: files.reduce(function (n, f) { return n + (f.removed || 0); }, 0),
  };
}

/**
 * Safe-edit substrate: may workspace//kit write to this file?
 *
 * Unsafe means the file has uncommitted working-tree changes that a write
 * would destroy. Staged-but-not-further-modified is safe: the change is
 * already recorded in the index and recoverable. Untracked is safe to create
 * but flagged, since there is no committed version to fall back to.
 */
function safeEditCheck(states, filePath) {
  const state = Object.prototype.hasOwnProperty.call(states, filePath)
    ? states[filePath]
    : STATE.CLEAN;
  if (state === STATE.MODIFIED) {
    return {
      safe: false,
      state: state,
      warning: filePath + ' has uncommitted changes. Writing to it now would overwrite work that '
        + 'is not recorded anywhere — commit or stash it first, or confirm you want it replaced.',
    };
  }
  if (state === STATE.UNTRACKED) {
    return {
      safe: true,
      state: state,
      warning: filePath + ' is not tracked by git, so there is no committed version to fall back '
        + 'on if this write is wrong.',
    };
  }
  return { safe: true, state: state, warning: null };
}

/**
 * A commit message templated from the change summary. Deterministic by
 * requirement, not by convenience: #79's model-agnostic guardrail means this
 * text may never come from a model.
 */
function buildCommitMessage(summary) {
  if (!summary.files.length) return null;
  const byState = {};
  summary.files.forEach(function (f) { (byState[f.state] = byState[f.state] || []).push(f); });

  const created = (byState[STATE.UNTRACKED] || []).length;
  const edited = summary.files.length - created;
  const parts = [];
  if (edited) parts.push('Update ' + edited + (edited === 1 ? ' file' : ' files'));
  if (created) parts.push('add ' + created + (created === 1 ? ' new file' : ' new files'));
  const subject = parts.join(' and ').replace(/^./, function (c) { return c.toUpperCase(); });

  const body = summary.files.map(function (f) {
    return '- ' + f.path + ' (' + f.what + ')';
  });

  return subject + '\n\n' + body.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Worktrees
//
// Placement/naming was an open product question until 2026-07-29; the answer is
// **convention by default, override always available** (see DECISIONS.md).
//
// The convention is `<workspace>/.worktrees/<name>`, kept *inside* the
// workspace rather than as a sibling folder. Two reasons, both concrete:
// a workspace stays one movable, self-contained directory, and every other
// module here already refuses to reason about paths outside the workspace root
// (core/server.js rejects them outright). A sibling would make the workspace's
// own worktrees the one thing living outside itself.
//
// Nesting is only safe because the read side already accounts for it:
// core/inspect.js skips nested git repositories, so a worktree's contents never
// get folded into the parent workspace's index or its health check.
// `ensureIgnored()` below adds the ignore rule when the first worktree is
// created, so the parent repo never reports its own worktrees as stray files.
// ---------------------------------------------------------------------------

const WORKTREE_DIR = '.worktrees';

/**
 * Names become directory names and branch names, so they are validated, not
 * sanitised: quietly rewriting a name the user chose would create a worktree
 * somewhere other than where they asked, which is worse than refusing.
 */
function validateWorktreeName(name) {
  if (typeof name !== 'string' || !name.trim()) return 'A worktree name is required.';
  if (name !== name.trim()) return 'Worktree name cannot start or end with whitespace.';
  if (name.length > 64) return 'Worktree name is too long (max 64 characters).';
  if (/[\\/]/.test(name)) return 'Worktree name cannot contain a path separator — it is a single folder name.';
  if (name === '.' || name === '..' || name.indexOf('..') !== -1) return 'Worktree name cannot contain "..".';
  if (/^[.-]/.test(name)) return 'Worktree name cannot start with "." or "-".';
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return 'Worktree name may only contain letters, digits, dot, underscore and dash.';
  return null;
}

/** Where the convention would place a worktree of this name. */
function defaultWorktreePath(root, name) {
  return path.join(root, WORKTREE_DIR, name);
}

/**
 * Add `.worktrees/` to the workspace's .gitignore if it is not already covered.
 * Without this the parent repo reports every worktree it owns as an untracked
 * file, which is exactly the noise the change summary exists to keep clean.
 * Idempotent, and it never rewrites an existing line.
 */
function ensureIgnored(root, readFile, writeFile, dirPattern) {
  const full = path.join(root, '.gitignore');
  const base = dirPattern || WORKTREE_DIR;
  let current = '';
  try {
    current = readFile(full);
  } catch (err) {
    current = null; // no .gitignore yet
  }
  const pattern = base + '/';
  if (current !== null && current.split('\n').some(function (line) {
    const t = line.trim();
    return t === pattern || t === '/' + pattern || t === base || t === '/' + base;
  })) {
    return false;
  }
  const header = '# Worktrees created by workspace//kit';
  const existing = current === null ? '' : current;
  const prefix = existing === '' || existing.endsWith('\n') ? '' : '\n';

  // The heading is written once; later worktrees just add their line under it,
  // rather than repeating the comment for every entry.
  if (existing.indexOf(header) !== -1) {
    const lines = existing.split('\n');
    const at = lines.findIndex(function (l) { return l.trim() === header; });
    let insert = at + 1;
    while (insert < lines.length && lines[insert].trim() && lines[insert].trim()[0] !== '#') insert++;
    lines.splice(insert, 0, pattern);
    writeFile(full, lines.join('\n'));
    return true;
  }

  writeFile(full, existing + prefix + (existing === '' ? '' : '\n') + header + '\n' + pattern + '\n');
  return true;
}

/**
 * A worktree placed inside the repository shows up in the parent's own status
 * as a stray directory — true whether it landed there by convention or because
 * the user pointed `--path` at somewhere inside the workspace. Returns the
 * top-level directory to ignore, or null when the worktree lives outside the
 * workspace entirely and the parent repo will never see it.
 */
function ignorePatternFor(root, target) {
  const rel = path.relative(root, target);
  if (!rel || rel === '..' || rel.indexOf('..' + path.sep) === 0 || path.isAbsolute(rel)) return null;
  return rel.split(path.sep)[0];
}

/**
 * Every worktree of this repository, the main one included, parsed from git's
 * own porcelain output rather than by reading .git/worktrees ourselves.
 */
function listWorktrees(root) {
  if (!isGitRepo(root)) return { isRepo: false, worktrees: [] };
  const out = tryGit(root, ['worktree', 'list', '--porcelain']);
  if (out === null) return { isRepo: true, worktrees: [] };

  const worktrees = [];
  let current = null;
  out.split('\n').forEach(function (line) {
    if (line.indexOf('worktree ') === 0) {
      current = { path: line.slice(9), branch: null, head: null, bare: false, detached: false };
      worktrees.push(current);
    } else if (!current) {
      return;
    } else if (line.indexOf('branch ') === 0) {
      current.branch = line.slice(7).replace(/^refs\/heads\//, '');
    } else if (line.indexOf('HEAD ') === 0) {
      current.head = line.slice(5);
    } else if (line === 'bare') {
      current.bare = true;
    } else if (line === 'detached') {
      current.detached = true;
    }
  });

  const mainPath = worktrees.length ? worktrees[0].path : null;
  return {
    isRepo: true,
    worktrees: worktrees.map(function (w) {
      const inside = w.path.indexOf(path.join(root, WORKTREE_DIR) + path.sep) === 0;
      return Object.assign({}, w, {
        isMain: w.path === mainPath,
        name: path.basename(w.path),
        // Whether this one sits where the convention would have put it — the
        // UI needs to tell "ours" apart from a worktree the user placed by hand.
        byConvention: inside,
      });
    }),
  };
}

/**
 * Create a worktree. `name` alone is enough — placement and branch name both
 * follow the convention. `options.path` overrides the location (the user may
 * put it anywhere, including outside the workspace) and `options.branch`
 * overrides the branch name.
 *
 * Local only, by design: no remote is contacted, nothing is pushed.
 */
function createWorktree(root, name, options) {
  const opts = options || {};
  // The filesystem is injected rather than required, the same way core/doctor.js
  // takes its `readFile`: this module deliberately depends on nothing but
  // `child_process` and `path`, and a test pins that. Without an `io` the
  // worktree is still created — git does that — but the .gitignore courtesy is
  // skipped rather than silently reaching for `fs` behind the caller's back.
  const io = opts.io || null;

  if (!isGitRepo(root)) {
    return { ok: false, error: 'Not a git repository, so there is nothing to create a worktree from.' };
  }
  const nameError = validateWorktreeName(name);
  if (nameError) return { ok: false, error: nameError };

  const branch = opts.branch || name;
  const target = opts.path ? path.resolve(root, opts.path) : defaultWorktreePath(root, name);

  if (io && io.exists(target)) {
    return { ok: false, error: 'There is already something at ' + target + '. Pick another name, or remove it first.' };
  }
  // An unborn HEAD has no commit to branch from; git's own error here is
  // "invalid reference", which tells the user nothing about what to do.
  if (tryGit(root, ['rev-parse', '--verify', 'HEAD']) === null) {
    return {
      ok: false,
      error: 'This repository has no commits yet. Make the first commit, then create worktrees from it.',
    };
  }
  const branchExists = tryGit(root, ['rev-parse', '--verify', '--quiet', 'refs/heads/' + branch]) !== null;

  let ignoreAdded = false;
  const ignorePattern = ignorePatternFor(root, target);
  if (io && ignorePattern) {
    try {
      ignoreAdded = ensureIgnored(root, io.readFile, io.writeFile, ignorePattern);
    } catch (err) {
      ignoreAdded = false; // a read-only .gitignore is not a reason to fail the whole flow
    }
  }

  const args = branchExists
    ? ['worktree', 'add', target, branch]
    : ['worktree', 'add', '-b', branch, target];
  try {
    git(root, args);
  } catch (err) {
    return { ok: false, error: 'git could not create the worktree: ' + String(err.stderr || err.message).trim() };
  }

  return {
    ok: true,
    name: name,
    path: target,
    branch: branch,
    reusedBranch: branchExists,
    byConvention: !opts.path,
    gitignoreUpdated: ignoreAdded,
  };
}

/**
 * Remove a worktree, identified by convention name or by path.
 *
 * Refuses when the worktree has uncommitted changes, for the same reason
 * `safeEditCheck` refuses a modified file: the work exists nowhere else. The
 * caller can override with `force`, but has to say so.
 */
function removeWorktree(root, nameOrPath, options) {
  const opts = options || {};
  if (!isGitRepo(root)) {
    return { ok: false, error: 'Not a git repository.' };
  }
  const listed = listWorktrees(root);
  const target = listed.worktrees.filter(function (w) {
    return !w.isMain && (w.name === nameOrPath || w.path === path.resolve(root, nameOrPath));
  })[0];

  if (!target) {
    return { ok: false, error: 'No worktree named "' + nameOrPath + '". Run `workspace-kit worktree list` to see them.' };
  }

  if (!opts.force) {
    const summary = changeSummary(target.path, null);
    if (summary.isRepo && summary.files.length) {
      return {
        ok: false,
        error: target.name + ' has ' + summary.files.length
          + (summary.files.length === 1
            ? ' uncommitted change that exists nowhere else'
            : ' uncommitted changes that exist nowhere else')
          + '. Commit first, or remove it anyway with --force.',
        uncommitted: summary.files.map(function (f) { return f.path; }),
      };
    }
  }

  const args = ['worktree', 'remove'];
  if (opts.force) args.push('--force');
  args.push(target.path);
  try {
    git(root, args);
  } catch (err) {
    return { ok: false, error: 'git could not remove the worktree: ' + String(err.stderr || err.message).trim() };
  }
  // The branch is deliberately left behind: it may hold commits, and deleting
  // it is a separate, more destructive decision than removing a directory.
  return { ok: true, name: target.name, path: target.path, branch: target.branch };
}

module.exports = {
  STATE: STATE,
  WORKTREE_DIR: WORKTREE_DIR,
  isGitRepo: isGitRepo,
  currentBranch: currentBranch,
  fileStates: fileStates,
  annotate: annotate,
  changeSummary: changeSummary,
  describeChange: describeChange,
  safeEditCheck: safeEditCheck,
  buildCommitMessage: buildCommitMessage,
  validateWorktreeName: validateWorktreeName,
  defaultWorktreePath: defaultWorktreePath,
  listWorktrees: listWorktrees,
  createWorktree: createWorktree,
  removeWorktree: removeWorktree,
};
