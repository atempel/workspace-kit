#!/usr/bin/env node
/**
 * workspace//kit CLI.
 *
 * Currently carries one command, `doctor`, which is docs/specs/
 * workspace-health-check.md's (→ #78) P0 command surface. The generate flow --
 * the CLI's first command, docs/specs/cli-generator.md (→ #20) -- is not built
 * yet; this entry point exists so `doctor` can ship without waiting on it, and
 * is deliberately shaped to take more subcommands rather than to be a
 * doctor-specific script.
 *
 * Zero dependencies, no build step, same as the rest of core/.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const inspector = require('../core/inspect.js');
const doctor = require('../core/doctor.js');
const gitLayer = require('../core/git.js');
const webServer = require('../core/server.js');

const HELP = [
  'workspace//kit — workspace management and versioning for instructions and docs',
  '',
  'Usage: workspace-kit <command> [options]',
  '',
  'Commands:',
  '  doctor [dir]     Check a workspace\'s context health. Defaults to the current',
  '                   directory. Exits non-zero when the verdict is unhealthy, so it',
  '                   is usable in CI.',
  '  status [dir]     Show what has changed in the workspace, in plain language.',
  '  serve [dir]      Start the read-only local JSON server the Web App dashboard',
  '                   consumes. Binds to 127.0.0.1 only.',
  '  inspect [dir]    Dump the raw workspace index as JSON (debugging aid).',
  '',
  'Options:',
  '  --json           Machine-readable output instead of the terminal report.',
  '  --port <n>       Port for `serve` (default 4319).',
  '  --max-lines <n>  Override the always-loaded budget (default 300 lines, the',
  '                   figure from docs/specs/context-manager-conventions.md).',
  '  -h, --help       Show this help.',
  '',
  'Note on token figures: every token count reported is an estimate derived from',
  'characters ÷ 4, a rough approximation — not a tokenizer count. Treat it as an',
  'order-of-magnitude signal, not an exact number.',
].join('\n');

function parseArgs(argv) {
  const args = { command: null, dir: null, json: false, maxLines: null, port: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') args.help = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--max-lines') args.maxLines = parseInt(argv[++i], 10);
    else if (arg === '--port') args.port = parseInt(argv[++i], 10);
    else if (!args.command) args.command = arg;
    else if (!args.dir) args.dir = arg;
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);

  if (args.help || !args.command) {
    process.stdout.write(HELP + '\n');
    return 0;
  }

  const dir = path.resolve(args.dir || process.cwd());

  if (args.command === 'status') {
    const index = inspector.inspect(dir);
    const summary = gitLayer.changeSummary(dir, index);
    if (args.json) {
      process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
      return 0;
    }
    if (!summary.isRepo) {
      process.stdout.write('Not a git repository — no change tracking available here.\n');
      return 0;
    }
    if (!summary.files.length) {
      process.stdout.write('On ' + summary.branch + ': nothing has changed since the last commit.\n');
      return 0;
    }
    const out = ['On ' + summary.branch + ': ' + summary.files.length
      + (summary.files.length === 1 ? ' file has changed' : ' files have changed') + '.', ''];
    summary.files.forEach(function (f) {
      out.push('  ' + f.path + '  (' + f.what + ')');
    });
    out.push('', 'Suggested commit message:', '');
    gitLayer.buildCommitMessage(summary).split('\n').forEach(function (line) {
      out.push(line ? '  ' + line : '');
    });
    process.stdout.write(out.join('\n') + '\n');
    return 0;
  }

  if (args.command === 'serve') {
    const port = args.port || 4319;
    webServer.listen(dir, port, function (err, instance) {
      if (err) {
        process.stderr.write('Could not start the server: ' + err.message + '\n');
        process.exit(1);
      }
      const actual = instance.address().port;
      process.stdout.write('workspace//kit serving ' + dir + '\n');
      process.stdout.write('  http://' + webServer.HOST + ':' + actual + '/api/dashboard\n');
      process.stdout.write('Read-only; localhost only. Ctrl-C to stop.\n');
    });
    return null; // keep the process alive
  }

  if (args.command === 'inspect') {
    process.stdout.write(JSON.stringify(inspector.inspect(dir), null, 2) + '\n');
    return 0;
  }

  if (args.command === 'doctor') {
    const index = inspector.inspect(dir);
    const thresholds = {};
    if (args.maxLines) thresholds.alwaysLoadedLines = args.maxLines;
    const report = doctor.diagnose(index, {
      thresholds: thresholds,
      // The doctor is handed a reader rather than reaching for `fs` itself, so
      // there stays exactly one module in this codebase that touches the disk.
      readFile: function (rel) { return fs.readFileSync(path.join(dir, rel), 'utf8'); },
    });

    process.stdout.write(
      (args.json ? JSON.stringify(report, null, 2) : doctor.formatReport(report)) + '\n'
    );
    return report.verdict === doctor.VERDICT.UNHEALTHY ? 1 : 0;
  }

  process.stderr.write('Unknown command: ' + args.command + '\n\n' + HELP + '\n');
  return 2;
}

const code = main(process.argv.slice(2));
if (code !== null) process.exit(code);
