/**
 * workspace//kit — workspace health check ("system doctor").
 *
 * Implements docs/specs/workspace-health-check.md (→ #78). Measures a
 * workspace's context footprint against concrete thresholds and turns findings
 * into specific, actionable suggestions.
 *
 * The division of labour with core/inspect.js (#77) is deliberate and worth
 * keeping sharp: inspect.js *reports* (what files exist, how big, what they
 * reference), this module *judges* (is that too big, what should you do about
 * it). diagnose() therefore takes an index, not a folder path -- it never walks
 * the filesystem itself, so there is exactly one workspace parser in this
 * codebase and no way for the two to drift.
 *
 * Zero runtime dependencies, no build step, Node-only -- same conventions as
 * core/generator.js and core/inspect.js. To test: `npm run test:doctor`.
 */

'use strict';

const inspector = require('./inspect.js');

/**
 * The ~300-line always-loaded figure comes from
 * docs/specs/context-manager-conventions.md (→ #34) and is deliberately not
 * reinvented here; the ~15-entry rotation trigger is that same spec's ADR
 * policy. The *banding* around those anchors is this module's proposal (the
 * spec flags it as an open product question): warning once a file reaches 90%
 * of the limit, over-budget once it passes it. That satisfies #78's own
 * acceptance criterion -- 250 lines healthy, 300 warning, 400 over-budget --
 * and keeps a single knob (`warnRatio`) to retune rather than three numbers.
 */
const DEFAULT_THRESHOLDS = {
  alwaysLoadedLines: 300,
  decisionEntries: 15,
  warnRatio: 0.9,
};

const TOKEN_METHOD = 'characters ÷ 4 (approximate, not a tokenizer count)';

const STATUS = { HEALTHY: 'healthy', WARNING: 'warning', OVER: 'over-budget' };
const VERDICT = { HEALTHY: 'healthy', ATTENTION: 'needs-attention', UNHEALTHY: 'unhealthy' };

/**
 * Files an agent loads by default at the start of every session. Skills are
 * excluded on purpose: a SKILL.md is read when the skill is invoked, not up
 * front, so counting it would inflate the budget this figure exists to
 * protect.
 */
function isAlwaysLoaded(file) {
  if (file.layer !== inspector.LAYER.AGENT) return false;
  return file.path.indexOf('.claude/skills/') !== 0;
}

function band(value, limit, thresholds) {
  if (value > limit) return STATUS.OVER;
  if (value >= limit * thresholds.warnRatio) return STATUS.WARNING;
  return STATUS.HEALTHY;
}

/**
 * Entries in a decision-log-style file. Dated `## YYYY-MM-DD` headings are the
 * convention core/generator.js writes and this repo follows, so they are
 * counted when present -- that avoids miscounting an index or policy section as
 * an entry. A log that does not use dated headings falls back to counting all
 * level-2 headings.
 */
