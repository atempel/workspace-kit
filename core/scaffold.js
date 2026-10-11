/**
 * workspace//kit — scaffold writer (the write-side of `workspace-kit new`).
 *
 * docs/specs/cli-generator.md (→ #20). core/generator.js turns inputs into an
 * in-memory file map and core/inspect.js reads a folder; this module is the
 * third piece: it puts a file map on disk. It lives apart from both on
 * purpose:
 *   - inspect.js stays the only module that *reads* the workspace, and stays
 *     read-only; a writer bolted onto it would end that guarantee.
 *   - generator.js stays pure (no fs), because it is also loaded in a browser.
 * Nothing here generates content. Every byte written comes from
 * generator.buildFileMap(); this module only decides where it goes, whether
 * it is safe to put it there, and (optionally) initialises a repository.
 *
 * Node-only, zero dependencies, no network. Git is driven with explicit
 * argument arrays, never a shell string (same rule as core/git.js).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const generator = require('./generator.js');

const DEFAULT_AGENTS = ['claude', 'agentsmd'];
const AGENT_KEYS = ['claude', 'agentsmd', 'cursor', 'copilot', 'gemini', 'windsurf', 'skill'];

function kebab(s) { return s.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); }
function camel(s) { return s.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }

/**
 * Generator-owned options beyond the fixed form fields. If the generator
 * exports an OPTIONS list ([{ key, type: 'boolean' | 'string' }]), every entry
 * becomes a `--kebab-key` / `--no-kebab-key` flag with no CLI change. Until it
 * does, `--set key=value` is the explicit escape hatch (see parseSet).
 */
function genericOptions() {
  const opts = Array.isArray(generator.OPTIONS) ? generator.OPTIONS : [];
  return opts.filter(function (o) { return o && o.key; }).map(function (o) {
    return { key: o.key, type: o.type || 'boolean', flag: kebab(o.key), label: o.label };
  });
}

