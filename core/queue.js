/**
 * workspace//kit — queue writer (the write-side of `workspace-kit queue`).
 *
 * docs/specs/document-ingestion-queue.md (→ #80, stub generation #104). The
 * queue is a folder of one-file-per-reference stubs in a fixed format.
 * core/inspect.js is the only module that *reads* them (`index.queue`), and
 * stays read-only; this module only creates a stub and flips one in place to
 * ingested, exactly as scaffold.js is the writer for `new`. The format here is
 * the one parseQueueItem() reads, and a test round-trips it through inspect so
 * the two cannot drift.
 *
 * Deterministic text only: no model, no network. Zero dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const QUEUE_DIR = 'queue';
const TYPES = ['Voice note', 'Document', 'Link', 'Board', 'Other'];

function today() {
  const d = new Date();
  const p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function oneLine(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

/** Kebab-case, ASCII-folded; falls back to "item" for titles with no letters. */
function slugify(title) {
  const slug = oneLine(title)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60).replace(/-+$/, '');
  return slug || 'item';
}

function resolveType(type) {
  const t = oneLine(type);
  if (!t) return 'Other';
  const hit = TYPES.filter(function (k) { return k.toLowerCase() === t.toLowerCase(); })[0];
  return hit || null;
}

/** The stub text, per the spec's fixed format. */
function buildStub(fields) {
  const lines = [
    '# Queue item — ' + oneLine(fields.title), '',
    '- **Type:** ' + fields.type,
    '- **Source:** ' + oneLine(fields.source),
    '- **Added:** ' + fields.added,
    '- **Status:** Pending', '',
    '## Notes',
  ];
  const note = String(fields.note || '').trim();
  lines.push(note || '<!-- what this covers, why it was saved, what to extract when ingesting -->');
  return lines.join('\n') + '\n';
}

/**
 * Create queue/<date>-<slug>.md under `root`. Never overwrites: the file is
 * opened exclusively, so a clash is an error, not a race.
 */
function add(root, input) {
  input = input || {};
  const title = oneLine(input.title);
  if (!title) return { ok: false, error: 'A title is required.' };
  const source = oneLine(input.source);
  if (!source) return { ok: false, error: 'A source is required (a URL or a short description).' };
  const type = resolveType(input.type);
  if (!type) return { ok: false, error: 'Unknown type "' + input.type + '". Expected one of: ' + TYPES.join(', ') + '.' };

  const added = input.date || today();
  const name = added + '-' + slugify(title) + '.md';
  const rel = QUEUE_DIR + '/' + name;
  const abs = path.join(root, QUEUE_DIR, name);
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buildStub({ title: title, type: type, source: source, added: added, note: input.note }), { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') return { ok: false, error: rel + ' already exists — refusing to overwrite it. Use a different title.' };
    return { ok: false, error: e.message };
  }
  return { ok: true, path: rel, absolute: abs };
}

/** Resolve a user-given name/path to a stub directly inside queue/, or null. */
function resolveStub(root, file) {
  const dir = path.resolve(root, QUEUE_DIR);
  const candidates = [path.resolve(root, file), path.resolve(dir, file)];
  for (const abs of candidates) {
    if (path.dirname(abs) === dir && fs.existsSync(abs)) return abs;
  }
  return null;
}

/**
 * Mark a stub ingested by editing its own Status field in place, and record
 * where it went on an "Ingested into" line (replacing one if present).
 */
function markDone(root, file, into, options) {
  const date = (options && options.date) || today();
  const abs = resolveStub(root, file);
  if (!abs) return { ok: false, error: 'No such queue item inside ' + QUEUE_DIR + '/: ' + file };
  const destination = oneLine(into);
  if (!destination) return { ok: false, error: 'Say where it went with --into <file or section>.' };

  const rel = QUEUE_DIR + '/' + path.basename(abs);
  const text = fs.readFileSync(abs, 'utf8');
  const statusRe = /^(\s*[-*]\s*\*\*Status:\*\*)\s*(.+?)\s*$/m;
  const m = statusRe.exec(text);
  if (!m) return { ok: false, error: rel + ' has no Status field to update.' };
  if (/^ingested/i.test(m[2])) return { ok: false, error: rel + ' is already marked ' + m[2] + '.' };

  let next = text.replace(statusRe, function (_all, head) { return head + ' Ingested (' + date + ')'; });
  const intoRe = /^(\s*[-*]\s*\*\*Ingested into:\*\*).*$/m;
  if (intoRe.test(next)) {
    next = next.replace(intoRe, function (_all, head) { return head + ' ' + destination; });
  } else {
    next = next.replace(/^(\s*[-*]\s*\*\*Status:\*\*.*)$/m, function (line) {
      return line + '\n- **Ingested into:** ' + destination;
    });
  }
  fs.writeFileSync(abs, next);
  return { ok: true, path: rel, date: date, into: destination };
}

module.exports = { QUEUE_DIR: QUEUE_DIR, TYPES: TYPES, slugify: slugify, buildStub: buildStub, add: add, markDone: markDone };
