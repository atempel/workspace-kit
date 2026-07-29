/**
 * workspace//kit — git integration layer (read side + safe-edit substrate).
 *
 * Implements the unblocked half of docs/specs/git-integration-layer.md (→ #79):
 * file-state tracking, the safe-edit check, a plain-language change summary,
 * and a templated commit message.
 *
 * Deliberately NOT here, because both are gated on product decisions the spec
 * flags as open and neither should be guessed at:
 *   - the PR flow, which depends on the hosting-provider scope question
 *     (GitHub-only via `gh`, or provider-agnostic)
 *   - worktree create/list/remove, which depends on the placement/naming
 *     question (auto-placed with a convention, or prompted every time)
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

module.exports = {
  STATE: STATE,
  isGitRepo: isGitRepo,
  currentBranch: currentBranch,
  fileStates: fileStates,
  annotate: annotate,
  changeSummary: changeSummary,
  describeChange: describeChange,
  safeEditCheck: safeEditCheck,
  buildCommitMessage: buildCommitMessage,
};