function countLogEntries(text) {
  const dated = text.match(/^##\s+\d{4}-\d{2}-\d{2}/gm);
  if (dated && dated.length) return dated.length;
  const headings = text.match(/^##\s+\S/gm);
  return headings ? headings.length : 0;
}

function suggestion(kind, file, message, severity) {
  return { kind: kind, file: file, message: message, severity: severity };
}

function plural(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

/**
 * Diagnose a workspace from an inspection index.
 *
 * @param {object} index                 output of inspector.inspect()
 * @param {object} [options]
 * @param {object} [options.thresholds]  override DEFAULT_THRESHOLDS
 * @param {function} [options.readFile]  (path) => string, used only to count
 *        log entries; injected so this module never touches `fs` itself
 * @returns {object} the health report
 */
function diagnose(index, options) {
  const opts = options || {};
  const thresholds = Object.assign({}, DEFAULT_THRESHOLDS, opts.thresholds || {});
  const suggestions = [];

  if (!index.isWorkspace) {
    return {
      verdict: VERDICT.UNHEALTHY,
      isWorkspace: false,
      reason: index.detection.reason,
      budget: null,
      files: [],
      growth: [],
      crossReferences: { total: 0, broken: [] },
      suggestions: [],
      method: { tokenEstimate: TOKEN_METHOD, thresholds: thresholds },
    };
  }

  // --- per-file status, over the always-loaded set -------------------------
  const files = index.files.map(function (file) {
    const alwaysLoaded = isAlwaysLoaded(file);
    const status = alwaysLoaded && file.lines !== null
      ? band(file.lines, thresholds.alwaysLoadedLines, thresholds)
      : STATUS.HEALTHY;
    return {
      path: file.path,
      layer: file.layer,
      alwaysLoaded: alwaysLoaded,
      bytes: file.bytes,
      lines: file.lines,
      chars: file.chars,
      tokensEstimate: file.tokensEstimate,
      status: status,
    };
  });

  files.forEach(function (file) {
    if (file.status === STATUS.HEALTHY) return;
    const over = file.lines - thresholds.alwaysLoadedLines;
    const largest = largestSectionOf(index, file.path);
    const where = largest
      ? ' Its largest section is "' + largest.heading + '" (' + plural(largest.lines, 'line') + ', '
        + 'lines ' + largest.startLine + '-' + largest.endLine + ') — the obvious candidate to move '
        + 'into an on-demand file the agent reads only when it is relevant.'
      : '';
    if (file.status === STATUS.OVER) {
      suggestions.push(suggestion('split-file', file.path,
        file.path + ' is ' + plural(file.lines, 'line') + ', ' + plural(over, 'line') + ' over the '
        + thresholds.alwaysLoadedLines + '-line always-loaded budget.' + where, 'high'));
    } else {
      suggestions.push(suggestion('move-prose', file.path,
        file.path + ' is ' + plural(file.lines, 'line') + ', approaching the '
        + thresholds.alwaysLoadedLines + '-line always-loaded budget.' + where, 'medium'));
    }
  });

  // --- always-loaded context budget ---------------------------------------
  const loaded = files.filter(function (f) { return f.alwaysLoaded; });
  const budget = {
    files: loaded.length,
    lines: loaded.reduce(function (n, f) { return n + (f.lines || 0); }, 0),
    tokensEstimate: loaded.reduce(function (n, f) { return n + (f.tokensEstimate || 0); }, 0),
    lineCap: thresholds.alwaysLoadedLines,
    status: STATUS.HEALTHY,
  };
  budget.status = band(budget.lines, thresholds.alwaysLoadedLines, thresholds);
  budget.pctOfCap = thresholds.alwaysLoadedLines
    ? Math.round((budget.lines / thresholds.alwaysLoadedLines) * 100)
    : 0;

  // --- history / log growth ------------------------------------------------
  const growth = [];
  if (opts.readFile) {
    index.files.forEach(function (file) {
      if (!/^(DECISIONS|CHANGELOG)\.md$/.test(file.path)) return;
      let text;
      try {
        text = opts.readFile(file.path);
      } catch (err) {
        return;
      }
      const entries = countLogEntries(text);
      const status = band(entries, thresholds.decisionEntries, thresholds);
      growth.push({
        path: file.path,
        entries: entries,
        threshold: thresholds.decisionEntries,
        pctOfThreshold: Math.round((entries / thresholds.decisionEntries) * 100),
        status: status,
      });
      const count = entries + (entries === 1 ? ' entry' : ' entries');
      if (status === STATUS.OVER) {
        suggestions.push(suggestion('rotate-log', file.path,
          file.path + ' holds ' + count + ', past the ~' + thresholds.decisionEntries
          + '-entry rotation trigger. Move the oldest ' + (entries - thresholds.decisionEntries)
          + ' into individual files under `decisions/` and leave a one-line index entry with a '
          + 'link, per the ADR policy in docs/specs/context-manager-conventions.md.', 'medium'));
      } else if (status === STATUS.WARNING) {
        // A warning with no suggestion attached is just noise -- the user is
        // told something is off and given nothing to do about it. Caught by
        // running this against workspace//kit's own repo, which sat at 14/15.
        const gap = thresholds.decisionEntries - entries;
        suggestions.push(suggestion('rotate-log', file.path,
          file.path + ' holds ' + count + ', ' + (gap === 0
            ? 'exactly at the ~' + thresholds.decisionEntries + '-entry rotation trigger. The next '
              + 'entry crosses it'
            : gap + ' short of the ~' + thresholds.decisionEntries + '-entry rotation trigger. '
              + 'Nothing to do yet, but the next entries will cross it')
          + ' — plan to move the oldest ones into `decisions/` per the ADR policy in '
          + 'docs/specs/context-manager-conventions.md.', 'low'));
      }
    });
  }

  // --- cross-references ----------------------------------------------------
  const broken = index.graph.edges.filter(function (edge) { return !edge.resolved; });
  broken.forEach(function (edge) {
    suggestions.push(suggestion('broken-reference', edge.from,
      edge.from + ':' + edge.line + ' references `' + edge.to + '`, which does not exist in this '
      + 'workspace. Either create it or drop the reference — a dead link costs the agent a lookup '
      + 'and teaches it a file exists when it does not.', 'high'));
  });

  // Stale-instruction detection is scoped to the mechanically-detectable case,
  // exactly as #78's own Open Questions propose for v1: an instruction section
  // that points at a file the workspace no longer has. Judging an instruction
  // "obsolete but still linked" needs real usage data first, so it is not
  // guessed at here.
  const brokenByFile = {};
  broken.forEach(function (edge) {
    (brokenByFile[edge.from] = brokenByFile[edge.from] || []).push(edge);
  });
  index.instructions.forEach(function (unit) {
    const edges = (brokenByFile[unit.file] || []).filter(function (edge) {
      return edge.line >= unit.startLine && edge.line <= unit.endLine;
    });
    if (!edges.length) return;
    suggestions.push(suggestion('stale-instruction', unit.file,
      'The instruction "' + (unit.heading || 'preamble') + '" (' + unit.file + ':' + unit.startLine
      + '-' + unit.endLine + ') references ' + edges.map(function (e) { return '`' + e.to + '`'; }).join(', ')
      + ', which no longer exists. Likely stale — review whether the instruction still applies.', 'medium'));
  });

  // --- overall verdict -----------------------------------------------------
  const anyOver = files.some(function (f) { return f.status === STATUS.OVER; })
    || growth.some(function (g) { return g.status === STATUS.OVER; })
    || budget.status === STATUS.OVER;
  const anyWarning = files.some(function (f) { return f.status === STATUS.WARNING; })
    || growth.some(function (g) { return g.status === STATUS.WARNING; })
    || budget.status === STATUS.WARNING
    || broken.length > 0;

  return {
    verdict: anyOver ? VERDICT.UNHEALTHY : anyWarning ? VERDICT.ATTENTION : VERDICT.HEALTHY,
    isWorkspace: true,
    budget: budget,
    files: files,
    growth: growth,
    crossReferences: { total: index.graph.edges.length, broken: broken },
    suggestions: suggestions,
    method: { tokenEstimate: TOKEN_METHOD, thresholds: thresholds },
  };
}

/** The biggest heading section in a file — what to move when it is oversized. */
function largestSectionOf(index, filePath) {
  let best = null;
  index.instructions.forEach(function (unit) {
    if (unit.file !== filePath || !unit.heading) return;
    const lines = unit.endLine - unit.startLine + 1;
    if (!best || lines > best.lines) {
      best = { heading: unit.heading, lines: lines, startLine: unit.startLine, endLine: unit.endLine };
    }
  });
  return best;
}

/** Render a report as a human-readable terminal summary. */
function formatReport(report) {
  const out = [];
  const mark = { healthy: 'ok', warning: '!!', 'over-budget': 'XX' };

  if (!report.isWorkspace) {
    out.push('Not a workspace//kit workspace.');
    out.push('  ' + report.reason);
    return out.join('\n');
  }

  out.push('Verdict: ' + report.verdict.toUpperCase());
  out.push('');
  out.push('Always-loaded context budget');
  out.push('  ' + report.budget.lines + ' lines across ' + plural(report.budget.files, 'file')
    + '  (~' + report.budget.tokensEstimate + ' tokens, ' + report.budget.pctOfCap + '% of the '
    + report.budget.lineCap + '-line target)  [' + mark[report.budget.status] + ']');
  out.push('  Token figures are ' + report.method.tokenEstimate + '.');

  const loaded = report.files.filter(function (f) { return f.alwaysLoaded; });
  if (loaded.length) {
    out.push('');
    out.push('Always-loaded files');
    loaded.forEach(function (f) {
      out.push('  [' + mark[f.status] + '] ' + pad(f.path, 40) + pad(f.lines + ' lines', 12)
        + '~' + f.tokensEstimate + ' tokens');
    });
  }

  if (report.growth.length) {
    out.push('');
    out.push('History growth');
    report.growth.forEach(function (g) {
      out.push('  [' + mark[g.status] + '] ' + pad(g.path, 40)
        + g.entries + '/' + g.threshold + ' entries before rotation');
    });
  }

  out.push('');
  out.push('Cross-references: ' + report.crossReferences.total + ' total, '
    + report.crossReferences.broken.length + ' broken');

  out.push('');
  if (!report.suggestions.length) {
    // Only claim the all-clear when the verdict actually is one, so the report
    // can never contradict its own headline.
    out.push(report.verdict === VERDICT.HEALTHY
      ? 'No suggestions — this workspace is within every threshold.'
      : 'No suggestions, but the verdict is ' + report.verdict + ' — see the sections above.');
  } else {
    out.push('Suggestions (' + report.suggestions.length + ')');
    report.suggestions.forEach(function (s, i) {
      out.push('  ' + (i + 1) + '. [' + s.severity + '] ' + s.message);
    });
  }
  return out.join('\n');
}

function pad(text, width) {
  return text.length >= width ? text + '  ' : text + new Array(width - text.length + 1).join(' ');
}

module.exports = {
  diagnose: diagnose,
  formatReport: formatReport,
  countLogEntries: countLogEntries,
  isAlwaysLoaded: isAlwaysLoaded,
  DEFAULT_THRESHOLDS: DEFAULT_THRESHOLDS,
  TOKEN_METHOD: TOKEN_METHOD,
  STATUS: STATUS,
  VERDICT: VERDICT,
};