function coerce(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

/** Split "a,b" into ['a','b'], trimming and dropping empties. */
function list(s) {
  return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
}

/** The kits the generator knows, for prompts and validation. */
function kitKeys() { return Object.keys(generator.KIT_CONFIG); }

/** Resolve a user-typed kit (key, 1-based number, or label) to a key, or null. */
function resolveKit(v) {
  if (v == null) return null;
  const keys = kitKeys();
  const s = String(v).trim().toLowerCase();
  if (keys.indexOf(s) !== -1) return s;
  if (/^\d+$/.test(s) && keys[Number(s) - 1]) return keys[Number(s) - 1];
  for (let i = 0; i < keys.length; i++) {
    const lab = generator.KIT_CONFIG[keys[i]].label;
    if (lab.en.toLowerCase() === s || lab.pt.toLowerCase() === s) return keys[i];
  }
  return null;
}

/** Folder checks for a kit in a language, with the form's default ticks. */
function folderChoices(kit, lang) {
  const cfg = generator.KIT_CONFIG[kit];
  return cfg.checks.map(function (c, i) {
    return { name: c.folder[lang], label: c.label[lang], localOnly: !!c.localOnly, checked: !!cfg.defaults[i] };
  });
}

/**
 * Turn collected options into the input object buildFileMap() expects.
 * `opts` holds name/kit/lang/desc/obj/stack/limits, `agents` (array of keys),
 * `folders` (array of names, or null for the kit's defaults), and `extra`
 * (generator-owned options, merged onto the input untouched).
 * Throws Error with a user-facing message on invalid values.
 */
function buildInput(opts) {
  const lang = opts.lang || 'en';
  if (lang !== 'en' && lang !== 'pt') throw new Error('Unknown language "' + lang + '". Expected en or pt.');
  const kit = resolveKit(opts.kit == null ? kitKeys()[0] : opts.kit);
  if (!kit) throw new Error('Unknown kit "' + opts.kit + '". Expected one of: ' + kitKeys().join(', ') + '.');

  const agentKeys = opts.agents || DEFAULT_AGENTS;
  const agents = {};
  AGENT_KEYS.forEach(function (k) { agents[k] = false; });
  agentKeys.forEach(function (k) {
    if (AGENT_KEYS.indexOf(k) === -1) throw new Error('Unknown agent "' + k + '". Expected any of: ' + AGENT_KEYS.join(', ') + '.');
    agents[k] = true;
  });

  const choices = folderChoices(kit, lang);
  let selected;
  if (opts.folders == null) {
    selected = choices.filter(function (c) { return c.checked; });
  } else {
    selected = opts.folders.map(function (n) {
      const hit = choices.filter(function (c) { return c.name === n; })[0];
      if (!hit) throw new Error('Kit "' + kit + '" has no folder "' + n + '". Choices: ' + choices.map(function (c) { return c.name; }).join(', ') + '.');
      return hit;
    });
  }

  const input = {
    name: opts.name || '', kit: kit, lang: lang, desc: opts.desc || '', obj: opts.obj || '',
    stack: opts.stack || '', limits: opts.limits || '',
    folders: selected.map(function (c) { return { name: c.name, localOnly: c.localOnly }; }),
    agents: agents,
  };
  Object.keys(opts.extra || {}).forEach(function (k) { input[k] = opts.extra[k]; });
  return input;
}

/** Parse "key=value" into {path, value}. A dotted path (agents.skill) nests. */
function parseSet(s) {
  const i = String(s).indexOf('=');
  if (i < 1) throw new Error('--set expects key=value, got "' + s + '".');
  return { path: s.slice(0, i), value: coerce(s.slice(i + 1)) };
}

/** Where a relative file path would land; refuses anything escaping dir. */
function target(dir, rel) {
  const full = path.resolve(dir, rel);
  if (full !== dir && full.indexOf(dir + path.sep) !== 0) throw new Error('Refusing to write outside ' + dir + ': ' + rel);
  return full;
}

/**
 * Decide whether writing `files` into `dir` is allowed, without touching it.
 * Returns { ok, exists, empty, overwrites:[rel], error }. A missing directory
 * and an empty one are both fine; a non-empty one needs `force`.
 */
function plan(dir, files, force) {
  const paths = Object.keys(files);
  paths.forEach(function (p) { target(dir, p); });
  if (!fs.existsSync(dir)) return { ok: true, exists: false, empty: true, overwrites: [], paths: paths };
  if (!fs.statSync(dir).isDirectory()) {
    return { ok: false, error: dir + ' exists and is not a directory.', paths: paths };
  }
  // A bare `.git` does not make a folder "populated": initialising first and
  // running `new` afterwards is a normal order of operations.
  const entries = fs.readdirSync(dir).filter(function (e) { return e !== '.git'; });
  const overwrites = paths.filter(function (p) { return fs.existsSync(target(dir, p)); });
  if (entries.length && !force) {
    return {
      ok: false, exists: true, empty: false, overwrites: overwrites, paths: paths,
      error: dir + ' is not empty (' + entries.length + (entries.length === 1 ? ' entry' : ' entries') + '). '
        + 'Nothing was written. Pick an empty or new folder, or pass --force to write into it '
        + '(files with the same names will be overwritten; others are left alone).',
    };
  }
  return { ok: true, exists: true, empty: !entries.length, overwrites: overwrites, paths: paths };
}

/** Write the file map. Callers run plan() first; this re-checks nothing. */
function write(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  Object.keys(files).forEach(function (rel) {
    const full = target(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, files[rel]);
  });
  return Object.keys(files);
}

function runGit(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * `git init` the folder and, unless opts.commit is false, make the first
 * commit. An existing repository is left strictly alone (no init, no commit):
 * `new --force` into a repo must not touch history. A commit that fails
 * (typically no user.name/email configured) is reported, not fatal: the files
 * are already written and the init succeeded.
 */
function gitInit(dir, opts) {
  opts = opts || {};
  const res = { initialized: false, committed: false, existing: false, warning: null };
  let top = null;
  try { top = runGit(dir, ['rev-parse', '--show-toplevel']).trim(); } catch (e) { /* not a repo */ }
  if (top && fs.realpathSync(top) === fs.realpathSync(dir)) { res.existing = true; return res; }
  runGit(dir, ['init', '-q']);
  res.initialized = true;
  if (opts.commit === false) return res;
  try {
    runGit(dir, ['add', '-A']);
    runGit(dir, ['commit', '-q', '-m', 'Initial workspace', '-m', 'Generated by workspace//kit.']);
    res.committed = true;
  } catch (err) {
    res.warning = 'git init succeeded but the first commit did not ('
      + String(err.stderr || err.message).trim().split('\n')[0]
      + '). Set user.name and user.email, then commit yourself.';
  }
  return res;
}

module.exports = {
  DEFAULT_AGENTS: DEFAULT_AGENTS,
  AGENT_KEYS: AGENT_KEYS,
  genericOptions: genericOptions,
  kebab: kebab,
  camel: camel,
  coerce: coerce,
  list: list,
  kitKeys: kitKeys,
  resolveKit: resolveKit,
  folderChoices: folderChoices,
  buildInput: buildInput,
  parseSet: parseSet,
  plan: plan,
  write: write,
  gitInit: gitInit,
};
